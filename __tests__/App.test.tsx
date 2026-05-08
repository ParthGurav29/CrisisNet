/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/storage/deviceId', () => ({
  getDeviceId: jest.fn(() => Promise.resolve('test-device-id-12345')),
  getShortId: jest.fn(() => 'test123'),
}));

jest.mock('../src/mesh/meshService', () => ({
  __esModule: true,
  default: {
    init: jest.fn(() => Promise.resolve(true)),
    stop: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve({})),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../src/utils/systemCoordinator', () => ({
  initializeSystemCoordinator: jest.fn(() => Promise.resolve()),
  shutdownSystemCoordinator: jest.fn(() => Promise.resolve()),
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(null);
  });
});
