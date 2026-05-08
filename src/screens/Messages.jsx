import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Animated } from 'react-native';
import { useMesh } from '../hooks/useMesh';
import { getMessages, clearMessages } from '../storage/messages';

export default function MessagesScreen() {
  const { messages, nodes, isConnected, lastMessageTime } = useMesh();
  const [refreshing, setRefreshing] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isConnected && nodes.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [isConnected, nodes.length, pulseAnim]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getTriageColor = (tag) => {
    switch ((tag || '').toUpperCase()) {
      case 'RED': return '#ff2244';
      case 'YELLOW': return '#ffaa00';
      case 'GREEN': return '#00cc66';
      default: return '#ffaa00';
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  const handleClearMessages = async () => {
    await clearMessages();
  };

  const renderItem = ({ item }) => {
    const isEmergency = item.type === 'emergency';
    const triageColor = getTriageColor(item.triage);

    return (
      <View style={[
        styles.messageItem,
        isEmergency && { borderLeftColor: triageColor, borderLeftWidth: 3 }
      ]}>
        <View style={styles.messageHeader}>
          <Text style={styles.sender}>{item.sender || 'Unknown'}</Text>
          <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
        </View>
        <Text style={[styles.messageText, isEmergency && { color: triageColor }]}>
          {item.text || item.content || 'Message'}
        </Text>
        {isEmergency && item.triage && (
          <View style={[styles.triageBadge, { backgroundColor: triageColor + '33' }]}>
            <Text style={[styles.triageText, { color: triageColor }]}>{item.triage}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          <Text style={styles.messageCount}>{messages.length} messages</Text>
          <TouchableOpacity onPress={handleClearMessages}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Animated.View style={[styles.statusDot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.statusText}>
          {isConnected ? `${nodes.length} devices connected` : 'Offline mode'}
        </Text>
        <Text style={styles.timeText}>
          {lastMessageTime ? new Date(lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No recent messages'}
        </Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📬</Text>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Messages from nearby devices will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2d4a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageCount: {
    color: '#6677aa',
    fontSize: 14,
  },
  clearText: {
    color: '#ff3b5c',
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2d4a',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00cc66',
  },
  statusText: {
    color: '#6677aa',
    fontSize: 12,
    flex: 1,
  },
  timeText: {
    color: '#3d4f70',
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySub: {
    color: '#6677aa',
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  messageItem: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sender: {
    color: '#4d9fff',
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    color: '#3d4f70',
    fontSize: 11,
  },
  messageText: {
    color: '#e0e8ff',
    fontSize: 15,
    lineHeight: 20,
  },
  triageBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  triageText: {
    fontSize: 11,
    fontWeight: '700',
  },
});