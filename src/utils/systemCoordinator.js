import { getSystemState, updateSystemState, getQueueDelay, checkMemoryBeforeInference } from '../utils/modelStorage';

let systemMonitorInterval = null;

export const initializeSystemCoordinator = async () => {
  if (systemMonitorInterval) return;
  
  await updateSystemState({
    networkQuality: 'unknown',
    memoryState: 'unknown',
    batteryLevel: 100,
    activeTasks: [],
  });

  systemMonitorInterval = setInterval(async () => {
    try {
      const state = await getSystemState();
      const memoryCheck = await checkMemoryBeforeInference();
      
      await updateSystemState({
        memoryState: memoryCheck.safe ? 'healthy' : 'low',
      });
    } catch (e) {
      console.warn('System coordinator update failed:', e.message);
    }
  }, 30000);
};

export const shutdownSystemCoordinator = () => {
  if (systemMonitorInterval) {
    clearInterval(systemMonitorInterval);
    systemMonitorInterval = null;
  }
};

export const canStartDownload = async () => {
  const state = await getSystemState();
  
  if (state.memoryState === 'low') {
    return { allowed: false, reason: 'Low memory - download deferred' };
  }
  
  return { allowed: true };
};

export const canStartInference = async () => {
  const state = await getSystemState();
  const memoryCheck = await checkMemoryBeforeInference();
  
  if (!memoryCheck.safe) {
    return { allowed: false, reason: memoryCheck.reason };
  }
  
  return { allowed: true };
};

export const shouldPauseDownloads = async () => {
  const state = await getSystemState();
  return state.memoryState === 'low' || state.batteryLevel < 20;
};

export const getAdaptiveRetryDelay = (retryCount, networkQuality) => {
  return getQueueDelay(retryCount, networkQuality);
};

export const getSystemHealth = async () => {
  const state = await getSystemState();
  const memoryCheck = await checkMemoryBeforeInference();
  
  return {
    healthy: memoryCheck.safe && state.networkQuality !== 'poor',
    networkQuality: state.networkQuality,
    memorySafe: memoryCheck.safe,
    batteryLevel: state.batteryLevel,
  };
};