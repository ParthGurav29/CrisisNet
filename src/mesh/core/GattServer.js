import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import meshLogger from './MeshLogger';
import meshEvents from './MeshEvents';

const MAX_CONNECTIONS = 3;

class GattServer {
  constructor() {
    this.active = false;
    this.connections = new Set();
    this.nativeEmitter = null;
    this.nativeListener = null;
  }

  async start() {
    if (this.active) return;
    
    meshLogger.info('gatt', 'Initializing GATT server (Max Connections: 3)...');
    
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.startGattServer === 'function') {
          await mod.startGattServer();
          this._setupListeners();
          this.active = true;
          meshLogger.info('gatt', 'GATT server initialized and listening');
        } else if (mod) {
          meshLogger.info(
            'gatt',
            '[MESH][GATT] Using @offline-protocol/mesh-sdk GATT stack (protocol.start)',
          );
          this.active = true;
        } else {
          meshLogger.warn('gatt', 'OfflineProtocolModule missing');
          this.active = true;
        }
      } else {
        this.active = true;
      }
    } catch (e) {
      meshLogger.error('gatt', `GattServer start failed: ${e.message}`);
      throw e;
    }
  }

  _setupListeners() {
    if (this.nativeListener) return;

    try {
      const mod = NativeModules?.OfflineProtocolModule;
      if (mod) {
        this.nativeEmitter = new NativeEventEmitter(mod);
        this.nativeListener = this.nativeEmitter.addListener('onGattConnectionStateChanged', (event) => {
          // event: { deviceId, connected: true/false }
          const { deviceId, connected } = event;
          if (connected) {
            if (this.connections.size >= MAX_CONNECTIONS) {
              meshLogger.warn('gatt', `Max connections reached. Rejecting ${deviceId}`);
              this.disconnect(deviceId);
              return;
            }
            this.connections.add(deviceId);
            meshLogger.info('gatt', `Peer connected: ${deviceId} (Total: ${this.connections.size})`);
            meshEvents.emit('peer_connected', { deviceId });
          } else {
            this.connections.delete(deviceId);
            meshLogger.info('gatt', `Peer disconnected: ${deviceId} (Total: ${this.connections.size})`);
            meshEvents.emit('peer_disconnected', { deviceId });
          }
        });
      }
    } catch (e) {
      meshLogger.warn('gatt', `Failed to setup GATT listeners: ${e.message}`);
    }
  }

  async disconnect(deviceId) {
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.disconnectPeer === 'function') {
          await mod.disconnectPeer(deviceId);
        }
      }
    } catch (e) {
      meshLogger.warn('gatt', `Disconnect failed for ${deviceId}: ${e.message}`);
    }
  }

  async stop() {
    meshLogger.info('gatt', 'Stopping GATT server...');
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.stopGattServer === 'function') {
          await mod.stopGattServer();
        }
      }
    } catch (e) {}
    
    if (this.nativeListener) {
      this.nativeListener.remove();
      this.nativeListener = null;
    }
    this.connections.clear();
    this.active = false;
  }

  getConnectionCount() {
    return this.connections.size;
  }
}

const gattServer = new GattServer();
export default gattServer;
