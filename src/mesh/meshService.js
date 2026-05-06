// CrisisNet mesh transport — wraps @offline-protocol/mesh-sdk.
//
// We use the SDK because it provides the BLE peripheral side that
// react-native-ble-manager doesn't: GATT server, advertising, fragmentation,
// retries, dedup, multi-hop relay. With this wiring two phones running
// CrisisNet can actually discover each other and exchange messages.
//
// We preserve the legacy event/method surface used by MeshContext etc., so
// callers don't need to change. Internally:
//
//   SDK event                            re-emitted as
//   ----------------------------         -------------
//   neighbor_discovered           ->     peer_discovered
//   neighbor_lost                 ->     peer_lost
//   message_received              ->     message_received  (shape adapted)
//   diagnostic                    ->     (forwarded as console)
//   transport_switched / *        ->     (logged)
//
// Outgoing API:
//   meshService.init()                 -> Promise<bool>
//   meshService.stop()                 -> Promise<void>
//   meshService.sendMessage(payload)   -> { id, queued?, duplicate? }
//   meshService.getDeviceShortId()     -> string
//   meshService.flushQueue()           -> Promise<void>
//   meshService.getStats()             -> { peerCount, networkQuality, ... }
//   meshService.restart() / pause / resume
//   .on('peer_discovered'|'peer_lost'|'message_received'|'started'|'stopped'|
//       'scanning'|'advertising'|'paused'|'resumed'|'error', listener)
//
// IMPORTANT: the SDK is unicast (recipient-based). For "broadcast to the
// mesh" semantics we maintain a Set of currently-known neighbor user_ids and
// fan-out a unicast send to each. The SDK handles multi-hop forwarding via
// its relay/DORS layer if a recipient isn't a direct neighbor.

import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import OfflineProtocol, {
  MessagePriority,
} from '@offline-protocol/mesh-sdk';

import { getDeviceId } from '../storage/deviceId';
import {
  checkBlePermissions,
  requestBlePermissions,
} from '../utils/permissions';
import {
  getSystemState,
  updateSystemState,
  getQueueDelay,
} from '../utils/modelStorage';

const DEBOUNCE_MS = 500;
const MAX_QUEUE_SIZE = 100;
const MAX_SEEN_MESSAGES = 1000;
const APP_ID = 'com.crisisnet';
const BROADCAST_RECIPIENT = '__broadcast__'; // synthetic marker, never sent as recipient

class MeshService extends EventEmitter {
  constructor() {
    super();
    this.protocol = null;
    this.userId = null;
    this.shortId = null;

    this.peers = new Map(); // peerId -> { id, name, transport, lastSeenMs, rssi? }
    this.peerCount = 0;
    this.networkQuality = 'unknown';

    this.isInitialized = false;
    this.initPromise = null;
    this.restartDebounceTimer = null;
    this.pendingRestart = false;

    this.messageQueue = [];
    this.seenMessageIds = new Set();
    this.retryCount = 0;
    this.totalRetries = 0;

    this.protocolListeners = []; // [{ type, fn }]
  }

  // ----- Hardened EventEmitter (matches previous behavior) ---------------
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
  addListener(eventName, listener) { return this.on(eventName, listener); }
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
  off(eventName, listener) { return super.removeListener(eventName, listener); }

  emit(eventName, ...args) {
    const listeners = this._events?.[eventName];
    if (!listeners) return false;
    const arr = Array.isArray(listeners) ? listeners : [listeners];
    for (const fn of arr) {
      if (typeof fn !== 'function') continue;
      try {
        const r = fn(...args);
        if (r && typeof r.then === 'function') {
          r.catch((e) => console.warn(`[MESH] async listener error for ${eventName}:`, e?.message));
        }
      } catch (e) {
        console.warn(`[MESH] listener error for ${eventName}:`, e?.message);
      }
    }
    return true;
  }

