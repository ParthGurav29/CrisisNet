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

import identity from './core/Identity';
import {
  checkBlePermissions,
  requestBlePermissions,
} from '../utils/permissions';
import {
  getSystemState,
  updateSystemState,
  getQueueDelay,
} from '../utils/modelStorage';
import {
  PACKET_TYPE,
  createMessagePacket,
  createAckPacket,
  createNackPacket,
  validatePacket,
  isDuplicate,
} from './packetFormat';
import peerRegistry from './core/PeerRegistry';
import { CRISISNET_MESH_SERVICE_UUID } from './core/crisisNetBleConstants';

const DEBOUNCE_MS = 500;
const MAX_QUEUE_SIZE = 100;
const MAX_SEEN_MESSAGES = 1000;
const APP_ID = 'com.crisisnet';
const BROADCAST_RECIPIENT = '__broadcast__';
const PEER_STALE_TIMEOUT_MS = 30000;
const PEER_CLEANUP_INTERVAL_MS = 10000; // synthetic marker, never sent as recipient

class MeshService extends EventEmitter {
  constructor() {
    super();
    this.protocol = null;
    this.userId = null;
    this.shortId = null;

    this.peers = new Map();
    this.peerCount = 0;
    this.networkQuality = 'unknown';

    this.isInitialized = false;
    this.initPromise = null;
    this.restartDebounceTimer = null;
    this.pendingRestart = false;
    this.peerCleanupTimer = null;

    this.messageQueue = [];
    this.seenMessageIds = new Set();
    this.retryCount = 0;
    this.totalRetries = 0;
    this.pendingAcks = new Map();
    this.ackTimeoutMs = 5000;

    this.protocolListeners = [];

    this.peerStates = new Map();
  }

  _getPeerState(peerId) {
    if (!this.peerStates.has(peerId)) {
      this.peerStates.set(peerId, {
        peerRegistered: false,
        deviceIdResolved: false,
        sessionEstablished: false,
        linkReady: false,
        lastHelloTimestamp: 0,
        lastPacketTimestamp: 0,
        lastDecodeFailure: null,
        pendingInboundFragments: 0,
        pendingOutboundFragments: 0,
      });
    }
    return this.peerStates.get(peerId);
  }

  _getConnectionRole(peerId) {
    const myId = this.userId || '';
    if (myId < peerId) {
      return 'initiator';
    }
    return 'acceptor';
  }

  _shouldSendMessageToPeer(peerId) {
    const state = this._getPeerState(peerId);
    if (!state.sessionEstablished || !state.peerRegistered) {
      return false;
    }
    const myRole = this._getConnectionRole(peerId);
    if (myRole === 'initiator') {
      return state.linkReady;
    }
    return true;
  }

  _updatePeerState(peerId, updates) {
    const state = this._getPeerState(peerId);
    Object.assign(state, updates);
    this._logPeerEvent('PEER_STATE_UPDATE', { peerId, ...updates });
  }

  _logPeerEvent(event, details) {
    const timestamp = new Date().toISOString();
    console.log(`[MESH][PEER] ${timestamp} ${event}`, JSON.stringify(details));
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

    await identity.init();
    this.userId = identity.getNodeId();
    this.shortId = this.userId.length > 4 ? this.userId.substring(this.userId.length - 4) : this.userId;
    console.log('[MESH] Device userId:', this.userId, 'shortId:', this.shortId);

    // Native mesh identity / neighbor validation uses MLS-backed signing even
    // when application payloads are plain JSON. The JS SDK only calls
    // `initializeMlsWithSecureStorage()` during `start()` when
    // `encryption.enabled` is true; leaving it false skips MLS entirely and
    // produces errors like "MLS not initialized, cannot create signed
    // identity" and blocked peers (unknown_candidate / non_mesh_cache).
    // `requireEncryption: false` keeps MLS + auto key exchange for trust,
    // without forcing ciphertext on every `sendMessage`.
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
      encryption: {
        enabled: true,
        autoKeyExchange: true,
        storePending: true,
        requireEncryption: false,
      },
      relay: { allowRelay: true, relayPriority: 'auto' },
      network: { initialTtl: 8 },
    };

