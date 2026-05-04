import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text, StatusBar, PermissionsAndroid, Platform} from 'react-native';

import HomeScreen from './screens/Home';
import ChatScreen from './screens/Chat';
import AskAIScreen from './screens/AskAI';
import TriageScreen from './screens/Triage';
import EmergencyScreen from './screens/Emergency';
import meshService from './mesh/meshService';
import { initModel, ask } from './ai/llamaService';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: '🏠',
  Chat: '💬',
  'Ask AI': '🤖',
  Triage: '🏥',
  Emergency: '🚨',
};

export default function App() {
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

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
  };

  useEffect(() => {
    const initApp = async () => {
      const hasPermission = await requestPermissions();

      if (hasPermission) {
        console.log('Permissions granted, starting mesh...');
        
        // Delay slightly to avoid native crash timing issues
        setTimeout(() => {
          meshService.init();
        }, 1000);

      } else {
        console.log('Permissions denied');
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    // Initialize model immediately
    initModel().then(async (success) => {
      console.log("Model init success:", success);
      if (success) {
        const res = await ask("Give quick emergency advice");
        console.log("🤖 Gemma Test Call:", res);
      }
    }).catch(e => console.error("Init error:", e));
  }, []);

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarIcon: ({focused}) => (
            <Text style={{fontSize: focused ? 24 : 20}}>
              {TAB_ICONS[route.name]}
            </Text>
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
        })}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Chat" component={ChatScreen} />
        <Tab.Screen name="Ask AI" component={AskAIScreen} />
        <Tab.Screen name="Triage" component={TriageScreen} />
        <Tab.Screen
          name="Emergency"
          component={EmergencyScreen}
          options={{
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '700',
              color: '#ff3b5c',
            },
            tabBarActiveTintColor: '#ff3b5c',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
