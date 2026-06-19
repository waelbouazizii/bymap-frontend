// src/screens/WelcomeNewUser.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { R, SP, T, HIT } from '../theme/index';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const C = {
  green:     '#2DBD7E',
  greenDark: '#22A06B',
  greenGlow: 'rgba(45,189,126,0.14)',
  blue:      '#3B7EF6',
  blueGlow:  'rgba(59,126,246,0.12)',
  orange:    '#F97316',
  orangeGlow:'rgba(249,115,22,0.14)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
};

export default function WelcomeNewUser() {
  const navigation = useNavigation();
  const route      = useRoute();
  const user       = route.params?.user ?? {};

  const prenom    = user.prenom || 'Bienvenu';
  const points    = user.pointsSolde        ?? 100;
  const freePosts = user.freePostsRemaining ?? 10;

  // Animations
  const fadeIn     = useRef(new Animated.Value(0)).current;
  const slideUp    = useRef(new Animated.Value(40)).current;
  const scalePts   = useRef(new Animated.Value(0.5)).current;
  const rotateStar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scalePts, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(rotateStar, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const starRotate = rotateStar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={s.root}>
      {/* Background blobs */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={s.blobTop} />
        <View style={s.blobBottom} />
      </View>

      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />

        <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

          {/* Logo */}
          <View style={s.logoRow}>
            <LinearGradient colors={[C.green, C.greenDark]} style={s.logo}>
              <FontAwesome6 name="location-dot" size={22} color="#fff" />
            </LinearGradient>
            <Text style={s.appName}>ByMap</Text>
          </View>

          {/* Avatar initiale */}
          <LinearGradient colors={[C.green, C.greenDark]} style={s.avatar}>
            <Text style={s.avatarText}>{prenom[0]?.toUpperCase() || 'B'}</Text>
          </LinearGradient>

          {/* Texte bienvenue */}
          <Text style={s.welcome}>Bienvenue,</Text>
          <Text style={s.name}>{prenom} !</Text>
          <Text style={s.subtitle}>Ton compte ByMap est prêt.{'\n'}Explore ta ville, partage des moments.</Text>

          {/* Cartes avantages : posts gratuits + points */}
          <Animated.View style={[s.cardsRow, { transform: [{ scale: scalePts }] }]}>

            {/* Posts gratuits — vert */}
            <LinearGradient colors={['#ECFDF5', '#D1FAE5']} style={s.bonusCard}>
              <FontAwesome6 name="newspaper" size={24} color={C.green} />
              <View style={s.bonusTextBlock}>
                <Text style={[s.bonusLabel, { color: C.green }]}>Posts gratuits</Text>
                <Text style={[s.bonusValue, { color: C.text }]}>{freePosts} posts</Text>
              </View>
              <View style={[s.bonusBadge, { backgroundColor: C.greenGlow }]}>
                <Text style={[s.bonusBadgeText, { color: C.green }]}>Offerts</Text>
              </View>
            </LinearGradient>

            {/* Points — orange */}
            <LinearGradient colors={['#FFF7ED', '#FFEDD5']} style={s.bonusCard}>
              <Animated.View style={{ transform: [{ rotate: starRotate }] }}>
                <FontAwesome6 name="star" size={24} color={C.orange} solid />
              </Animated.View>
              <View style={s.bonusTextBlock}>
                <Text style={[s.bonusLabel, { color: C.orange }]}>Points de départ</Text>
                <Text style={[s.bonusValue, { color: C.text }]}>{points} pts</Text>
              </View>
              <View style={[s.bonusBadge, { backgroundColor: C.orangeGlow }]}>
                <Text style={[s.bonusBadgeText, { color: C.orange }]}>Offerts</Text>
              </View>
            </LinearGradient>

          </Animated.View>

          {/* Avantages rapides */}
          <View style={s.perksRow}>
            {[
              { icon: 'map-location-dot', label: 'Explorer la carte', color: C.blue },
              { icon: 'users',            label: 'Rejoindre la comm.',  color: C.green },
              { icon: 'newspaper',        label: 'Publier des posts',  color: C.orange },
            ].map((p) => (
              <View key={p.icon} style={s.perk}>
                <View style={[s.perkIcon, { backgroundColor: p.color + '18' }]}>
                  <FontAwesome6 name={p.icon} size={18} color={p.color} />
                </View>
                <Text style={s.perkLabel}>{p.label}</Text>
              </View>
            ))}
          </View>

          {/* Bouton commencer */}
          <TouchableOpacity
            style={s.btn}
            onPress={() => navigation.replace('Map')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[C.green, C.greenDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnGrad}
            >
              <Text style={s.btnText}>Commencer l'aventure</Text>
              <FontAwesome6 name="arrow-right" size={15} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  blobTop: {
    position: 'absolute', top: -100, right: -80,
    width: 300, height: 300, borderRadius: 999,
    backgroundColor: 'rgba(45,189,126,0.12)',
  },
  blobBottom: {
    position: 'absolute', bottom: -80, left: -80,
    width: 260, height: 260, borderRadius: 999,
    backgroundColor: 'rgba(59,126,246,0.08)',
  },

  content: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: SP.xl, paddingTop: SP.lg + SP.md, paddingBottom: SP.base,
  },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.xxl,
  },
  logo: {
    width: 44, height: 44, borderRadius: R.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  appName: { ...T.headline, color: C.text },

  avatar: {
    width: 88, height: 88, borderRadius: R.full,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SP.lg,
    shadowColor: C.green, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  avatarText: { fontSize: 40, fontWeight: '800', color: '#fff' },

  welcome: { ...T.titleMd, color: C.textDim, marginBottom: 2 },
  name:    { ...T.displaySm, color: C.text, marginBottom: SP.sm },
  subtitle: {
    ...T.bodyMd, color: C.textFaint, textAlign: 'center',
    marginBottom: SP.lg + SP.md,
  },

  cardsRow: {
    flexDirection: 'row', gap: SP.sm, width: width - SP.xl * 2, marginBottom: SP.xl,
  },
  bonusCard: {
    flex: 1, borderRadius: R.xl, overflow: 'hidden',
    flexDirection: 'column', alignItems: 'flex-start', gap: SP.xs,
    paddingHorizontal: SP.base, paddingVertical: SP.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  bonusTextBlock: { width: '100%' },
  bonusLabel:     { ...T.labelSm, marginBottom: 2 },
  bonusValue:     { ...T.displaySm },
  bonusBadge:     { paddingHorizontal: SP.sm, paddingVertical: 3, borderRadius: R.sm, marginTop: 2 },
  bonusBadgeText: { ...T.labelSm },

  perksRow: {
    flexDirection: 'row', gap: SP.sm, marginBottom: SP.xxl,
  },
  perk: { flex: 1, alignItems: 'center', gap: SP.sm },
  perkIcon: {
    width: 48, height: 48, borderRadius: R.md,
    justifyContent: 'center', alignItems: 'center',
  },
  perkLabel: { ...T.labelSm, color: C.textDim, textAlign: 'center' },

  btn: {
    width: width - SP.xl * 2, borderRadius: R.lg, overflow: 'hidden',
    shadowColor: C.green, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  btnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SP.sm, minHeight: HIT.min, paddingVertical: SP.md,
  },
  btnText: { ...T.titleMd, color: '#fff', letterSpacing: 0.3 },
});
