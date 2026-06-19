/**
 * useAppSecurity.js — Hook de sécurité pour les écrans sensibles
 *
 * Fonctionnalités :
 *  1. Prévention des screenshots (Android FLAG_SECURE + iOS)
 *  2. Détection des screen recordings → alerte automatique
 *  3. Protection au passage en arrière-plan (via SecurityProvider)
 *
 * Usage sur un écran sensible :
 *   function ProfileScreen() {
 *     useScreenSecurity({ preventCapture: true, alertOnRecording: true });
 *     ...
 *   }
 */

import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

export function useScreenSecurity({
  preventCapture    = true,
  alertOnRecording  = true,
  onRecordingDetected,
  key = 'default',
} = {}) {

  useEffect(() => {
    if (!preventCapture) return;
    ScreenCapture.preventScreenCaptureAsync(key);
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key);
    };
  }, [preventCapture, key]);

  useEffect(() => {
    if (!alertOnRecording && !onRecordingDetected) return;

    const subscription = ScreenCapture.addScreenshotListener(() => {
      if (onRecordingDetected) {
        onRecordingDetected();
        return;
      }
      Alert.alert(
        'Capture détectée',
        "La capture d'écran de cet écran est interdite pour protéger vos données personnelles.",
        [{ text: 'Compris', style: 'default' }]
      );
    });

    return () => subscription.remove();
  }, [alertOnRecording, onRecordingDetected]);
}

export function usePreventScreenCapture(key = 'secure') {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync(key);
    return () => { ScreenCapture.allowScreenCaptureAsync(key); };
  }, [key]);
}

export function useScreenshotDetection(onScreenshot) {
  useEffect(() => {
    const sub = ScreenCapture.addScreenshotListener(onScreenshot);
    return () => sub.remove();
  }, [onScreenshot]);

  const stop = useCallback(() => {}, []);
  return { stop };
}
