import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HF_TOKEN = 'GET_UR_OWN_TOKEN_KID';
// TOKEN : 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

export const MODEL_FILENAME = 'gemma-4-E2B-it-Q4_K_M.gguf';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/models/${MODEL_FILENAME}`;
const MODEL_DIR = `${RNFS.DocumentDirectoryPath}/models`;
const TEMP_MODEL_PATH = `${RNFS.DocumentDirectoryPath}/models/${MODEL_FILENAME}.tmp`;
const LOCK_PATH = `${RNFS.DocumentDirectoryPath}/models/download.lock`;
const DOWNLOAD_STATE_KEY = 'download_state';
const ACK_DEDUPE_KEY = 'ack_dedupe';
const SYSTEM_STATE_KEY = 'system_state';
const RETRY_BUDGET_KEY = 'retry_budget';
const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf';
const MODEL_EXPECTED_SIZE = 2800 * 1024 * 1024;

const EXPECTED_SHA256 = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

const MIN_RAM_GB = 5;
const MIN_RAM_BYTES = MIN_RAM_GB * 1024 * 1024 * 1024;
const MIN_SIZE_BYTES = MODEL_EXPECTED_SIZE;
const MIN_SIZE_MB = 2500;
const DOWNLOAD_TIMEOUT_MS = 300000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;
const STORAGE_SAFETY_MARGIN = 2.0;
const MEMORY_SAFETY_MULTIPLIER = 1.8;
const MAX_RESUME_ATTEMPTS = 3;
const LOCK_TTL_MS = 10 * 60 * 1000;
const ACK_DEDUPE_TTL_MS = 5 * 60 * 1000;
const MAX_ACK_DEDUPE_ENTRIES = 1000;
const MAX_RETRIES_PER_MINUTE = 20;
const MEMORY_SAFETY_THRESHOLD = 0.3;

const NON_RETRYABLE_ERRORS = new Set([401, 403, 404]);

const MODEL_VERSION = 1;
const META_FILENAME = 'meta.json';

let downloadCancellationPromise = null;
let activeDownload = null;
let modelInUse = false;

export const getModelVersion = () => MODEL_VERSION;

export const getMetaPath = () => `${MODEL_DIR}/${META_FILENAME}`;

export const getLockPath = () => LOCK_PATH;

export const getModelMeta = async () => {
  try {
    const metaPath = getMetaPath();
    const exists = await RNFS.exists(metaPath);
    if (!exists) return null;
    const content = await RNFS.readFile(metaPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.warn('Failed to read model meta:', e.message);
    return null;
  }
};

export const saveModelMeta = async (meta) => {
  try {
    const metaPath = getMetaPath();
    const tmpPath = `${metaPath}.tmp`;
    const content = JSON.stringify({ ...meta, version: MODEL_VERSION, timestamp: Date.now() });
    await RNFS.writeFile(tmpPath, content, 'utf8');
    await RNFS/fsync && await RNFS.fsync(tmpPath);
    await RNFS.moveFile(tmpPath, metaPath);
  } catch (e) {
    console.warn('Failed to save model meta:', e.message);
  }
};

export const clearModelMeta = async () => {
  try {
    const metaPath = getMetaPath();
    const exists = await RNFS.exists(metaPath);
    if (exists) await RNFS.unlink(metaPath);
  } catch (e) {
    console.warn('Failed to clear model meta:', e.message);
  }
};

export const getDownloadState = async () => {
  try {
    const state = await AsyncStorage.getItem(DOWNLOAD_STATE_KEY);
    return state ? JSON.parse(state) : null;
  } catch (e) {
    console.warn('Failed to read download state:', e.message);
    return null;
  }
};

export const saveDownloadState = async (state) => {
  try {
    await AsyncStorage.setItem(DOWNLOAD_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save download state:', e.message);
  }
};

export const clearDownloadState = async () => {
  try {
    await AsyncStorage.removeItem(DOWNLOAD_STATE_KEY);
  } catch (e) {
    console.warn('Failed to clear download state:', e.message);
  }
};

export const getModelPath = () => MODEL_PATH;

export const getModelDir = () => MODEL_DIR;

export const getModelSize = async () => {
  try {
    const exists = await RNFS.exists(MODEL_PATH);
    if (!exists) return '0 MB';
    const stat = await RNFS.stat(MODEL_PATH);
    const bytes = parseInt(stat.size, 10);
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    }
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  } catch (e) {
    return '0 MB';
  }
};

export const acquireDownloadLock = async () => {
  try {
    const existingLock = await readLockFile();
    if (existingLock && !isLockStale(existingLock)) {
      return { acquired: false, reason: 'Lock exists', lock: existingLock };
    }
    const lockData = {
      pid: process.pid || Date.now(),
      timestamp: Date.now(),
      appStartTimestamp: Date.now(),
    };
    await writeLockFile(lockData);
    return { acquired: true, lock: lockData };
  } catch (e) {
    console.warn('Failed to acquire lock:', e.message);
    return { acquired: false, reason: e.message };
  }
};

export const releaseDownloadLock = async () => {
  try {
    await RNFS.unlink(LOCK_PATH);
  } catch (e) {
    // ignore
  }
};

const readLockFile = async () => {
  try {
    const exists = await RNFS.exists(LOCK_PATH);
    if (!exists) return null;
    const content = await RNFS.readFile(LOCK_PATH, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
};

const writeLockFile = async (lockData) => {
  const content = JSON.stringify(lockData);
  await RNFS.writeFile(LOCK_PATH, content, 'utf8');
};

const isLockStale = (lock) => {
  const age = Date.now() - lock.timestamp;
  return age > LOCK_TTL_MS;
};

export const isModelLocked = () => modelInUse;

export const setModelInUse = (inUse) => {
  modelInUse = inUse;
};

export const checkAndResumeDownload = async () => {
  const lock = await readLockFile();
  if (lock && !isLockStale(lock)) {
    const meta = await getModelMeta();
    if (meta && !meta.completed) {
      return { shouldResume: true, lock };
    }
  }
  return { shouldResume: false };
};

export const modelExists = async () => {
  try {
    const exists = await RNFS.exists(MODEL_PATH);
    if (!exists) return false;
    const stat = await RNFS.stat(MODEL_PATH);
    const bytes = parseInt(stat.size, 10);
    if (bytes < MIN_SIZE_BYTES * 0.9) return false;

    const meta = await getModelMeta();
    if (!meta || meta.version !== MODEL_VERSION) {
      console.warn('Model version mismatch or missing metadata, invalidating');
      return false;
    }

    const checksumResult = await validateModelChecksum({ quick: true });
    return checksumResult.valid;
  } catch (e) {
    console.error('Error checking model:', e);
    return false;
  }
};

export const validateModelChecksum = async (options = {}) => {
  try {
    const { quick = false } = options;
    const exists = await RNFS.exists(MODEL_PATH);
    if (!exists) return { valid: false, reason: 'Model file not found' };

    const stat = await RNFS.stat(MODEL_PATH);
    const bytes = parseInt(stat.size, 10);
    if (bytes < MIN_SIZE_BYTES) {
      return { valid: false, reason: `File too small: ${bytes} bytes` };
    }

    const meta = await getModelMeta();
    if (meta && meta.validatedAt && Date.now() - meta.validatedAt < 60 * 60 * 1000) {
      if (meta.size === bytes && meta.partialHash) {
        return { valid: true, reason: 'Validated recently' };
      }
    }

    const Crypto = require('crypto');
    const hash = Crypto.createHash('sha256');

    if (quick && meta && meta.partialHash) {
      const fileBuffer = await RNFS.readFile(MODEL_PATH, 'base64');
      const endBytes = 1024 * 1024;
      const endBuffer = fileBuffer.slice(-endBytes);
      hash.update(Buffer.from(endBuffer, 'base64'));
      const computedEndHash = hash.digest('hex');
      if (computedEndHash === meta.partialHash) {
        await saveModelMeta({ ...meta, validatedAt: Date.now() });
        return { valid: true, reason: 'Quick validation passed' };
      }
    }

    const fileBuffer = await RNFS.readFile(MODEL_PATH, 'base64');
    hash.update(Buffer.from(fileBuffer, 'base64'));
    const computedHash = hash.digest('hex');

    if (computedHash !== EXPECTED_SHA256) {
      return { valid: false, reason: `Hash mismatch: expected ${EXPECTED_SHA256}, got ${computedHash}` };
    }

    const partialHash = Crypto.createHash('sha256');
    const endBytes = 1024 * 1024;
    const endBuffer = Buffer.from(fileBuffer.slice(-endBytes));
    partialHash.update(endBuffer);
    await saveModelMeta({
      hash: EXPECTED_SHA256,
      size: bytes,
      completed: true,
      timestamp: Date.now(),
      validatedAt: Date.now(),
      partialHash: partialHash.digest('hex'),
    });
    return { valid: true };
  } catch (e) {
    console.error('Error validating checksum:', e);
    return { valid: false, reason: `Checksum validation failed: ${e.message}` };
  }
};

export const getAvailableStorage = async () => {
  try {
    const stat = await RNFS.stat(RNFS.DocumentDirectoryPath);
    if (stat && stat.totalSize && stat.freeSpace) {
      return {
        available: parseInt(stat.freeSpace, 10),
        total: parseInt(stat.totalSize, 10),
      };
    }
    if (stat && stat.availableSize) {
      return { available: parseInt(stat.availableSize, 10), total: parseInt(stat.totalSize, 10) };
    }
    return null;
  } catch (e) {
    console.warn('Could not get storage info:', e.message);
    return null;
  }
};

export const getFreeDiskStorage = async () => {
  const storage = await getAvailableStorage();
  return storage?.available || 0;
};

export const checkStoragePreDownload = async (modelSize = MODEL_EXPECTED_SIZE) => {
  const storage = await getAvailableStorage();
  if (!storage) {
    throw new Error('Unable to determine available storage space.');
  }

  const requiredBytes = modelSize * STORAGE_SAFETY_MARGIN;
  if (storage.available < requiredBytes) {
    const availableGB = (storage.available / (1024 * 1024 * 1024)).toFixed(2);
    const requiredGB = (requiredBytes / (1024 * 1024 * 1024)).toFixed(2);
    throw new Error(`Insufficient storage: ${availableGB} GB available, ${requiredGB} GB required.`);
  }
  return true;
};

const checkStorage = async () => {
  const storage = await getAvailableStorage();
  if (!storage) {
    throw new Error('Unable to determine available storage space.');
  }

  const requiredBytes = MIN_SIZE_BYTES * 2 * STORAGE_SAFETY_MARGIN;
  if (storage.available < requiredBytes) {
    const availableGB = (storage.available / (1024 * 1024 * 1024)).toFixed(2);
    const requiredGB = (requiredBytes / (1024 * 1024 * 1024)).toFixed(2);
    throw new Error(`Insufficient storage: ${availableGB} GB available, ${requiredGB} GB required.`);
  }
};

const getNonRetryableStatusCode = (error) => {
  if (error.message?.includes?.('401')) return 401;
  if (error.message?.includes?.('403')) return 403;
  if (error.message?.includes?.('404')) return 404;
  return null;
};

export const checkDeviceRAM = async () => {
  try {
    if (Platform.OS === 'android') {
      try {
        const DeviceInfo = require('react-native-device-info');
        const totalMemory = await DeviceInfo.getTotalMemory();
        const usedMemory = await DeviceInfo.getUsedMemory();
        const freeMemory = totalMemory - usedMemory;
        const freeGB = freeMemory / (1024 * 1024 * 1024);
        const totalGB = totalMemory / (1024 * 1024 * 1024);

        const requiredFreeGB = MODEL_EXPECTED_SIZE / (1024 * 1024 * 1024) * MEMORY_SAFETY_MULTIPLIER;
        if (freeGB < requiredFreeGB) {
          throw new Error(`Insufficient available memory: ${freeGB.toFixed(1)} GB free < ${requiredFreeGB.toFixed(1)} GB required`);
        }
        return { valid: true, freeGB, totalGB };
      } catch (e) {
        console.warn('DeviceInfo not available, using fallback RAM check:', e.message);
        const DeviceInfo = require('react-native-device-info');
        const totalMemory = await DeviceInfo.getTotalMemory();
        const totalGB = totalMemory / (1024 * 1024 * 1024);
        if (totalGB < MIN_RAM_GB) {
          throw new Error(`Device has insufficient RAM: ${totalGB.toFixed(1)} GB < ${MIN_RAM_GB} GB required`);
        }
        return { valid: true, totalGB };
      }
    }

    return { valid: true, totalGB: null };
  } catch (e) {
    console.error('RAM check failed:', e);
    return { valid: false, error: e.message };
  }
};

export const checkMemoryBeforeInference = async () => {
  try {
    if (Platform.OS === 'android') {
      const DeviceInfo = require('react-native-device-info');
      const totalMemory = await DeviceInfo.getTotalMemory();
      const usedMemory = await DeviceInfo.getUsedMemory();
      const freeMemory = totalMemory - usedMemory;
      const freeGB = freeMemory / (1024 * 1024 * 1024);
      const totalGB = totalMemory / (1024 * 1024 * 1024);

      if (freeGB < totalGB * MEMORY_SAFETY_THRESHOLD) {
        return { safe: false, reason: `Low memory: ${freeGB.toFixed(1)} GB free` };
      }
      return { safe: true, freeGB, totalGB };
    }
    return { safe: true };
  } catch (e) {
    return { safe: true };
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateExponentialBackoff = (attempt) => {
  const baseDelay = RETRY_DELAY_MS;
  const maxDelay = 60000;
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
};

const checkRetryBudget = async () => {
  try {
    const budget = await AsyncStorage.getItem(RETRY_BUDGET_KEY);
    const now = Date.now();
    const entry = budget ? JSON.parse(budget) : { count: 0, resetTime: now + 60000 };

    if (now > entry.resetTime) {
      return { allowed: true, remaining: MAX_RETRIES_PER_MINUTE };
    }

    if (entry.count >= MAX_RETRIES_PER_MINUTE) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: MAX_RETRIES_PER_MINUTE - entry.count };
  } catch (e) {
    return { allowed: true, remaining: MAX_RETRIES_PER_MINUTE };
  }
};

const incrementRetryBudget = async () => {
  try {
    const budget = await AsyncStorage.getItem(RETRY_BUDGET_KEY);
    const now = Date.now();
    const entry = budget ? JSON.parse(budget) : { count: 0, resetTime: now + 60000 };

    if (now > entry.resetTime) {
      await AsyncStorage.setItem(RETRY_BUDGET_KEY, JSON.stringify({ count: 1, resetTime: now + 60000 }));
    } else {
      await AsyncStorage.setItem(RETRY_BUDGET_KEY, JSON.stringify({ ...entry, count: entry.count + 1 }));
    }
  } catch (e) {
    // ignore
  }
};

export const addToRetryBudget = incrementRetryBudget;

export const getSystemState = async () => {
  try {
    const state = await AsyncStorage.getItem(SYSTEM_STATE_KEY);
    return state ? JSON.parse(state) : {
      networkQuality: 'unknown',
      memoryState: 'unknown',
      batteryLevel: 100,
      activeTasks: [],
    };
  } catch (e) {
    return {
      networkQuality: 'unknown',
      memoryState: 'unknown',
      batteryLevel: 100,
      activeTasks: [],
    };
  }
};

export const updateSystemState = async (updates) => {
  try {
    const state = await getSystemState();
    const newState = { ...state, ...updates };
    await AsyncStorage.setItem(SYSTEM_STATE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.warn('Failed to update system state:', e.message);
  }
};

export const recordAck = async (id) => {
  try {
    const dedupe = await AsyncStorage.getItem(ACK_DEDUPE_KEY);
    const now = Date.now();
    const entries = dedupe ? JSON.parse(dedupe) : [];

    entries.push({ id, timestamp: now });

    const filtered = entries.filter(e => now - e.timestamp < ACK_DEDUPE_TTL_MS);

    if (filtered.length > MAX_ACK_DEDUPE_ENTRIES) {
      filtered.splice(0, filtered.length - MAX_ACK_DEDUPE_ENTRIES);
    }

    await AsyncStorage.setItem(ACK_DEDUPE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to record ACK:', e.message);
  }
};

export const hasRecordedAck = async (id) => {
  try {
    const dedupe = await AsyncStorage.getItem(ACK_DEDUPE_KEY);
    const entries = dedupe ? JSON.parse(dedupe) : [];
    const now = Date.now();
    const filtered = entries.filter(e => now - e.timestamp < ACK_DEDUPE_TTL_MS);

    return filtered.some(e => e.id === id);
  } catch (e) {
    return false;
  }
};

export const getQueueDelay = (retryCount, networkQuality) => {
  const baseDelay = 100;
  const networkFactor = networkQuality === 'poor' ? 2 : networkQuality === 'good' ? 0.5 : 1;
  return Math.round(baseDelay + (retryCount * 150 * networkFactor));
};

export const downloadModel = async (onProgress, onCancel) => {
  const lock = await acquireDownloadLock();
  if (!lock.acquired) {
    console.log('Download already in progress:', lock.reason);
    return { alreadyDownloading: true, lock: lock.lock };
  }

  if (downloadCancellationPromise) {
    try {
      await downloadCancellationPromise;
    } catch (e) {
      // ignore previous cancellation
    }
  }

  activeDownload = (async () => {
    let downloadRef = null;
    let attempt = 0;
    let cancelled = false;

    const cancellationController = new Promise((_, reject) => {
      onCancel?.(() => {
        cancelled = true;
        reject(new Error('Download cancelled'));
      });
    });
    downloadCancellationPromise = cancellationController;

    try {
      const ramCheck = await checkDeviceRAM();
      if (!ramCheck.valid) {
        throw new Error(ramCheck.error || 'Device has insufficient RAM');
      }

      await checkStoragePreDownload();

      const retryAllowed = await checkRetryBudget();
      if (!retryAllowed.allowed) {
        throw new Error('Retry budget exceeded. Please wait before retrying.');
      }
      await incrementRetryBudget();

      while (attempt < MAX_RETRIES) {
        attempt++;
        if (cancelled) throw new Error('Download cancelled');

        try {
          const systemState = await getSystemState();
          const queueDelay = getQueueDelay(attempt - 1, systemState.networkQuality);
          if (queueDelay > 100) {
            await sleep(queueDelay);
          }

          const dirExists = await RNFS.exists(MODEL_DIR);
          if (!dirExists) {
            await RNFS.mkdir(MODEL_DIR);
          }

          let resumeOffset = 0;
          if (await RNFS.exists(TEMP_MODEL_PATH)) {
            const stat = await RNFS.stat(TEMP_MODEL_PATH);
            const existingSize = parseInt(stat.size, 10);
            if (existingSize >= MIN_SIZE_BYTES * 0.9) {
              resumeOffset = existingSize;
            }
          }

          console.log('Starting download to temp file:', TEMP_MODEL_PATH, 'attempt:', attempt, 'offset:', resumeOffset);

          const options = {
            fromUrl: MODEL_URL,
            toFile: TEMP_MODEL_PATH,
            progress: async (data) => {
              if (cancelled) {
                downloadRef?.cancel?.();
                return;
              }
              const percent = Math.round((data.bytesWritten / data.totalBytes) * 100);
              await saveResumeOffset(data.bytesWritten, data.totalBytes);
              onProgress?.({
                downloaded: Math.round(data.bytesWritten / (1024 * 1024)),
                total: Math.round(data.totalBytes / (1024 * 1024)),
                percentage: percent,
                attempt,
                resumed: resumeOffset > 0,
              });
            },
            headers: {
              'Authorization': HF_TOKEN ? `Bearer ${HF_TOKEN}` : undefined,
              'User-Agent': 'CrisisNet/1.0',
              'Range': resumeOffset > 0 ? `bytes=${resumeOffset}-` : undefined,
            },
            stopOnFailure: false,
            begin: (res) => {
              console.log('Download response status:', res.statusCode);
            },
          };

          downloadRef = RNFS.downloadFile(options);

          const result = await Promise.race([
            downloadRef.promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Download timeout')), DOWNLOAD_TIMEOUT_MS)
            ),
            cancellationController.then(() => {
              throw new Error('Download cancelled');
            }),
          ]);
          console.log('Download result:', result);

          if (result.statusCode === 416) {
            console.log('Server does not support range requests, starting fresh');
          }

          if (result.statusCode === 401) {
            throw new Error('Authentication failed. Please check your HuggingFace token.');
          }
          if (result.statusCode === 403) {
            throw new Error('Access denied. Accept the Gemma license on HuggingFace first.');
          }
          if (result.statusCode === 404) {
            throw new Error('Model not found (404). URL may be incorrect.');
          }
          if (result.statusCode && result.statusCode !== 200 && result.statusCode !== 206) {
            throw new Error(`Download failed with status: ${result.statusCode}`);
          }

          const stat = await RNFS.stat(TEMP_MODEL_PATH);
          const downloadedSize = parseInt(stat.size, 10);

          if (downloadedSize < MIN_SIZE_BYTES) {
            await RNFS.unlink(TEMP_MODEL_PATH);
            throw new Error(`Download incomplete: ${Math.round(downloadedSize / (1024 * 1024))} MB < ${MIN_SIZE_MB} MB minimum`);
          }

          const checksumResult = await validateModelChecksum();
          if (!checksumResult.valid) {
            await RNFS.unlink(TEMP_MODEL_PATH);
            throw new Error(`Model validation failed: ${checksumResult.reason}`);
          }

          if (modelInUse) {
            throw new Error('Model is currently in use, cannot replace');
          }

          await RNFS.moveFile(TEMP_MODEL_PATH, MODEL_PATH);
          await clearDownloadState();
          await saveModelMeta({
            hash: EXPECTED_SHA256,
            size: downloadedSize,
            completed: true,
            timestamp: Date.now(),
          });

          await releaseDownloadLock();
          downloadCancellationPromise = null;
          activeDownload = null;
          return true;
        } catch (e) {
          console.error('Download failed:', e.message, 'attempt:', attempt);

          if (await RNFS.exists(TEMP_MODEL_PATH)) {
            const stat = await RNFS.stat(TEMP_MODEL_PATH);
            const existingSize = parseInt(stat.size, 10);
            if (existingSize > MIN_SIZE_BYTES * 0.5) {
              console.log('Preserving partial download for resume:', existingSize);
            } else {
              await RNFS.unlink(TEMP_MODEL_PATH);
            }
          }

          const statusCode = getNonRetryableStatusCode(e);
          if (statusCode && NON_RETRYABLE_ERRORS.has(statusCode)) {
            await releaseDownloadLock();
            downloadCancellationPromise = null;
            activeDownload = null;
            throw e;
          }

          if (e.message === 'Download cancelled' || e.message === 'Download timeout') {
            if (downloadRef && downloadRef.cancel) {
              try {
                await downloadRef.cancel();
              } catch (cancelErr) {
                // ignore
              }
            }
            await releaseDownloadLock();
            downloadCancellationPromise = null;
            activeDownload = null;
            throw e;
          }

          if (downloadRef && downloadRef.cancel) {
            try {
              await downloadRef.cancel();
            } catch (cancelErr) {
              // ignore
            }
          }

          if (attempt < MAX_RETRIES) {
            const backoffDelay = calculateExponentialBackoff(attempt);
            console.log(`Retrying in ${backoffDelay}ms...`);
            await sleep(backoffDelay);
          } else {
            await releaseDownloadLock();
            downloadCancellationPromise = null;
            activeDownload = null;
            throw e;
          }
        }
      }
    } finally {
      if (downloadCancellationPromise) {
        downloadCancellationPromise = null;
      }
    }
  })();

  return activeDownload;
};

export const deleteModel = async () => {
  try {
    if (modelInUse) {
      throw new Error('Model is currently in use, cannot delete');
    }
    const exists = await RNFS.exists(MODEL_PATH);
    if (exists) {
      await RNFS.unlink(MODEL_PATH);
    }
    const tempExists = await RNFS.exists(TEMP_MODEL_PATH);
    if (tempExists) {
      await RNFS.unlink(TEMP_MODEL_PATH);
    }
    await clearModelMeta();
    return true;
  } catch (e) {
    console.error('Error deleting model:', e);
    return false;
  }
};