import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useMesh } from '../hooks/useMesh';

export default function ChatScreen() {
  const { messages, sendMessage, nodes, isConnected, myShortId } = useMesh();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(inputText.trim());
    } catch (error) {
      console.error('Send failed:', error);
    } finally {
      setInputText('');
      setSending(false);
    }
  };

  const chatMessages = messages.filter(m => m.type === 'chat');
  const displayShortId = myShortId || 'You';

  const getTriageColor = (tag) => {
    switch ((tag || '').toUpperCase()) {
      case 'RED': return '#ff2244';
      case 'YELLOW': return '#ffaa00';
      case 'GREEN': return '#00cc66';
      default: return '#ffaa00';
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender === displayShortId || item.sender_id === displayShortId || item.sender === myShortId;
    const isEmergency = item.type === 'emergency';
    const triageColor = getTriageColor(item.triage);

    return (
      <View style={[
        styles.bubble,
        isMe ? styles.bubbleMe : styles.bubbleThem,
        isEmergency && { borderLeftColor: triageColor, borderLeftWidth: 4 }
      ]}>
        {!isMe && (
          <View style={styles.senderRow}>
            <Text style={styles.sender}>{item.sender}</Text>
            {isEmergency && (
              <View style={[styles.emergencyBadge, { backgroundColor: triageColor + '33' }]}>
                <Text style={[styles.emergencyBadgeText, { color: triageColor }]}>
                  {item.triage || 'YELLOW'}
                </Text>
              </View>
            )}
          </View>
        )}
        {isEmergency && !isMe ? (
          <Text style={[styles.messageText, styles.emergencyText]}>{item.text}</Text>
        ) : (
          <Text style={styles.messageText}>{item.text}</Text>
        )}
        <Text style={styles.time}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Chat</Text>
        <Text style={styles.nodeCount}>
          {nodes.length} online
        </Text>
        {!isConnected && (
          <Text style={styles.searching}>Searching...</Text>
        )}
      </View>

      {chatMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Devices nearby will appear here</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={renderMessage}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#4a5880"
          value={inputText}
          onChangeText={setInputText}
          multiline
          disabled={sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  nodeCount: {
    color: '#00cc66',
    fontSize: 14,
    fontWeight: '600',
  },
  searching: {
    color: '#ffaa00',
    fontSize: 12,
    marginTop: 4,
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
  messageList: {
    padding: 16,
    paddingBottom: 20,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  bubbleMe: {
    backgroundColor: '#1a3a6e',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#121929',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sender: {
    color: '#4d9fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emergencyBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  emergencyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  messageText: {
    color: '#e0e8ff',
    fontSize: 15,
  },
  emergencyText: {
    fontWeight: '600',
  },
  time: {
    color: '#4a5880',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121929',
    borderTopWidth: 1,
    borderTopColor: '#1e2d4a',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#4d9fff',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#1a3a6e',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});