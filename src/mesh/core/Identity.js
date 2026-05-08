import AsyncStorage from '@react-native-async-storage/async-storage';
import meshLogger from './MeshLogger';

const NODE_ID_KEY = 'crisisnet_node_id';

class Identity {
  constructor() {
    this.nodeId = null;
    this.sessionId = this._generateId(6);
    this.protocolVersion = 1;
    meshLogger.setSessionId(this.sessionId);
  }

  async init() {
    try {
      let storedId = await AsyncStorage.getItem(NODE_ID_KEY);
      if (!storedId) {
        storedId = `CRISISNET_NODE_${this._generateId(4).toUpperCase()}`;
        await AsyncStorage.setItem(NODE_ID_KEY, storedId);
        meshLogger.info('identity', `Generated new Node ID: ${storedId}`);
      } else {
        meshLogger.info('identity', `Loaded existing Node ID: ${storedId}`);
      }
      this.nodeId = storedId;
      return this.nodeId;
    } catch (e) {
      meshLogger.error('identity', 'Failed to load identity:', e.message);
      // Fallback to transient ID if storage fails
      this.nodeId = `TEMP_NODE_${this._generateId(4)}`;
      return this.nodeId;
    }
  }

  getNodeId() {
    return this.nodeId;
  }

  getSessionId() {
    return this.sessionId;
  }

  getProtocolVersion() {
    return this.protocolVersion;
  }

  _generateId(length) {
    return Math.random().toString(36).substring(2, 2 + length);
  }
}

const identity = new Identity();
export default identity;
