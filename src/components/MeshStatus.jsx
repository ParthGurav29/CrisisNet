import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useMesh } from '../hooks/useMesh';

export default function MeshStatus() {
  const { nodes, isConnected, scanning, advertising } = useMesh();
  const pulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const shouldAnimate = isConnected && nodes.length > 0;
    const isSearching = isConnected && nodes.length === 0;

    if (shouldAnimate || isSearching) {
      const animate = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.5, duration: 500, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
          ])
        ).start();
      };
      animate();
    } else {
      pulse.setValue(1);
    }
  }, [isConnected, nodes.length, pulse]);

  const getStatusColor = () => {
    if (!isConnected) return '#ff3b5c';
    if (nodes.length === 0) return '#ffaa00';
    return '#00cc66';
  };

  const getStatusText = () => {
    if (!isConnected) return 'OFFLINE';
    if (nodes.length === 0) return 'SEARCHING';
    return 'ACTIVE';
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { backgroundColor: getStatusColor(), transform: [{ scale: pulse }] }]} />
      <Text style={styles.text}>
        {getStatusText()} {nodes.length > 0 ? `(${nodes.length} nodes)` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121929',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: '#e0e8ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});