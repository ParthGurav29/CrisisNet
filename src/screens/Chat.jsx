import React from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';

const PLACEHOLDER_MESSAGES = [
  {id: '1', sender: 'Device A', text: 'Hey, is everyone okay?', time: '14:21'},
  {id: '2', sender: 'Device B', text: 'Yes, all good on my end.', time: '14:22'},
  {id: '3', sender: 'You', text: 'Mesh is holding. Stay close.', time: '14:22'},
];

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 Offline Chat</Text>
        <Text style={styles.subtitle}>No internet needed · BLE mesh</Text>
      </View>

      <FlatList
        data={PLACEHOLDER_MESSAGES}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({item}) => {
          const isMe = item.sender === 'You';
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && <Text style={styles.sender}>{item.sender}</Text>}
              <Text style={styles.messageText}>{item.text}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <Text style={styles.inputPlaceholder}>Type a message... (coming soon)</Text>
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
    color: '#6677aa',
    fontSize: 13,
  },
  messageList: {
    padding: 16,
    paddingBottom: 80,
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
  sender: {
    color: '#4d9fff',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    color: '#e0e8ff',
    fontSize: 15,
  },
  time: {
    color: '#4a5880',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  inputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121929',
    borderTopWidth: 1,
    borderTopColor: '#1e2d4a',
    padding: 16,
    paddingBottom: 24,
  },
  inputPlaceholder: {
    color: '#4a5880',
    fontSize: 15,
  },
});
