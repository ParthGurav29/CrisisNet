import express from 'express';
import cors from 'cors';
import meshService from '../mesh/meshService';

const app = express();
const PORT = process.env.MESH_API_PORT || 3001;

app.use(cors());
app.use(express.json());

let server = null;

const startServer = async () => {
  try {
    await meshService.init();
  } catch (e) {
    console.warn('[ExpressServer] meshService.init failed:', e?.message);
  }

  server = app.listen(PORT, () => {
    console.log(`[ExpressServer] Mesh API listening on port ${PORT}`);
  });
};

const stopServer = () => {
  if (server) {
    server.close(() => {
      console.log('[ExpressServer] Server stopped');
    });
    server = null;
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/nodes', (req, res) => {
  const peers = meshService.getPeers();
  res.json({
    count: peers.length,
    nodes: peers.map(p => ({
      id: p.id,
      shortId: p.id?.substring(0, 6) || 'unknown',
      name: p.name || p.id?.substring(0, 6) || 'unknown',
      rssi: p.rssi,
      transport: p.transport,
      lastSeen: p.lastSeenMs
    }))
  });
});

app.get('/api/nodes/:nodeId', (req, res) => {
  const { nodeId } = req.params;
  const peers = meshService.getPeers();
  const node = peers.find(p => p.id === nodeId);
  
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }
  
  res.json({
    id: node.id,
    shortId: node.id?.substring(0, 6) || 'unknown',
    name: node.name || node.id?.substring(0, 6) || 'unknown',
    rssi: node.rssi,
    transport: node.transport,
    lastSeen: node.lastSeenMs
  });
});

app.post('/api/nodes/:nodeId/message', async (req, res) => {
  const { nodeId } = req.params;
  const { text, type = 'chat', priority = 'medium' } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }
  
  const peers = meshService.getPeers();
  const node = peers.find(p => p.id === nodeId);
  
  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }
  
  try {
    const payload = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      type: 'message',
      content: text,
      sender: meshService.getProtocolUserId(),
      recipient: nodeId,
      timestamp: Date.now(),
      priority
    };
    
    const result = await meshService.sendMessage(payload);
    
    res.json({
      success: true,
      messageId: result.id,
      recipient: nodeId,
      recipientName: node.name || node.id?.substring(0, 6)
    });
  } catch (e) {
    console.error('[ExpressServer] Failed to send message:', e?.message);
    res.status(500).json({ error: 'Failed to send message', details: e?.message });
  }
});

app.post('/api/nodes/broadcast', async (req, res) => {
  const { text, type = 'chat', priority = 'medium' } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }
  
  try {
    const peers = meshService.getPeers();
    const payload = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      type: 'message',
      content: text,
      sender: meshService.getProtocolUserId(),
      timestamp: Date.now(),
      priority
    };
    
    const result = await meshService.sendMessage(payload);
    
    res.json({
      success: true,
      messageId: payload.id,
      recipients: peers.length
    });
  } catch (e) {
    console.error('[ExpressServer] Failed to broadcast:', e?.message);
    res.status(500).json({ error: 'Failed to broadcast', details: e?.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    connected: meshService.isInitialized,
    peerCount: meshService.getPeers().length,
    stats: meshService.getStats()
  });
});

app.get('/api/debug/peers', (req, res) => {
  const peers = meshService.getPeers();
  const peerStates = meshService.getPeerStates();
  
  res.json({
    timestamp: new Date().toISOString(),
    connected: meshService.isInitialized,
    peerCount: peers.length,
    peers: peers.map(p => ({
      bleAddress: p.id,
      deviceId: p.id?.substring(0, 6) || 'unknown',
      gattConnected: p.transport === 'ble',
      servicesDiscovered: true,
      notificationsEnabled: p.peerState?.sessionEstablished || false,
      linkReady: p.peerState?.linkReady || false,
      peerRegistered: p.peerState?.peerRegistered || false,
      sessionEstablished: p.peerState?.sessionEstablished || false,
      pendingInboundFragments: p.peerState?.pendingInboundFragments || 0,
      pendingOutboundFragments: p.peerState?.pendingOutboundFragments || 0,
      lastHelloTimestamp: p.peerState?.lastHelloTimestamp || 0,
      lastPacketTimestamp: p.peerState?.lastPacketTimestamp || 0,
      lastDecodeFailure: p.peerState?.lastDecodeFailure || null,
      lastRouteUpdate: p.lastSeenMs || 0,
    })),
    peerStates
  });
});

export { app, startServer, stopServer, PORT };