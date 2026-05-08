jest.mock('react-native-dotenv', () => ({}), { virtual: true });
jest.mock('@env', () => ({ HF_TOKEN: 'test_token' }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('test-device-id-12345')),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));