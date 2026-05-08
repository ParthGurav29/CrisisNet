import { AppState } from 'react-native';
import { MeshState } from './MeshState';
import meshEvents from './MeshEvents';
import meshLogger from './MeshLogger';
import identity from './Identity';
import capabilities from './Capabilities';
import bleAdvertiser from './BleAdvertiser';
import bleScanner from './BleScanner';
import peerRegistry from './PeerRegistry';
import recoveryManager from './RecoveryManager';
import gattServer from './GattServer';
import heartbeat from './Heartbeat';

class MeshManager {
  constructor() {
    this.state = MeshState.IDLE;
    this.initialized = false;
    this.discoveryActive = false;
    this.appStateListener = null;
  }

  async init() {
    if (this.initialized) {
      meshLogger.warn('manager', 'MeshManager already initialized');
      return;
    }

    try {
      this._transition(MeshState.INITIALIZING);
      meshLogger.info('manager', 'Initializing Mesh Core...');

      // Phase 1: Identity & Foundation
      await identity.init();
      
      // Phase 2: Hardware & Discovery Foundation
      await capabilities.check();
      if (!capabilities.isSupported()) {
        meshLogger.error('manager', 'BLE Mesh not supported on this device');
        this._transition(MeshState.FAILED);
        return;
      }

      // Initialize Recovery Manager
      recoveryManager.init(this);

      // Handle App State (Background/Foreground)
      this.appStateListener = AppState.addEventListener('change', (nextState) => {
        meshLogger.info('manager', `App state changed: ${nextState}`);
        if (nextState === 'active' && this.initialized) {
          this.startDiscovery().catch(() => {});
        }
      });

      this.initialized = true;
      meshLogger.info('manager', 'Mesh Core foundation ready.');
      this._transition(MeshState.READY);

      // Automatically start discovery on init success
      await this.startDiscovery();
    } catch (e) {
      meshLogger.error('manager', `Initialization failed: ${e.message}`);
      this._transition(MeshState.FAILED);
      throw e;
    }
  }

  async startDiscovery() {
    if (!this.initialized) {
      meshLogger.warn('manager', 'Cannot start discovery: not initialized');
      return;
    }
    if (this.discoveryActive) return;

    meshLogger.info('manager', 'Starting Mesh Discovery...');
    try {
      const nodeId = identity.getNodeId();
      
      peerRegistry.start();
      if (capabilities.sdkOwnsBleTransport) {
        meshLogger.info(
          'manager',
          'BLE scan/advertise/GATT run inside mesh-sdk after meshService.protocol.start(); skipping JS duty scanner',
        );
      }
      await bleAdvertiser.start(nodeId);
      if (!capabilities.sdkOwnsBleTransport) {
        await bleScanner.start();
      }
      await gattServer.start();
      heartbeat.start();
      
      this.discoveryActive = true;
      meshLogger.info('manager', 'Mesh Discovery ACTIVE');
    } catch (e) {
      meshLogger.error('manager', `Discovery start failed: ${e.message}`);
      this.stopDiscovery();
    }
  }

  async stopDiscovery() {
    meshLogger.info('manager', 'Stopping Mesh Discovery...');
    this.discoveryActive = false;
    
    try {
      heartbeat.stop();
      await gattServer.stop();
      await bleScanner.stop();
      await bleAdvertiser.stop();
      peerRegistry.stop();
    } catch (e) {
      meshLogger.warn('manager', `Discovery stop warning: ${e.message}`);
    }
    meshLogger.info('manager', 'Mesh Discovery STOPPED');
  }

  async panic() {
    meshLogger.warn('manager', 'PANIC TRIGGERED: Rebuilding Mesh Core...');
    await this.stopDiscovery();
    this.initialized = false;
    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
    recoveryManager.stop();
    await this.init();
  }

  _transition(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    meshLogger.info('manager', `State transition: ${oldState} -> ${newState}`);
    meshEvents.emit('state_changed', { oldState, newState });
  }

  getState() {
    return this.state;
  }
}

const meshManager = new MeshManager();
export default meshManager;
