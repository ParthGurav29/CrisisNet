import meshLogger from './MeshLogger';

class PacketSerializer {
  constructor() {
    this.PROTOCOL_VERSION = 1;
  }

  serialize(packet) {
    try {
      const data = {
        v: this.PROTOCOL_VERSION,
        ...packet,
        t: Date.now(),
      };
      return JSON.stringify(data);
    } catch (e) {
      meshLogger.error('serializer', `Serialization failed: ${e.message}`);
      return null;
    }
  }

  deserialize(payload) {
    try {
      const data = JSON.parse(payload);
      if (data.v !== this.PROTOCOL_VERSION) {
        meshLogger.warn('serializer', `Version mismatch: ${data.v} vs ${this.PROTOCOL_VERSION}`);
        // Handle backward compatibility here if needed
      }
      return data;
    } catch (e) {
      meshLogger.error('serializer', `Deserialization failed: ${e.message}`);
      return null;
    }
  }

  validate(packet) {
    return packet && packet.v && packet.type && packet.id;
  }
}

const packetSerializer = new PacketSerializer();
export default packetSerializer;
