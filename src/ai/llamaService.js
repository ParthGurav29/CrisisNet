import { initLlama } from 'llama.rn';
import RNFS from 'react-native-fs';
import { getModelPath, setModelInUse, checkMemoryBeforeInference } from '../utils/modelStorage';
import DeviceInfo from 'react-native-device-info';

let context = null;
let isInitializing = false;
let initReject = null;

export const getIsReady = () => context !== null;

export const getInitState = () => ({
  isInitializing,
  isReady: context !== null,
});

const getThreadCount = () => {
  try {
    const cores = DeviceInfo.getNumberOfCores();
    return Math.max(1, Math.min(2, cores - 1));
  } catch {
    return 2;
  }
};

export const initModel = async (onProgress) => {
  if (context) return true;
  if (isInitializing) {
    return new Promise((resolve, reject) => {
      initReject = reject;
    });
  }
  isInitializing = true;
  initReject = null;

  try {
    onProgress?.({ text: 'Checking for model file...', percent: 10 });

    const MODEL_PATH = getModelPath();
    const exists = await RNFS.exists(MODEL_PATH);
    if (!exists) {
      console.warn('⚠️ Model not found at:', MODEL_PATH);
      onProgress?.({
        text: 'Model not found.\nRun: ./push_model.sh',
        percent: 0,
      });
      isInitializing = false;
      return false;
    }

    const memoryCheck = await checkMemoryBeforeInference();
    if (!memoryCheck.safe) {
      throw new Error(memoryCheck.reason || 'Insufficient memory for model loading');
    }

    setModelInUse(true);

    const stat = await RNFS.stat(MODEL_PATH);
    console.log('✅ Model found:', MODEL_PATH, 'size:', stat.size);
    onProgress?.({ text: 'Loading model into memory (10-30s)...', percent: 50 });

    const n_threads = getThreadCount();
    console.log(`[LLAMA] Using ${n_threads} threads`);

    context = await initLlama({
      model: MODEL_PATH,
      n_ctx: 256,
      n_batch: 512,
      n_threads,
      use_mmap: true,
      use_mlock: false,
    });

    console.log('✅ Gemma loaded successfully!');
    onProgress?.({ text: 'Ready', percent: 100 });
    isInitializing = false;
    initReject = null;
    return true;
  } catch (e) {
    console.error('❌ Model load FAILED:', e.message, e.stack);
    context = null;
    isInitializing = false;
    setModelInUse(false);
    const reject = initReject;
    initReject = null;
    onProgress?.({ text: `Error: ${e.message}`, percent: 0 });
    
    if (reject) {
      reject(e);
    }
    return false;
  }
};

export const ask = async (prompt) => {
  if (!context) return 'Model not ready. Please wait...';

  try {
    const res = await context.completion({
      prompt: `Question: ${prompt}\n\nAnswer:`,
      n_predict: 150,
      temperature: 0.7,
    });
    return res.text || res;
  } catch (e) {
    console.error('Inference failed:', e);
    return 'Error: ' + e.message;
  }
};

export const isModelInUse = () => {
  return context !== null;
};