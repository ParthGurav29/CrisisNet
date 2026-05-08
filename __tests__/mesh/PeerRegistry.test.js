import peerRegistry from '../../src/mesh/core/PeerRegistry';
import meshEvents from '../../src/mesh/core/MeshEvents';

jest.mock('../../src/mesh/core/MeshLogger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('PeerRegistry', () => {
  beforeEach(() => {
    peerRegistry.stop();
    jest.clearAllMocks();
  });

  test('should add new peer and emit event', () => {
    const emitSpy = jest.spyOn(meshEvents, 'emit');
    peerRegistry.updatePeer('node1', -70);
    
    const peers = peerRegistry.getPeers();
    expect(peers.length).toBe(1);
    expect(peers[0].id).toBe('node1');
    expect(peers[0].rssi).toBe(-70);
    expect(emitSpy).toHaveBeenCalledWith('peer_discovered', expect.objectContaining({ id: 'node1' }));
  });

  test('should remove peer via removePeer', () => {
    const emitSpy = jest.spyOn(meshEvents, 'emit');
    peerRegistry.updatePeer('node1', -70);
    const removed = peerRegistry.removePeer('node1');
    expect(removed).toBe(true);
    expect(peerRegistry.getPeerCount()).toBe(0);
    expect(emitSpy).toHaveBeenCalledWith('peer_lost', { peerId: 'node1' });
  });

  test('should smooth RSSI over multiple updates', () => {
    peerRegistry.updatePeer('node1', -70);
    peerRegistry.updatePeer('node1', -80);
    peerRegistry.updatePeer('node1', -60);
    
    const peer = peerRegistry.getPeers()[0];
    expect(peer.rssi).toBe(-70); // average of -70, -80, -60
  });

  test('should handle smoothing with more than 3 updates', () => {
    peerRegistry.updatePeer('node1', -100);
    peerRegistry.updatePeer('node1', -70);
    peerRegistry.updatePeer('node1', -80);
    peerRegistry.updatePeer('node1', -60);
    
    const peer = peerRegistry.getPeers()[0];
    // History should be [-70, -80, -60], average -70
    expect(peer.rssi).toBe(-70);
  });

  test('should timeout stale peers', () => {
    jest.useFakeTimers();
    // In some Jest versions, we need to mock Date.now for it to advance with fake timers
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => realNow + 16000);
    
    const emitSpy = jest.spyOn(meshEvents, 'emit');
    
    peerRegistry.updatePeer('node1', -70);
    // Since we mocked Date.now to be 16s in the future, 
    // we need to set the initial lastSeen to something older or advance after update.
    // Let's reset the mock to a baseline first.
    Date.now.mockImplementation(() => realNow);
    peerRegistry.updatePeer('node1', -70);
    
    peerRegistry.start();
    
    // Move time forward
    Date.now.mockImplementation(() => realNow + 16000);
    jest.advanceTimersByTime(16000);
    
    expect(peerRegistry.getPeerCount()).toBe(0);
    expect(emitSpy).toHaveBeenCalledWith('peer_lost', { peerId: 'node1' });
    
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
});
