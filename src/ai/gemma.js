import RNFS from 'react-native-fs';
import { getModelPath, setModelLifecycleState, MODEL_LIFECYCLE_STATES } from '../utils/modelStorage';
import { getEmergencyResponse } from './offlineResponses';
import { AppState } from 'react-native';

let context = null;
let isInitializing = false;
let isUsingFallback = false;
let initError = null;
let appStateListener = null;
let unloadRequested = false;
const DEFAULT_MAX_TOKENS = 96;
const MIN_MAX_TOKENS = 24;
const MAX_MAX_TOKENS = 192;

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
  try {
    const { initLlama } = require('llama.rn');
    return typeof initLlama === 'function';
  } catch {
    return false;
  }
};

const getOptimalThreadCount = () => {
  try {
    const DeviceInfo = require('react-native-device-info');
    const cores = DeviceInfo.getMaxCpuCount ? DeviceInfo.getMaxCpuCount() : 4;
    const totalMemory = DeviceInfo.getTotalMemory ? DeviceInfo.getTotalMemory() : 4000000000;
    const totalGB = totalMemory / (1024 * 1024 * 1024);
    
    if (totalGB >= 8 && cores >= 8) {
      return Math.min(6, Math.max(2, cores - 1));
    } else if (totalGB >= 6 && cores >= 6) {
      return Math.min(4, Math.max(2, cores - 1));
    } else if (totalGB >= 4 && cores >= 4) {
      return Math.min(3, Math.max(1, cores - 1));
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

const ensureJsiReady = async () => {
  try {
    const { installJsi } = require('llama.rn');
    if (typeof installJsi === 'function') {
      await installJsi();
    }
  } catch (e) {
    console.warn('JSI install skipped:', e.message);
  }
};

const MODEL_LOAD_TIMEOUT_MS = 5 * 60 * 1000;

export const loadModel = async (onProgress) => {
  if (context) return { success: true };
  if (isInitializing) return { success: false, error: 'Already initializing' };
  isInitializing = true;
  initError = null;
  await setModelLifecycleState(MODEL_LIFECYCLE_STATES.LOADING);

  let progressInterval = null;

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
    await ensureJsiReady();
    safeProgress({ stage: 'Checking AI runtime', percent: 5 });

    if (!isLlamaAvailable()) {
      console.warn('llama.rn not available - switching to fallback mode');
      isUsingFallback = true;
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: 'llama_runtime_unavailable' });
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
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED);
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
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED);
      return { success: true, fallback: true };
    }

    console.log('Attempting to load model from:', MODEL_PATH);
    safeProgress({ stage: 'Initializing runtime', percent: 30 });

    const n_threads = getOptimalThreadCount();
    const Llama = require('llama.rn');
    const initLlama = Llama.initLlama || Llama.init;

    if (typeof initLlama !== 'function') {
      throw new Error('Llama initialization function not found. Ensure llama.rn is properly installed.');
    }

    const config = {
      model: MODEL_PATH,
      n_ctx: 384,
      n_batch: 256,
      n_threads,
      n_gpu_layers: 0,
      use_mmap: true,
      use_mlock: false,
      seed: -1,
    };

    console.log('[LLAMA] Calling init with config:', JSON.stringify({ ...config, model: 'REDACTED' }));
    
    progressInterval = setInterval(() => {
      safeProgress({ stage: 'Loading model...', percent: 40 + Math.random() * 40 });
    }, 800);

    const loadPromise = initLlama(config);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Model load timed out')), MODEL_LOAD_TIMEOUT_MS);
    });
    
    context = await Promise.race([loadPromise, timeoutPromise]);
    clearInterval(progressInterval);
    progressInterval = null;

    if (!context) {
      throw new Error('initLlama returned null');
    }

    setupMemoryPressureHandler();

    safeProgress({ stage: 'Warming up model', percent: 85 });

    try {
      const warmupPromise = generateResponse('hello', 8);
      const warmupTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Warmup timed out')), 30000);
      });
      await Promise.race([warmupPromise, warmupTimeoutPromise]);
      safeProgress({ stage: 'Optimizing', percent: 95 });
    } catch (testErr) {
      console.warn('Warmup inference failed:', testErr.message);
    }

    safeProgress({ stage: 'AI Ready', percent: 100 });
    isInitializing = false;
    await setModelLifecycleState(MODEL_LIFECYCLE_STATES.READY_IN_RAM);
    console.log('AI model loaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Model load failed with error:', error);
    if (progressInterval) clearInterval(progressInterval);
    initError = error;

    context = null;
    isInitializing = false;
    isUsingFallback = true;
    await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: error.message });

    return { success: false, error: error.message };
  }
};

const isImageInput = (prompt) => {
  if (typeof prompt !== 'string') return false;
  const imagePatterns = [
    /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i,
    /^image:/i,
    /image\/\w+/i,
  ];
  return imagePatterns.some(pattern => pattern.test(prompt));
};

export const generateResponse = async (prompt, maxTokens = DEFAULT_MAX_TOKENS) => {
  if (isImageInput(prompt)) {
    return 'This model does not support image input. Please provide a text-based question or description.';
  }

  if (context && !isUsingFallback) {
    try {
      if (typeof context.completion !== 'function') {
        throw new Error('Context completion method not available');
      }
      const safeMaxTokens = Math.max(
        MIN_MAX_TOKENS,
        Math.min(Number.isFinite(maxTokens) ? maxTokens : DEFAULT_MAX_TOKENS, MAX_MAX_TOKENS)
      );
      const res = await context.completion({
        prompt,
        n_predict: safeMaxTokens,
        temperature: 0.1,
      });

      return res.text || res;
    } catch (e) {
      console.error('Inference failed:', e);
      if (e.message && (e.message.includes('OOM') || e.message.includes('memory') || e.message.includes('alloc'))) {
        console.warn('Out of memory detected, unloading model');
        unloadModel();
        return 'Error: Model unloaded due to memory pressure. Please restart the app and try again.';
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
  setModelLifecycleState(MODEL_LIFECYCLE_STATES.READY_ON_DISK).catch(() => {});
};