    console.log('[MESH] MLS bootstrap: enabling encryption config so SDK runs initializeMlsWithSecureStorage before native start');

    this.protocol = new OfflineProtocol(config);
    this._wireProtocolEvents();

    try {
      await this.protocol.start();
    } catch (e) {
      console.error('[MESH] protocol.start() failed:', e?.message || e);
      this.protocol = null;
      throw e;
    }

    try {
      const mlsReady = await this.protocol.isMlsInitialized();
      if (mlsReady) {
        console.log('[MESH] MLS initialized successfully');
        const pk = await this.protocol.getIdentityPublicKey();
        const pkLen = Array.isArray(pk) ? pk.length : 0;
        console.log('[MESH] Signed identity ready (identity public key bytes:', pkLen, ')');
      } else {
        console.warn('[MESH] MLS not ready after start — neighbor promotion / fragments may fail');
      }
    } catch (e) {
      console.warn('[MESH] Post-start MLS verification failed:', e?.message || e);
    }

    this.isInitialized = true;
    this._startPeerCleanup();
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

    subscribe('neighbor_discovered', async (event) => {
      const peerId = event?.peer_id;
      if (!peerId) return;
      const rssi =
        typeof event.rssi === 'number' && Number.isFinite(event.rssi) ? event.rssi : -95;
      console.log('[MESH][REGISTRY] Peer added (mesh-sdk):', peerId, 'rssi=', rssi);
      peerRegistry.updatePeer(peerId, rssi, { transport: event.transport || 'ble' });
      
      const peerState = this._getPeerState(peerId);
      peerState.rssi = rssi;
      
      this.peers.set(peerId, {
        id: peerId,
        name: peerId.substring(0, 6),
        transport: event.transport,
        rssi: event.rssi,
        lastSeenMs: Date.now(),
        peerState,
      });
      this.peerCount = this.peers.size;
      this._updateNetworkQuality();
      this.emit('peer_discovered', { id: peerId, name: peerId.substring(0, 6), transport: event.transport });

      this._logPeerEvent('HELLO_RX', { 
        peerId, 
        rssi, 
        transport: event.transport
      });

      await this._establishSessionForPeer(peerId);
    });

    subscribe('neighbor_lost', (event) => {
      const peerId = event?.peer_id;
      if (!peerId) return;
      peerRegistry.removePeer(peerId);
      const existed = this.peers.delete(peerId);
      if (existed) {
        this.peerStates.delete(peerId);
      }
      if (!existed) return;
      this.peerCount = this.peers.size;
      this._updateNetworkQuality();
      this.emit('peer_lost', { id: peerId });
    });

    subscribe('message_received', async (event) => {
      const peerId = event.sender;
      if (peerId) {
        this.peers.forEach((peer, pid) => {
          if (event.sender === pid || event.sender === peer.id) {
            peer.lastSeenMs = Date.now();
          }
        });
      }

      const content = event.content || '';
      let packet;
      try {
        packet = JSON.parse(content);
      } catch {
        packet = null;
      }

      if (packet && peerId) {
        const state = this._getPeerState(peerId);
        state.lastPacketTimestamp = Date.now();
        if (!packet.type) {
          state.lastDecodeFailure = 'missing packet type';
        }
      }

      if (packet && packet.type === PACKET_TYPE.ACK) {
        console.log('[MESH][E2E] ack_received', {
          originalId: packet.originalId,
          sender: event.sender,
          contentBytes: typeof content === 'string' ? content.length : 0,
        });
        this._handleAck(packet);
        return;
      }

      if (packet && packet.type === PACKET_TYPE.MESSAGE) {
        if (isDuplicate(packet.id, this.seenMessageIds)) {
          return;
        }
        if (packet.recipient && packet.recipient !== this.userId) {
          return;
        }
        console.log('[MESH][E2E] message_received_assembled', {
          packetId: packet.id,
          sender: event.sender,
          payloadChars: typeof packet.content === 'string' ? packet.content.length : 0,
          hopCount: event.hop_count,
          transport: event.transport,
        });
        this._logPeerEvent('MESSAGE_RECEIVED', { peerId, packetId: packet.id, hopCount: event.hop_count });
      }

      this.emit('message_received', {
        message_id: event.message_id || (packet ? packet.id : undefined),
        senderId: event.sender,
        sender: event.sender,
        content: event.content,
        timestamp: event.timestamp,
        hop_count: event.hop_count,
        transport: event.transport,
        packet,
      });

      if (packet && packet.type === PACKET_TYPE.MESSAGE && packet.recipient) {
        await this._sendAck(packet.id, packet.sender);
      }
    });

