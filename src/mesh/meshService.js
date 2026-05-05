import { OfflineProtocol } from '@offline-protocol/mesh-sdk';
import { EventEmitter } from 'events';
import { getDeviceId } from '../storage/deviceId';
import { getSystemState, updateSystemState, addToRetryBudget, getQueueDelay } from '../utils/modelStorage';

const DEBOUNCE_MS = 500;
const INIT_TIMEOUT_MS = 10000;
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_SEEN_MESSAGES = 1000;
const MAX_CONCURRENT_SENDS = 2;

class MeshService extends EventEmitter {
  constructor() {
    super();
    this.protocol = null;
    this.userId = null;
    this.shortId = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.restartDebounceTimer = null;
    this.pendingRestart = false;
    this.messageQueue = [];
    this.pendingAcks = new Map();
    this.retryCounters = new Map();
    this.seenMessageIds = new Set();
    this.activeSends = 0;
    this.peerCount = 0;
    this.networkQuality = 'unknown';
    this.retryCount = 0;
    this.totalRetries = 0;
  }

  _validateListener(listener, methodName) {
    if (typeof listener !== 'function') {
      console.warn(`[MESH] Invalid listener for ${methodName}: expected function, got`, typeof listener);
      return false;
    }
    return true;
  }

  on(eventName, listener) {
    if (!this._validateListener(listener, '.on()')) return this;
    return super.on(eventName, listener);
  }

  addListener(eventName, listener) {
    return this.on(eventName, listener);
  }

  once(eventName, listener) {
    if (!this._validateListener(listener, '.once()')) return this;
    return super.once(eventName, listener);
  }

  prependListener(eventName, listener) {
    if (!this._validateListener(listener, '.prependListener()')) return this;
    return super.prependListener(eventName, listener);
  }

  prependOnceListener(eventName, listener) {
    if (!this._validateListener(listener, '.prependOnceListener()')) return this;
    return super.prependOnceListener(eventName, listener);
  }

  off(eventName, listener) {
    return super.removeListener(eventName, listener);
  }

  async init() {
    if (this.isInitialized && this.protocol) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    try {
      this.userId = await getDeviceId();
      this.shortId = this.userId.substring(0, 6);

      this.protocol = new OfflineProtocol({
        appId: 'CrisisNet',
        userId: this.userId,
        transports: {
          ble: { enabled: true },
          internet: { enabled: false },
          wifiDirect: { enabled: false }
        },
        encryption: {
            enabled: true
        }
      });

      this.protocol.on('message_received', (message) => {
        this.emit('message_received', message);
      });

      this.protocol.on('neighbor_discovered', (peer) => {
        this.emit('peer_discovered', { id: peer.peer_id, ...peer });
        this.peerCount++;
        this._updateNetworkQuality();
      });

      this.protocol.on('neighbor_lost', (peer) => {
        this.emit('peer_lost', { id: peer.peer_id, ...peer });
        this.peerCount = Math.max(0, this.peerCount - 1);
        this._updateNetworkQuality();
      });

      this.protocol.on('started', () => {
        this.emit('started');
        this.emit('scanning');
        this.emit('advertising');
      });

      this.protocol.on('stopped', () => {
        this.emit('stopped');
      });

      this.protocol.on('error', (error) => {
        this.emit('error', error);
      });

      const startPromise = this.protocol.start();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Mesh init timeout')), INIT_TIMEOUT_MS)
      );

      await Promise.race([startPromise, timeoutPromise]);
      this.isInitialized = true;
      await this._updateSystemState();
      return true;
    } catch (error) {
      console.error('[MESH] Initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  _updateNetworkQuality() {
    let quality = 'good';
    if (this.peerCount === 0) {
      quality = 'poor';
    } else if (this.peerCount === 1) {
      quality = 'fair';
    }
    this.networkQuality = quality;
    this._updateSystemState();
  }

  async _updateSystemState() {
    try {
      await updateSystemState({
        networkQuality: this.networkQuality,
        activeTasks: this.messageQueue.length > 0 ? ['mesh_send'] : [],
      });
    } catch (e) {
      // ignore
    }
  }

  emit(eventName, ...args) {
    const listeners = this._events[eventName];
    if (listeners) {
      const listenerArray = Array.isArray(listeners) ? listeners : [listeners];
      let promiseChain = Promise.resolve();
      for (const listener of listenerArray) {
        if (typeof listener === 'function') {
          promiseChain = promiseChain.then(() => {
            try {
              return listener(...args);
            } catch (e) {
              console.warn(`[MESH] Listener error for "${eventName}":`, e.message);
            }
          });
        }
      }
    }
  }

  async restart() {
    if (this.restartDebounceTimer) {
      this.pendingRestart = true;
      return;
    }

    const doRestart = async () => {
      this.restartDebounceTimer = setTimeout(() => {
        this.restartDebounceTimer = null;
        if (this.pendingRestart) {
          this.pendingRestart = false;
          doRestart();
        }
      }, DEBOUNCE_MS);

      if (this.protocol) {
        try {
          await this.protocol.stop();
        } catch (e) {
          console.warn('[MESH] Error stopping protocol:', e.message);
        }
        this.protocol = null;
        this.isInitialized = false;
      }

      await this.init();
    };

    return doRestart();
  }

  getDeviceShortId() {
    return this.shortId || this.userId?.substring(0, 6) || 'unknown';
  }

  async sendMessage(payload) {
    if (!this.protocol) {
      this.enqueueMessage(payload);
      throw new Error('Mesh not initialized - message queued');
    }

    const systemState = await getSystemState();
    const queueDelay = getQueueDelay(this.retryCount, systemState.networkQuality);
    if (queueDelay > 100) {
      await new Promise(resolve => setTimeout(resolve, queueDelay));
    }

    const messageId = payload.id || Math.random().toString(36).substring(7);
    
    if (this.seenMessageIds.has(messageId)) {
      return { id: messageId, duplicate: true };
    }
    this.seenMessageIds.add(messageId);
    if (this.seenMessageIds.size > MAX_SEEN_MESSAGES) {
      const firstKey = this.seenMessageIds.values().next().value;
      this.seenMessageIds.delete(firstKey);
    }

    while (this.activeSends >= MAX_CONCURRENT_SENDS) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    this.activeSends++;

    try {
      const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      const result = await this.protocol.sendMessage({ 
        recipient: 'broadcast', 
        content,
        messageId
      });
      
      this.pendingAcks.set(messageId, {
        payload,
        timestamp: Date.now(),
        retries: 0
      });
      
      setTimeout(() => this.checkAckTimeout(messageId), 10000);
      
      return { id: result };
    } catch (error) {
      console.error('[MESH] Broadcast failed:', error);
      this.enqueueMessage(payload);
      throw error;
    } finally {
      this.activeSends--;
    }
  }

  enqueueMessage(payload) {
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      this.messageQueue.shift();
    }
    this.messageQueue.push({
      id: payload.id || Math.random().toString(36).substring(7),
      payload,
      timestamp: Date.now(),
      retries: 0
    });
  }

