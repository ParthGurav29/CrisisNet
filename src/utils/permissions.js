import { Platform, PermissionsAndroid, NativeModules } from 'react-native';

export const PERMISSIONS = {
  BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
  BLUETOOTH_ADVERTISE: 'android.permission.BLUETOOTH_ADVERTISE',
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
  POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
};

// `@offline-protocol/mesh-sdk` exposes a Bluetooth-enabled check via its
// own native module (OfflineProtocolModule). We avoid importing the SDK
// here to keep this file dependency-light; instead we talk to the native
// module directly when it's available, and fall back to "BT enabled" so
// callers don't get blocked on devices where the helper isn't shipped.
const checkBluetoothEnabled = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const mod = NativeModules?.OfflineProtocolModule;
    if (mod && typeof mod.isBluetoothEnabled === 'function') {
      return Boolean(await mod.isBluetoothEnabled());
    }
  } catch (e) {
    console.warn('[PERMS] isBluetoothEnabled probe failed:', e?.message);
  }
  return true;
};

const tryEnableBluetooth = async () => {
  if (Platform.OS !== 'android') return { ok: true };
  try {
    const mod = NativeModules?.OfflineProtocolModule;
    if (mod && typeof mod.requestEnableBluetooth === 'function') {
      const ok = await mod.requestEnableBluetooth();
      return { ok: Boolean(ok) };
    }
  } catch (e) {
    return { ok: false, reason: e?.message || 'User declined to enable Bluetooth' };
  }
  return { ok: true };
};

export const checkBlePermissions = async () => {
  if (Platform.OS !== 'android') return { granted: true };

  const enabled = await checkBluetoothEnabled();
  if (!enabled) {
    return { granted: false, reason: 'Bluetooth is not enabled' };
  }
  return { granted: true };
};

const requestAndroidBluetoothPermissions = async () => {
  const required = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ].filter(Boolean);

  const result = await PermissionsAndroid.requestMultiple(required);
  const denied = Object.entries(result)
    .filter(([, status]) => status !== PermissionsAndroid.RESULTS.GRANTED)
    .map(([perm]) => perm);

  return { granted: denied.length === 0, denied };
};

export const requestBlePermissions = async () => {
  if (Platform.OS !== 'android') return { granted: true };

  try {
    const permResult = await requestAndroidBluetoothPermissions();
    if (!permResult.granted) {
      return {
        granted: false,
        reason: `Permissions denied: ${permResult.denied.join(', ')}`,
      };
    }

    const enabledNow = await checkBluetoothEnabled();
    if (!enabledNow) {
      const enableResult = await tryEnableBluetooth();
      if (!enableResult.ok) {
        return { granted: false, reason: enableResult.reason || 'Bluetooth disabled' };
      }
    }

    return { granted: true, enabled: true };
  } catch (e) {
    return { granted: false, reason: e?.message || 'Bluetooth setup failed' };
  }
};

export const requestBatteryOptimizationExemption = async () => {
  if (Platform.OS !== 'android') return { granted: true };
  // Not yet bridged; surface as best-effort no-op so callers can continue.
  return { granted: true, needsUserAction: true };
};

// The mesh foreground service is now managed entirely by
// `@offline-protocol/mesh-sdk` (it starts the service in
// `OfflineProtocolModule.start()` and stops it in `stop()`). We keep this
// export as a no-op for backwards compatibility with any older callers.
export const startForegroundService = async () => {
  return { started: true, managedBy: '@offline-protocol/mesh-sdk' };
};

export const CRISISNET_SERVICE_UUID = 'c8e02000-2000-1000-8000-00805f9b34fb';
export const MESSAGE_CHARACTERISTIC_UUID = 'c8e02001-2000-1000-8000-00805f9b34fb';
