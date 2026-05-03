import React from 'react';
import {View, Text, StyleSheet, StatusBar} from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <View style={styles.header}>
        <Text style={styles.logo}>🆘 CrisisNet</Text>
        <Text style={styles.tagline}>Built for everyday. Ready for anything.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📡</Text>
        <Text style={styles.cardTitle}>Mesh Status</Text>
        <Text style={styles.cardSub}>Searching for nearby nodes...</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>🔄</Text>
        <Text style={styles.cardTitle}>Mode</Text>
        <Text style={styles.cardSub}>Everyday Mode</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>🛰️</Text>
        <Text style={styles.cardTitle}>Network</Text>
        <Text style={styles.cardSub}>0 nodes connected</Text>
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
    marginBottom: 32,
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
});
