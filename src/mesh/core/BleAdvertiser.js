import { NativeModules, Platform } from 'react-native';
import meshLogger from './MeshLogger';
import meshEvents from './MeshEvents';

class BleAdvertiser {
  constructor() {
    this.active = false;
  }

  async start(nodeId) {
    if (this.active) return;
    
    meshLogger.info('advertiser', `Starting BLE advertising for ${nodeId}...`);
    
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.startAdvertising === 'function') {
          const success = await mod.startAdvertising(nodeId);
          if (success) {
            this.active = true;
            meshLogger.info('advertiser', 'BLE advertising started successfully (native)');
            meshEvents.emit('advertising_started');
          } else {
            throw new Error('Native advertiser failed to start');
          }
        } else if (mod) {
          meshLogger.info(
            'advertiser',
            '[MESH][ADVERTISER] Using @offline-protocol/mesh-sdk advertiser (native BleTransportFacade via protocol.start)',
          );
          this.active = true;
          meshEvents.emit('advertising_started');
        } else {
          meshLogger.warn('advertiser', 'OfflineProtocolModule missing; mesh-sdk BLE will not run');
          this.active = true;
        }
      } else {
        this.active = true;
      }
    } catch (e) {
      meshLogger.error('advertiser', `Advertising failed: ${e.message}`);
      throw e;
    }
  }

  async stop() {
    if (!this.active) return;
    
    meshLogger.info('advertiser', 'Stopping BLE advertising...');
    try {
      if (Platform.OS === 'android') {
        const mod = NativeModules?.OfflineProtocolModule;
        if (mod && typeof mod.stopAdvertising === 'function') {
          await mod.stopAdvertising();
        }
      }
    } catch (e) {
      meshLogger.warn('advertiser', `Stop advertising warning: ${e.message}`);
    }
    this.active = false;
    meshEvents.emit('advertising_stopped');
  }

  isActive() {
    return this.active;
  }
}

const bleAdvertiser = new BleAdvertiser();
export default bleAdvertiser;
