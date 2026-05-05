import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const CATEGORIES = [
  {
    id: 'medical',
    title: 'Medical',
    icon: '🏥',
    scenarios: [
      { id: 'bleeding', title: 'Severe Bleeding' },
      { id: 'fracture', title: 'Broken Bones' },
      { id: 'shock', title: 'Shock Treatment' },
      { id: 'burns', title: 'Burns Care' },
    ],
  },
  {
    id: 'disaster',
    title: 'Disaster',
    icon: '🌪',
    scenarios: [
      { id: 'earthquake', title: 'Earthquake Response' },
      { id: 'flood', title: 'Flood Safety' },
      { id: 'fire', title: 'Fire Evacuation' },
      { id: 'storm', title: 'Storm Shelter' },
    ],
  },
  {
    id: 'survival',
    title: 'Survival Basics',
    icon: '🔥',
    scenarios: [
      { id: 'water', title: 'Water Purification' },
      { id: 'shelter', title: 'Shelter Building' },
      { id: 'fire', title: 'Fire Making' },
      { id: 'food', title: 'Food Finding' },
    ],
  },
];

const SCENARIO_GUIDANCE = {
  bleeding: {
    title: 'Severe Bleeding',
    steps: [
      'Apply direct pressure with clean cloth',
      'Elevate wounded area above heart',
      'Use tourniquet if pressure fails',
      'Seek medical help immediately',
    ],
  },
  fracture: {
    title: 'Broken Bones',
    steps: [
      'Immobilize the limb',
      'Do not realign broken parts',
      'Control swelling with ice',
      'Evacuate patient carefully',
    ],
  },
  shock: {
    title: 'Shock Treatment',
    steps: [
      'Lay person flat with legs elevated',
      'Keep warm with blankets',
      'Monitor breathing',
      'Do not give food or water',
    ],
  },
  burns: {
    title: 'Burns Care',
    steps: [
      'Cool burn with clean water',
      'Remove constricting items',
      'Cover with sterile dressing',
      'Seek care for large burns',
    ],
  },
  earthquake: {
    title: 'Earthquake Response',
    steps: [
      'Drop, Cover, Hold On',
      'Stay indoors until shaking stops',
      'Check for gas/electric leaks',
      'Exit buildings carefully',
    ],
  },
  flood: {
    title: 'Flood Safety',
    steps: ['Move to higher ground', 'Avoid flood waters', 'Turn off electricity', 'Boil water'],
  },
  fire: {
    title: 'Fire Evacuation',
    steps: ['Stay low to avoid smoke', 'Use wet cloth if needed', 'Exit building once', 'Call emergency services'],
  },
  storm: {
    title: 'Storm Shelter',
    steps: ['Go to basement or interior room', 'Stay away from windows', 'Protect head and neck', 'Wait for all clear'],
  },
  water: {
    title: 'Water Purification',
    steps: ['Boil water for 1 minute', 'Use purification tablets', 'Filter through cloth', 'Store clean water safely'],
  },
  shelter: {
    title: 'Shelter Building',
    steps: ['Find natural windbreak', 'Gather materials', 'Create drainage', 'Insulate from ground'],
  },
  fire: {
    title: 'Fire Making',
    steps: ['Gather dry tinder', 'Create friction method', 'Build fire lay', 'Protect from wind'],
  },
  food: {
    title: 'Food Finding',
    steps: ['Identify edible plants', 'Set simple traps', 'Dig for roots', 'Avoid poisonous items'],
  },
};

export default function KnowledgeBaseScreen() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);

  const renderCategory = ({ item }) => (
    <TouchableOpacity key={item.id} style={styles.categoryBtn} onPress={() => setSelectedCategory(item)}>
      <Text style={styles.categoryIcon}>{item.icon}</Text>
      <Text style={styles.categoryTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  const renderScenario = ({ item }) => (
    <TouchableOpacity style={styles.scenarioBtn} onPress={() => setSelectedScenario(item.id)}>
      <Text style={styles.scenarioText}>{item.title}</Text>
    </TouchableOpacity>
  );

  const renderGuidance = () => {
    if (!selectedScenario || !SCENARIO_GUIDANCE[selectedScenario]) return null;
    const guide = SCENARIO_GUIDANCE[selectedScenario];
    return (
      <View style={styles.guidanceContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedScenario(null)}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.guidanceTitle}>{guide.title}</Text>
        {guide.steps.map((step, idx) => (
          <View key={idx} style={styles.step}>
            <Text style={styles.stepNum}>{idx + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (selectedCategory && !selectedScenario) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCategory(null)}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.categoryHeader}>{selectedCategory.title}</Text>
        <ScrollView contentContainerStyle={styles.scenarioList}>
          {selectedCategory.scenarios.map((item) => (
            <TouchableOpacity key={item.id} style={styles.scenarioBtn} onPress={() => setSelectedScenario(item.id)}>
              <Text style={styles.scenarioText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (selectedScenario) {
    return renderGuidance();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Knowledge Base</Text>
        <Text style={styles.subtitle}>Offline survival guidance</Text>
      </View>
      <ScrollView contentContainerStyle={styles.categoryList}>
        {CATEGORIES.map((cat) => renderCategory({ item: cat }))}
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
    fontSize: 13,
    color: '#6677aa',
  },
  categoryList: {
    padding: 20,
    gap: 16,
  },
  categoryBtn: {
    backgroundColor: '#121929',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  categoryIcon: {
    fontSize: 32,
  },
  categoryTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtnText: {
    color: '#4d9fff',
    fontSize: 14,
  },
  categoryHeader: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scenarioList: {
    padding: 20,
    gap: 12,
  },
  scenarioBtn: {
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  scenarioText: {
    color: '#e0e8ff',
    fontSize: 14,
  },
  guidanceContainer: {
    flex: 1,
    padding: 20,
  },
  guidanceTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 24,
    marginTop: 8,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#121929',
    borderRadius: 12,
    padding: 14,
  },
  stepNum: {
    backgroundColor: '#4d9fff',
    color: '#ffffff',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
  },
  stepText: {
    color: '#e0e8ff',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});