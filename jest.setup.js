jest.mock('react-native-dotenv', () => ({}), { virtual: true });
jest.mock('@env', () => ({ HF_TOKEN: 'test_token' }), { virtual: true });