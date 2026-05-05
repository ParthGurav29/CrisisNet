import React, { useState, useEffect, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { getMessages } from '../storage/messages';
import { MeshContext } from '../context/MeshContext';

export default function NoticeBoardScreen() {
  const [messages, setMessages] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [composeText, setComposeText] = useState('');
  const { sendMessage } = useContext(MeshContext);

  const loadMessages = useCallback(async () => {
    const saved = await getMessages();
    setMessages(saved);
  }, []);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleBroadcast = () => {
    if (!composeText.trim()) return;
    const payload = {
      type: 'notice',
      text: composeText,
      timestamp: Date.now(),
    };
    sendMessage(payload).catch(e => console.error('Broadcast failed:', e));
    setComposeText('');
    setModalVisible(false);
    loadMessages();
  };

  const renderItem = ({ item }) => (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <Text style={styles.sender}>{item.sender}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notice Board</Text>
        <Text style={styles.subtitle}>Community messages via mesh network</Text>
      </View>

      <FlatList
        data={messages.filter(m => m.type === 'chat' || m.type === 'notice')}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity style={styles.composeBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.composeBtnText}>+ Broadcast Notice</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Broadcast Notice</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your message..."
              placeholderTextColor="#4a5880"
              value={composeText}
              onChangeText={setComposeText}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={handleBroadcast}>
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6677aa',
  },
  list: {
    padding: 20,
    gap: 12,
  },
  messageCard: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sender: {
    color: '#4d9fff',
    fontWeight: '600',
    fontSize: 13,
  },
  timestamp: {
    color: '#4a5880',
    fontSize: 11,
  },
  messageText: {
    color: '#e0e8ff',
    fontSize: 14,
    lineHeight: 20,
  },
  composeBtn: {
    backgroundColor: '#121929',
    borderTopWidth: 1,
    borderTopColor: '#1e2d4a',
    padding: 16,
    alignItems: 'center',
  },
  composeBtnText: {
    color: '#4d9fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0f1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a2238',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6677aa',
  },
  sendBtn: {
    flex: 1,
    backgroundColor: '#4d9fff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});