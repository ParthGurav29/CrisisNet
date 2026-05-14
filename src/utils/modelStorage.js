import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

// Streaming SHA-256 hasher backed by crypto-js (pure JS, no native module).
// Mirrors the small subset of node's crypto.createHash('sha256') we used:
//   .update(base64String | Buffer | Uint8Array)
//   .digest('hex')
// We intentionally do NOT use `react-native-crypto` because it transitively
// loads `react-native-randombytes`, whose top-level init() reads
// `NativeModules.RNRandomBytes.seed` and crashes the JS bundle at load time
// when the native module is not linked (RN 0.85 New Architecture).
const createSha256Hasher = () => {
  const hasher = CryptoJS.algo.SHA256.create();
  return {
    update: (chunk) => {
      if (chunk == null) return;
      if (typeof chunk === 'string') {
        hasher.update(CryptoJS.enc.Base64.parse(chunk));
        return;
      }
      const len = chunk.length;
      const words = [];
      for (let i = 0; i < len; i++) {
        words[i >>> 2] |= (chunk[i] & 0xff) << (24 - (i % 4) * 8);
      }
      hasher.update(CryptoJS.lib.WordArray.create(words, len));
    },
    digest: (encoding = 'hex') => {
      const result = hasher.finalize();
      return encoding === 'hex'
        ? result.toString(CryptoJS.enc.Hex)
        : result.toString();
    },
  };
};

const HF_TOKEN = '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';


export const MODEL_FILENAME =
  'crisisnet-gemma-final.Q4_K_M.gguf';

export const MODEL_ID = 'crisisnet-gemma';

const MODEL_URL =
  'https://huggingface.co/Prime23457890/crisisnet-gemma-gguf/resolve/main/crisisnet-gemma-final.Q4_K_M.gguf';

export const MODEL_EXPECTED_SIZE = 1708582528;

const MODEL_ROOT_DIR = `${RNFS.DocumentDirectoryPath}/models`;
const MODEL_DIR = `${MODEL_ROOT_DIR}/${MODEL_ID}`;
const MODEL_PATH = `${MODEL_DIR}/${MODEL_FILENAME}`;
const TEMP_MODEL_PATH = `${MODEL_DIR}/${MODEL_FILENAME}.tmp`;
const LOCK_PATH = `${MODEL_DIR}/download.lock`;
const LEGACY_MODEL_PATH = `${MODEL_ROOT_DIR}/${MODEL_FILENAME}`;
const LEGACY_LOCK_PATH = `${MODEL_ROOT_DIR}/download.lock`;
const LEGACY_META_PATH = `${MODEL_ROOT_DIR}/meta.json`;
const DOWNLOAD_STATE_KEY = 'download_state';
const ACK_DEDUPE_KEY = 'ack_dedupe';
const SYSTEM_STATE_KEY = 'system_state';
const RETRY_BUDGET_KEY = 'retry_budget';
const MODEL_LIFECYCLE_KEY = 'model_lifecycle_state';
const MIN_VALID_MODEL_BYTES = MODEL_EXPECTED_SIZE * 0.5;

export const EXPECTED_SHA256 = null;

