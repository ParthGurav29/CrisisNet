import identity from './core/Identity';

const PACKET_TYPE = {
  MESSAGE: 'msg',
  ACK: 'ack',
  NACK: 'nack',
  PING: 'ping',
  PONG: 'pong',
  HEARTBEAT: 'heartbeat',
};

const createPacketId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

const createMessagePacket = async (content, recipientId = null, priority = 'medium') => {
  const senderId = identity.getNodeId();
  const packetId = createPacketId();
  const timestamp = Date.now();

  return {
    id: packetId,
    type: PACKET_TYPE.MESSAGE,
    sender: senderId,
    recipient: recipientId,
    content,
    priority,
    timestamp,
    ttl: 8,
    hopCount: 0,
  };
};

const createAckPacket = (originalPacketId, recipientId) => {
  return {
    id: createPacketId(),
    type: PACKET_TYPE.ACK,
    originalId: originalPacketId,
    recipient: recipientId,
    timestamp: Date.now(),
  };
};

const createNackPacket = (originalPacketId, recipientId, reason) => {
  return {
    id: createPacketId(),
    type: PACKET_TYPE.NACK,
    originalId: originalPacketId,
    recipient: recipientId,
    reason,
    timestamp: Date.now(),
  };
};

const validatePacket = (packet) => {
  if (!packet || typeof packet !== 'object') return false;
  if (!packet.id || !packet.type || !packet.timestamp) return false;
  if (!Object.values(PACKET_TYPE).includes(packet.type)) return false;
  return true;
};

const isDuplicate = (packetId, seenSet, maxSize = 1000) => {
  if (seenSet.has(packetId)) return true;
  seenSet.add(packetId);
  if (seenSet.size > maxSize) {
    const first = seenSet.values().next().value;
    seenSet.delete(first);
  }
  return false;
};

export {
  PACKET_TYPE,
  createPacketId,
  createMessagePacket,
  createAckPacket,
  createNackPacket,
  validatePacket,
  isDuplicate,
};