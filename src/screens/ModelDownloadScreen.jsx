import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bar } from 'react-native-progress';
import { downloadModel, modelExists } from '../utils/modelStorage';

export default function ModelDownloadScreen({ navigation }) {
  const [progress, setProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(2500);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('ready');
  const [speed, setSpeed] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [stallDetected, setStallDetected] = useState(false);

  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(null);
  const stallTimeoutRef = useRef(null);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const exists = await modelExists();
        if (exists) {
          navigation.replace('Home');
        }
      } catch (e) {
        console.error('Error checking model:', e);
      }
    };
    checkExisting();
  }, []);

  const calculateSpeed = (bytesDownloaded) => {
    const now = Date.now();
    if (!lastTimeRef.current) {
      lastTimeRef.current = now;
      lastBytesRef.current = bytesDownloaded;
      return 0;
    }
    const timeDiff = (now - lastTimeRef.current) / 1000;
    if (timeDiff < 0.1) return speed;
    const bytesDiff = bytesDownloaded - lastBytesRef.current;
    const mbPerSecond = bytesDiff / (1024 * 1024) / timeDiff;
    lastTimeRef.current = now;
    lastBytesRef.current = bytesDownloaded;
    return mbPerSecond;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(0);
    setDownloadedMB(0);
    setStatus('downloading');
    setSpeed(0);
    setStallDetected(false);
    lastBytesRef.current = 0;
    lastTimeRef.current = null;

    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    stallTimeoutRef.current = setTimeout(() => {
      setStallDetected(true);
    }, 10000);

    const onProgress = (data) => {
      const percent = data.percentage / 100;
      setProgress(percent);
      setDownloadedMB(data.downloaded);
      setTotalMB(data.total);

      const newSpeed = calculateSpeed(data.downloaded * 1024 * 1024);
      setSpeed(newSpeed);

      if (newSpeed > 0) {
        setStallDetected(false);
        if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
        const remainingMB = data.total - data.downloaded;
        const etaSec = remainingMB / newSpeed;
        setEtaMinutes(Math.floor(etaSec / 60));
        setEtaSeconds(Math.floor(etaSec % 60));
      }

      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = setTimeout(() => {
        if (percent < 1) setStallDetected(true);
      }, 10000);
    };

    try {
      setStatus('verifying');
      const success = await downloadModel(onProgress);
      if (success) {
        setStatus('complete');
        setTimeout(() => navigation.replace('Home'), 500);
      } else {
        setError('Download failed. Please try again.');
        setStatus('error');
      }
    } catch (e) {
      setError(e.message || 'Download failed');
      setStatus('error');
    } finally {
      setIsDownloading(false);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>CrisisNet</Text>
        <Text style={styles.title}>AI Model Required</Text>
        <Text style={styles.subtitle}>One-time download needed for offline AI</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Large Download</Text>
          <Text style={styles.warningText}>
            ~2.5GB file — WiFi strongly recommended
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Bar
            progress={progress}
            width={200}
            height={12}
            color="#4d9fff"
            unfilledColor="#1a2540"
            borderColor="#4d9fff"
          />
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}% • {downloadedMB} MB / {totalMB} MB
          </Text>
          {speed > 0 && (
            <Text style={styles.speedText}>
              {speed.toFixed(1)} MB/s • ~{etaMinutes}m {etaSeconds}s left
            </Text>
          )}
          {stallDetected && (
            <Text style={styles.stallText}>
              Download stalled — check your connection
            </Text>
          )}
          <Text style={styles.statusText}>
            {status === 'downloading' && 'Downloading...'}
            {status === 'verifying' && 'Verifying...'}
            {status === 'complete' && 'Complete!'}
            {status === 'error' && 'Error occurred'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
          onPress={handleDownload}
          disabled={isDownloading}>
          <Text style={styles.downloadBtnText}>
            {isDownloading ? 'Downloading...' : 'DOWNLOAD'}
          </Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleDownload}>
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  body: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4d9fff',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6677aa',
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#2a221a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffaa00',
  },
  warningTitle: {
    color: '#ffaa00',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 8,
  },
  warningText: {
    color: '#d0c8b8',
    fontSize: 13,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressText: {
    color: '#8899bb',
    fontSize: 12,
    marginTop: 8,
  },
  speedText: {
    color: '#4dff88',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  stallText: {
    color: '#ff3b5c',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  statusText: {
    color: '#4d9fff',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  downloadBtn: {
    backgroundColor: '#4d9fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadBtnDisabled: {
    backgroundColor: '#1a3a6e',
  },
  downloadBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#ff3b5c',
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#1a3a6e',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: '#4d9fff',
    fontWeight: '600',
  },
});