  // ----- Lifecycle -------------------------------------------------------
  async init() {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  async _doInit() {
    console.log('[MESH] Initializing (offline-protocol mesh-sdk)...');

    const permResult = await checkBlePermissions();
    console.log('[MESH] Permission check result:', permResult);
    if (!permResult.granted) {
      const requestResult = await requestBlePermissions();
      console.log('[MESH] Permission request result:', requestResult);
      if (!requestResult.granted) {
        throw new Error(`Permission denied: ${requestResult.reason || 'user declined'}`);
      }
    }

    this.userId = await getDeviceId();
    this.shortId = this.userId.substring(0, 6);
    console.log('[MESH] Device userId:', this.userId, 'shortId:', this.shortId);

    // Configure SDK for BLE-only, unencrypted demo. Encryption requires MLS
    // key exchange UX which we don't ship yet; flip `encryption.enabled` to
    // true once a connection-request flow is in place.
    const config = {
      appId: APP_ID,
      userId: this.userId,
      transports: {
        ble: { enabled: true },
        // Other transports stay disabled for the demo.
        wifiDirect: { enabled: false },
        internet: { enabled: false },
        nostr: { enabled: false },
        reticulum: { enabled: false },
      },
      encryption: { enabled: false },
      relay: { allowRelay: true, relayPriority: 'auto' },
      network: { initialTtl: 8 },
    };

    this.protocol = new OfflineProtocol(config);
    this._wireProtocolEvents();

    try {
      await this.protocol.start();
    } catch (e) {
      console.error('[MESH] protocol.start() failed:', e?.message || e);
      this.protocol = null;
      throw e;
    }

    this.isInitialized = true;
    await this._updateSystemState();

    // The SDK's BLE transport is symmetric: it advertises + scans + serves
    // GATT, all internally. We surface synthetic "scanning"/"advertising"
    // events so existing UI keeps working.
    this.emit('scanning');
    this.emit('advertising');
    this.emit('started');
    return true;
  }

  _wireProtocolEvents() {
    if (!this.protocol) return;

    const subscribe = (type, fn) => {
      this.protocol.on(type, fn);
      this.protocolListeners.push({ type, fn });
    };

    subscribe('neighbor_discovered', (event) => {
      const peerId = event?.peer_id;
      if (!peerId) return;
      this.peers.set(peerId, {
        id: peerId,
        name: peerId.substring(0, 6),
        transport: event.transport,
        rssi: event.rssi,
        lastSeenMs: Date.now(),
      });
      this.peerCount = this.peers.size;
      this._updateNetworkQuality();
      this.emit('peer_discovered', { id: peerId, name: peerId.substring(0, 6), transport: event.transport });
    });

    subscribe('neighbor_lost', (event) => {
      const peerId = event?.peer_id;
      if (!peerId) return;
      const existed = this.peers.delete(peerId);
      if (!existed) return;
      this.peerCount = this.peers.size;
      this._updateNetworkQuality();
      this.emit('peer_lost', { id: peerId });
    });

    subscribe('message_received', (event) => {
      // Adapt SDK shape to the legacy shape MeshContext expects. MeshContext
      // reads: event.content (string, JSON-or-text), event.senderId,
      // event.message_id, event.timestamp.
      this.emit('message_received', {
        message_id: event.message_id,
        senderId: event.sender,
        sender: event.sender,
        content: event.content,
        timestamp: event.timestamp,
        hop_count: event.hop_count,
        transport: event.transport,
      });
    });

    subscribe('message_delivered', (event) => {
      this.emit('message_delivered', {
        id: event.message_id,
        latencyMs: event.latency_ms,
        hopCount: event.hop_count,
        transport: event.transport,
      });
    });

    subscribe('message_failed', (event) => {
      this.totalRetries += event.retry_count || 0;
      console.warn('[MESH] message failed:', event.message_id, event.reason);
    });

    subscribe('transport_switched', (event) => {
      console.log('[MESH] transport switched:', event.from, '->', event.to, 'reason:', event.reason);
    });

    subscribe('diagnostic', (event) => {
      const tag = `[MESH:${event.level}]`;
      if (event.level === 'error') console.error(tag, event.message, event.context || '');
      else if (event.level === 'warning') console.warn(tag, event.message, event.context || '');
      else console.log(tag, event.message);
    });
  }

  async stop() {
    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
      this.restartDebounceTimer = null;
      this.pendingRestart = false;
    }
    if (this.protocol) {
      try { await this.protocol.stop(); } catch (e) { /* ignore */ }
      try {
        for (const { type, fn } of this.protocolListeners) {
          this.protocol.off(type, fn);
        }
      } catch { /* ignore */ }
      this.protocolListeners = [];
      try { this.protocol.removeAllListeners(); } catch { /* ignore */ }
      this.protocol = null;
    }
    this.peers.clear();
    this.peerCount = 0;
    this.isInitialized = false;
    this.emit('stopped');
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

      await this.stop();
      await this.init();
    };
    return doRestart();
  }

  async pause() {
    try { await this.protocol?.pause(); } catch (e) { /* ignore */ }
    this.emit('paused');
  }

  async resume() {
    try { await this.protocol?.resume(); } catch (e) { /* ignore */ }
    this.emit('resumed');
  }

  // ----- Identity --------------------------------------------------------
  getDeviceShortId() {
    return this.shortId || (this.userId ? this.userId.substring(0, 6) : 'unknown');
  }

  // ----- Sending --------------------------------------------------------
  // Accepts the same payload shape MeshContext currently produces. The
  // payload's stringified JSON is sent as the message body to each known
  // neighbor (the SDK relays beyond direct neighbors via DORS).
  async sendMessage(payload) {
    if (!this.protocol || !this.isInitialized) {
      this.enqueueMessage(payload);
      return { id: this._payloadId(payload), queued: true };
    }

    const messageId = this._payloadId(payload);
    if (this.seenMessageIds.has(messageId)) {
      return { id: messageId, duplicate: true };
    }
    this.seenMessageIds.add(messageId);
    if (this.seenMessageIds.size > MAX_SEEN_MESSAGES) {
      const firstKey = this.seenMessageIds.values().next().value;
      this.seenMessageIds.delete(firstKey);
    }

    const systemState = await getSystemState();
    const queueDelay = getQueueDelay(this.retryCount, systemState.networkQuality);
    if (queueDelay > 100) {
      await new Promise((r) => setTimeout(r, queueDelay));
    }

    const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const priority = this._payloadPriority(payload);

    if (this.peers.size === 0) {
      this.enqueueMessage(payload);
      return { id: messageId, queued: true };
    }

    const sendOps = [];
    for (const [peerId] of this.peers) {
      sendOps.push(
        this.protocol
          .sendMessage({ recipient: peerId, content, priority })
          .catch((e) => {
            console.warn('[MESH] send to', peerId, 'failed:', e?.message || e);
          }),
      );
    }
    await Promise.all(sendOps);
    return { id: messageId, recipients: this.peers.size };
  }

  _payloadId(payload) {
    if (payload && typeof payload === 'object' && payload.id) return String(payload.id);
    return Math.random().toString(36).substring(2, 10);
  }

  _payloadPriority(payload) {
    if (payload && typeof payload === 'object') {
      if (payload.type === 'emergency') return MessagePriority.Critical;
    }
    return MessagePriority.Medium;
  }

  enqueueMessage(payload) {
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      this.messageQueue.shift();
    }
    this.messageQueue.push({
      id: this._payloadId(payload),
      payload,
      timestamp: Date.now(),
      retries: 0,
    });
  }

  async flushQueue() {
    if (!this.protocol || !this.isInitialized || this.messageQueue.length === 0) return;
    const queueCopy = [...this.messageQueue];
    this.messageQueue = [];
    for (const item of queueCopy) {
      try {
        await this.sendMessage(item.payload);
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        console.warn('[MESH] flushQueue send failed:', e?.message);
      }
    }
  }

  // ----- Network state --------------------------------------------------
  _updateNetworkQuality() {
    let q = 'good';
    if (this.peerCount === 0) q = 'poor';
    else if (this.peerCount === 1) q = 'fair';
    this.networkQuality = q;
    this._updateSystemState();
  }

  async _updateSystemState() {
    try {
      await updateSystemState({
        networkQuality: this.networkQuality,
        activeTasks: this.messageQueue.length > 0 ? ['mesh_send'] : [],
      });
    } catch { /* ignore */ }
  }

  getStats() {
    return {
      peerCount: this.peerCount,
      networkQuality: this.networkQuality,
      messageQueueSize: this.messageQueue.length,
      pendingAcks: 0,
      retryCount: this.retryCount,
      totalRetries: this.totalRetries,
    };
  }

  async getTopology() {
    try { return await this.protocol?.getTopology(); } catch { return null; }
  }

  async getActiveTransports() {
    try { return await this.protocol?.getActiveTransports(); } catch { return []; }
  }

  // Reserved for future use; kept for API compatibility.
  static BROADCAST = BROADCAST_RECIPIENT;
}

const meshService = new MeshService();

if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
  console.warn('[MESH] BLE mesh requires native platform; running as a no-op on', Platform.OS);
}

export default meshService;
