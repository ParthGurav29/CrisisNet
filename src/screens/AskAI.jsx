import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { AIContext } from '../context/AIContext';
import { buildSurvivalPrompt } from '../ai/prompts';
import { MeshContext } from '../context/MeshContext';

export default function AskAIScreen() {
  const { isModelLoaded, isGenerating, generateResponse, getStatusText, isDeviceSupported } = useContext(AIContext);
  const { sendEmergency } = useContext(MeshContext);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  const handleAsk = async () => {
    if (!input.trim() || isGenerating || !isModelLoaded) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);

    try {
      const prompt = buildSurvivalPrompt(question);
      const response = await generateResponse(prompt);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + e.message }]);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleBroadcast = () => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'ai') return;
    sendEmergency({
      desc: lastMessage.text.substring(0, 100),
      color: 'YELLOW',
    });
    Alert.alert('Broadcast', 'Emergency packet sent via mesh network');
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <Text style={styles.title}>AI</Text>
        <Text style={styles.subtitle}>
          {getStatusText()}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={styles.bubbleRole}>
              {msg.role === 'user' ? 'You' : 'Gemma'}
            </Text>
            <Text style={styles.bubbleText}>{msg.text}</Text>
          </View>
        ))}
        {isGenerating && (
          <View style={[styles.bubble, styles.bubbleAI]}>
            <Text style={styles.bubbleRole}>Gemma</Text>
            <ActivityIndicator size="small" color="#4dff88" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={isModelLoaded ? 'Ask a question...' : 'AI loading...'}
          placeholderTextColor="#4a5880"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAsk}
          returnKeyType="send"
          editable={isModelLoaded}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!isModelLoaded || !input.trim()) && styles.sendBtnDisabled]}
          onPress={handleAsk}
          disabled={!isModelLoaded || !input.trim()}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      {messages.length > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleClear}>
            <Text style={styles.actionBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.broadcastBtn} onPress={handleBroadcast}>
            <Text style={styles.broadcastBtnText}>Broadcast</Text>
          </TouchableOpacity>
        </View>
      )}
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
  subtitle: {
    color: '#6677aa',
    fontSize: 13,
  },
  body: {
    padding: 20,
    paddingBottom: 100,
    gap: 12,
  },
  bubble: {
    borderRadius: 16,
    padding: 14,
    maxWidth: '85%',
  },
  bubbleUser: {
    backgroundColor: '#1a3a6e',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#0d1f0d',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#1a4a1a',
    borderBottomLeftRadius: 4,
  },
  bubbleRole: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    color: '#4d9fff',
  },
  bubbleText: {
    color: '#e0e8ff',
    fontSize: 14,
    lineHeight: 22,
  },
  inputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#121929',
    borderTopWidth: 1,
    borderTopColor: '#1e2d4a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a2238',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#4d9fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    backgroundColor: '#1a3a6e',
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e2d4a',
    backgroundColor: '#121929',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtnText: {
    color: '#6677aa',
    fontWeight: '600',
  },
  broadcastBtn: {
    backgroundColor: '#ff3b5c',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  broadcastBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
});