// src/utils/notifications.js
// Remote push notifications require a development build (not Expo Go).
// This module registers gracefully — if running in Expo Go it returns null
// without crashing, so the rest of the app is unaffected.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Returns true when running inside Expo Go (SDK 53+ blocks remote push there)
function isExpoGo() {
  return Constants.executionEnvironment === 'storeClient';
}

export async function registerForPushNotifications() {
  // Physical device required; Expo Go can't receive remote push since SDK 53
  if (!Device.isDevice || isExpoGo()) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ByMap',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2DBD7E',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'f4bfa777-8c91-437f-b037-c8db0ef5eb8d',
    });
    return tokenData.data;
  } catch {
    // Silently fail in unsupported environments
    return null;
  }
}

export async function savePushTokenToServer(token) {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken || !token) return;
    await fetch(`${API_URL}/users/push-token`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch {}
}
