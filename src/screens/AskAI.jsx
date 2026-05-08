import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIContext } from '../context/AIContext';

const RESPONSE_MODE_KEY = 'ask_ai_response_mode';
const RESPONSE_MODES = [
  { id: 'fast', label: 'Fast', tokens: 64 },
  { id: 'balanced', label: 'Balanced', tokens: 96 },
  { id: 'detailed', label: 'Detailed', tokens: 160 },
];
const DEFAULT_RESPONSE_MODE_ID = 'balanced';

export default function AskAIScreen() {
  const { isModelLoaded, isGenerating, generateResponse, getStatusText } = useContext(AIContext);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [responseMode, setResponseMode] = useState(DEFAULT_RESPONSE_MODE_ID);
  const scrollRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadResponseMode = async () => {
      try {
        const saved = await AsyncStorage.getItem(RESPONSE_MODE_KEY);
        if (!mounted || !saved) return;
        const modeExists = RESPONSE_MODES.some((mode) => mode.id === saved);
        if (modeExists) {
          setResponseMode(saved);
        }
      } catch (e) {
        // ignore persisted setting read errors
      }
    };
    loadResponseMode();
    return () => {
      mounted = false;
    };
  }, []);

  const handleResponseModeChange = async (modeId) => {
    setResponseMode(modeId);
    try {
      await AsyncStorage.setItem(RESPONSE_MODE_KEY, modeId);
    } catch (e) {
      // ignore persisted setting write errors
    }
  };

  const handleAsk = async () => {
    if (!input.trim() || isGenerating || !isModelLoaded) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);

    try {
      const selectedMode = RESPONSE_MODES.find((mode) => mode.id === responseMode) || RESPONSE_MODES[1];
      const response = await generateResponse(question, selectedMode.tokens);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error: ' + e.message }]);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
        <View style={styles.modeRow}>
          {RESPONSE_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.modeBtn,
                responseMode === mode.id && styles.modeBtnActive,
              ]}
              onPress={() => handleResponseModeChange(mode.id)}
              disabled={isGenerating}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  responseMode === mode.id && styles.modeBtnTextActive,
                ]}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  modeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2b3b5f',
    backgroundColor: '#121929',
  },
  modeBtnActive: {
    backgroundColor: '#1a3a6e',
    borderColor: '#4d9fff',
  },
  modeBtnText: {
    color: '#9cb3df',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#ffffff',
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
});