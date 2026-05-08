import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StatusBar, PermissionsAndroid, Platform, Alert, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { initializeSystemCoordinator, shutdownSystemCoordinator } from './utils/systemCoordinator';
import HomeScreen from './screens/Home';
import ChatScreen from './screens/Chat';
import AskAIScreen from './screens/AskAI';
import TriageScreen from './screens/Triage';
import EmergencyScreen from './screens/Emergency';
import ModelDownloadScreen from './screens/ModelDownloadScreen';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import KnowledgeBaseScreen from './screens/KnowledgeBaseScreen';
import NoticeBoardScreen from './screens/NoticeBoardScreen';
import MessagesScreen from './screens/Messages';
import MeshDebugScreen from './screens/MeshDebugScreen';
import { MeshProvider } from './context/MeshContext';
import { AIProvider } from './context/AIContext';
import meshManager from './mesh/core/MeshManager';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: '🏠',
  Chat: '💬',
  Messages: '📬',
  'Ask AI': '🤖',
  Triage: '🏥',
  Emergency: '🚨',
  Knowledge: '📚',
  Notice: '📢',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 24 : 20 }}>{TAB_ICONS[route.name]}</Text>
        ),
        tabBarStyle: {
          backgroundColor: '#0d1527',
          borderTopColor: '#1e2d4a',
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarActiveTintColor: '#4d9fff',
        tabBarInactiveTintColor: '#3d4f70',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Ask AI" component={AskAIScreen} />
      <Tab.Screen name="Triage" component={TriageScreen} />
      <Tab.Screen name="Emergency" component={EmergencyScreen} options={{
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            color: '#ff3b5c',
          },
          tabBarActiveTintColor: '#ff3b5c',
        }}
      />
      <Tab.Screen name="Knowledge" component={KnowledgeBaseScreen} />
      <Tab.Screen name="Notice" component={NoticeBoardScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeSystemCoordinator();
      const granted = await requestPermissions();
      setPermissionsGranted(granted);
      
      if (granted) {
        // Initialize the new Mesh Core foundation
        meshManager.init().catch(e => console.error('MeshManager init failed:', e));
      }

      const completed = await AsyncStorage.getItem('onboarding_complete');
      setHasCompletedOnboarding(completed === 'true');
      setIsLoading(false);
    };

    init();

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background') {
        shutdownSystemCoordinator();
      } else if (nextAppState === 'active') {
        initializeSystemCoordinator();
      }
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateListener.remove();
      shutdownSystemCoordinator();
    };
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    setHasCompletedOnboarding(true);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#4d9fff', fontSize: 18 }}>Loading...</Text>
      </View>
    );
  }

  // Block access if permissions denied
  if (!permissionsGranted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#ff3b5c', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>
          Permissions Required
        </Text>
        <Text style={{ color: '#6677aa', fontSize: 14, textAlign: 'center', marginBottom: 30 }}>
          Bluetooth, Location, and Notification permissions are required for mesh networking and AI features.
        </Text>
        <Text style={{ color: '#3d4f70', fontSize: 12, textAlign: 'center' }}>
          Please enable all permissions in Settings → Apps → CrisisNet
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <MeshProvider>
        <AIProvider>
          <NavigationContainer>
            <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
            <Stack.Navigator
              key={hasCompletedOnboarding ? 'post-onboarding' : 'onboarding'}
              initialRouteName={hasCompletedOnboarding ? 'Splash' : 'Onboarding'}
              screenOptions={{ headerShown: false }}
            >
              {!hasCompletedOnboarding ? (
                <Stack.Screen name="Onboarding">
                  {(props) => (
                    <OnboardingScreen
                      {...props}
                      onComplete={completeOnboarding}
                    />
                  )}
                </Stack.Screen>
              ) : (
                <>
                  <Stack.Screen name="Splash" component={SplashScreen} />
                  <Stack.Screen name="ModelDownload" component={ModelDownloadScreen} />
                  <Stack.Screen name="Home" component={MainTabs} />
                  <Stack.Screen name="MeshDebug" component={MeshDebugScreen} />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </AIProvider>
      </MeshProvider>
    </SafeAreaProvider>
  );
}

async function requestPermissions() {
  if (Platform.OS === 'android') {
    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];

      if (Platform.Version >= 33) {
        permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      const allGranted = Object.values(granted).every(
        status => status === PermissionsAndroid.RESULTS.GRANTED
      );

      return allGranted;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
}