    subscribe('message_delivered', (event) => {
      const peerId = event.recipient || event.peer_id;
      if (peerId) {
        this._logPeerEvent('MESSAGE_DELIVERED', { 
          peerId, 
          messageId: event.message_id,
          latencyMs: event.latency_ms 
        });
      }
      console.log('[MESH][E2E] message_delivered', {
        crisisNetBleDiscoveryUuid: CRISISNET_MESH_SERVICE_UUID,
        messageId: event.message_id,
        latencyMs: event.latency_ms,
        hopCount: event.hop_count,
        transport: event.transport,
        retryCount: event.retry_count,
      });
      this.emit('message_delivered', {
        id: event.message_id,
        latencyMs: event.latency_ms,
        hopCount: event.hop_count,
        transport: event.transport,
      });
    });

    subscribe('message_failed', (event) => {
      this.totalRetries += event.retry_count || 0;
      console.warn('[MESH][E2E] message_failed', {
        messageId: event.message_id,
        reason: event.reason,
        retryCount: event.retry_count,
        disconnectReason: event.disconnect_reason ?? event.disconnectReason,
      });
    });

    subscribe('transport_switched', (event) => {
      console.log('[MESH] transport switched:', event.from, '->', event.to, 'reason:', event.reason);
    });

    subscribe('diagnostic', (event) => {
      const tag = `[MESH:${event.level}]`;
      const ctx =
        event.context && Object.keys(event.context).length
          ? JSON.stringify(event.context)
          : '';
      
      if (event.message && event.message.includes('fragment')) {
        console.log('[MESH][FRAGMENT]', event.message, ctx);
        const context = event.context || {};
        if (event.message.includes('expired')) {
          console.log('[MESH][FRAGMENT] PENDING_EXPIRED', ctx);
        }
        if (event.message.includes('reassembly')) {
          console.log('[MESH][FRAGMENT] REASSEMBLY_COMPLETE', ctx);
        }
      }
      
      if (event.level === 'error') console.error(tag, event.message, ctx);
      else if (event.level === 'warning') console.warn(tag, event.message, ctx);
      else console.log(tag, event.message, ctx);
    });

    const logProto = (label, event) => {
      try {
        console.log('[MESH][PROTO]', label, JSON.stringify(event));
      } catch {
        console.log('[MESH][PROTO]', label, event);
      }
    };

    subscribe('secure_session_established', (event) => {
      const peerId = event?.peer_id || event?.recipient_id;
      if (peerId) {
        this._logPeerEvent('SESSION_ESTABLISHED', { peerId, event });
        const state = this._getPeerState(peerId);
        state.sessionEstablished = true;
        state.peerRegistered = true;
        state.deviceIdResolved = true;
        state.linkReady = true;
        console.log('[MESH] Session established for peer:', peerId.slice(0, 8));
      }
      logProto('neighbor/session: secure_session_established', event);
    });
    subscribe('secure_session_failed', (event) => {
      const peerId = event?.peer_id || event?.recipient_id;
      if (peerId) {
        this._logPeerEvent('SESSION_FAILED', { peerId, reason: event?.reason, error: event?.error });
        console.warn('[MESH] Session failed for peer:', peerId.slice(0, 8), event?.reason || event?.error);
      }
      logProto('neighbor/session: secure_session_failed', event);
    });

