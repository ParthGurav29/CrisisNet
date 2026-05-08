/**
 * Explicit states for the Mesh State Machine.
 */
export const MeshState = {
  IDLE: 'IDLE',
  PERMISSIONS_PENDING: 'PERMISSIONS_PENDING',
  BLE_DISABLED: 'BLE_DISABLED',
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  RECOVERING: 'RECOVERING',
  FAILED: 'FAILED',
};

export const MeshStateLabels = {
  [MeshState.IDLE]: 'Idle',
  [MeshState.PERMISSIONS_PENDING]: 'Permissions Pending',
  [MeshState.BLE_DISABLED]: 'Bluetooth Disabled',
  [MeshState.INITIALIZING]: 'Initializing',
  [MeshState.READY]: 'Ready',
  [MeshState.RECOVERING]: 'Recovering',
  [MeshState.FAILED]: 'Failed',
};
