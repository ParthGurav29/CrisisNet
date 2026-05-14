import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useMesh } from '../hooks/useMesh';

export default function MeshStatus() {
  const { nodes, isConnected, scanning, advertising, myShortId } = useMesh();
  const pulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const shouldAnimate = isConnected && nodes.length > 0;
    const isSearching = isConnected && nodes.length === 0 && (scanning || advertising);

    if (shouldAnimate || isSearching) {
      const duration = isSearching ? 400 : 800;
      const animate = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.4, duration, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
          ])
        ).start();
      };
      animate();
    } else {
      pulse.setValue(1);
    }
  }, [isConnected, nodes.length, scanning, advertising, pulse]);

  const getStatusColor = () => {
    if (!isConnected) return '#ff3b5c';
    if (nodes.length === 0) {
      if (scanning || advertising) return '#ffaa00';
      return '#6677aa';
    }
    return '#00cc66';
  };

  const getStatusText = () => {
    if (!isConnected) return 'OFFLINE';
    if (nodes.length === 0) {
      if (scanning && advertising) return 'MESH READY';
      if (scanning) return 'SCANNING';
      if (advertising) return 'ADVERTISING';
      return 'IDLE';
    }
    return 'ACTIVE';
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { backgroundColor: getStatusColor(), transform: [{ scale: pulse }] }]} />
      <Text style={styles.text}>
        {getStatusText()} {nodes.length > 0 ? `(${nodes.length} nodes)` : ''}
      </Text>
      {myShortId ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{myShortId}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121929',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e2d4a',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    color: '#e0e8ff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#1e2d4a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#4d9fff',
    fontSize: 9,
    fontWeight: '800',
  },
});