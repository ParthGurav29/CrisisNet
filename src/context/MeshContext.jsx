import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Alert, View, Text } from 'react-native';
import meshService from '../mesh/meshService';
import { getMessages, saveMessage, cleanupMessages } from '../storage/messages';
import db from '../storage/db';
import { getShortId } from '../storage/deviceId';

// Mesh state machine types
const MeshState = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  READY: 'ready',
  FAILED: 'failed'
};

export const MeshContext = createContext();

export const MeshProvider = ({ children }) => {
  const [nodes, setNodes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [myShortId, setMyShortId] = useState('');
  const [lastMessageTime, setLastMessageTime] = useState(null);
  const [meshError, setMeshError] = useState(false);
  const [meshState, setMeshState] = useState(MeshState.IDLE);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  const listenersInitializedRef = useRef(false);
  const meshRestartingRef = useRef(false);
  // NOTE: keep all useRef calls grouped here. Adding useRef calls AFTER
  // the useCallback block changes the hook ordering between renders and
  // breaks Fast Refresh with "Rendered more hooks than during the previous
  // render".
  const initInFlightRef = useRef(false);
  const initAttemptedRef = useRef(false);

  const handlePeerDiscovered = useCallback((peer) => {
    setNodes((prev) => {
      if (prev.find(n => n.id === peer.id)) return prev;
      return [...prev, peer];
    });
  }, []);

  const handlePeerLost = useCallback((peer) => {
    setNodes((prev) => prev.filter(n => n.id !== peer.id));
  }, []);

  const handleMessageReceived = useCallback(async (event) => {
    setLastMessageTime(Date.now());
    let payload;
    try {
      payload = event.content ? JSON.parse(event.content) : {};
    } catch (e) {
      payload = { text: event.content || 'Unknown message' };
    }

    let messageType = payload.type || 'chat';
    let text = '';
    let triage = null;

    if (messageType === 'emergency') {
      text = payload.desc || payload.text || 'Emergency Alert';
      triage = payload.triage || payload.payload?.triage || 'YELLOW';
    } else {
      text = payload.text || (typeof payload === 'string' ? payload : 'Unknown message');
    }

    const rawSenderId = event.senderId || event.sender || 'Unknown';
    const senderShortId = rawSenderId.length > 6 ? rawSenderId.substring(0, 6) : rawSenderId;

    const newMessage = {
      id: event.message_id || Math.random().toString(36).substring(7),
      sender: senderShortId,
      sender_id: senderShortId,
      text: text,
      timestamp: event.timestamp || Date.now(),
      type: messageType,
      triage: triage || payload.triage
    };

    setMessages((prev) => {
      const updated = [...prev, newMessage];
      if (updated.length > 500) {
        const toKeep = updated.slice(-500);
        cleanupMessages().then(() => {
          toKeep.forEach(msg => saveMessage(msg));
        });
        return toKeep;
      }
      saveMessage(newMessage);
      return updated;
    });

    if (appStateRef.current === 'background') {
      const isEmergency = messageType === 'emergency';
      Alert.alert(
        'CrisisNet: New Message',
        `${newMessage.sender}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
        [{ text: 'OK' }],
        { playSound: true, vibrate: isEmergency ? undefined : false }
      );
    }
  }, []);

  const handleStarted = useCallback(() => {
    setIsConnected(true);
    setScanning(false);
    setAdvertising(false);
  }, []);

  const handleStopped = useCallback(() => {
    setIsConnected(false);
    setScanning(false);
    setAdvertising(false);
  }, []);

  const handleScanning = useCallback(() => {
    setScanning(true);
  }, []);

  const handleAdvertising = useCallback(() => {
    setAdvertising(true);
  }, []);

  const initMesh = useCallback(async () => {
    // Guard: only the first call from useEffect should run init.
    // Subsequent retries must go through `restartMesh` (the user-initiated
    // path) so a transient failure doesn't enter an init -> FAILED -> init
    // loop on devices/emulators without Bluetooth.
    if (initInFlightRef.current || initAttemptedRef.current) return;
    initInFlightRef.current = true;
    initAttemptedRef.current = true;

    setMeshState(MeshState.INITIALIZING);
    setMeshError(false);

    try {
      await db.init();
      const savedMessages = await getMessages();
      if (isMountedRef.current) {
        setMessages(savedMessages);
      }
      const shortId = await getShortId();
      if (isMountedRef.current) {
        setMyShortId(shortId);
      }
      await meshService.init();
      if (isMountedRef.current) {
        setMeshState(MeshState.READY);
        setMeshError(false);
      }

      meshService.flushQueue();
    } catch (e) {
      console.error('[MeshContext] Init failed:', e?.message || e);
      if (isMountedRef.current) {
        setMeshError(true);
        setMeshState(MeshState.FAILED);
      }
    } finally {
      initInFlightRef.current = false;
    }
  }, []);

  const restartMesh = useCallback(async () => {
    if (meshRestartingRef.current) return;
    meshRestartingRef.current = true;

    setMeshState(MeshState.INITIALIZING);
    setMeshError(false);

    try {
      await meshService.stop();
      await meshService.init();
      if (isMountedRef.current) {
        setMeshState(MeshState.READY);
        setMeshError(false);
      }

      meshService.flushQueue();
    } catch (e) {
      console.error('[MeshContext] Restart failed:', e?.message || e);
      if (isMountedRef.current) {
        setMeshState(MeshState.FAILED);
        setMeshError(true);
      }
    } finally {
      meshRestartingRef.current = false;
    }
  }, []);

  const setupListeners = useCallback(() => {
    if (listenersInitializedRef.current) return;
    listenersInitializedRef.current = true;

    meshService.on('peer_discovered', handlePeerDiscovered);
    meshService.on('peer_lost', handlePeerLost);
    meshService.on('message_received', handleMessageReceived);
    meshService.on('started', handleStarted);
    meshService.on('stopped', handleStopped);
    meshService.on('scanning', handleScanning);
    meshService.on('advertising', handleAdvertising);
  }, [handlePeerDiscovered, handlePeerLost, handleMessageReceived, handleStarted, handleStopped, handleScanning, handleAdvertising]);

  const cleanupListeners = useCallback(() => {
    meshService.off('peer_discovered', handlePeerDiscovered);
    meshService.off('peer_lost', handlePeerLost);
    meshService.off('message_received', handleMessageReceived);
    meshService.off('started', handleStarted);
    meshService.off('stopped', handleStopped);
    meshService.off('scanning', handleScanning);
    meshService.off('advertising', handleAdvertising);
  }, [handlePeerDiscovered, handlePeerLost, handleMessageReceived, handleStarted, handleStopped, handleScanning, handleAdvertising]);

  useEffect(() => {
    isMountedRef.current = true;
    initMesh();

    const handleAppStateChange = async (nextAppState) => {
      appStateRef.current = nextAppState;
      if (nextAppState === 'background') {
        try {
          await meshService.stop();
        } catch (e) {
          // ignore
        }
      } else if (nextAppState === 'active') {
        restartMesh();
      }
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      appStateListener.remove();
      cleanupListeners();
    };
  }, [initMesh, cleanupListeners, restartMesh]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setupListeners();
    }, 100);

    return () => clearTimeout(timer);
  }, [setupListeners]);

  const getStatusText = () => {
    if (meshState === MeshState.READY && isConnected) return 'Mesh Ready - Connected';
    if (meshState === MeshState.INITIALIZING) return 'Connecting to mesh...';
    if (meshState === MeshState.FAILED) return 'Mesh connection failed';
    if (meshError) return 'Mesh unavailable - check permissions';
    if (!isConnected && scanning) return 'Scanning for peers...';
    if (!isConnected && advertising) return 'Advertising...';
    return 'Disconnected';
  };

  const getMeshStatus = () => ({
    state: meshState,
    isConnected,
    scanning,
    advertising,
    error: meshError,
    nodesCount: nodes.length,
    getStatusText
  });

  const sendMessage = useCallback(async (text) => {
    try {
      const payload = {
        text,
        type: 'chat',
        timestamp: Date.now(),
        sender_id: myShortId
      };
      await meshService.sendMessage(payload);
      const myMessage = {
        id: Math.random().toString(36).substring(7),
        sender: myShortId,
        sender_id: myShortId,
        text: text,
        timestamp: Date.now(),
        type: 'chat'
      };
      setMessages((prev) => {
        const updated = [...prev, myMessage];
        if (updated.length > 500) {
          const toKeep = updated.slice(-500);
          cleanupMessages().then(() => {
            toKeep.forEach(msg => saveMessage(msg));
          });
          return toKeep;
        }
        return updated;
      });
      await saveMessage(myMessage);
    } catch (error) {
      // ignore
    }
  }, [myShortId]);

  const sendEmergency = useCallback(async (data) => {
    try {
      const shortId = myShortId;
      const emergencyPacket = {
        type: 'emergency',
        sender_id: shortId,
        timestamp: Date.now(),
        desc: data.desc || 'Emergency Alert',
        triage: data.color || 'YELLOW'
      };

      await meshService.sendMessage(emergencyPacket);

      const myMessage = {
        id: Math.random().toString(36).substring(7),
        sender: shortId,
        sender_id: shortId,
        text: data.desc || 'Emergency Alert',
        timestamp: Date.now(),
        type: 'emergency',
        triage: data.color || 'YELLOW'
      };
      setMessages((prev) => {
        const updated = [...prev, myMessage];
        if (updated.length > 500) {
          const toKeep = updated.slice(-500);
          cleanupMessages().then(() => {
            toKeep.forEach(msg => saveMessage(msg));
          });
          return toKeep;
        }
        return updated;
      });
      await saveMessage(myMessage);
    } catch (error) {
      // ignore
    }
  }, [myShortId]);

  return (
    <>
      {meshError && (
        <View style={{ backgroundColor: '#ff3b5c', padding: 10, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
            Mesh unavailable — check Bluetooth permissions
          </Text>
        </View>
      )}
      <MeshContext.Provider value={{
        nodes,
        messages,
        isConnected,
        scanning,
        advertising,
        myShortId,
        lastMessageTime,
        meshState,
        meshError,
        sendMessage,
        sendEmergency,
        retryMesh: restartMesh,
        getStatus: getMeshStatus,
        clearMessages: async () => {
          const { clearMessages } = await import('../storage/messages');
          await clearMessages();
        }
      }}>
        {children}
      </MeshContext.Provider>
    </>
  );
};