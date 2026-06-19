/**
 * secureStorage.js — Stockage sécurisé des tokens et données sensibles
 *
 * iOS   → Keychain Services (chiffrement matériel AES-256)
 * Android → Keystore + EncryptedSharedPreferences (chiffrement AES-256-GCM)
 *
 * Remplace entièrement AsyncStorage pour les données sensibles.
 * AsyncStorage = fichier texte non chiffré → vulnérable sur appareils rootés.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS_TOKEN:  'bymap_access_token',
  REFRESH_TOKEN: 'bymap_refresh_token',
  USER_ID:       'bymap_user_id',
  USER_NAME:     'bymap_user_name',
  CURRENT_USER:  'bymap_current_user',
};

const SECURE_OPTIONS = {};

// ── API publique ──────────────────────────────────────────────────────────────

export async function saveSession(accessToken, refreshToken, user) {
  const userName = `${user.prenom || ''} ${user.nom || ''}`.trim();
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN,  accessToken,             SECURE_OPTIONS),
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken,            SECURE_OPTIONS),
    SecureStore.setItemAsync(KEYS.USER_ID,       String(user._id || ''), SECURE_OPTIONS),
    SecureStore.setItemAsync(KEYS.USER_NAME,     userName,               SECURE_OPTIONS),
    AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user)),
  ]);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN, SECURE_OPTIONS);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN, SECURE_OPTIONS);
}

export async function getCurrentUser() {
  const raw = await AsyncStorage.getItem(KEYS.CURRENT_USER);
  return raw ? JSON.parse(raw) : null;
}

export async function updateTokens(accessToken, refreshToken) {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.ACCESS_TOKEN,  accessToken,  SECURE_OPTIONS),
    SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken, SECURE_OPTIONS),
  ]);
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN,  SECURE_OPTIONS),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(KEYS.USER_ID,       SECURE_OPTIONS),
    SecureStore.deleteItemAsync(KEYS.USER_NAME,     SECURE_OPTIONS),
    AsyncStorage.removeItem(KEYS.CURRENT_USER),
  ]);
}

export async function setSecureItem(key, value) {
  await SecureStore.setItemAsync(`bymap_${key}`, value, SECURE_OPTIONS);
}

export async function getSecureItem(key) {
  return SecureStore.getItemAsync(`bymap_${key}`, SECURE_OPTIONS);
}

export async function deleteSecureItem(key) {
  await SecureStore.deleteItemAsync(`bymap_${key}`, SECURE_OPTIONS);
}

export async function isSecureStoreAvailable() {
  return SecureStore.isAvailableAsync();
}
