/**
 * encryption.js — Chiffrement des données locales sensibles
 *
 * Stratégie :
 *  1. Clé AES-256 générée aléatoirement via expo-crypto
 *  2. Clé stockée dans SecureStore (Keychain/Keystore)
 *  3. Données chiffrées stockées dans AsyncStorage
 *
 * Algorithme : AES-256-CBC (via SubtleCrypto — disponible Hermes + JSC)
 */

import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ENC_KEY_STORE = 'bymap_enc_key_v1';
const IV_LENGTH     = 16; // 128 bits

// ── Gestion de la clé de chiffrement ─────────────────────────────────────────

async function getOrCreateEncryptionKey() {
  let key = await SecureStore.getItemAsync(ENC_KEY_STORE);
  if (!key) {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    key = Buffer.from(randomBytes).toString('base64');
    await SecureStore.setItemAsync(ENC_KEY_STORE, key);
  }
  return key;
}

export async function destroyEncryptionKey() {
  await SecureStore.deleteItemAsync(ENC_KEY_STORE);
}

// ── Utilitaires de conversion ─────────────────────────────────────────────────

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Chiffrement / Déchiffrement ───────────────────────────────────────────────

/**
 * Chiffre une chaîne avec AES-256-CBC.
 * Retourne : base64(iv) + '.' + base64(ciphertext)
 */
export async function encrypt(plaintext) {
  const keyBase64 = await getOrCreateEncryptionKey();
  const keyBytes  = base64ToUint8Array(keyBase64);

  const iv      = await Crypto.getRandomBytesAsync(IV_LENGTH);
  const ivBytes = new Uint8Array(iv);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  );

  const encoder   = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: ivBytes },
    cryptoKey,
    encoder.encode(plaintext)
  );

  const ivB64     = uint8ArrayToBase64(ivBytes);
  const cipherB64 = uint8ArrayToBase64(new Uint8Array(cipherBuf));
  return `${ivB64}.${cipherB64}`;
}

/**
 * Déchiffre une chaîne chiffrée par encrypt().
 */
export async function decrypt(ciphertext) {
  const [ivB64, cipherB64] = ciphertext.split('.');
  if (!ivB64 || !cipherB64) throw new Error('Format de données chiffrées invalide');

  const keyBase64   = await getOrCreateEncryptionKey();
  const keyBytes    = base64ToUint8Array(keyBase64);
  const ivBytes     = base64ToUint8Array(ivB64);
  const cipherBytes = base64ToUint8Array(cipherB64);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
  );

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: ivBytes },
    cryptoKey,
    cipherBytes
  );

  return new TextDecoder().decode(plainBuf);
}

// ── AsyncStorage chiffré ──────────────────────────────────────────────────────

export const encryptedStorage = {
  async setItem(key, value) {
    const encrypted = await encrypt(value);
    await AsyncStorage.setItem(`enc_${key}`, encrypted);
  },

  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(`enc_${key}`);
    if (!encrypted) return null;
    try {
      return await decrypt(encrypted);
    } catch {
      await AsyncStorage.removeItem(`enc_${key}`);
      return null;
    }
  },

  async removeItem(key) {
    await AsyncStorage.removeItem(`enc_${key}`);
  },

  async clear() {
    const allKeys = await AsyncStorage.getAllKeys();
    const encKeys = allKeys.filter(k => k.startsWith('enc_'));
    await AsyncStorage.multiRemove(encKeys);
  },
};

// ── Hash utilitaire ───────────────────────────────────────────────────────────

export async function sha256(input) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

export function generateSecureId() {
  return Crypto.randomUUID();
}
