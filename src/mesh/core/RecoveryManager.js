import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import meshLogger from './MeshLogger';
import meshEvents from './MeshEvents';
import { MeshState } from './MeshState';

class RecoveryManager {
  constructor() {
    this.meshManager = null;
    this.nativeEmitter = null;
    this.nativeListener = null;
    this.checkInterval = null;
  }

  init(meshManager) {
    this.meshManager = meshManager;
    this._setupListener();
    
    // Fallback: poll Bluetooth state every 10 seconds
    this.checkInterval = setInterval(() => this.checkBluetoothState(), 10000);
    meshLogger.info('recovery', 'RecoveryManager initialized');
  }

  _setupListener() {
    try {
      const mod = NativeModules?.OfflineProtocolModule;
      if (mod) {
        this.nativeEmitter = new NativeEventEmitter(mod);
        this.nativeListener = this.nativeEmitter.addListener('onBluetoothStateChanged', (state) => {
          // state: 'on', 'off', 'turning_on', 'turning_off'
          meshLogger.info('recovery', `Native Bluetooth state change: ${state}`);
          this._handleStateChange(state === 'on');
        });
      }
    } catch (e) {
      meshLogger.warn('recovery', `Failed to setup native state listener: ${e.message}`);
    }
  }

  async checkBluetoothState() {
    try {
      const mod = NativeModules?.OfflineProtocolModule;
      if (mod && typeof mod.isBluetoothEnabled === 'function') {
        const enabled = await mod.isBluetoothEnabled();
        this._handleStateChange(Boolean(enabled));
      }
    } catch (e) {
      meshLogger.warn('recovery', `Bluetooth state check failed: ${e.message}`);
    }
  }

  _handleStateChange(isEnabled) {
    if (!this.meshManager) return;

    const currentState = this.meshManager.getState();
    
    if (!isEnabled && currentState !== MeshState.BLE_DISABLED) {
      meshLogger.warn('recovery', 'Bluetooth disabled detected. Moving to BLE_DISABLED.');
      this.meshManager._transition(MeshState.BLE_DISABLED);
      this.meshManager.stopDiscovery();
    } else if (isEnabled && currentState === MeshState.BLE_DISABLED) {
      meshLogger.info('recovery', 'Bluetooth re-enabled. Triggering recovery.');
      this.meshManager._transition(MeshState.RECOVERING);
      this.meshManager.startDiscovery().then(() => {
        this.meshManager._transition(MeshState.READY);
      });
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.nativeListener) {
      this.nativeListener.remove();
      this.nativeListener = null;
    }
  }
}

const recoveryManager = new RecoveryManager();
export default recoveryManager;
