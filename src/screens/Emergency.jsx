import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';

const EMERGENCY_FEED = [
  {id: '1', type: 'SOS', sender: 'Device-A7F2', desc: 'Person unconscious, 3rd floor', time: '2m ago', color: '#ff2244'},
  {id: '2', type: 'HAZARD', sender: 'Device-B3C1', desc: 'Gas smell near east stairwell', time: '5m ago', color: '#ffaa00'},
  {id: '3', type: 'RESOURCE', sender: 'Device-D9E4', desc: 'First aid kit found at lobby', time: '8m ago', color: '#00cc66'},
];

export default function EmergencyScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Emergency</Text>
        <Text style={styles.subtitle}>Live mesh feed · No internet required</Text>
      </View>

      <View style={styles.sosButton}>
        <Text style={styles.sosIcon}>🆘</Text>
        <Text style={styles.sosText}>SOS BROADCAST</Text>
        <Text style={styles.sosSub}>Tap to broadcast across entire mesh</Text>
      </View>

      <Text style={styles.feedLabel}>Emergency Mesh Feed</Text>

      <ScrollView contentContainerStyle={styles.feed}>
        {EMERGENCY_FEED.map(item => (
          <View key={item.id} style={[styles.feedCard, {borderLeftColor: item.color}]}>
            <View style={[styles.typeBadge, {backgroundColor: item.color + '33'}]}>
              <Text style={[styles.typeText, {color: item.color}]}>{item.type}</Text>
            </View>
            <Text style={styles.feedDesc}>{item.desc}</Text>
            <View style={styles.feedMeta}>
              <Text style={styles.feedSender}>{item.sender}</Text>
              <Text style={styles.feedTime}>{item.time}</Text>
            </View>
          </View>
        ))}

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>More events will appear here</Text>
          <Text style={styles.placeholderSub}>Powered by mesh broadcast · real-time</Text>
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