export const computeModelChecksum = async (filePath) => {
  const chunkSize = 1024 * 1024;
  const stat = await RNFS.stat(filePath);
  const bytes = parseInt(stat.size, 10);
  let offset = 0;
  const hash = createSha256Hasher();

  while (offset < bytes) {
    const lengthToRead = Math.min(chunkSize, bytes - offset);
    const chunk = await RNFS.readFile(filePath, 'base64', {
      offset,
      length: lengthToRead
    });
    hash.update(chunk);
    offset += lengthToRead;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return hash.digest('hex');
};

const verifyGgufHeader = async (filePath) => {
  try {
    if (typeof RNFS.read !== 'function') {
      return { valid: true };
    }
    const magic = await RNFS.read(filePath, 4, 0, 'ascii');
    if (magic !== 'GGUF') {
      return { valid: false, reason: `Invalid GGUF header: ${magic || 'unknown'}` };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: `Failed to read GGUF header: ${e.message}` };
  }
};

const MIN_RAM_GB = 5;
const MIN_RAM_BYTES = MIN_RAM_GB * 1024 * 1024 * 1024;
const MIN_SIZE_BYTES = MODEL_EXPECTED_SIZE;
export const MIN_SIZE_MB = Math.round(MIN_SIZE_BYTES / (1024 * 1024));
const DOWNLOAD_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const DOWNLOAD_MONITOR_INTERVAL_MS = 1000;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const STORAGE_SAFETY_MARGIN = 2.0;
const MEMORY_SAFETY_MULTIPLIER = 1.8;
const MAX_RESUME_ATTEMPTS = 3;
const LOCK_TTL_MS = 10 * 60 * 1000;
const ACK_DEDUPE_TTL_MS = 5 * 60 * 1000;
const MAX_ACK_DEDUPE_ENTRIES = 1000;
const MAX_RETRIES_PER_MINUTE = 20;
const MEMORY_SAFETY_THRESHOLD = 0.3;
const MODEL_QUANTIZATION = 'Q4_K_M';
const MODEL_FORMAT = 'gguf';
const MIN_RESUME_BYTES = 10 * 1024 * 1024;

const NON_RETRYABLE_ERRORS = new Set([401, 403, 404]);

const MODEL_VERSION = 1;
const META_FILENAME = 'meta.json';
const PARTIAL_DOWNLOAD_THRESHOLD = 10 * 1024 * 1024;

let downloadCancellationPromise = null;
let activeDownload = null;
let modelInUse = false;

export const MODEL_LIFECYCLE_STATES = Object.freeze({
  NOT_DOWNLOADED: 'NOT_DOWNLOADED',
  DOWNLOADING: 'DOWNLOADING',
  VERIFYING: 'VERIFYING',
  READY_ON_DISK: 'READY_ON_DISK',
  LOADING: 'LOADING',
  READY_IN_RAM: 'READY_IN_RAM',
  FAILED: 'FAILED',
});

// Unique to *this* JS session. Written into the download lock so we can
// detect orphan locks left behind by a previous app process / JS reload
// (RN apps are single-instance on Android, so any lock with a different
// session id is by definition stale and safe to steal).
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const getPartialDownloadInfo = async () => {
  try {
    if (!(await RNFS.exists(TEMP_MODEL_PATH))) return null;
    const stat = await RNFS.stat(TEMP_MODEL_PATH);
    const size = parseInt(stat.size, 10);
    if (size < PARTIAL_DOWNLOAD_THRESHOLD) {
      await RNFS.unlink(TEMP_MODEL_PATH);
      return null;
    }
    return { bytesDownloaded: size, totalBytes: MODEL_EXPECTED_SIZE };
  } catch (e) {
    return null;
  }
};

export const getModelVersion = () => MODEL_VERSION;

export const getMetaPath = () => `${MODEL_DIR}/${META_FILENAME}`;

export const getLockPath = () => LOCK_PATH;

export const setModelLifecycleState = async (state, details = {}) => {
  try {
    await AsyncStorage.setItem(
      MODEL_LIFECYCLE_KEY,
      JSON.stringify({
        state,
        details,
        timestamp: Date.now(),
      }),
    );
  } catch (e) {
    console.warn('Failed to persist model lifecycle state:', e.message);
  }
};

export const getModelLifecycleState = async () => {
  try {
    const raw = await AsyncStorage.getItem(MODEL_LIFECYCLE_KEY);
    const persisted = raw ? JSON.parse(raw) : null;
    if (persisted?.state === MODEL_LIFECYCLE_STATES.DOWNLOADING || persisted?.state === MODEL_LIFECYCLE_STATES.VERIFYING || persisted?.state === MODEL_LIFECYCLE_STATES.LOADING) {
      return persisted.state;
    }
  } catch (e) {
    // ignore parse/read errors; fall through to disk detection
  }
  const exists = await RNFS.exists(MODEL_PATH);
  return exists ? MODEL_LIFECYCLE_STATES.READY_ON_DISK : MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED;
};

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
    const content = JSON.stringify({
      modelId: MODEL_ID,
      filename: MODEL_FILENAME,
      format: MODEL_FORMAT,
      quantization: MODEL_QUANTIZATION,
      compatibility: {
        minRamGB: MIN_RAM_GB,
        minStorageBytes: Math.round(MODEL_EXPECTED_SIZE * STORAGE_SAFETY_MARGIN),
      },
      version: MODEL_VERSION,
      timestamp: Date.now(),
      ...meta,
    });
    await RNFS.writeFile(tmpPath, content, 'utf8');
    if (RNFS.fsync) await RNFS.fsync(tmpPath);
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

export const saveResumeOffset = async (bytesWritten, totalBytes) => {
  try {
    await saveDownloadState({ bytesWritten, totalBytes, timestamp: Date.now() });
  } catch (e) {
    console.warn('Failed to save resume offset:', e.message);
  }
};

export const getModelPath = () => {
  const path = MODEL_PATH;
  console.log('[DEBUG-STORAGE] getModelPath called, returning:', path);
  console.log('[DEBUG-STORAGE] MODEL_ROOT_DIR:', MODEL_ROOT_DIR);
  console.log('[DEBUG-STORAGE] MODEL_DIR:', MODEL_DIR);
  console.log('[DEBUG-STORAGE] MODEL_FILENAME:', MODEL_FILENAME);
  return path;
};

export const getModelDir = () => MODEL_DIR;
export const getModelRootDir = () => MODEL_ROOT_DIR;

// Ensure `${DocumentDirectory}/models/` exists. Idempotent and safe to call
// many times. The first launch of the app does not have this directory yet,
// which previously caused `acquireDownloadLock` to fail with ENOENT and
// `downloadModel` to incorrectly surface "Download already in progress".
export const ensureModelDir = async () => {
  try {
    const rootExists = await RNFS.exists(MODEL_ROOT_DIR);
    if (!rootExists) {
      await RNFS.mkdir(MODEL_ROOT_DIR);
    }
    const exists = await RNFS.exists(MODEL_DIR);
    if (!exists) {
      await RNFS.mkdir(MODEL_DIR);
    }
    await migrateLegacyRuntimeLayout();
    return true;
  } catch (e) {
    console.warn('Failed to ensure model dir:', e.message);
    return false;
  }
};

const migrateLegacyRuntimeLayout = async () => {
  try {
    const legacyModelExists = await RNFS.exists(LEGACY_MODEL_PATH);
    const currentModelExists = await RNFS.exists(MODEL_PATH);
    if (legacyModelExists && !currentModelExists) {
      await RNFS.moveFile(LEGACY_MODEL_PATH, MODEL_PATH);
      console.log('Migrated legacy runtime model into managed model directory');
    }
  } catch (e) {
    console.warn('Failed to migrate legacy model path:', e.message);
  }

  try {
    const legacyMetaExists = await RNFS.exists(LEGACY_META_PATH);
    const currentMetaExists = await RNFS.exists(getMetaPath());
    if (legacyMetaExists && !currentMetaExists) {
      await RNFS.moveFile(LEGACY_META_PATH, getMetaPath());
    }
  } catch (e) {
    console.warn('Failed to migrate legacy model metadata:', e.message);
  }

  try {
    const legacyLockExists = await RNFS.exists(LEGACY_LOCK_PATH);
    if (legacyLockExists) {
      await RNFS.unlink(LEGACY_LOCK_PATH);
    }
  } catch (e) {
    // ignore stale legacy lock cleanup failures
  }
};

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
    await ensureModelDir();
    const existingLock = await readLockFile();
    if (existingLock && !isLockStale(existingLock) && existingLock.sessionId === SESSION_ID) {
      // Same session already holds the lock — caller is the legitimate owner.
      return { acquired: false, reason: 'Lock exists', lock: existingLock };
    }
    if (existingLock && existingLock.sessionId && existingLock.sessionId !== SESSION_ID) {
      // Lock was written by a previous JS session (e.g. before a reload or
      // crash). RN apps are single-instance on Android, so that session is
      // gone — steal the lock.
      console.log('Stealing orphan download lock from previous session:', existingLock.sessionId);
    }
    const lockData = {
      sessionId: SESSION_ID,
      pid: typeof process !== 'undefined' && process.pid ? process.pid : Date.now(),
      timestamp: Date.now(),
      appStartTimestamp: Date.now(),
      progress: { bytesWritten: 0, totalBytes: MODEL_EXPECTED_SIZE },
    };
    await writeLockFile(lockData);
    return { acquired: true, lock: lockData };
  } catch (e) {
    console.warn('Failed to acquire lock:', e.message);
    return { acquired: false, reason: e.message, ioError: true };
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

export const updateLockProgress = async (bytesWritten, totalBytes) => {
  try {
    const lock = await readLockFile();
    if (lock) {
      lock.progress = { bytesWritten, totalBytes };
      await writeLockFile(lock);
    }
  } catch (e) {
    console.warn('Failed to update lock progress:', e.message);
  }
};

const askResumeChoice = async (partialInfo) => {
  try {
    const { Alert } = require('react-native');
    return new Promise((resolve) => {
      Alert.alert(
        'Resume Download',
        `Found partial download: ${Math.round(partialInfo.bytesDownloaded / (1024 * 1024))} MB of ${Math.round(MODEL_EXPECTED_SIZE / (1024 * 1024))} MB. Resume or restart?`,
        [
          { text: 'Restart', onPress: () => resolve(false) },
          { text: 'Resume', onPress: () => resolve(true) },
        ]
      );
    });
  } catch (e) {
    return false;
  }
};

export const isModelLocked = () => modelInUse;

export const setModelInUse = (inUse) => {
  modelInUse = inUse;
};

export const checkAndResumeDownload = async () => {
  const lock = await readLockFile();
  if (lock && !isLockStale(lock) && lock.sessionId === SESSION_ID) {
    const meta = await getModelMeta();
    if (meta && !meta.completed) {
      return { shouldResume: true, lock };
    }
  }
  return { shouldResume: false };
};

export const modelExists = async () => {
  try {
    console.log('[DEBUG-STORAGE] modelExists: Starting check...');
    const exists = await RNFS.exists(MODEL_PATH);
    console.log('[DEBUG-STORAGE] modelExists check for:', MODEL_PATH, 'Result:', exists);
    if (!exists) {
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED);
      return false;
    }
    const stat = await RNFS.stat(MODEL_PATH);
    const bytes = parseInt(stat.size, 10);
    console.log('[DEBUG-STORAGE] Model file size:', bytes, 'bytes');
    if (bytes < MIN_VALID_MODEL_BYTES) {
      console.warn('[DEBUG-STORAGE] File too small:', bytes, '<', MIN_VALID_MODEL_BYTES);
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED, { reason: 'file_too_small' });
      return false;
    }

    const meta = await getModelMeta();
    console.log('[DEBUG-STORAGE] Model meta:', meta);
    if (!meta || meta.version !== MODEL_VERSION || !meta.completed) {
      console.log('[DEBUG-STORAGE] Meta missing or incomplete, saving new meta');
      await saveModelMeta({
        hash: null,
        size: bytes,
        completed: true,
        source: 'runtime_check',
        timestamp: Date.now(),
      });
      await setModelLifecycleState(MODEL_LIFECYCLE_STATES.READY_ON_DISK);
      return true;
    }

    const checksumResult = await validateModelChecksum({ quick: true });
    console.log('[DEBUG-STORAGE] Checksum result:', checksumResult);
    await setModelLifecycleState(
      checksumResult.valid ? MODEL_LIFECYCLE_STATES.READY_ON_DISK : MODEL_LIFECYCLE_STATES.FAILED,
      checksumResult.valid ? {} : { reason: checksumResult.reason || 'checksum_failed' },
    );
    return checksumResult.valid;
  } catch (e) {
    console.error('Error checking model:', e);
    await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: e.message });
    return false;
  }
};

