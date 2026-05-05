import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function OnboardingScreen({ onComplete }) {
  const [selected, setSelected] = useState('en');

  const handleStart = async () => {
    await AsyncStorage.setItem('language', selected);
    await AsyncStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>CrisisNet</Text>
        <Text style={styles.subtitle}>Emergency Communication System</Text>

        <Text style={styles.label}>Select Language</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langList}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langBtn, selected === lang.code && styles.langBtnActive]}
              onPress={() => setSelected(lang.code)}>
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={[styles.langLabel, selected === lang.code && styles.langLabelActive]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
        <Text style={styles.startBtnText}>Start</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    justifyContent: 'space-between',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#4d9fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6677aa',
    textAlign: 'center',
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: '#8899bb',
    marginBottom: 12,
  },
  langList: {
    gap: 12,
    paddingHorizontal: 4,
  },
  langBtn: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  langBtnActive: {
    backgroundColor: '#1a3a6e',
    borderColor: '#4d9fff',
  },
  langFlag: {
    fontSize: 24,
  },
  langLabel: {
    color: '#8899bb',
    fontSize: 16,
  },
  langLabelActive: {
    color: '#ffffff',
  },
  startBtn: {
    backgroundColor: '#4d9fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});