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
let backgroundTimer = null;
let previousAppState = AppState.currentState;
let isUnloading = false;
const DEFAULT_MAX_TOKENS = 512;
const MIN_MAX_TOKENS = 128;
const MAX_MAX_TOKENS = 1024;

export const AIState = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FALLBACK: 'fallback',
  ERROR: 'error',
};

export const getModelState = () => {
  console.log('[DEBUG-AI] getModelState called: context=', !!context, 'isUsingFallback=', isUsingFallback, 'isInitializing=', isInitializing);
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
    const Llama = require('llama.rn');
    const available = typeof (Llama.initLlama || Llama.init) === 'function';
    console.log('[DEBUG-AI] isLlamaAvailable check:', available, 'Llama object:', Object.keys(Llama));
    return available;
  } catch (e) {
    console.warn('[DEBUG-AI] llama.rn module not found or failed to load:', e.message);
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
  if (appStateListener) {
    appStateListener.remove();
  }

  appStateListener = AppState.addEventListener('change', (nextAppState) => {
    console.log(`[MEMORY] AppState transition: ${previousAppState} -> ${nextAppState}`);

    if (nextAppState === 'background' && previousAppState === 'active' && context) {
      console.log('[MEMORY] App backgrounded, scheduling unload in 30s...');
      
      if (backgroundTimer) clearTimeout(backgroundTimer);
      
      backgroundTimer = setTimeout(async () => {
        if (!isUnloading && context) {
          console.log('[MEMORY] 30s elapsed, unloading model to free memory');
          await unloadModel();
        }
        backgroundTimer = null;
      }, 30000);
    } else if (nextAppState === 'active') {
      // Cancel pending unload if user returned quickly
      if (backgroundTimer) {
        console.log('[MEMORY] App returned to active, cancelling background unload');
        clearTimeout(backgroundTimer);
        backgroundTimer = null;
      }
      
      // Reload if model was unloaded (and not currently initializing)
      if (!isModelLoaded() && !isInitializing) {
        console.log('[MEMORY] App returned to active and model not loaded, reloading...');
        loadModel().catch(err => console.error('[MEMORY] Auto-reload failed:', err));
      }
    }

    previousAppState = nextAppState;
  });
};

