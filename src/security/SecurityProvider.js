/**
 * SecurityProvider.js — Protection globale lors du passage en arrière-plan
 *
 * Protège contre :
 *  - Affichage du contenu dans le sélecteur de tâches (Recent Apps Android)
 *  - Capture de l'état de l'app lors d'un switch d'application (iOS)
 *
 * Mécanisme :
 *  - Écoute AppState pour détecter background / inactive
 *  - Affiche un écran opaque avec le logo ByMap à la place du contenu
 *  - L'overlay est retiré instantanément quand l'app revient au premier plan
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

// ── Context ───────────────────────────────────────────────────────────────────

const SecurityContext = createContext({
  isBackground: false,
  lockScreen:   () => {},
  unlockScreen: () => {},
});

export const useSecurity = () => useContext(SecurityContext);

// ── Overlay de protection ─────────────────────────────────────────────────────

function PrivacyOverlay({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue:         visible ? 1 : 0,
      duration:        visible ? 80 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>BY</Text>
          <Text style={styles.logoAccent}>MAP</Text>
        </View>
        <Text style={styles.tagline}>Contenu protégé</Text>
      </View>
    </Animated.View>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SecurityProvider({ children, disabled = false }) {
  const [isBackground, setIsBackground] = useState(false);
  const [manualLock,   setManualLock]   = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (disabled) return;

    const handleAppStateChange = (nextState) => {
      const wasActive = appStateRef.current === 'active';
      const goingBack = nextState === 'background' || nextState === 'inactive';

      appStateRef.current = nextState;

      if (wasActive && goingBack) {
        setIsBackground(true);
      } else if (nextState === 'active') {
        setIsBackground(false);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [disabled]);

  const lockScreen   = useCallback(() => setManualLock(true),  []);
  const unlockScreen = useCallback(() => setManualLock(false), []);

  const showOverlay = !disabled && (isBackground || manualLock);

  return (
    <SecurityContext.Provider value={{ isBackground, lockScreen, unlockScreen }}>
      <View style={styles.container}>
        {children}
        <PrivacyOverlay visible={showOverlay} />
      </View>
    </SecurityContext.Provider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    backgroundColor: '#140729',
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  logoAccent: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1a73e8',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
