import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, Alert, TextInput } from 'react-native';
import meshManager from '../mesh/core/MeshManager';
import meshEvents from '../mesh/core/MeshEvents';
import peerRegistry from '../mesh/core/PeerRegistry';
import identity from '../mesh/core/Identity';
import meshMetrics from '../mesh/core/MeshMetrics';
import { MeshStateLabels } from '../mesh/core/MeshState';
import bleScanner from '../mesh/core/BleScanner';
import bleAdvertiser from '../mesh/core/BleAdvertiser';
import meshService from '../mesh/meshService';
import capabilities from '../mesh/core/Capabilities';
import { useMesh } from '../hooks/useMesh';

const PORT = 3001;

export default function MeshDebugScreen() {
  const { sendMessageToNode } = useMesh();
  const [state, setState] = useState(meshManager.getState());
  const [peers, setPeers] = useState(peerRegistry.getPeers());
  const [metrics, setMetrics] = useState(meshMetrics.getSnapshot());
  const [isScanning, setIsScanning] = useState(bleScanner.isScanning());
  const [isAdvertising, setIsAdvertising] = useState(bleAdvertiser.isActive());
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    const onStateChanged = ({ newState }) => setState(newState);
    const updatePeers = () => setPeers(peerRegistry.getPeers());
    const updateMetrics = () => setMetrics(meshMetrics.getSnapshot());
    const onScanStarted = () => setIsScanning(true);
    const onScanStopped = () => setIsScanning(false);
    const onAdvStarted = () => setIsAdvertising(true);
    const onAdvStopped = () => setIsAdvertising(false);

    meshEvents.on('state_changed', onStateChanged);
    meshEvents.on('peer_discovered', updatePeers);
    meshEvents.on('peer_lost', updatePeers);
    meshEvents.on('peer_updated', updatePeers);
    meshEvents.on('advertising_started', onAdvStarted);
    meshEvents.on('advertising_stopped', onAdvStopped);
    meshEvents.on('scan_started', onScanStarted);
    meshEvents.on('scan_stopped', onScanStopped);

    const metricsInterval = setInterval(updateMetrics, 1000);

    return () => {
      meshEvents.off('state_changed', onStateChanged);
      meshEvents.off('peer_discovered', updatePeers);
      meshEvents.off('peer_lost', updatePeers);
      meshEvents.off('peer_updated', updatePeers);
      meshEvents.off('advertising_started', onAdvStarted);
      meshEvents.off('advertising_stopped', onAdvStopped);
      meshEvents.off('scan_started', onScanStarted);
      meshEvents.off('scan_stopped', onScanStopped);
      clearInterval(metricsInterval);
    };
  }, []);

  const sendMessageToPeer = async (peerId, text) => {
    if (!text.trim()) return;
    try {
      const payload = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
        type: 'message',
        content: text.trim(),
        sender: meshService.getProtocolUserId(),
        recipient: peerId,
        timestamp: Date.now()
      };
      await meshService.sendMessage(payload);
      Alert.alert('Message Sent', `Message sent to ${peerId.substring(0, 6)}`);
    } catch (e) {
      Alert.alert('Send Failed', e?.message || 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Debug Console</Text>
        <Text style={styles.subtitle}>Session: {identity.getSessionId()}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>
          <StatusRow label="State" value={MeshStateLabels[state] || state} />
          <StatusRow label="Node ID (UI key)" value={identity.getNodeId() || '—'} />
          <StatusRow
            label="Protocol userId"
            value={meshService.getProtocolUserId() || '(meshService not init)'}
          />
          <StatusRow
            label="BLE transport"
            value={capabilities.sdkOwnsBleTransport ? 'mesh-sdk native' : 'custom / stub'}
          />
          <StatusRow label="Scanning" value={capabilities.sdkOwnsBleTransport ? '(SDK)' : (isScanning ? 'ACTIVE' : 'IDLE')} color={isScanning ? '#00cc66' : '#6677aa'} />
          <StatusRow label="Advertising" value={capabilities.sdkOwnsBleTransport ? '(SDK)' : (isAdvertising ? 'ACTIVE' : 'IDLE')} color={isAdvertising ? '#00cc66' : '#6677aa'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Endpoints (Express Server)</Text>
          <StatusRow label="GET /api/nodes" value={`${PORT}:3001/api/nodes`} />
          <StatusRow label="POST /api/nodes/:id/message" value="Send to specific node" />
          <StatusRow label="POST /api/nodes/broadcast" value="Send to all nodes" />
          <StatusRow label="GET /api/status" value="Mesh status" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery Metrics</Text>
          <StatusRow label="Peers (Nearby)" value={peers.length} />
          <StatusRow label="Peers (Connected)" value={metrics.connectionCount} color={metrics.connectionCount > 0 ? '#00cc66' : '#6677aa'} />
          <StatusRow label="Total Scan Results" value={metrics.totalScanResults} />
          <StatusRow label="Advertiser Restarts" value={metrics.advertiserRestarts} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Peers</Text>
          {peers.length === 0 ? (
            <Text style={styles.emptyText}>No peers discovered yet.</Text>
          ) : (
            peers.map(peer => (
              <PeerCard key={peer.id} peer={peer} onSendMessage={sendMessageToPeer} />
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={() => meshManager.startDiscovery()}>
          <Text style={styles.buttonText}>Start Discovery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#ff3b5c' }]} onPress={() => meshManager.stopDiscovery()}>
          <Text style={styles.buttonText}>Stop Discovery</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatusRow({ label, value, color = '#e0e8ff' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

function PeerCard({ peer, onSendMessage }) {
  const [message, setMessage] = useState('');
  
  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(peer.id, message);
      setMessage('');
    }
  };

  return (
    <View style={styles.peerCard}>
      <View style={styles.peerHeader}>
        <Text style={styles.peerId}>{peer.id?.substring(0, 8) || 'unknown'}...</Text>
        <Text style={styles.peerRssi}>RSSI: {peer.rssi} dBm</Text>
      </View>
      <Text style={styles.peerDetail}>Transport: {peer.capabilities?.transport || 'ble'}</Text>
      <Text style={styles.peerDetail}>Last seen: {Math.round((Date.now() - (peer.lastSeen || Date.now())) / 1000)}s ago</Text>
      <View style={styles.messageInputRow}>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type message..."
          placeholderTextColor="#3d4f70"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2d4a',
  },
  title: {
    color: '#4d9fff',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6677aa',
    fontSize: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2d4a',
  },
  sectionTitle: {
    color: '#e0e8ff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#6677aa',
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: '#3d4f70',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  peerCard: {
    backgroundColor: '#121929',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  peerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  peerId: {
    color: '#4d9fff',
    fontSize: 14,
    fontWeight: '700',
  },
  peerRssi: {
    color: '#6677aa',
    fontSize: 11,
  },
  peerDetail: {
    color: '#6677aa',
    fontSize: 11,
    marginBottom: 4,
  },
  peerStat: {
    color: '#6677aa',
    fontSize: 11,
  },
  messageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  messageInputContainer: {
    flex: 1,
    backgroundColor: '#1a2238',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  messageInput: {
    color: '#8899bb',
    fontSize: 11,
  },
  sendBtn: {
    backgroundColor: '#4d9fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#4d9fff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
