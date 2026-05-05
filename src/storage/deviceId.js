import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';

// Simple mutex to prevent race conditions in device ID generation
let mutexPromise = null;

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const getDeviceId = async () => {
  // Use mutex to prevent concurrent calls from generating multiple IDs
  if (!mutexPromise) {
    mutexPromise = (async () => {
      try {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateUUID();
          await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
      } catch (error) {
        console.error('Failed to get/save device ID:', error);
        return generateUUID();
      } finally {
        mutexPromise = null;
      }
    })();
  }
  
  return mutexPromise;
};

export const getShortId = async () => {
  const deviceId = await getDeviceId();
  return deviceId.substring(0, 6);
};