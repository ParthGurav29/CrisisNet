/* eslint-env jest */
jest.mock('../src/storage/deviceId', () => ({
  getDeviceId: jest.fn(() => Promise.resolve('test-device-id-12345')),
}));

import {
  PACKET_TYPE,
  createPacketId,
  createMessagePacket,
  createAckPacket,
  createNackPacket,
  validatePacket,
  isDuplicate,
} from '../src/mesh/packetFormat';

describe('packetFormat', () => {
  describe('PACKET_TYPE', () => {
    test('defines expected packet types', () => {
      expect(PACKET_TYPE.MESSAGE).toBe('msg');
      expect(PACKET_TYPE.ACK).toBe('ack');
      expect(PACKET_TYPE.NACK).toBe('nack');
      expect(PACKET_TYPE.PING).toBe('ping');
      expect(PACKET_TYPE.PONG).toBe('pong');
    });
  });

  describe('createPacketId', () => {
    test('generates unique IDs', () => {
      const id1 = createPacketId();
      const id2 = createPacketId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('createMessagePacket', () => {
    test('creates a valid message packet', async () => {
      const content = 'hello from device A';
      const packet = await createMessagePacket(content, 'recipient123', 'high');

      expect(packet.type).toBe(PACKET_TYPE.MESSAGE);
      expect(packet.sender).toBeDefined();
      expect(packet.recipient).toBe('recipient123');
      expect(packet.content).toBe(content);
      expect(packet.priority).toBe('high');
      expect(packet.timestamp).toBeGreaterThan(0);
      expect(packet.ttl).toBe(8);
      expect(packet.hopCount).toBe(0);
    });

    test('generates packet ID', async () => {
      const packet = await createMessagePacket('test');
      expect(packet.id).toBeDefined();
      expect(typeof packet.id).toBe('string');
    });
  });

  describe('createAckPacket', () => {
    test('creates a valid ack packet', () => {
      const originalId = 'original123';
      const recipient = 'recipient456';
      const packet = createAckPacket(originalId, recipient);

      expect(packet.type).toBe(PACKET_TYPE.ACK);
      expect(packet.originalId).toBe(originalId);
      expect(packet.recipient).toBe(recipient);
      expect(packet.timestamp).toBeGreaterThan(0);
    });
  });

  describe('createNackPacket', () => {
    test('creates a valid nack packet', () => {
      const originalId = 'original123';
      const recipient = 'recipient456';
      const reason = 'timeout';
      const packet = createNackPacket(originalId, recipient, reason);

      expect(packet.type).toBe(PACKET_TYPE.NACK);
      expect(packet.originalId).toBe(originalId);
      expect(packet.recipient).toBe(recipient);
      expect(packet.reason).toBe(reason);
    });
  });

  describe('validatePacket', () => {
    test('returns true for valid packet', () => {
      const packet = {
        id: '123',
        type: PACKET_TYPE.MESSAGE,
        timestamp: Date.now(),
      };
      expect(validatePacket(packet)).toBe(true);
    });

    test('returns false for invalid packet - missing id', () => {
      const packet = {
        type: PACKET_TYPE.MESSAGE,
        timestamp: Date.now(),
      };
      expect(validatePacket(packet)).toBe(false);
    });

    test('returns false for invalid packet - missing type', () => {
      const packet = {
        id: '123',
        timestamp: Date.now(),
      };
      expect(validatePacket(packet)).toBe(false);
    });

    test('returns false for invalid packet - missing timestamp', () => {
      const packet = {
        id: '123',
        type: PACKET_TYPE.MESSAGE,
      };
      expect(validatePacket(packet)).toBe(false);
    });

    test('returns false for invalid packet - invalid type', () => {
      const packet = {
        id: '123',
        type: 'invalid',
        timestamp: Date.now(),
      };
      expect(validatePacket(packet)).toBe(false);
    });

    test('returns false for null', () => {
      expect(validatePacket(null)).toBe(false);
    });

    test('returns false for non-object', () => {
      expect(validatePacket('string')).toBe(false);
      expect(validatePacket(123)).toBe(false);
    });
  });

  describe('isDuplicate', () => {
    test('returns false for first occurrence', () => {
      const seen = new Set();
      expect(isDuplicate('id1', seen)).toBe(false);
      expect(seen.has('id1')).toBe(true);
    });

    test('returns true for duplicate', () => {
      const seen = new Set(['id1']);
      expect(isDuplicate('id1', seen)).toBe(true);
    });

    test('evicts old entries when maxSize exceeded', () => {
      const seen = new Set();
      for (let i = 0; i < 1001; i++) {
        isDuplicate(`id${i}`, seen, 1000);
      }
      expect(seen.size).toBeLessThanOrEqual(1000);
    });
  });
});