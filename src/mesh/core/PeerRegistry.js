import meshEvents from './MeshEvents';
import meshLogger from './MeshLogger';

const PEER_TIMEOUT_MS = 15000;
const CLEANUP_INTERVAL_MS = 5000;
const RSSI_SMOOTHING_FACTOR = 3;

class PeerRegistry {
  constructor() {
    this.peers = new Map(); // peerId -> { id, rssiHistory, rssi, capabilities, lastSeen }
    this.cleanupTimer = null;
  }

  start() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
    meshLogger.info('registry', 'Peer cleanup loop started');
  }

  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.peers.clear();
    meshLogger.info('registry', 'Peer registry stopped and cleared');
  }

  updatePeer(peerId, rssi, capabilities = {}) {
    const now = Date.now();
    let peer = this.peers.get(peerId);

    if (!peer) {
      peer = {
        id: peerId,
        rssiHistory: [rssi],
        rssi: rssi,
        capabilities: capabilities,
        lastSeen: now,
      };
      this.peers.set(peerId, peer);
      meshLogger.info('registry', `New peer discovered: ${peerId} (RSSI: ${rssi})`);
      meshEvents.emit('peer_discovered', peer);
    } else {
      // Update RSSI with smoothing
      peer.rssiHistory.push(rssi);
      if (peer.rssiHistory.length > RSSI_SMOOTHING_FACTOR) {
        peer.rssiHistory.shift();
      }
      peer.rssi = Math.round(peer.rssiHistory.reduce((a, b) => a + b, 0) / peer.rssiHistory.length);
      
      // Update capabilities if provided
      if (Object.keys(capabilities).length > 0) {
        peer.capabilities = { ...peer.capabilities, ...capabilities };
      }
      
      peer.lastSeen = now;
      meshEvents.emit('peer_updated', peer);
    }
  }

  /** Remove immediately (e.g. mesh-sdk neighbor_lost); matches emit shape used in _cleanup. */
  removePeer(peerId) {
    if (!peerId || !this.peers.has(peerId)) return false;
    this.peers.delete(peerId);
    meshLogger.info('registry', `Peer removed: ${peerId}`);
    meshEvents.emit('peer_lost', { peerId });
    return true;
  }

  _cleanup() {
    const now = Date.now();
    let count = 0;
    for (const [peerId, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
        this.peers.delete(peerId);
        meshLogger.info('registry', `Peer timed out: ${peerId}`);
        meshEvents.emit('peer_lost', { peerId });
        count++;
      }
    }
    if (count > 0) {
      meshLogger.info('registry', `Cleaned up ${count} stale peers`);
    }
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  getPeerCount() {
    return this.peers.size;
  }
}

const peerRegistry = new PeerRegistry();
export default peerRegistry;
