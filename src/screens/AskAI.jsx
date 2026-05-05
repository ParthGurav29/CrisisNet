import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert} from 'react-native';
import {initModel, ask} from '../ai/llamaService';

export default function AskAIScreen() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [initStatus, setInitStatus] = useState('Initializing AI model...');
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setInitStatus('Checking model...');
        const success = await initModel();
        if (success) {
          setReady(true);
          setInitStatus('AI ready');
        } else {
          setInitStatus('Model initialization failed');
        }
      } catch (e) {
        setInitStatus('Error: ' + e.message);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const handleAsk = async () => {
    if (!input.trim() || loading || !ready) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, {role: 'user', text: question}]);
    setLoading(true);
    try {
      const response = await ask(question);
      setMessages(prev => [...prev, {role: 'ai', text: response}]);
    } catch (e) {
      setMessages(prev => [...prev, {role: 'ai', text: 'Error: ' + e.message}]);
    } finally {
      setLoading(false);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <Text style={styles.title}> AI</Text>
        <Text style={styles.subtitle}>
          {ready ? 'Powered by Gemma 2B  Offline AI' : initStatus}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        {initializing && (
          <View style={styles.placeholder}>
            <ActivityIndicator size="large" color="#4d9fff" />
            <Text style={styles.placeholderText}>{initStatus}</Text>
          </View>
        )}
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={styles.bubbleRole}>
              {msg.role === 'user' ? 'You' : ' Gemma'}
            </Text>
            <Text style={styles.bubbleText}>{msg.text}</Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubble, styles.bubbleAI]}>
            <Text style={styles.bubbleRole}> Gemma</Text>
            <ActivityIndicator size="small" color="#4dff88" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={ready ? "Ask a question..." : "AI loading..."}
          placeholderTextColor="#4a5880"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAsk}
          returnKeyType="send"
          editable={ready}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!ready || !input.trim()) && styles.sendBtnDisabled]} 
          onPress={handleAsk} 
          disabled={!ready || !input.trim()}>
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
  body: {
    padding: 20,
    paddingBottom: 100,
    gap: 12,
  },
  placeholder: {
    backgroundColor: '#121929',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2d4a',
    borderStyle: 'dashed',
    marginTop: 20,
  },
  placeholderText: {
    color: '#8899bb',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
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