    subscribe('all', (event) => {
      const t = event?.type;
      if (
        t === 'neighbor_discovered' ||
        t === 'neighbor_lost' ||
        t === 'diagnostic' ||
        t === 'secure_session_established' ||
        t === 'secure_session_failed'
      ) {
        return;
      }
      if (
        typeof t === 'string' &&
        (t.includes('welcome') ||
          t.includes('connection') ||
          t.includes('session') ||
          t.includes('key') ||
          t.includes('fragment') ||
          t.includes('mesh') ||
          t.includes('neighbor') ||
          t.includes('route'))
      ) {
        logProto(`protocol event: ${t}`, event);
      }
    });
  }

  async _establishSessionForPeer(peerId) {
    if (!this.protocol) {
      this._logPeerEvent('SESSION_SKIPPED', { peerId, reason: 'protocol_not_ready' });
      return;
    }
    
    const state = this._getPeerState(peerId);
    if (state.sessionEstablished) {
      return;
    }

    this._logPeerEvent('SESSION_STARTING', { peerId });
    
    try {
      const welcome = await this.protocol.establishSecureSession(peerId);
      if (welcome) {
        this._logPeerEvent('DEVICE_ID_RESOLVED', { peerId, resolved: true });
        console.log('[MESH] establishSecureSession created welcome for', peerId.slice(0, 8));
      }
    } catch (e) {
      this._logPeerEvent('SESSION_FAILED', { peerId, error: e?.message || e });
      console.warn('[MESH] establishSecureSession failed for', peerId.slice(0, 8), e?.message || e);
    }
  }

  async stop() {
    if (this.restartDebounceTimer) {
      clearTimeout(this.restartDebounceTimer);
      this.restartDebounceTimer = null;
      this.pendingRestart = false;
    }
    this._stopPeerCleanup();
    this.initPromise = null;
    try {
      peerRegistry.getPeers().forEach((p) => {
        try {
          peerRegistry.removePeer(p.id);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
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
      this.isInitialized = false;
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

  /** Mesh-sdk protocol user id (distinct from CrisisNet MeshManager identity.nodeId). */
  getProtocolUserId() {
    return this.userId || null;
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

    const readyPeers = [];
    for (const [peerId, peer] of this.peers.entries()) {
      if (this._shouldSendMessageToPeer(peerId)) {
        readyPeers.push(peerId);
      } else {
        const state = this._getPeerState(peerId);
        this._logPeerEvent('TX_GATED', { 
          peerId, 
          reason: 'session_not_ready',
          sessionEstablished: state.sessionEstablished,
          peerRegistered: state.peerRegistered,
          linkReady: state.linkReady,
        });
      }
    }

    if (readyPeers.length === 0) {
      this.enqueueMessage(payload);
      console.log('[MESH] No ready peers, queuing message:', messageId);
      return { id: messageId, queued: true };
    }

    for (const peerId of readyPeers) {
      try {
        await this.protocol.sendMessage({ recipient: peerId, content, priority });
        this._logPeerEvent('MESSAGE_DELIVERED', { peerId, messageId, recipientCount: readyPeers.length });
      } catch (e) {
        console.warn('[MESH] send to', peerId, 'failed:', e?.message || e);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return { id: messageId, recipients: readyPeers.length };
  }

  _payloadId(payload) {
    if (payload && typeof payload === 'object' && payload.id) return String(payload.id);
    return Math.random().toString(36).substring(2, 10);
  }

  _payloadPriority(payload) {
    if (payload && typeof payload === 'object') {
      if (payload.type === 'emergency' || payload.emergency || payload.priority === 'critical') return MessagePriority.Critical;
      if (payload.priority === 'high') return MessagePriority.High;
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

  _startPeerCleanup() {
    this.peerCleanupTimer = setInterval(() => {
      const now = Date.now();
      const stalePeers = [];
      this.peers.forEach((peer, peerId) => {
        if (now - peer.lastSeenMs > PEER_STALE_TIMEOUT_MS) {
          stalePeers.push(peerId);
        }
      });
      for (const peerId of stalePeers) {
        this.peers.delete(peerId);
        this.emit('peer_lost', { id: peerId });
      }
      if (stalePeers.length > 0) {
        this.peerCount = this.peers.size;
        this._updateNetworkQuality();
      }
    }, PEER_CLEANUP_INTERVAL_MS);
  }

  _stopPeerCleanup() {
    if (this.peerCleanupTimer) {
      clearInterval(this.peerCleanupTimer);
      this.peerCleanupTimer = null;
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

  getPeers() {
    return Array.from(this.peers.values()).map(peer => ({
      ...peer,
      peerState: this._getPeerState(peer.id),
    }));
  }

  getPeerStates() {
    const result = {};
    for (const [peerId, state] of this.peerStates.entries()) {
      result[peerId] = {
        peerRegistered: state.peerRegistered,
        deviceIdResolved: state.deviceIdResolved,
        sessionEstablished: state.sessionEstablished,
        linkReady: state.linkReady,
        lastHelloTimestamp: state.lastHelloTimestamp,
        lastPacketTimestamp: state.lastPacketTimestamp,
        lastDecodeFailure: state.lastDecodeFailure,
        pendingInboundFragments: state.pendingInboundFragments,
        pendingOutboundFragments: state.pendingOutboundFragments,
      };
    }
    return result;
  }

  async getTopology() {
    try { return await this.protocol?.getTopology(); } catch { return null; }
  }

  async getActiveTransports() {
    try { return await this.protocol?.getActiveTransports(); } catch { return []; }
  }

  _handleAck(packet) {
    const pending = this.pendingAcks.get(packet.originalId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAcks.delete(packet.originalId);
      if (pending.resolve) {
        pending.resolve({ acknowledged: true, latencyMs: Date.now() - pending.timestamp });
      }
    }
  }

  async _sendAck(packetId, recipientId) {
    if (!this.protocol || !this.isInitialized) return;
    const ackPacket = createAckPacket(packetId, recipientId);
    await this.protocol.sendMessage({
      recipient: recipientId,
      content: JSON.stringify(ackPacket),
      priority: MessagePriority.Low,
    }).catch(() => {});
  }

  async waitForAck(packetId, timeoutMs = this.ackTimeoutMs) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(packetId);
        resolve({ acknowledged: false, reason: 'timeout' });
      }, timeoutMs);

      this.pendingAcks.set(packetId, {
        timestamp: Date.now(),
        resolve,
        timeout,
      });
    });
  }

  /**
   * Debug helper: unicast a JSON packet to one peer and wait for application-level ACK.
   * Requires both devices to run this app version with ACK auto-reply on MESSAGE packets.
   */
  async verifyBidirectionalDelivery(peerId, body = { type: 'crisisnet_mesh_e2e', t: Date.now() }) {
    if (!this.protocol || !this.isInitialized) {
      throw new Error('mesh not initialized');
    }
    if (!peerId) {
      throw new Error('peerId required');
    }
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const packet = await createMessagePacket(bodyStr, peerId, 'high');
    const wire = JSON.stringify(packet);
    const t0 = Date.now();
    console.log('[MESH][E2E] verify_send', {
      peerId,
      packetId: packet.id,
      payloadBytes: wire.length,
      crisisNetBleDiscoveryUuid: CRISISNET_MESH_SERVICE_UUID,
    });
    await this.protocol.sendMessage({
      recipient: peerId,
      content: wire,
      priority: MessagePriority.High,
   });
    const ack = await this.waitForAck(packet.id, Math.max(this.ackTimeoutMs, 15000));
    const elapsed = Date.now() - t0;
    console.log('[MESH][E2E] verify_ack_result', { packetId: packet.id, elapsedMs: elapsed, ...ack });
    return { packet, ack, elapsedMs: elapsed };
  }
}

MeshService.BROADCAST = BROADCAST_RECIPIENT;

const meshService = new MeshService();

if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
  console.warn('[MESH] BLE mesh requires native platform; running as a no-op on', Platform.OS);
}

export default meshService;
