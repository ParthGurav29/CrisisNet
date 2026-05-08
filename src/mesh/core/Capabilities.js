import { NativeModules, Platform } from 'react-native';
import meshLogger from './MeshLogger';

class Capabilities {
  constructor() {
    this.bleSupported = false;
    this.advertiserSupported = false;
    this.multipleAdvertisementSupported = false;
    this.extendedAdvertisementSupported = false;
    this.initialized = false;
    /** True when OfflineProtocolModule is linked and BLE is owned by mesh-sdk (`start()`), not RN stubs. */
    this.sdkOwnsBleTransport = false;
  }

  async check() {
    if (this.initialized) return;

    meshLogger.info('capabilities', 'Checking device BLE capabilities...');

    if (Platform.OS !== 'android') {
      // Assuming modern iOS devices support BLE and Advertising
      this.bleSupported = true;
      this.advertiserSupported = true;
      this.sdkOwnsBleTransport = true;
      this.initialized = true;
      return;
    }

    try {
      const mod = NativeModules?.OfflineProtocolModule;
      if (mod) {
        this.bleSupported = typeof mod.isBleSupported === 'function' ? await mod.isBleSupported() : true;
        this.advertiserSupported = typeof mod.isAdvertiserSupported === 'function' ? await mod.isAdvertiserSupported() : true;
        this.multipleAdvertisementSupported = typeof mod.isMultipleAdvertisementSupported === 'function' ? await mod.isMultipleAdvertisementSupported() : false;
        
        // Log available methods for diagnostics
        const methods = Object.keys(mod).filter(k => typeof mod[k] === 'function');
        meshLogger.info('capabilities', `Native methods available: ${methods.join(', ')}`);
        
        this.hasStartAdv = typeof mod.startAdvertising === 'function';
        this.hasStartScan = typeof mod.startScanning === 'function';
        this.hasGattServer = typeof mod.startGattServer === 'function';
        /** Stock mesh-sdk: BLE starts inside native `start()` / BleTransportFacade, not RN stubs. */
        this.sdkOwnsBleTransport =
          !!mod &&
          typeof mod.startAdvertising !== 'function';
      } else {
        meshLogger.warn('capabilities', 'OfflineProtocolModule not found, assuming defaults');
        this.bleSupported = true;
        this.advertiserSupported = true;
        this.sdkOwnsBleTransport = false;
      }
    } catch (e) {
      meshLogger.error('capabilities', `Failed to check capabilities: ${e.message}`);
      this.bleSupported = true; // Fallback to avoid blocking
      this.advertiserSupported = true;
      this.sdkOwnsBleTransport = false;
    }

    meshLogger.info(
      'capabilities',
      `BLE: ${this.bleSupported}, Adv: ${this.advertiserSupported}, Multi: ${this.multipleAdvertisementSupported}, Ext: ${this.extendedAdvertisementSupported}, sdkBle: ${this.sdkOwnsBleTransport}`,
    );
    this.initialized = true;
  }

  isSupported() {
    return this.bleSupported && this.advertiserSupported;
  }
}

const capabilities = new Capabilities();
export default capabilities;
