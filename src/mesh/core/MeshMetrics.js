import meshEvents from './MeshEvents';

class MeshMetrics {
  constructor() {
    this.discoveryCount = 0;
    this.lostCount = 0;
    this.failedGattAttempts = 0;
    this.advertiserRestarts = 0;
    this.panicRecoveries = 0;
    this.totalScanResults = 0;
    this.connectionCount = 0;
    
    this._initListeners();
  }

  _initListeners() {
    meshEvents.on('peer_discovered', () => { this.discoveryCount++; });
    meshEvents.on('peer_lost', () => { this.lostCount++; });
    meshEvents.on('advertising_started', () => { this.advertiserRestarts++; });
    meshEvents.on('raw_scan_result', () => { this.totalScanResults++; });
    meshEvents.on('peer_connected', () => { this.connectionCount++; });
    meshEvents.on('peer_disconnected', () => { this.connectionCount--; });
  }

  getSnapshot() {
    return {
      discoveryCount: this.discoveryCount,
      lostCount: this.lostCount,
      failedGattAttempts: this.failedGattAttempts,
      advertiserRestarts: this.advertiserRestarts,
      panicRecoveries: this.panicRecoveries,
      totalScanResults: this.totalScanResults,
      connectionCount: this.connectionCount,
    };
  }

  reset() {
    this.discoveryCount = 0;
    this.lostCount = 0;
    this.failedGattAttempts = 0;
    this.advertiserRestarts = 0;
    this.panicRecoveries = 0;
    this.totalScanResults = 0;
  }
}

const meshMetrics = new MeshMetrics();
export default meshMetrics;
