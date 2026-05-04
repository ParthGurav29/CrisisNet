import {initLlama} from 'llama.rn';
import RNFS from 'react-native-fs';

let context = null;
let isInitializing = false;

const MODEL_PATH = '/storage/emulated/0/Android/data/com.crisisnet/files/gemma.gguf';

export const initModel = async () => {
  if (context) return true;
  if (isInitializing) return false;
  isInitializing = true;

  try {
    console.log('Loading Gemma from:', MODEL_PATH);
    
    const exists = await RNFS.exists(MODEL_PATH);
    if (!exists) {
      console.error('Model not found at:', MODEL_PATH);
      isInitializing = false;
      return false;
    }

    console.log('Model exists, initializing (8GB RAM mode)...');
    
    // Force real model - NO mock fallback
    context = await initLlama({
      model: MODEL_PATH,
      n_ctx: 256,
      n_batch: 512,
      use_mmap: true,    // Memory-map for 8GB RAM
      use_mlock: false,
    });

    console.log('Gemma loaded successfully!');
    isInitializing = false;
    return true;
  } catch (e) {
    console.error('Model load FAILED:', e.message, e.stack);
    context = null;
    isInitializing = false;
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
