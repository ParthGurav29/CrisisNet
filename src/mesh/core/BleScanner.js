import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import meshLogger from './MeshLogger';
import meshEvents from './MeshEvents';
import peerRegistry from './PeerRegistry';
import capabilities from './Capabilities';

const SCAN_ACTIVE_MS = 8000;
const SCAN_IDLE_MS = 4000;

class BleScanner {
  constructor() {
    this.active = false;
    this.scanning = false;
    this.timer = null;
    this.nativeEmitter = null;
    this.nativeListener = null;
  }

  async start() {
    if (this.active) return;

    if (capabilities.sdkOwnsBleTransport) {
      this.active = true;
      meshLogger.info(
        'scanner',
        '[MESH][SCANNER] BLE scan handled by @offline-protocol/mesh-sdk — skipping JS duty cycle',
      );
      return;
    }

    this.active = true;
    meshLogger.info('scanner', 'Starting scanner with duty cycling (8s ON / 4s OFF)');
    
    this._setupNativeListener();
    this._cycle();
  }

  _setupNativeListener() {
    if (this.nativeListener) return;

    try {
      const mod = NativeModules?.OfflineProtocolModule;
      if (mod) {
        this.nativeEmitter = new NativeEventEmitter(mod);
        this.nativeListener = this.nativeEmitter.addListener('onBleScanResult', (result) => {
          // result: { deviceId, rssi, manufacturerData, ... }
          if (result && result.deviceId) {
            meshEvents.emit('raw_scan_result', result);
            // We assume deviceId might be the nodeId or we parse it from result
            peerRegistry.updatePeer(result.deviceId, result.rssi);
          }
        });
        meshLogger.info('scanner', 'Native scan listener attached');
      }
    } catch (e) {
      meshLogger.warn('scanner', `Failed to setup native listener: ${e.message}`);
    }
  }

  async stop() {
    this.active = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this._stopScanning();
    if (this.nativeListener) {
      this.nativeListener.remove();
      this.nativeListener = null;
    }
    meshLogger.info('scanner', 'Scanner stopped');
  }

  async _cycle() {
    if (!this.active) return;

    await this._startScanning();
    this.timer = setTimeout(async () => {
      await this._stopScanning();
      this.timer = setTimeout(() => this._cycle(), SCAN_IDLE_MS);
    }, SCAN_ACTIVE_MS);
  }

  async _startScanning() {
    if (this.scanning) return;
    
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.startScanning === 'function') {
          await mod.startScanning();
        }
      }
      this.scanning = true;
      meshLogger.debug('scanner', 'Scan loop: ACTIVE');
      meshEvents.emit('scan_started');
    } catch (e) {
      meshLogger.error('scanner', `Failed to start scan: ${e.message}`);
    }
  }

  async _stopScanning() {
    if (!this.scanning) return;
    
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.stopScanning === 'function') {
          await mod.stopScanning();
        }
      }
      this.scanning = false;
      meshLogger.debug('scanner', 'Scan loop: IDLE');
      meshEvents.emit('scan_stopped');
    } catch (e) {
      meshLogger.warn('scanner', `Failed to stop scan: ${e.message}`);
    }
  }

  isScanning() {
    return this.scanning;
  }
}

const bleScanner = new BleScanner();
export default bleScanner;
