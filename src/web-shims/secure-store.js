// Web shim for expo-secure-store.
// Keychain/Keystore don't exist in a browser — use localStorage as fallback.
// Data is NOT encrypted at rest on web; acceptable since the web version
// runs in the user's own browser session (same security level as cookies).

const PREFIX = 'bymap_ss:';

export async function getItemAsync(key) {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export async function setItemAsync(key, value) {
  try { localStorage.setItem(PREFIX + key, value); } catch {}
}

export async function deleteItemAsync(key) {
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

export async function isAvailableAsync() {
  try { localStorage.setItem('__test', '1'); localStorage.removeItem('__test'); return true; }
  catch { return false; }
}

// SecureStoreAccessible enum values (used as options — ignored on web)
export const AFTER_FIRST_UNLOCK                             = 'AFTER_FIRST_UNLOCK';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY            = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const ALWAYS                                         = 'ALWAYS';
export const ALWAYS_THIS_DEVICE_ONLY                        = 'ALWAYS_THIS_DEVICE_ONLY';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY             = 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';
export const WHEN_UNLOCKED                                  = 'WHEN_UNLOCKED';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY                 = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
