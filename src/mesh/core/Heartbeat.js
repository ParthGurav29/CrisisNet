import meshLogger from './MeshLogger';
import identity from './Identity';
import bleAdvertiser from './BleAdvertiser';
import capabilities from './Capabilities';

const HEARTBEAT_INTERVAL_MS = 5000;

class Heartbeat {
  constructor() {
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    
    meshLogger.info('heartbeat', 'Starting heartbeat loop (5s)...');
    this.timer = setInterval(() => this._beat(), HEARTBEAT_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    meshLogger.info('heartbeat', 'Heartbeat loop stopped');
  }

  _beat() {
    const nodeId = identity.getNodeId();
    const payload = {
      type: 'hb',
      id: nodeId,
      v: identity.getProtocolVersion(),
      cap: {
        relay: true,
        ai: true,
        storage: false,
      },
    };

    // For BLE Mesh discovery, the "heartbeat" is often just the advertisement itself.
    // However, if we are connected via GATT, we might send a heartbeat packet.
    meshLogger.debug('heartbeat', `Beat: ${nodeId}`);

    if (capabilities.sdkOwnsBleTransport) {
      return;
    }

    if (!bleAdvertiser.isActive()) {
      meshLogger.warn('heartbeat', 'Advertiser inactive, attempting restart...');
      bleAdvertiser.start(nodeId).catch(() => {});
    }
  }
}

const heartbeat = new Heartbeat();
export default heartbeat;
