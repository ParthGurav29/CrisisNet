import { OfflineProtocol } from '@offline-protocol/mesh-sdk';

class MeshService {
  constructor() {
    this.protocol = null;
  }

  async init() {
    if (this.protocol) return;

    try {
      this.protocol = new OfflineProtocol({
        appId: 'CrisisNet',
        userId: `user_${Math.random().toString(36).substring(2, 9)}`,
        transports: {
          ble: { enabled: true },
          internet: { enabled: false },
          wifiDirect: { enabled: false }
        },
        encryption: {
            enabled: true
        }
      });

      // Event Listeners
      this.protocol.on('message_received', (event) => {
        console.log('[Mesh] Message received:', event);
      });

      this.protocol.on('peer_discovered', (peer) => {
        console.log('[Mesh] Peer discovered:', peer.id);
      });

      await this.protocol.start();
      console.log('[Mesh] SDK initialized and started');
    } catch (error) {
      console.error('[Mesh] Failed to initialize SDK:', error);
    }
  }

  async stop() {
    if (this.protocol) {
      await this.protocol.stop();
      this.protocol = null;
    }
  }
}

const meshService = new MeshService();
export default meshService;
