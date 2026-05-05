import {initLlama} from 'llama.rn';
import RNFS from 'react-native-fs';

let context = null;
let isInitializing = false;

// ============================================================
// Model path: App's EXTERNAL files directory
// Maps to: /sdcard/Android/data/com.crisisnet/files/
//
// This directory is ALWAYS readable/writable by the app without
// any runtime permissions (no scoped storage issues on Android 13+).
//
// To deploy the model:
//   adb push models/gemma.gguf /sdcard/Download/gemma.gguf
//   adb shell "mv /sdcard/Download/gemma.gguf /sdcard/Android/data/com.crisisnet/files/gemma.gguf"
// ============================================================
const MODEL_PATH = `${RNFS.ExternalDirectoryPath}/gemma.gguf`;

export const getIsReady = () => context !== null;

export const initModel = async (onProgress) => {
  if (context) return true;
  if (isInitializing) return false;
  isInitializing = true;

  try {
    onProgress?.({ text: 'Checking for model file...', percent: 10 });

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

    const stat = await RNFS.stat(MODEL_PATH);
    console.log('✅ Model found:', MODEL_PATH, 'size:', stat.size);
    onProgress?.({ text: 'Loading model into memory (10-30s)...', percent: 50 });

    context = await initLlama({
      model: MODEL_PATH,
      n_ctx: 256,
      n_batch: 512,
      use_mmap: true,
      use_mlock: false,
    });

    console.log('✅ Gemma loaded successfully!');
    onProgress?.({ text: 'Ready', percent: 100 });
    isInitializing = false;
    return true;
  } catch (e) {
    console.error('❌ Model load FAILED:', e.message, e.stack);
    context = null;
    isInitializing = false;
    onProgress?.({ text: `Error: ${e.message}`, percent: 0 });
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