export const validateModelChecksum = async (options = {}) => {
  try {
    const { quick = false, path: filePath = MODEL_PATH } = options;
    const exists = await RNFS.exists(filePath);
    if (!exists) return { valid: false, reason: 'Model file not found' };

    const stat = await RNFS.stat(filePath);
    const bytes = parseInt(stat.size, 10);
    if (bytes < MIN_VALID_MODEL_BYTES) {
      return { valid: false, reason: `File too small: ${bytes} bytes` };
    }

    const headerResult = await verifyGgufHeader(filePath);
    if (!headerResult.valid) {
      return headerResult;
    }

    if (quick && !EXPECTED_SHA256) {
      return { valid: true, reason: 'Quick validation passed (size + GGUF header)' };
    }

    const meta = await getModelMeta();
    if (meta && meta.validatedAt && Date.now() - meta.validatedAt < 60 * 60 * 1000) {
      if (meta.size === bytes) {
        return { valid: true, reason: 'Validated recently' };
      }
    }

    const chunkSize = 1024 * 1024;
    const hash = createSha256Hasher();

    let offset = 0;
    while (offset < bytes) {
      const lengthToRead = Math.min(chunkSize, bytes - offset);
      const chunk = await RNFS.readFile(filePath, 'base64', {
        offset,
        length: lengthToRead
      });
      hash.update(chunk);
      offset += lengthToRead;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const computedHash = hash.digest('hex');
    if (EXPECTED_SHA256 && computedHash.toLowerCase() !== EXPECTED_SHA256.toLowerCase()) {
      return { valid: false, reason: 'Checksum mismatch', hash: computedHash };
    }

    const partialHash = createSha256Hasher();
    const endBytes = Math.min(1024 * 1024, bytes);
    const endChunk = await RNFS.readFile(filePath, 'base64', {
      offset: bytes - endBytes,
      length: endBytes
    });
    partialHash.update(endChunk);

    await saveModelMeta({
      hash: computedHash,
      size: bytes,
      completed: true,
      timestamp: Date.now(),
      validatedAt: Date.now(),
      partialHash: partialHash.digest('hex'),
    });
    return { valid: true, hash: computedHash };
  } catch (e) {
    console.error('Error validating checksum:', e);
    return { valid: false, reason: `Checksum validation failed: ${e.message}` };
  }
};

export const getAvailableStorage = async () => {
  // The correct API is `RNFS.getFSInfo()` which returns `{ totalSpace,
  // freeSpace }`. The previous implementation called `RNFS.stat(...)` and
  // looked for `freeSpace` / `totalSize` / `availableSize` on the result —
  // none of which exist on a stat result. That made this function ALWAYS
  // return null and `checkStoragePreDownload` always throw "Unable to
  // determine available storage space."
  try {
    if (typeof RNFS.getFSInfo === 'function') {
      const info = await RNFS.getFSInfo();
      const total = Number(info?.totalSpace);
      const free = Number(info?.freeSpace);
      if (Number.isFinite(total) && Number.isFinite(free) && total > 0) {
        return { available: free, total };
      }
    }

    // Fallback: very old/odd RNFS forks expose these keys directly on the
    // module export. Best-effort, doesn't break anything if absent.
    const total = Number(RNFS.TotalSpaceBytes ?? RNFS.totalSpace);
    const free = Number(RNFS.FreeSpaceBytes ?? RNFS.freeSpace);
    if (Number.isFinite(total) && Number.isFinite(free) && total > 0) {
      return { available: free, total };
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
    // Cannot determine storage — warn but do NOT block the download.
    // On many devices/emulators getFSInfo() is unavailable.
    console.warn('Unable to determine available storage space — proceeding anyway.');
    return true;
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
  await ensureModelDir();
  await setModelLifecycleState(MODEL_LIFECYCLE_STATES.DOWNLOADING);
  const lock = await acquireDownloadLock();
  if (!lock.acquired) {
    if (lock.ioError) {
      console.warn('Proceeding without download lock due to I/O error:', lock.reason);
    } else {
      console.log('Download already in progress:', lock.reason);
      return { alreadyDownloading: true, lock: lock.lock };
    }
  }

  const partialInfo = await getPartialDownloadInfo();
  if (partialInfo) {
    const resumeChoice = await askResumeChoice(partialInfo);
    if (!resumeChoice) {
      await clearDownloadState();
      try { await RNFS.unlink(TEMP_MODEL_PATH); } catch (_) {}
    }
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
    let inactivityMonitorId = null;
    let attempt = 0;
    let cancelled = false;
    let lastProgressAt = Date.now();
    let lastBytesWritten = 0;

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

          // RNFS.downloadFile always truncates the target file — it does NOT
          // support HTTP Range resume.  Delete any leftover temp file so we
          // get a clean HTTP 200 response and correct bytesWritten accounting.
          if (await RNFS.exists(TEMP_MODEL_PATH)) {
            try { await RNFS.unlink(TEMP_MODEL_PATH); } catch (_) { /* ignore */ }
          }
          lastBytesWritten = 0;
          lastProgressAt = Date.now();

          console.log('Starting download to temp file:', TEMP_MODEL_PATH, 'attempt:', attempt);

          // Track last percent we persisted so we only write to AsyncStorage
          // every 5% (cheap), but fire onProgress on EVERY callback (smooth UI).
          let lastPersistedPercent = -1;

          const options = {
            fromUrl: MODEL_URL,
            toFile: TEMP_MODEL_PATH,
            progressInterval: 200,
            progressDivider: 1,
            progress: (data) => {
              if (cancelled) {
                downloadRef?.cancel?.();
                return;
              }
              if (data.bytesWritten > lastBytesWritten) {
                lastBytesWritten = data.bytesWritten;
                lastProgressAt = Date.now();
              }
              const percent = data.totalBytes > 0
                ? Math.round((data.bytesWritten / data.totalBytes) * 100)
                : (data.bytesWritten > 0 ? 1 : 0);

              // Persist resume state and update lock every 5%
              if (percent >= lastPersistedPercent + 5) {
                lastPersistedPercent = percent;
                saveResumeOffset(data.bytesWritten, data.totalBytes).catch(() => {});
                updateLockProgress(data.bytesWritten, data.totalBytes).catch(() => {});
              }

              // Fire progress on EVERY callback so the UI bar is smooth
              onProgress?.({
                bytesWritten: data.bytesWritten,
                totalBytes: data.totalBytes,
                downloaded: Math.round(data.bytesWritten / (1024 * 1024)),
                total: Math.round(data.totalBytes / (1024 * 1024)),
                percentage: percent,
                attempt,
              });
            },
            headers: {
              'Authorization': HF_TOKEN ? `Bearer ${HF_TOKEN}` : undefined,
              'User-Agent': 'CrisisNet/1.0',
            },
            connectionTimeout: 60000,
            readTimeout: 120000,
            begin: (res) => {
              console.log('Download response status:', res.statusCode, 'contentLength:', res.contentLength);
            },
          };

          downloadRef = RNFS.downloadFile(options);
          const inactivityTimeoutPromise = new Promise((_, reject) => {
            inactivityMonitorId = setInterval(() => {
              if (cancelled) return;
              const idleMs = Date.now() - lastProgressAt;
              if (idleMs >= DOWNLOAD_INACTIVITY_TIMEOUT_MS) {
                clearInterval(inactivityMonitorId);
                inactivityMonitorId = null;
                reject(new Error(`Download stalled for ${Math.round(idleMs / 1000)}s`));
              }
            }, DOWNLOAD_MONITOR_INTERVAL_MS);
          });

          let result;
          try {
            result = await Promise.race([
              downloadRef.promise,
              inactivityTimeoutPromise,
              cancellationController.then(() => {
                throw new Error('Download cancelled');
              }),
            ]);
          } finally {
            if (inactivityMonitorId) {
              clearInterval(inactivityMonitorId);
              inactivityMonitorId = null;
            }
          }
          console.log('Download result:', result);

          // 416 Range Not Satisfiable should not happen anymore since we
          // no longer send Range headers, but handle it defensively.
          if (result.statusCode === 416) {
            console.log('Got 416 — retrying without Range header');
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
          if (result.statusCode === 500) {
            throw new Error('Server error (500). Please retry in a few minutes.');
          }
          if (result.statusCode && result.statusCode !== 200 && result.statusCode !== 206) {
            throw new Error(`Download failed with status: ${result.statusCode}`);
          }
          if (!result.statusCode || result.statusCode === 0) {
            throw new Error('Download failed: Unable to resolve host "huggingface.co"');
          }

          const stat = await RNFS.stat(TEMP_MODEL_PATH);
          const downloadedSize = parseInt(stat.size, 10);

          if (downloadedSize < MIN_SIZE_BYTES) {
            await RNFS.unlink(TEMP_MODEL_PATH);
            throw new Error(`Download incomplete: ${Math.round(downloadedSize / (1024 * 1024))} MB < ${MIN_SIZE_MB} MB minimum`);
          }

          await setModelLifecycleState(MODEL_LIFECYCLE_STATES.VERIFYING);
          onProgress?.({
            downloaded: Math.round(downloadedSize / (1024 * 1024)),
            total: Math.round(downloadedSize / (1024 * 1024)),
            percentage: 100,
            attempt,
            stage: 'verifying',
          });
          const checksumResult = await validateModelChecksum({ path: TEMP_MODEL_PATH, quick: true });
          if (!checksumResult.valid) {
            await RNFS.unlink(TEMP_MODEL_PATH);
            throw new Error(`Model validation failed: ${checksumResult.reason}`);
          }

          if (modelInUse) {
            throw new Error('Model is currently in use, cannot replace');
          }

          // Skip testModelLoad — it fully loads the 2.8 GB model into RAM
          // just to validate, which risks OOM on constrained devices.
          // The model will be loaded properly on the Splash screen.

          await RNFS.moveFile(TEMP_MODEL_PATH, MODEL_PATH);
          await clearDownloadState();
          await saveModelMeta({
            hash: checksumResult.hash,
            size: downloadedSize,
            completed: true,
            timestamp: Date.now(),
            installedAt: Date.now(),
            downloadedFrom: MODEL_URL,
            source: 'managed_runtime_download',
          });

          await setModelLifecycleState(MODEL_LIFECYCLE_STATES.READY_ON_DISK);
          await releaseDownloadLock();
          downloadCancellationPromise = null;
          activeDownload = null;
          return true;
        } catch (e) {
          console.error('Download failed:', e.message, 'attempt:', attempt);

          // Clean up partial temp file — RNFS cannot resume, so keeping
          // it around is pointless and wastes disk space.
          if (await RNFS.exists(TEMP_MODEL_PATH)) {
            try { await RNFS.unlink(TEMP_MODEL_PATH); } catch (_) { /* ignore */ }
          }

          const statusCode = getNonRetryableStatusCode(e);
          if (statusCode && NON_RETRYABLE_ERRORS.has(statusCode)) {
            await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: e.message, attempt });
            await releaseDownloadLock();
            downloadCancellationPromise = null;
            activeDownload = null;
            throw e;
          }

          const isStallError = e.message?.includes('stall') || e.message?.includes('timeout') || e.message?.includes(' stalled');
          const isNetworkError = e.message?.includes('network') || e.message?.includes('ECONN') || e.message?.includes('ENET') || e.message?.includes('resolve host') || e.message?.includes('No address') || e.message?.includes('Unable to resolve host') || !e.message?.includes('status');

          if (attempt < MAX_RETRIES && (isStallError || isNetworkError)) {
            const backoffDelay = calculateExponentialBackoff(attempt);
            console.log(`Retrying in ${backoffDelay}ms after: ${e.message}`);
            onProgress?.({
              downloaded: 0,
              total: Math.round(MODEL_EXPECTED_SIZE / (1024 * 1024)),
              percentage: 0,
              attempt: attempt + 1,
              stage: 'retrying',
              error: e.message,
            });
            await sleep(backoffDelay);
          } else {
            await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: e.message, attempt });
            await releaseDownloadLock();
            downloadCancellationPromise = null;
            activeDownload = null;
            throw e;
          }
        }
      }
    } finally {
      if (inactivityMonitorId) {
        clearInterval(inactivityMonitorId);
        inactivityMonitorId = null;
      }
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
    await setModelLifecycleState(MODEL_LIFECYCLE_STATES.NOT_DOWNLOADED);
    return true;
  } catch (e) {
    console.error('Error deleting model:', e);
    await setModelLifecycleState(MODEL_LIFECYCLE_STATES.FAILED, { reason: e.message });
    return false;
  }
};

export const testModelLoad = async (modelPath) => {
  try {
    const { installJsi } = require('llama.rn');
    if (typeof installJsi === 'function') {
      await installJsi();
    }
    const Llama = require('llama.rn');
    const initLlama = Llama.initLlama || Llama.init;
    
    if (typeof initLlama !== 'function') {
      return { success: false, error: 'Llama init not found' };
    }

    const testContext = await initLlama({
      model: modelPath,
      n_ctx: 256,
      n_threads: 2,
      use_mmap: true,
      use_mlock: false,
      seed: -1, // Random seed (default)
    });

    if (!testContext) {
      return { success: false, error: 'Model test init returned null' };
    }
    await testContext.terminate();
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};