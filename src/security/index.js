// src/security/index.js — Point d'entrée unique de la couche sécurité ByMap

export {
  saveSession,
  getAccessToken,
  getRefreshToken,
  getCurrentUser,
  updateTokens,
  clearSession,
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
  isSecureStoreAvailable,
} from './secureStorage';

export {
  encrypt,
  decrypt,
  encryptedStorage,
  destroyEncryptionKey,
  sha256,
  generateSecureId,
} from './encryption';

export {
  useScreenSecurity,
  usePreventScreenCapture,
  useScreenshotDetection,
} from './useAppSecurity';

export {
  SecurityProvider,
  useSecurity,
} from './SecurityProvider';

export {
  SecureView,
  withScreenSecurity,
  SensitiveText,
} from './SecureView';
