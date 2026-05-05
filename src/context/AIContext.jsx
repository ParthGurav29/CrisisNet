import React, { createContext, useState, useEffect, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadModel, isModelLoaded as gemmaIsModelLoaded, generateResponse, getContext, getInitError, unloadModel, AIState as GemmaAIState } from '../ai/gemma';
import { buildTriagePrompt, parseTriageResponse } from '../ai/triage';
import db from '../storage/db';
import { modelExists, checkDeviceRAM } from '../utils/modelStorage';

const AI_STATE_KEY = 'ai_state_cache';

const AIState = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FALLBACK: 'fallback',
  ERROR: 'error',
  NOT_SUPPORTED: 'not_supported',
};

export const AIContext = createContext();

const getCachedAIState = async () => {
  try {
    const state = await AsyncStorage.getItem(AI_STATE_KEY);
    return state ? JSON.parse(state) : null;
  } catch {
    return null;
  }
};

const setCachedAIState = async (state) => {
  try {
    await AsyncStorage.setItem(AI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

const clearCachedAIState = async () => {
  try {
    await AsyncStorage.removeItem(AI_STATE_KEY);
  } catch {
    // ignore
  }
};

export const AIProvider = ({ children }) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelStatus, setModelStatus] = useState('loading');
  const [modelLoadProgress, setModelLoadProgress] = useState({ stage: '', percent: 0 });
  const [aiState, setAIState] = useState(AIState.IDLE);
  const [aiError, setAIError] = useState(null);
  const [isNotSupported, setIsNotSupported] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await db.init();
        
        const cached = await getCachedAIState();
        
        const ramCheck = await checkDeviceRAM();
        if (!ramCheck.valid) {
          if (isMounted) {
            setIsNotSupported(true);
            setAIState(AIState.NOT_SUPPORTED);
            setAIError(ramCheck.error || 'Device not supported');
            setModelStatus('unsupported');
          }
          return;
        }
        
        const modelFileExists = await modelExists();
        if (modelFileExists) {
          const loaded = gemmaIsModelLoaded();
          if (isMounted) {
            setIsModelLoaded(loaded);
            setModelStatus(loaded ? 'ready' : 'download');
            setAIState(loaded ? AIState.READY : AIState.FALLBACK);
          }
        } else {
          if (isMounted) {
            setIsModelLoaded(false);
            setModelStatus('download');
            setAIState(AIState.IDLE);
          }
        }
      } catch (e) {
        if (isMounted) {
          setIsModelLoaded(false);
          setModelStatus('error');
          setAIState(AIState.ERROR);
          setAIError(e.message);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadModelCallback = useCallback(async (onProgress) => {
    const handleProgress = (progress) => {
      setModelLoadProgress(progress);
      if (onProgress) onProgress(progress);
    };
    setAIState(AIState.LOADING);
    setAIError(null);
    
    const result = await InteractionManager.runAfterInteractions(async () => {
      return await loadModel(handleProgress);
    });

    if (result.success) {
      const hasContext = getContext() !== null;
      setIsModelLoaded(hasContext);
      setModelStatus(hasContext ? 'ready' : 'fallback');
      setAIState(hasContext ? AIState.READY : AIState.FALLBACK);
      await setCachedAIState({ ready: hasContext, fallback: !hasContext, timestamp: Date.now() });
    } else {
      setIsModelLoaded(false);
      setModelStatus('error');
      setAIState(AIState.ERROR);
      setAIError(result.error || 'Failed to load model');
    }
    return result;
  }, []);

  const preloadModelInBackgroundCallback = useCallback(async () => {
    setTimeout(async () => {
      const modelFileExists = await modelExists();
      
      if (modelFileExists && !gemmaIsModelLoaded()) {
        const result = await loadModel((p) => console.log('Background preload:', p));
        if (result.success) {
          await setCachedAIState({ ready: getContext() !== null, timestamp: Date.now() });
        }
      }
    }, 1000);
  }, []);

  const generateResponseCallback = useCallback(async (prompt, maxTokens) => {
    setIsGenerating(true);
    try {
      const response = await generateResponse(prompt, maxTokens);
      if (response && response.retry) {
        setAIState(AIState.FALLBACK);
        setModelStatus('fallback');
      }
      return response;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateTriageCallback = useCallback(async (inputs) => {
    setIsGenerating(true);
    try {
      const prompt = buildTriagePrompt(inputs);
      const response = await generateResponse(prompt, 50);
      return parseTriageResponse(response);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const getStatusText = () => {
    if (aiState === AIState.READY) return 'AI Ready (Gemma 4E2B)';
    if (aiState === AIState.FALLBACK) return 'AI Ready (Offline Mode)';
    if (aiState === AIState.LOADING) return 'Loading AI model...';
    if (aiState === AIState.ERROR) return `AI Error: ${aiError || 'Unknown error'}`;
    if (aiState === AIState.NOT_SUPPORTED) return `Device not supported: ${aiError || ''}`;
    if (aiState === AIState.IDLE && modelStatus === 'download') return 'Model not downloaded';
    return 'Loading AI model...';
  };

  const getAIState = () => aiState;
  const getAIError = () => aiError;
  const isDeviceSupported = () => aiState !== AIState.NOT_SUPPORTED;

  const clearAICache = useCallback(async () => {
    await clearCachedAIState();
    unloadModel();
    setIsModelLoaded(false);
    setModelStatus('download');
    setAIState(AIState.IDLE);
  }, []);

  return (
    <AIContext.Provider value={{
      isModelLoaded,
      isGenerating,
      modelStatus,
      modelLoadProgress,
      aiState,
      aiError,
      isNotSupported,
      loadModel: loadModelCallback,
      generateResponse: generateResponseCallback,
      generateTriage: generateTriageCallback,
      getStatusText,
      getAIState,
      getAIError,
      isDeviceSupported,
      preloadModelInBackground: preloadModelInBackgroundCallback,
      clearAICache,
    }}>
      {children}
    </AIContext.Provider>
  );
};