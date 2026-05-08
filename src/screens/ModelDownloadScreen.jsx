import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Bar } from 'react-native-progress';
import { downloadModel, modelExists, MODEL_EXPECTED_SIZE } from '../utils/modelStorage';

const MIN_SIZE_MB = Math.round(MODEL_EXPECTED_SIZE / (1024 * 1024));
const MIN_SIZE_GB = (MODEL_EXPECTED_SIZE / (1024 * 1024 * 1024)).toFixed(1);
const RECOMMENDED_FREE_GB = ((MODEL_EXPECTED_SIZE * 2) / (1024 * 1024 * 1024)).toFixed(1);
const SCREEN_WIDTH = Dimensions.get('window').width;
const BAR_WIDTH = Math.min(SCREEN_WIDTH - 60, 340);

const SPEED_EMA_ALPHA = 0.3;
const SPEED_CALC_INTERVAL_MS = 800;
const STALL_THRESHOLD_MS = 15000;

export default function ModelDownloadScreen({ navigation }) {
  const [progress, setProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(MIN_SIZE_MB);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('ready');
  const [speed, setSpeed] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [stallDetected, setStallDetected] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(0);

  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(null);
  const emaSpeedRef = useRef(0);
  const stallTimeoutRef = useRef(null);
  const cancelControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const checkExisting = async () => {
      try {
        const exists = await modelExists();
        if (exists && isMountedRef.current) {
          navigation.replace('Splash');
        }
      } catch (e) {
        console.error('Error checking model:', e);
      }
    };
    checkExisting();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Calculate download speed using raw bytes (not rounded MB) and smooth
   * with an exponential moving average so the displayed speed doesn't jitter.
   */
  const calculateSpeed = (bytesDownloaded) => {
    const now = Date.now();
    if (!lastTimeRef.current) {
      lastTimeRef.current = now;
      lastBytesRef.current = bytesDownloaded;
      return 0;
    }
    const timeDiffMs = now - lastTimeRef.current;
    // Only recalculate if enough time has passed to avoid division-by-tiny-number jitter
    if (timeDiffMs < SPEED_CALC_INTERVAL_MS) {
      return emaSpeedRef.current;
    }
    const timeDiffSec = timeDiffMs / 1000;
    const bytesDiff = bytesDownloaded - lastBytesRef.current;
    if (bytesDiff <= 0) return emaSpeedRef.current;

    const instantMBps = bytesDiff / (1024 * 1024) / timeDiffSec;
    // EMA smoothing
    const smoothed = emaSpeedRef.current > 0
      ? SPEED_EMA_ALPHA * instantMBps + (1 - SPEED_EMA_ALPHA) * emaSpeedRef.current
      : instantMBps;
    emaSpeedRef.current = smoothed;

    lastTimeRef.current = now;
    lastBytesRef.current = bytesDownloaded;
    return smoothed;
  };

  const resetStallTimer = (percentDone) => {
    if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    setStallDetected(false);
    stallTimeoutRef.current = setTimeout(() => {
      if (percentDone < 1) setStallDetected(true);
    }, STALL_THRESHOLD_MS);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(0);
    setDownloadedMB(0);
    setTotalMB(MIN_SIZE_MB);
    setStatus('ready');
    setSpeed(0);
    setStallDetected(false);
    setCurrentAttempt(0);
    lastBytesRef.current = 0;
    lastTimeRef.current = null;
    emaSpeedRef.current = 0;

    resetStallTimer(0);

    cancelControllerRef.current = {};
    const onCancel = (cancelFn) => {
      cancelControllerRef.current.cancel = cancelFn;
    };

    const onProgress = (data) => {
      if (data?.stage === 'verifying') {
        setStatus('verifying');
      } else if (data?.stage === 'retrying') {
        setStatus('retrying');
      } else {
        setStatus('downloading');
      }

      const percent = Math.min(1, data.percentage / 100);
      setProgress(percent);
      setDownloadedMB(data.downloaded || 0);
      setTotalMB(data.total || MIN_SIZE_MB);
      if (data.attempt) setCurrentAttempt(data.attempt);

      if (data.error) {
        setError(data.error);
      }

      const rawBytes = data.bytesWritten ?? 0;
      const newSpeed = calculateSpeed(rawBytes);
      setSpeed(newSpeed);

      if (newSpeed > 0.01 && data.total > 0) {
        const remainingMB = data.total - data.downloaded;
        const etaSec = remainingMB / newSpeed;
        setEtaMinutes(Math.floor(etaSec / 60));
        setEtaSeconds(Math.floor(etaSec % 60));
      }

      resetStallTimer(percent);
    };

    try {
      const result = await downloadModel(onProgress, onCancel);
      if (result === true) {
        setStatus('complete');
        setProgress(1);
        setTimeout(() => {
          if (isMountedRef.current) navigation.replace('Splash');
        }, 500);
      } else {
        throw new Error(result?.error || 'Download failed');
      }
    } catch (e) {
      setError(e.message || 'Download failed');
      setStatus('error');
    } finally {
      setIsDownloading(false);
      if (stallTimeoutRef.current) clearTimeout(stallTimeoutRef.current);
    }
  };

  const progressPercent = Math.min(100, Math.round(progress * 100));

  const formatBytes = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  const displayDownloaded = formatBytes(downloadedMB * 1024 * 1024);
  const displayTotal = formatBytes(totalMB * 1024 * 1024);

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
            ~{MIN_SIZE_GB} GB model • Keep at least {RECOMMENDED_FREE_GB} GB free • WiFi recommended
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Bar
            progress={progress}
            width={BAR_WIDTH}
            height={14}
            color="#4d9fff"
            unfilledColor="#1a2540"
            borderColor="#2a3a5f"
            borderRadius={7}
            animated={false}
          />
          <Text style={styles.progressText}>
            {progressPercent}% • {displayDownloaded} / {displayTotal}
          </Text>
          {speed > 0.01 && (
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
            {status === 'downloading' && `Downloading${currentAttempt > 1 ? ` (attempt ${currentAttempt})` : ''}...`}
            {status === 'retrying' && `Retrying${currentAttempt > 1 ? ` (attempt ${currentAttempt})` : ''}...`}
            {status === 'verifying' && 'Verifying model integrity...'}
            {status === 'complete' && 'Download complete!'}
            {status === 'error' && 'Error occurred'}
            {status === 'ready' && 'Ready to download'}
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
            <Text style={styles.errorText}>
              {error.includes('resolve host') || error.includes('No address') || error.includes('Unable to resolve host')
                ? 'Network error: Cannot reach HuggingFace. Check your internet connection.'
                : error}
            </Text>
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
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
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