// src/screens/Welcome.js — Splash screen avec chargement réel depuis le backend
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Image, Animated, Easing, Dimensions, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '../security/secureStorage';
import { environment } from '../environments/environment';

const API_URL = environment.apiUrl;
const { width } = Dimensions.get('window');
const LOGO = require('../../assets/logo.png');

// Étapes de chargement : label affiché + cible progress (0→1)
const STEPS = [
  { label: 'Connexion au serveur…',    target: 0.20 },
  { label: 'Chargement des zones…',    target: 0.50 },
  { label: 'Chargement des données…',  target: 0.80 },
  { label: 'Prêt !',                   target: 1.00 },
];

export default function Welcome() {
  const navigation   = useNavigation();
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.8)).current;
  const progress     = useRef(new Animated.Value(0)).current;
  const [stepLabel, setStepLabel] = useState(STEPS[0].label);

  // Anime la barre vers une valeur cible
  const animateTo = (target, duration = 500) =>
    new Promise(resolve =>
      Animated.timing(progress, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(resolve)
    );

  useEffect(() => {
    // Logo fade-in
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    // Timeout de sécurité max 6 s
    const fallback = setTimeout(() => navigation.replace('Map'), 6000);

    const load = async () => {
      try {
        // ── Étape 1 : vérifier le token stocké ──────────────────────────────
        setStepLabel(STEPS[0].label);
        await animateTo(STEPS[0].target, 400);
        const token = await getAccessToken();

        // ── Étape 2 : charger les zones (zone-dots) ─────────────────────────
        setStepLabel(STEPS[1].label);
        const zoneFetch = fetch(`${API_URL}/publications/zone-dots`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.json()).catch(() => null);

        // ── Étape 3 : charger les données utilisateur (si connecté) ─────────
        const userFetch = token
          ? fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .then(d => d?.user || null)
              .catch(() => null)
          : Promise.resolve(null);

        const [zonesData, userData] = await Promise.all([zoneFetch, userFetch]);
        await animateTo(STEPS[1].target, 500);

        // Stocker les données en cache
        if (zonesData?.zones) {
          await AsyncStorage.setItem('cachedZoneDots', JSON.stringify(zonesData.zones));
        }
        if (userData) {
          await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
        }

        // ── Étape 3 : charger la liste de publications ──────────────────────
        setStepLabel(STEPS[2].label);
        const pubFetch = fetch(`${API_URL}/publications?limit=20`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then(r => r.json()).catch(() => null);

        await Promise.all([
          pubFetch.then(d => d?.publications
            ? AsyncStorage.setItem('cachedPubs', JSON.stringify(d.publications))
            : null),
          animateTo(STEPS[2].target, 500),
        ]);

        // ── Étape 4 : finalisation ───────────────────────────────────────────
        setStepLabel(STEPS[3].label);
        await animateTo(STEPS[3].target, 350);

        // Petit délai pour que "Prêt !" soit visible
        await new Promise(r => setTimeout(r, 300));

      } catch {
        // En cas d'erreur réseau on passe quand même
        await animateTo(1, 400);
      }

      clearTimeout(fallback);
      navigation.replace('Map');
    };

    load();
    return () => clearTimeout(fallback);
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={['#ffffff', '#ffffff', '#ffffff']} style={styles.root}>
      <StatusBar style="light" />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* Label étape */}
      <Animated.Text style={[styles.stepLabel, { opacity: logoOpacity }]}>
        {stepLabel}
      </Animated.Text>

      {/* Barre de progression */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: progressWidth }]}>
          <LinearGradient
            colors={['#34C759', '#1E90FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.4,
  },
  stepLabel: {
    position: 'absolute',
    bottom: 80,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  barTrack: {
    position: 'absolute',
    bottom: 60,
    left: 48,
    right: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
