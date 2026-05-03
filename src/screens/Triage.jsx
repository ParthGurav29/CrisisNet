import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';

const TRIAGE_TAGS = [
  {tag: 'RED', label: 'Immediate', desc: 'Life threatening · Medic needed NOW', color: '#ff2244'},
  {tag: 'YELLOW', label: 'Urgent', desc: 'Stable for now · Within 30 min', color: '#ffaa00'},
  {tag: 'GREEN', label: 'Walking wounded', desc: 'Can wait · Monitor closely', color: '#00cc66'},
  {tag: 'BLACK', label: 'Expectant', desc: 'Beyond help · Focus elsewhere', color: '#555577'},
];

export default function TriageScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏥 Triage</Text>
        <Text style={styles.subtitle}>Emergency classification · Powered by Gemma</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.formPlaceholder}>
          <Text style={styles.formTitle}>Quick Triage Form</Text>
          {['Is the person breathing?', 'Is there severe bleeding?', 'Are they conscious?', 'Can they move?'].map((q, i) => (
            <View key={i} style={styles.question}>
              <Text style={styles.questionText}>{q}</Text>
              <View style={styles.yesNo}>
                <View style={styles.optionBox}><Text style={styles.optionText}>Yes</Text></View>
                <View style={styles.optionBox}><Text style={styles.optionText}>No</Text></View>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Triage Tags</Text>
        {TRIAGE_TAGS.map(item => (
          <View key={item.tag} style={[styles.tagCard, {borderLeftColor: item.color}]}>
            <View style={[styles.tagBadge, {backgroundColor: item.color}]}>
              <Text style={styles.tagBadgeText}>{item.tag}</Text>
            </View>
            <View>
              <Text style={styles.tagLabel}>{item.label}</Text>
              <Text style={styles.tagDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
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
    paddingBottom: 40,
  },
  formPlaceholder: {
    backgroundColor: '#121929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  formTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  question: {
    marginBottom: 16,
  },
  questionText: {
    color: '#c0cfee',
    fontSize: 14,
    marginBottom: 8,
  },
  yesNo: {
    flexDirection: 'row',
    gap: 10,
  },
  optionBox: {
    flex: 1,
    backgroundColor: '#1a2540',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3a60',
  },
  optionText: {
    color: '#8899bb',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    color: '#6677aa',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  tagCard: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1e2d4a',
    gap: 14,
  },
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  tagBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  tagLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  tagDesc: {
    color: '#6677aa',
    fontSize: 12,
  },
});
