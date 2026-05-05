import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { getModelPath } from '../utils/modelStorage';
import { getEmergencyResponse } from './offlineResponses';
import { AppState } from 'react-native';

let context = null;
let isInitializing = false;
let isUsingFallback = false;
let initError = null;
let appStateListener = null;
let unloadRequested = false;

export const AIState = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FALLBACK: 'fallback',
  ERROR: 'error',
};

export const getModelState = () => {
  if (context && !isUsingFallback) return AIState.READY;
  if (isInitializing) return AIState.LOADING;
  if (isUsingFallback) return AIState.FALLBACK;
  return AIState.IDLE;
};

export const isModelLoaded = () => context !== null && !isUsingFallback;
export const isInFallbackMode = () => isUsingFallback;
export const getInitError = () => initError;
export const getContext = () => context;

const isLlamaAvailable = () => {
  return typeof initLlama === 'function';
};

const getOptimalThreadCount = () => {
  try {
    const DeviceInfo = require('react-native-device-info');
    const cores = DeviceInfo.getMaxCpuCount ? DeviceInfo.getMaxCpuCount() : 4;
    const totalMemory = DeviceInfo.getTotalMemory ? DeviceInfo.getTotalMemory() : 4000000000;
    const totalGB = totalMemory / (1024 * 1024 * 1024);
    
    if (totalGB >= 8 && cores >= 6) {
      return Math.min(4, cores);
    } else if (totalGB >= 6 && cores >= 4) {
      return Math.min(3, cores);
    }
    return Math.min(2, Math.max(1, cores - 1));
  } catch (e) {
    return 2;
  }
};

const setupMemoryPressureHandler = () => {
  appStateListener = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background' && context) {
      console.log('[MEMORY] App backgrounded, unloading model to free memory');
      unloadModel();
    }
  });
};

export const loadModel = async (onProgress) => {
  if (context) return { success: true };
  if (isInitializing) return { success: false, error: 'Already initializing' };
  isInitializing = true;
  initError = null;

  const safeProgress = (data) => {
    try {
      if (typeof onProgress === 'function') {
        onProgress(data);
      }
    } catch (e) {
      // ignore
    }
  };

  try {
    safeProgress({ stage: 'Checking AI runtime', percent: 5 });

    if (!isLlamaAvailable()) {
      console.warn('llama.rn not available - switching to fallback mode');
      isUsingFallback = true;
      safeProgress({ stage: 'Using offline mode', percent: 100 });
      isInitializing = false;
      return { success: true, fallback: true };
    }

    const MODEL_PATH = getModelPath();

    safeProgress({ stage: 'Checking model file', percent: 10 });
    const exists = await RNFS.exists(MODEL_PATH);
    if (!exists) {
      console.warn('Model not found at:', MODEL_PATH);
      safeProgress({ stage: 'Model not found', percent: 0 });
      isInitializing = false;
      isUsingFallback = true;
      return { success: true, fallback: true };
    }

    safeProgress({ stage: 'Verifying model', percent: 20 });
    const stat = await RNFS.stat(MODEL_PATH);
    const sizeMB = parseInt(stat.size, 10) / (1024 * 1024);

    if (sizeMB < 100) {
      console.warn('Model file too small, likely corrupted:', sizeMB.toFixed(1), 'MB');
      try {
        await RNFS.unlink(MODEL_PATH);
      } catch (deleteErr) {
        // ignore
      }
      isInitializing = false;
      isUsingFallback = true;
      return { success: true, fallback: true };
    }

    console.log('Attempting to load model from:', MODEL_PATH);
    safeProgress({ stage: 'Initializing runtime', percent: 30 });

    const n_threads = getOptimalThreadCount();

    context = await initLlama({
      model: MODEL_PATH,
      n_ctx: 512,
      n_threads,
      n_gpu_layers: 0,
      use_mmap: true,
      use_mlock: false,
    });

    if (!context) {
      throw new Error('initLlama returned null');
    }

    setupMemoryPressureHandler();

    safeProgress({ stage: 'Warming up', percent: 90 });

    try {
      const testResult = await generateResponse('hello', 20);
      console.log('Test inference result:', testResult);
    } catch (testErr) {
      console.warn('Warmup inference failed:', testErr.message);
    }

    safeProgress({ stage: 'AI Ready', percent: 100 });
    isInitializing = false;
    console.log('AI model loaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Model load failed with error:', error);
    initError = error;

    context = null;
    isInitializing = false;
    isUsingFallback = true;

    return { success: false, error: error.message };
  }
};

export const generateResponse = async (prompt, maxTokens = 150) => {
  if (context && !isUsingFallback) {
    try {
      const res = await context.completion({
        prompt,
        n_predict: maxTokens,
        temperature: 0.1,
      });

      return res.text || res;
    } catch (e) {
      console.error('Inference failed:', e);
      if (e.message && (e.message.includes('OOM') || e.message.includes('memory') || e.message.includes('alloc'))) {
        console.warn('Out of memory detected, unloading model');
        unloadModel();
        return { error: 'Model unloaded due to memory pressure', retry: true };
      }
      return getEmergencyResponse(prompt);
    }
  }

  return getEmergencyResponse(prompt);
};

export const unloadModel = () => {
  unloadRequested = true;
  context = null;
  isUsingFallback = false;
  initError = null;
};