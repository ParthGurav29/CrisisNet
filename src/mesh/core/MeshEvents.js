import { EventEmitter } from 'events';

/**
 * Local event bus for mesh-wide notifications.
 */
class MeshEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // Events:
  // - state_changed: { oldState, newState }
  // - peer_discovered: { peerId, rssi, capabilities, lastSeen }
  // - peer_lost: { peerId }
  // - peer_updated: { peerId, rssi, capabilities }
  // - message_received: { senderId, content, timestamp }
  // - diagnostic: { level, module, message }
}

const meshEvents = new MeshEvents();
export default meshEvents;
