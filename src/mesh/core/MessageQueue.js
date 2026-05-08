import meshLogger from './MeshLogger';

const MAX_QUEUE_SIZE = 100;

class MessageQueue {
  constructor() {
    this.outgoing = [];
    this.incoming = [];
    this.isProcessing = false;
  }

  enqueueOutgoing(packet, recipientId = null) {
    if (this.outgoing.length >= MAX_QUEUE_SIZE) {
      this.outgoing.shift();
    }
    this.outgoing.push({ packet, recipientId, timestamp: Date.now() });
    meshLogger.debug('queue', `Enqueued outgoing message (Queue size: ${this.outgoing.length})`);
  }

  enqueueIncoming(packet, senderId) {
    if (this.incoming.length >= MAX_QUEUE_SIZE) {
      this.incoming.shift();
    }
    this.incoming.push({ packet, senderId, timestamp: Date.now() });
    meshLogger.debug('queue', `Enqueued incoming message (Queue size: ${this.incoming.length})`);
  }

  getPendingOutgoing() {
    return this.outgoing;
  }

  clearOutgoing() {
    this.outgoing = [];
  }

  clearIncoming() {
    this.incoming = [];
  }
}

const messageQueue = new MessageQueue();
export default messageQueue;
