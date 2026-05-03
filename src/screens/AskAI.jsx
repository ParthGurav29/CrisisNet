import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';

export default function AskAIScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 Ask AI</Text>
        <Text style={styles.subtitle}>Powered by Gemma 4 · Runs fully offline</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.aiCard}>
          <Text style={styles.aiCardText}>
            "What are the symptoms of severe dehydration?"
          </Text>
          <Text style={styles.aiLabel}>Sample question</Text>
        </View>

        <View style={styles.responseCard}>
          <Text style={styles.responseHeader}>🧠 Gemma responds:</Text>
          <Text style={styles.responseText}>
            SEVERE DEHYDRATION — Signs:{'\n'}
            1. Extreme thirst, dry mouth{'\n'}
            2. No urination for 8+ hours{'\n'}
            3. Sunken eyes, rapid heartbeat{'\n'}
            4. Confusion or dizziness{'\n\n'}
            Act immediately — seek water and shade.
          </Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>⌨️</Text>
          <Text style={styles.placeholderText}>AI input coming soon</Text>
          <Text style={styles.placeholderSub}>
            Ask any survival or medical question — no internet required
          </Text>
        </View>
      </ScrollView>
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
  body: {
    padding: 20,
    gap: 16,
  },
  aiCard: {
    backgroundColor: '#1a3a6e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a4d8a',
  },
  aiCardText: {
    color: '#c0d8ff',
    fontSize: 15,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  aiLabel: {
    color: '#4d9fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  responseCard: {
    backgroundColor: '#0d1f0d',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a4a1a',
  },
  responseHeader: {
    color: '#4dff88',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  responseText: {
    color: '#c8f0d8',
    fontSize: 14,
    lineHeight: 22,
  },
  placeholder: {
    backgroundColor: '#121929',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2d4a',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  placeholderIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  placeholderText: {
    color: '#8899bb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  placeholderSub: {
    color: '#4a5880',
    fontSize: 13,
    textAlign: 'center',
  },
});
