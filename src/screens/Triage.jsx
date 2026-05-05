import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { AIContext } from '../context/AIContext';
import { MeshContext } from '../context/MeshContext';

const TRIAGE_TAGS = [
  { tag: 'RED', label: 'Immediate', desc: 'Life threatening · Medic needed NOW', color: '#ff2244' },
  { tag: 'YELLOW', label: 'Urgent', desc: 'Stable for now · Within 30 min', color: '#ffaa00' },
  { tag: 'GREEN', label: 'Delayed', desc: 'Can wait · Monitor closely', color: '#00cc66' },
  { tag: 'BLACK', label: 'Expectant', desc: 'Beyond help · Focus elsewhere', color: '#555577' },
];

export default function TriageScreen() {
  const { isModelLoaded, isGenerating, generateTriage } = useContext(AIContext);
  const { sendEmergency } = useContext(MeshContext);
  const [breathing, setBreathing] = useState(false);
  const [severeBleeding, setSevereBleeding] = useState(false);
  const [conscious, setConscious] = useState(false);
  const [canMove, setCanMove] = useState(false);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState(null);

  const handleClassify = async () => {
    if (!isModelLoaded || isGenerating) return;

    try {
      const triage = await generateTriage({
        breathing,
        severeBleeding,
        conscious,
        canMove,
        description,
      });
      setResult(triage);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleBroadcast = () => {
    if (!result) return;
    sendEmergency({
      desc: `Triage: ${result.tag} - ${result.reason}`,
      color: result.tag,
    });
    Alert.alert('Broadcast', 'Triage packet sent via mesh network');
  };

  const ToggleButton = ({ label, value, onPress }) => (
    <TouchableOpacity
      style={[styles.toggleBtn, value && styles.toggleBtnActive]}
      onPress={onPress}>
      <Text style={[styles.toggleText, value && styles.toggleTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏥 Triage</Text>
        <Text style={styles.subtitle}>Emergency classification · Powered by Gemma</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Quick Triage Form</Text>

          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>Breathing</Text>
            <ToggleButton label="Yes" value={breathing} onPress={() => setBreathing(!breathing)} />
          </View>

          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>Severe Bleeding</Text>
            <ToggleButton label="Yes" value={severeBleeding} onPress={() => setSevereBleeding(!severeBleeding)} />
          </View>

          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>Conscious</Text>
            <ToggleButton label="Yes" value={conscious} onPress={() => setConscious(!conscious)} />
          </View>

          <View style={styles.toggleGroup}>
            <Text style={styles.toggleLabel}>Can Move</Text>
            <ToggleButton label="Yes" value={canMove} onPress={() => setCanMove(!canMove)} />
          </View>

          <TextInput
            style={styles.descriptionInput}
            placeholder="Additional notes (optional)..."
            placeholderTextColor="#4a5880"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.classifyBtn, (!isModelLoaded || isGenerating) && styles.classifyBtnDisabled]}
            onPress={handleClassify}
            disabled={!isModelLoaded || isGenerating}>
            <Text style={styles.classifyBtnText}>
              {isGenerating ? 'Classifying...' : 'Classify'}
            </Text>
          </TouchableOpacity>

          {result && (
            <View style={[styles.resultCard, { borderLeftColor: TRIAGE_TAGS.find(t => t.tag === result.tag)?.color || '#ffaa00' }]}>
              <View style={styles.resultHeader}>
                <View style={[styles.tagBadge, { backgroundColor: TRIAGE_TAGS.find(t => t.tag === result.tag)?.color || '#ffaa00' }]}>
                  <Text style={styles.tagBadgeText}>{result.tag}</Text>
                </View>
                <Text style={styles.resultReason}>{result.reason}</Text>
              </View>
              <TouchableOpacity style={styles.broadcastResultBtn} onPress={handleBroadcast}>
                <Text style={styles.broadcastResultBtnText}>Broadcast Result</Text>
              </TouchableOpacity>
            </View>
          )}
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
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: '#121929',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  formTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    color: '#c0cfee',
    fontSize: 14,
  },
  toggleBtn: {
    backgroundColor: '#1a2540',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2a3a60',
  },
  toggleBtnActive: {
    backgroundColor: '#4d9fff',
    borderColor: '#4d9fff',
  },
  toggleText: {
    color: '#8899bb',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  descriptionInput: {
    backgroundColor: '#1a2238',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 20,
  },
  classifyBtn: {
    backgroundColor: '#4d9fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  classifyBtnDisabled: {
    backgroundColor: '#1a3a6e',
  },
  classifyBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  resultCard: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  tagBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  resultReason: {
    color: '#e0e8ff',
    fontSize: 14,
    flex: 1,
  },
  broadcastResultBtn: {
    backgroundColor: '#ff3b5c',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  broadcastResultBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
});