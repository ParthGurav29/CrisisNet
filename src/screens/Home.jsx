import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, Platform, Linking, Animated } from 'react-native';
import { useMesh } from '../hooks/useMesh';
import { checkBlePermissions } from '../utils/permissions';

export default function HomeScreen({ navigation }) {
  const { nodes, isConnected, lastMessageTime, scanning, advertising } = useMesh();
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(true);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    checkBluetoothStatus();
  }, []);

  const checkBluetoothStatus = async () => {
    try {
      const result = await checkBlePermissions();
      setIsBluetoothEnabled(Boolean(result.granted));
      if (!result.granted) {
        setTimeout(() => openBluetoothSettings(), 500);
      }
    } catch (err) {
      console.warn('Bluetooth check failed:', err);
    }
  };

  useEffect(() => {
    if (isConnected && nodes.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else if (scanning || advertising) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.8, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isConnected, nodes.length, scanning, advertising, pulseAnim]);

  const openBluetoothSettings = () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Bluetooth Disabled',
        'Bluetooth is off — mesh communication is disabled. Enable Bluetooth to use mesh networking.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Enable', onPress: () => {
            Linking.openSettings();
          }},
        ]
      );
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = () => {
    if (!isBluetoothEnabled) return '#ff3b5c';
    if (!isConnected) return '#ffaa00';
    if (nodes.length === 0) return '#ffaa00';
    return '#00cc66';
  };

  const getStatusText = () => {
    if (!isBluetoothEnabled) return 'BT OFF';
    if (!isConnected) return 'OFFLINE';
    if (nodes.length === 0) return 'SEARCHING';
    return 'ACTIVE';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <View style={styles.header}>
        <Text style={styles.logo}>🆘 CrisisNet</Text>
        <Text style={styles.tagline}>Built for everyday. Ready for anything.</Text>
      </View>

      <TouchableOpacity style={styles.statusRow} onPress={() => navigation.navigate('Chat')}>
        <Animated.View style={[styles.statusIndicator, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </Animated.View>
        <Text style={styles.nodeCount}>
          {nodes.length} device{nodes.length !== 1 ? 's' : ''} connected
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📡</Text>
        <View>
          <Text style={styles.cardTitle}>Mesh System</Text>
          <Text style={styles.cardSub}>
            {isConnected ? 'Broadcasting & Scanning' : 'Initializing...'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>👥</Text>
        <View>
          <Text style={styles.cardTitle}>{nodes.length} Device{nodes.length !== 1 ? 's' : ''} Nearby</Text>
          <Text style={styles.cardSub}>
            {nodes.length === 0 ? 'No devices found — searching...' : `${nodes.length} device(s) connected via mesh`}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>💬</Text>
        <View>
          <Text style={styles.cardTitle}>Last Message</Text>
          <Text style={styles.cardSub}>
            {lastMessageTime ? formatTime(lastMessageTime) : 'No messages yet'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>🔄</Text>
        <View>
          <Text style={styles.cardTitle}>Protocol</Text>
          <Text style={styles.cardSub}>BLE Multi-hop Relay</Text>
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Chat')}>
          <Text style={styles.quickBtnText}>💬 Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Triage')}>
          <Text style={styles.quickBtnText}>🏥 Triage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Ask AI')}>
          <Text style={styles.quickBtnText}>🤖 AI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ff3b5c',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    color: '#8899bb',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#121929',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: '#e0e8ff',
    fontSize: 14,
    fontWeight: '700',
  },
  nodeCount: {
    color: '#6677aa',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#121929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  cardIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSub: {
    color: '#6677aa',
    fontSize: 13,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  quickBtnText: {
    color: '#4d9fff',
    fontWeight: '600',
  },
});