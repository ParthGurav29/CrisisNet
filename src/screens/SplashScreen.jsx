import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Bar } from 'react-native-progress';
import { AIContext } from '../context/AIContext';
import { modelExists } from '../utils/modelStorage';
import { isInFallbackMode } from '../ai/gemma';

export default function SplashScreen({ navigation }) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ stage: 'Starting...', percent: 0 });
  const { loadModel } = useContext(AIContext);

  useEffect(() => {
    let isMounted = true;
    const startedAt = Date.now();
    const MIN_SPLASH_MS = 1000;

    const navigateWithMinimumSplash = async (routeName) => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      if (isMounted) {
        navigation.replace(routeName);
      }
    };

    const checkModel = async () => {
      try {
        setProgress({ stage: 'Checking model file', percent: 10 });
        const exists = await modelExists();
        if (exists) {
          const result = await loadModel((nextProgress) => {
            if (isMounted) {
              setProgress(nextProgress);
            }
          });
          if (result?.success) {
            await navigateWithMinimumSplash('Home');
          } else {
            setError(result?.error || 'Failed to load model');
            await navigateWithMinimumSplash('ModelDownload');
          }
        } else {
          setProgress({ stage: 'Model missing', percent: 0 });
          await navigateWithMinimumSplash('ModelDownload');
        }
      } catch (e) {
        console.error('Error checking model:', e);
        if (isMounted) {
          setError('Failed to check model status');
        }
        await navigateWithMinimumSplash('ModelDownload');
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };
    checkModel();

    return () => {
      isMounted = false;
    };
  }, [navigation, loadModel]);

  const progressValue = progress.percent || 0;
  const stage = progress.stage || 'Preparing...';

  return (
    <View style={styles.container}>
      {isInFallbackMode() && (
        <View style={styles.fallbackBanner}>
          <Text style={styles.fallbackText}>Using offline quick-response mode</Text>
        </View>
      )}
      <Text style={styles.logo}>CrisisNet</Text>
      <Text style={styles.stageText}>{stage}</Text>
      <Bar
        progress={progressValue / 100}
        width={200}
        height={12}
        color="#4d9fff"
        unfilledColor="#1a2540"
        borderColor="#4d9fff"
        style={{ marginTop: 16 }}
      />
      <Text style={styles.percentText}>{Math.round(progressValue)}%</Text>
      <Text style={styles.etaText}>This may take 30-60 seconds</Text>
      {checking && error === null && (
        <ActivityIndicator size="small" color="#4d9fff" style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBanner: {
    position: 'absolute',
    top: 40,
    backgroundColor: '#ff9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  fallbackText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#4d9fff',
    marginBottom: 16,
  },
  stageText: {
    color: '#6677aa',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  percentText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  etaText: {
    color: '#4d9fff',
    fontSize: 12,
    marginTop: 4,
  },
});