/**
 * SecureView.js — Composant wrapper pour les écrans sensibles
 *
 * Combine toutes les protections en un seul composant :
 *  ✓ Prévention screenshots (expo-screen-capture)
 *  ✓ Alerte si screenshot détecté
 *  ✓ Masquage en arrière-plan (via SecurityProvider)
 *
 * Usage :
 *   export default function ProfileScreen() {
 *     return (
 *       <SecureView>
 *         <Text>Données sensibles ici</Text>
 *       </SecureView>
 *     );
 *   }
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useScreenSecurity } from './useAppSecurity';

export function SecureView({
  children,
  style,
  preventCapture       = true,
  alertOnScreenshot    = true,
  onScreenshotDetected,
  screenKey            = 'secure_view',
}) {
  useScreenSecurity({
    preventCapture,
    alertOnRecording:    alertOnScreenshot,
    onRecordingDetected: onScreenshotDetected,
    key:                 screenKey,
  });

  return <View style={[{ flex: 1 }, style]}>{children}</View>;
}

/**
 * HOC pour sécuriser un écran existant sans le modifier.
 *
 * Usage :
 *   export default withScreenSecurity(ProfileScreen, { screenKey: 'profile' });
 */
export function withScreenSecurity(WrappedComponent, options = {}) {
  return function SecuredScreen(props) {
    return (
      <SecureView {...options}>
        <WrappedComponent {...props} />
      </SecureView>
    );
  };
}

/**
 * Masque sélectivement une valeur sensible.
 * Affiche '••••••' à la place du contenu en mode masqué.
 *
 * Usage :
 *   <SensitiveText value={user.phone} />
 *   <SensitiveText value={user.email} revealed={isOwner} />
 */
export function SensitiveText({
  value,
  revealed   = false,
  maskChar   = '•',
  maskLength = 8,
  style,
}) {
  const display = revealed ? value : maskChar.repeat(maskLength);
  return <Text style={style}>{display}</Text>;
}