const ensureJsiReady = async () => {
  try {
    const { installJsi } = require('llama.rn');
    console.log('[DEBUG-AI] installJsi found:', typeof installJsi === 'function');
    if (typeof installJsi === 'function') {
      await installJsi();
      console.log('[DEBUG-AI] JSI installed successfully');
    }
  } catch (e) {
    console.warn('[DEBUG-AI] JSI install skipped:', e.message);
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
      console.warn('[DEBUG-AI] llama.rn not available - switching to fallback mode');
      isUsingFallback = true;
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: 'llama_runtime_unavailable' });
      safeProgress({ stage: 'Using offline mode', percent: 100 });
      isInitializing = false;
      return { success: false, error: 'llama.rn runtime unavailable', fallback: true };
    }

    const MODEL_PATH = getModelPath();
    console.log('[DEBUG-AI] MODEL PATH:', MODEL_PATH);

    safeProgress({ stage: 'Checking model file', percent: 10 });
    const exists = await RNFS.exists(MODEL_PATH);
    console.log('[DEBUG-AI] MODEL EXISTS:', exists);
    console.log('[DEBUG-AI] Model file exists at path:', exists);

    if (!exists) {
      console.warn('[DEBUG-AI] Model NOT found at:', MODEL_PATH);
      safeProgress({ stage: 'Model not found', percent: 0 });
      isInitializing = false;
      isUsingFallback = true;
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED);
      return { success: false, error: 'Model file not found', fallback: true };
    }

    safeProgress({ stage: 'Verifying model', percent: 20 });
    const stat = await RNFS.stat(MODEL_PATH);
    console.log('[DEBUG-AI] Model file stat:', JSON.stringify(stat));
    const sizeMB = parseInt(stat.size, 10) / (1024 * 1024);
    console.log('[DEBUG-AI] FILE SIZE:', stat.size, 'bytes (', sizeMB.toFixed(2), 'MB)');
    console.log('[DEBUG-AI] Model size (MB):', sizeMB.toFixed(2));

    if (sizeMB < 100) {
      console.warn('[DEBUG-AI] Model file too small, likely corrupted:', sizeMB.toFixed(1), 'MB');
      try {
        await RNFS.unlink(MODEL_PATH);
        console.log('[DEBUG-AI] Deleted corrupted model file');
      } catch (deleteErr) {
        console.error('[DEBUG-AI] Failed to delete corrupted model file:', deleteErr);
      }
      isInitializing = false;
      isUsingFallback = true;
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED);
      return { success: false, error: 'Model file corrupted or too small', fallback: true };
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

    console.log('[DEBUG-AI] Calling init with config:', JSON.stringify(config));
    
    progressInterval = setInterval(() => {
      safeProgress({ stage: 'Loading model...', percent: 40 + Math.random() * 40 });
    }, 800);

    const loadPromise = initLlama(config);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Model load timed out')), MODEL_LOAD_TIMEOUT_MS);
    });
    
    let initLlamaResult;
    try {
      initLlamaResult = await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.error('[DEBUG-AI] LLAMA INIT ERROR:', error);
      throw error;
    }
    context = initLlamaResult;
    console.log('[DEBUG-AI] initLlama result (context exists):', !!context);
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
    console.log('[DEBUG-AI] AI model loaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('[DEBUG-AI] Model load FAILED with error:', error);
    console.error('[DEBUG-AI] Error stack:', error.stack);
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
  console.log('[DEBUG-AI] generateResponse called with prompt:', prompt.substring(0, 50) + '...');
  console.log('[DEBUG-AI] Current context state:', !!context, 'isUsingFallback:', isUsingFallback);

  if (isImageInput(prompt)) {
    return 'This model does not support image input. Please provide a text-based question or description.';
  }

  if (context && !isUsingFallback) {
    try {
      if (typeof context.completion !== 'function') {
        console.error('[DEBUG-AI] context.completion is not a function!');
        throw new Error('Context completion method not available');
      }
      const safeMaxTokens = Math.max(
        MIN_MAX_TOKENS,
        Math.min(Number.isFinite(maxTokens) ? maxTokens : DEFAULT_MAX_TOKENS, MAX_MAX_TOKENS)
      );
      
      console.log('[DEBUG-AI] Starting inference...');
      const startTime = Date.now();
      const res = await context.completion({
        prompt,
        n_predict: safeMaxTokens,
        temperature: 0.1,
      });
      console.log(`[DEBUG-AI] Inference complete in ${Date.now() - startTime}ms`);

      return res.text || res;
    } catch (e) {
      console.error('[DEBUG-AI] Inference failed:', e);
      if (e.message && (e.message.includes('OOM') || e.message.includes('memory') || e.message.includes('alloc'))) {
        console.warn('[DEBUG-AI] Out of memory detected, unloading model');
        unloadModel();
        return 'Error: Model unloaded due to memory pressure. Please restart the app and try again.';
      }
      return getEmergencyResponse(prompt);
    }
  }

  console.log('[DEBUG-AI] AI not available or in fallback mode, using emergency responses');
  return getEmergencyResponse(prompt);
};

export const unloadModel = async () => {
  if (isUnloading) return;
  isUnloading = true;
  try {
    unloadRequested = true;
    context = null;
    isUsingFallback = false;
    initError = null;
    await setModelLifecycleState(MODEL_LIFECYCLE_STATES.READY_ON_DISK);
    console.log('[MEMORY] Model unloaded successfully');
  } catch (err) {
    console.error('[MEMORY] Failed to unload model:', err);
  } finally {
    isUnloading = false;
  }
};