  async flushQueue() {
    if (!this.protocol || this.messageQueue.length === 0) return;
    
    const queueCopy = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const item of queueCopy) {
      try {
        await this.sendMessage(item.payload);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('[MESH] Failed to send queued message:', e.message);
      }
    }
  }

  checkAckTimeout(messageId) {
    const pending = this.pendingAcks.get(messageId);
    if (pending && pending.retries < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, pending.retries);
      setTimeout(() => {
        this.retryMessage(messageId);
      }, delay);
    } else if (pending) {
      this.pendingAcks.delete(messageId);
    }
  }

  async retryMessage(messageId) {
    const pending = this.pendingAcks.get(messageId);
    if (!pending) return;
    
    pending.retries++;
    this.retryCount++;
    this.totalRetries++;
    
    try {
      const result = await this.protocol.sendMessage({
        recipient: 'broadcast',
        content: JSON.stringify(pending.payload),
        messageId
      });
      setTimeout(() => this.checkAckTimeout(messageId), 10000);
    } catch (e) {
      console.error('[MESH] Retry failed:', e.message);
      if (pending.retries >= MAX_RETRIES) {
        this.pendingAcks.delete(messageId);
      }
    }
  }

  async stop() {
    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
      this.restartDebounceTimer = null;
      this.pendingRestart = false;
    }
    
    if (this.protocol) {
      await this.protocol.stop();
      this.protocol = null;
      this.isInitialized = false;
      this.emit('stopped');
    }
  }

  async pause() {
    if (this.protocol) {
      await this.protocol.pause();
      this.emit('paused');
    }
  }

  async resume() {
    if (this.protocol) {
      await this.protocol.resume();
      this.emit('resumed');
    }
  }

  getStats() {
    return {
      peerCount: this.peerCount,
      networkQuality: this.networkQuality,
      messageQueueSize: this.messageQueue.length,
      pendingAcks: this.pendingAcks.size,
      retryCount: this.retryCount,
      totalRetries: this.totalRetries,
    };
  }
}

const meshService = new MeshService();
export default meshService;