import React, { useState } from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert} from 'react-native';
import { useMesh } from '../hooks/useMesh';

const getTriageColor = (tag) => {
  switch ((tag || '').toUpperCase()) {
    case 'RED': return '#ff2244';
    case 'YELLOW': return '#ffaa00';
    case 'GREEN': return '#00cc66';
    default: return '#ffaa00';
  }
};

export default function EmergencyScreen() {
  const { messages, sendEmergency } = useMesh();

  const emergencyFeed = messages.filter(m => m.type === 'emergency');

  const handleSOS = () => {
    Alert.alert(
      "Confirm SOS",
      "This will broadcast an emergency signal to all nearby devices. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "BROADCAST", 
          style: "destructive",
          onPress: () => {
            sendEmergency({
              type: 'SOS',
              desc: 'Emergency SOS Signal Sent',
              color: 'RED'
            });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Emergency</Text>
        <Text style={styles.subtitle}>Live mesh feed · No internet required</Text>
      </View>

      <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
        <Text style={styles.sosIcon}>🆘</Text>
        <Text style={styles.sosText}>SOS BROADCAST</Text>
        <Text style={styles.sosSub}>Tap to broadcast across entire mesh</Text>
      </TouchableOpacity>

      <Text style={styles.feedLabel}>Emergency Mesh Feed</Text>

      <ScrollView contentContainerStyle={styles.feed}>
        {emergencyFeed.length > 0 ? (
          emergencyFeed.map(item => {
            const color = getTriageColor(item.triage);
            return (
              <View key={item.id} style={[styles.feedCard, {borderLeftColor: color}]}>
                <View style={[styles.typeBadge, {backgroundColor: color + '33'}]}>
                  <Text style={[styles.typeText, {color: color}]}>{item.sender === 'You' ? 'MY ALERT' : 'SOS'}</Text>
                </View>
                <Text style={styles.feedDesc}>{item.text}</Text>
                <View style={styles.feedMeta}>
                  <Text style={styles.feedSender}>{item.sender}</Text>
                  <Text style={styles.feedTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                </View>
              </View>
            )
          })
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No active emergencies</Text>
            <Text style={styles.placeholderSub}>Powered by mesh broadcast · real-time</Text>
          </View>
        )}
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
  sosButton: {
    margin: 20,
    backgroundColor: '#1a0810',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ff2244',
    padding: 24,
    alignItems: 'center',
  },
  sosIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  sosText: {
    color: '#ff2244',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  sosSub: {
    color: '#cc4455',
    fontSize: 12,
  },
  feedLabel: {
    color: '#6677aa',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 10,
  },
  feed: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  feedCard: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  feedDesc: {
    color: '#e0e8ff',
    fontSize: 14,
    marginBottom: 8,
  },
  feedMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feedSender: {
    color: '#4d9fff',
    fontSize: 11,
    fontWeight: '600',
  },
  feedTime: {
    color: '#4a5880',
    fontSize: 11,
  },
  placeholder: {
    backgroundColor: '#0d0d1a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e2d4a',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  placeholderText: {
    color: '#4a5880',
    fontSize: 14,
    marginBottom: 4,
  },
  placeholderSub: {
    color: '#2a3550',
    fontSize: 12,
  },
});
