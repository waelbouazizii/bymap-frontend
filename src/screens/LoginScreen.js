// src/screens/LoginScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  login as apiLogin,
  register as apiRegister,
  socialLogin as apiSocialLogin,
} from '../utils/api';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  FACEBOOK_APP_ID,
} from '../config/oauth';
import { useCall } from '../context/CallContext';
import { API_URL } from '../environments/environment';
import { R, SP, T, HIT } from '../theme/index';

WebBrowser.maybeCompleteAuthSession();

// ── Palette — même thème que LocalScreen ─────────────────────────────────────
const C = {
  green:     '#2DBD7E',
  greenDark: '#22A06B',
  greenGlow: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6',
  blueGlow:  'rgba(59,126,246,0.12)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  inputBg:   '#F8FAFB',
  card:      '#FFFFFF',
  red:       '#EF4444',
  facebook:  '#1877F2',
  google:    '#EA4335',
};

// ── Champ de saisie ───────────────────────────────────────────────────────────
const InputField = ({
  iconName, placeholder, value, onChangeText,
  keyboardType = 'default', secureTextEntry = false,
  prefix, error, maxLength, autoFocus, autoCapitalize = 'none',
}) => {
  const [focused, setFocused] = useState(false);
  const [hidden,  setHidden]  = useState(secureTextEntry);

  return (
    <View style={s.inputGroup}>
      <View style={[
        s.inputWrap,
        focused && s.inputWrapFocused,
        error   && s.inputWrapError,
      ]}>
        {iconName && (
          <View style={s.inputIconLeft}>
            <FontAwesome6
              name={iconName} size={14}
              color={error ? C.red : (focused ? C.green : C.textFaint)}
            />
          </View>
        )}
        {prefix && <Text style={s.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={s.inputText}
          placeholder={placeholder}
          placeholderTextColor={C.textFaint}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={maxLength}
          autoFocus={autoFocus}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden(!hidden)} style={s.inputIconRight} hitSlop={8}>
            <FontAwesome6 name={hidden ? 'eye' : 'eye-slash'} size={14} color={C.textFaint} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={s.errText}>{error}</Text> : null}
    </View>
  );
};

// ── Saisie OTP 6 chiffres ─────────────────────────────────────────────────────
const CodeInput = ({ value, onChange }) => {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, v) => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    onChange(next.join(''));
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleBackspace = (i, v) => {
    if (!v && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      onChange(next.join(''));
      inputs.current[i - 1]?.focus();
    }
  };

  return (
    <View style={s.codeRow}>
      {Array.from({ length: 6 }).map((_, i) => (
        <TextInput
          key={i}
          ref={r => { inputs.current[i] = r; }}
          style={[s.codeBox, digits[i] && s.codeBoxFilled]}
          value={digits[i] || ''}
          onChangeText={v => handleKey(i, v)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace') handleBackspace(i, digits[i]);
          }}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
          autoFocus={i === 0}
        />
      ))}
    </View>
  );
};

// ── Composant principal ───────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { connect } = useCall();

  const initMode = route.params?.tab === 'login' ? 'login' : 'register';

  const [screen,   setScreen]   = useState(initMode); // 'register' | 'login'
  const [regStep,  setRegStep]  = useState(1);         // 1 = contact, 2 = nom, 3 = mot de passe
  const [regType,  setRegType]  = useState('phone');   // 'phone' | 'email'
  const [loginTab, setLoginTab] = useState('phone');   // 'phone' | 'email'

  // Champs
  const [prenom,     setPrenom]     = useState('');
  const [nom,        setNom]        = useState('');
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [saveLogin,    setSaveLogin]    = useState(true);
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);

  // OTP e-mail (inscription)
  const [otpSent,      setOtpSent]      = useState(false);
  const [otpCode,      setOtpCode]      = useState('');
  const [otpLoading,   setOtpLoading]   = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Animation d'entrée
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [screen]);

  // Compte à rebours renvoi OTP
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const goTo = (s) => {
    setScreen(s);
    setErrors({});
    setRegStep(1);
    setOtpSent(false);
    setOtpCode('');
    setOtpCountdown(0);
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    const val = regType === 'phone' ? phone : email;
    if (!val) {
      e.contact = regType === 'phone' ? 'Numéro requis' : 'E-mail requis';
    } else if (regType === 'email' && !/^\S+@\S+\.\S+$/.test(val)) {
      e.contact = 'Format e-mail invalide';
    } else if (regType === 'phone' && !/^\d{8}$/.test(val)) {
      e.contact = 'Numéro invalide (8 chiffres)';
    }
    return e;
  };

  const validateStep2 = () => {
    const e = {};
    if (!prenom.trim()) e.prenom = 'Prénom requis';
    return e;
  };

  const validateStep3 = () => {
    const e = {};
    if (!password) e.password = 'Mot de passe requis';
    else if (password.length < 6) e.password = 'Minimum 6 caractères';
    if (!confirm) e.confirm = 'Confirmation requise';
    else if (password !== confirm) e.confirm = 'Les mots de passe ne correspondent pas';
    return e;
  };

  const validateLogin = () => {
    const e = {};
    const val = loginTab === 'phone' ? phone : email;
    if (!val) {
      e.contact = loginTab === 'phone' ? 'Numéro requis' : 'E-mail requis';
    } else if (loginTab === 'email' && !/^\S+@\S+\.\S+$/.test(val)) {
      e.contact = 'Format e-mail invalide';
    } else if (loginTab === 'phone' && !/^\d{8}$/.test(val)) {
      e.contact = 'Numéro invalide (8 chiffres)';
    }
    if (!password) e.password = 'Mot de passe requis';
    return e;
  };

  // ── Handlers OTP ───────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const e = validateStep1();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setOtpLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/send-register-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ contact: data.message }); return; }
      setOtpSent(true);
      setOtpCode('');
      setOtpCountdown(60);
    } catch {
      setErrors({ contact: 'Erreur réseau, réessayez' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) { setErrors({ otp: 'Entrez les 6 chiffres' }); return; }
    setErrors({});
    setOtpLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/verify-register-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ otp: data.message }); return; }
      setOtpSent(false);
      setOtpCode('');
      setRegStep(2);
    } catch {
      setErrors({ otp: 'Erreur réseau, réessayez' });
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRegContinue = () => {
    if (regStep === 1) {
      if (regType === 'email') {
        // Email → OTP obligatoire
        if (!otpSent) {
          handleSendOtp();
        } else {
          handleVerifyOtp();
        }
        return;
      }
      // Téléphone → pas d'OTP, continuer directement
      const e = validateStep1();
      if (Object.keys(e).length) { setErrors(e); return; }
      setErrors({});
      setRegStep(2);
    } else if (regStep === 2) {
      const e = validateStep2();
      if (Object.keys(e).length) { setErrors(e); return; }
      setErrors({});
      setRegStep(3);
    } else {
      handleSignUp();
    }
  };

  const handleSignUp = async () => {
    const e = validateStep3();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = await apiRegister({
        prenom,
        nom: nom.trim() || undefined,
        email: regType === 'email' ? email : undefined,
        phone: regType === 'phone' ? phone : undefined,
        password,
      });
      await connect();
      if (data.user?.role === 'admin') {
        navigation.replace('AdminDashboard');
      } else {
        navigation.replace('WelcomeNew', { user: data.user });
      }
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const e = validateLogin();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      const data = await apiLogin({
        email: loginTab === 'email' ? email : undefined,
        phone: loginTab === 'phone' ? phone : undefined,
        password,
      });
      await connect();
      navigation.replace(data.user?.role === 'admin' ? 'AdminDashboard' : 'Map');
    } catch (err) {
      setErrors({ global: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── Social ─────────────────────────────────────────────────────────────────
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId:     GOOGLE_WEB_CLIENT_ID,
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });
  const [, fbResponse, fbPromptAsync] = Facebook.useAuthRequest({ clientId: FACEBOOK_APP_ID });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const token = googleResponse.authentication?.id_token || googleResponse.authentication?.access_token;
      setLoading(true);
      apiSocialLogin({ provider: 'google', token })
        .then(async () => { await connect(); navigation.replace('Map'); })
        .catch(err => Alert.alert('Erreur Google', err.message))
        .finally(() => setLoading(false));
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const token = fbResponse.authentication?.access_token;
      setLoading(true);
      apiSocialLogin({ provider: 'facebook', token })
        .then(async () => { await connect(); navigation.replace('Map'); })
        .catch(err => Alert.alert('Erreur Facebook', err.message))
        .finally(() => setLoading(false));
    }
  }, [fbResponse]);

  const handleGoogle   = () => googlePromptAsync();
  const handleFacebook = () => fbPromptAsync();
  const handleApple    = async () => {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      setLoading(true);
      const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
      await apiSocialLogin({ provider: 'apple', token: cred.identityToken, name, email: cred.email });
      await connect();
      navigation.replace('Map');
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Erreur Apple', 'Connexion Apple échouée.');
    } finally {
      setLoading(false);
    }
  };

  const canStep1  = otpSent ? otpCode.length === 6 : (regType === 'phone' ? phone : email).length > 0;
  const canStep2  = prenom.trim().length > 0;
  const canStep3  = password.length > 0 && confirm.length > 0;
  const canLogin  = (loginTab === 'phone' ? phone : email).length > 0 && password.length > 0;

  // ════════════════════════════════════════════════════════════════════════════
  // REGISTER SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'register') {
    return (
      <View style={s.container}>
        {/* Blobs décoratifs — même style que LocalScreen */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={s.blobTopRight} />
          <View style={s.blobBottomLeft} />
        </View>

        <SafeAreaView style={s.safe}>
          <StatusBar style="dark" />

          {/* ── Header ── */}
          <View style={s.header}>
            <LinearGradient colors={[C.green, C.greenDark]} style={s.headerLogo}>
              <FontAwesome6 name="location-dot" size={17} color="#FFFFFF" />
            </LinearGradient>
            <Text style={s.headerAppName}>ByMap</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerCloseBtn} hitSlop={8}>
              <FontAwesome6 name="xmark" size={17} color={C.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                {/* Titre */}
                <Text style={s.pageTitle}>Inscription</Text>
                <Text style={s.pageSubtitle}>Rejoins la communauté locale ByMap</Text>

                {/* Indicateur de progression — 3 étapes */}
                <View style={s.progressRow}>
                  <View style={[s.progressDot, s.progressDotActive]} />
                  <View style={[s.progressLine, regStep >= 2 && s.progressLineActive]} />
                  <View style={[s.progressDot, regStep >= 2 && s.progressDotActive]} />
                  <View style={[s.progressLine, regStep >= 3 && s.progressLineActive]} />
                  <View style={[s.progressDot, regStep >= 3 && s.progressDotActive]} />
                </View>

                {errors.global ? (
                  <View style={s.errGlobalBox}>
                    <FontAwesome6 name="circle-exclamation" size={14} color={C.red} />
                    <Text style={s.errGlobal}>{errors.global}</Text>
                  </View>
                ) : null}

                {/* ── Carte principale ── */}
                <View style={s.card}>

                  {/* ── ÉTAPE 1a : saisie contact ── */}
                  {regStep === 1 && !otpSent && (
                    <>
                      <View style={s.cardTitleRow}>
                        <View style={[s.cardTitleBadge, { backgroundColor: C.greenGlow }]}>
                          <Text style={[s.cardTitleBadgeText, { color: C.green }]}>1 / 3</Text>
                        </View>
                        <Text style={s.cardTitle}>Votre contact</Text>
                      </View>

                      {/* Toggle téléphone / e-mail */}
                      <View style={s.toggleRow}>
                        <TouchableOpacity
                          style={[s.toggleBtn, regType === 'phone' && s.toggleBtnActive]}
                          onPress={() => { setRegType('phone'); setEmail(''); setErrors({}); }}
                        >
                          <FontAwesome6 name="phone" size={12} color={regType === 'phone' ? C.green : C.textFaint} />
                          <Text style={[s.toggleBtnText, regType === 'phone' && s.toggleBtnTextActive]}>Téléphone</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.toggleBtn, regType === 'email' && s.toggleBtnActive]}
                          onPress={() => { setRegType('email'); setPhone(''); setErrors({}); }}
                        >
                          <FontAwesome6 name="envelope" size={12} color={regType === 'email' ? C.green : C.textFaint} />
                          <Text style={[s.toggleBtnText, regType === 'email' && s.toggleBtnTextActive]}>E-mail</Text>
                        </TouchableOpacity>
                      </View>

                      {regType === 'phone' ? (
                        <InputField
                          iconName="phone"
                          placeholder="Numéro de téléphone"
                          value={phone}
                          onChangeText={(v) => { setPhone(v); setErrors(p => ({ ...p, contact: '' })); }}
                          keyboardType="phone-pad"
                          prefix="+216  "
                          error={errors.contact}
                          maxLength={8}
                          autoFocus
                        />
                      ) : (
                        <InputField
                          iconName="envelope"
                          placeholder="Adresse e-mail"
                          value={email}
                          onChangeText={(v) => { setEmail(v); setErrors(p => ({ ...p, contact: '' })); }}
                          keyboardType="email-address"
                          error={errors.contact}
                          autoFocus
                        />
                      )}

                      <TouchableOpacity
                        style={[s.primaryBtn, (!canStep1 || otpLoading) && s.primaryBtnOff]}
                        onPress={handleRegContinue}
                        disabled={!canStep1 || otpLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={canStep1 ? [C.green, C.greenDark] : ['#B0D8C8', '#9DC9B6']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={s.primaryBtnGrad}
                        >
                          {otpLoading
                            ? <ActivityIndicator color="#fff" />
                            : <>
                                <Text style={s.primaryBtnText}>
                                  {regType === 'email' ? 'Envoyer le code' : 'Continuer'}
                                </Text>
                                <FontAwesome6 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
                              </>
                          }
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── ÉTAPE 1b : vérification OTP e-mail ── */}
                  {regStep === 1 && otpSent && (
                    <>
                      <View style={s.cardTitleRow}>
                        <View style={[s.cardTitleBadge, { backgroundColor: C.greenGlow }]}>
                          <Text style={[s.cardTitleBadgeText, { color: C.green }]}>1 / 3</Text>
                        </View>
                        <Text style={s.cardTitle}>Vérification e-mail</Text>
                      </View>

                      {/* Récap e-mail + bouton modifier */}
                      <View style={s.identitySummary}>
                        <View style={[s.identityAvatar, { backgroundColor: C.greenGlow, justifyContent: 'center', alignItems: 'center' }]}>
                          <FontAwesome6 name="envelope" size={16} color={C.green} />
                        </View>
                        <Text style={[s.identityContact, { flex: 1 }]} numberOfLines={1}>{email}</Text>
                        <TouchableOpacity
                          onPress={() => { setOtpSent(false); setOtpCode(''); setErrors({}); }}
                          style={s.identityEditBtn}
                          hitSlop={8}
                        >
                          <FontAwesome6 name="pen" size={12} color={C.green} />
                          <Text style={s.identityEditText}>Modifier</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={s.otpHint}>
                        Un code à 6 chiffres a été envoyé à <Text style={{ color: C.green, fontWeight: '700' }}>{email}</Text>
                      </Text>

                      {/* Saisie 6 cases */}
                      <CodeInput value={otpCode} onChange={(v) => { setOtpCode(v); setErrors(p => ({ ...p, otp: '' })); }} />
                      {errors.otp ? <Text style={[s.errText, { textAlign: 'center' }]}>{errors.otp}</Text> : null}

                      <TouchableOpacity
                        style={[s.primaryBtn, (!canStep1 || otpLoading) && s.primaryBtnOff]}
                        onPress={handleRegContinue}
                        disabled={!canStep1 || otpLoading}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={canStep1 ? [C.green, C.greenDark] : ['#B0D8C8', '#9DC9B6']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={s.primaryBtnGrad}
                        >
                          {otpLoading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.primaryBtnText}>Vérifier le code</Text>
                          }
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Renvoi */}
                      <TouchableOpacity
                        onPress={() => { if (otpCountdown === 0) handleSendOtp(); }}
                        disabled={otpCountdown > 0}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.otpResend, otpCountdown > 0 && s.otpResendDisabled]}>
                          {otpCountdown > 0 ? `Renvoyer le code (${otpCountdown}s)` : 'Renvoyer le code'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── ÉTAPE 2 : nom & prénom ── */}
                  {regStep === 2 && (
                    <>
                      <View style={s.cardTitleRow}>
                        <View style={[s.cardTitleBadge, { backgroundColor: C.greenGlow }]}>
                          <Text style={[s.cardTitleBadgeText, { color: C.green }]}>2 / 3</Text>
                        </View>
                        <Text style={s.cardTitle}>Votre identité</Text>
                      </View>

                      {/* Récapitulatif contact */}
                      <View style={s.identitySummary}>
                        <View style={[s.identityAvatar, { backgroundColor: C.greenGlow, justifyContent: 'center', alignItems: 'center' }]}>
                          <FontAwesome6 name={regType === 'phone' ? 'phone' : 'envelope'} size={16} color={C.green} />
                        </View>
                        <Text style={[s.identityContact, { flex: 1 }]}>
                          {regType === 'phone' ? `+216 ${phone}` : email}
                        </Text>
                        <TouchableOpacity
                          onPress={() => { setRegStep(1); setErrors({}); }}
                          style={s.identityEditBtn}
                          hitSlop={8}
                        >
                          <FontAwesome6 name="pen" size={12} color={C.green} />
                          <Text style={s.identityEditText}>Modifier</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Prénom + Nom côte à côte */}
                      <View style={s.nameRow}>
                        <View style={{ flex: 1 }}>
                          <InputField
                            iconName="user"
                            placeholder="Prénom *"
                            value={prenom}
                            onChangeText={(v) => { setPrenom(v); setErrors(p => ({ ...p, prenom: '' })); }}
                            error={errors.prenom}
                            autoCapitalize="words"
                            autoFocus
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <InputField
                            iconName="user"
                            placeholder="Nom"
                            value={nom}
                            onChangeText={(v) => { setNom(v); }}
                            autoCapitalize="words"
                          />
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[s.primaryBtn, !canStep2 && s.primaryBtnOff]}
                        onPress={handleRegContinue}
                        disabled={!canStep2}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={canStep2 ? [C.green, C.greenDark] : ['#B0D8C8', '#9DC9B6']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={s.primaryBtnGrad}
                        >
                          <Text style={s.primaryBtnText}>Continuer</Text>
                          <FontAwesome6 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* ── ÉTAPE 3 : mot de passe ── */}
                  {regStep === 3 && (
                    <>
                      <View style={s.cardTitleRow}>
                        <View style={[s.cardTitleBadge, { backgroundColor: C.blueGlow }]}>
                          <Text style={[s.cardTitleBadgeText, { color: C.blue }]}>3 / 3</Text>
                        </View>
                        <Text style={s.cardTitle}>Sécurisez votre compte</Text>
                      </View>

                      {/* Récapitulatif identité complète */}
                      <View style={s.identitySummary}>
                        <LinearGradient colors={[C.green, C.greenDark]} style={s.identityAvatar}>
                          <Text style={s.identityAvatarText}>{prenom[0]?.toUpperCase() || '?'}</Text>
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={s.identityName}>{prenom} {nom}</Text>
                          <Text style={s.identityContact}>
                            {regType === 'phone' ? `+216 ${phone}` : email}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => { setRegStep(2); setErrors({}); }}
                          style={s.identityEditBtn}
                          hitSlop={8}
                        >
                          <FontAwesome6 name="pen" size={12} color={C.green} />
                          <Text style={s.identityEditText}>Modifier</Text>
                        </TouchableOpacity>
                      </View>

                      <InputField
                        iconName="lock"
                        placeholder="Mot de passe (min. 6 caractères)"
                        value={password}
                        onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                        secureTextEntry
                        error={errors.password}
                        autoFocus
                      />
                      <InputField
                        iconName="lock"
                        placeholder="Confirmer le mot de passe"
                        value={confirm}
                        onChangeText={(v) => { setConfirm(v); setErrors(p => ({ ...p, confirm: '' })); }}
                        secureTextEntry
                        error={errors.confirm}
                      />

                      <TouchableOpacity
                        style={[s.primaryBtn, !canStep3 && s.primaryBtnOff]}
                        onPress={handleRegContinue}
                        disabled={loading || !canStep3}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={canStep3 ? [C.green, C.greenDark] : ['#B0D8C8', '#9DC9B6']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={s.primaryBtnGrad}
                        >
                          {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.primaryBtnText}>S'inscrire</Text>
                          }
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* ── Options sociales (étape 1 uniquement) ── */}
                {regStep === 1 && (

                  <>
                    <View style={s.divRow}>
                      <View style={s.divLine} />
                      <Text style={s.divText}>ou continuer avec</Text>
                      <View style={s.divLine} />
                    </View>

                    <TouchableOpacity style={s.socialCard} onPress={handleFacebook} activeOpacity={0.82}>
                      <View style={[s.socialIconBox, { backgroundColor: 'rgba(24,119,242,0.1)' }]}>
                        <FontAwesome6 name="facebook" size={20} color={C.facebook} />
                      </View>
                      <Text style={s.socialCardText}>Facebook</Text>
                      <FontAwesome6 name="chevron-right" size={11} color={C.textFaint} />
                    </TouchableOpacity>

                    <TouchableOpacity style={s.socialCard} onPress={handleGoogle} activeOpacity={0.82}>
                      <View style={[s.socialIconBox, { backgroundColor: 'rgba(234,67,53,0.08)' }]}>
                        <FontAwesome6 name="google" size={18} color={C.google} />
                      </View>
                      <Text style={s.socialCardText}>Google</Text>
                      <FontAwesome6 name="chevron-right" size={11} color={C.textFaint} />
                    </TouchableOpacity>

                    {Platform.OS === 'ios' && (
                      <TouchableOpacity style={s.socialCard} onPress={handleApple} activeOpacity={0.82}>
                        <View style={[s.socialIconBox, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
                          <FontAwesome6 name="apple" size={20} color={C.text} />
                        </View>
                        <Text style={s.socialCardText}>Apple</Text>
                        <FontAwesome6 name="chevron-right" size={11} color={C.textFaint} />
                      </TouchableOpacity>
                    )}
                  </>
                )}

                <Text style={s.termsText}>
                  En t'inscrivant, tu acceptes nos{' '}
                  <Text style={s.termsLink}>Conditions d'utilisation</Text>
                  {' '}et notre{' '}
                  <Text style={s.termsLink}>Politique de confidentialité</Text>.
                </Text>

              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={s.bottomBar}>
            <Text style={s.bottomBarText}>Tu as déjà un compte ? </Text>
            <TouchableOpacity onPress={() => goTo('login')}>
              <Text style={s.bottomBarLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={s.blobTopRight} />
        <View style={s.blobBottomLeft} />
      </View>

      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => goTo('register')} style={s.backBtn} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color={C.text} />
          </TouchableOpacity>
          <LinearGradient colors={[C.green, C.greenDark]} style={s.headerLogo}>
            <FontAwesome6 name="location-dot" size={15} color="#FFFFFF" />
          </LinearGradient>
          <Text style={s.headerAppName}>ByMap</Text>
          <View style={{ flex: 1 }} />
          <View style={[s.statusBadge, { backgroundColor: C.greenGlow }]}>
            <View style={[s.statusDot, { backgroundColor: C.green }]} />
            <Text style={[s.statusText, { color: C.green }]}>Sécurisé</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              <Text style={s.pageTitle}>Se connecter</Text>
              <Text style={s.pageSubtitle}>Bon retour sur ByMap</Text>

              {errors.global ? (
                <View style={s.errGlobalBox}>
                  <FontAwesome6 name="circle-exclamation" size={14} color={C.red} />
                  <Text style={s.errGlobal}>{errors.global}</Text>
                </View>
              ) : null}

              <View style={s.card}>
                {/* Onglets Téléphone / E-mail */}
                <View style={s.loginTabBar}>
                  {[
                    { key: 'phone', label: 'Téléphone', icon: 'phone' },
                    { key: 'email', label: 'E-mail',    icon: 'envelope' },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[s.loginTabBtn, loginTab === tab.key && s.loginTabBtnActive]}
                      onPress={() => { setLoginTab(tab.key); setErrors({}); }}
                      activeOpacity={0.8}
                    >
                      <FontAwesome6
                        name={tab.icon}
                        size={13}
                        color={loginTab === tab.key ? C.green : C.textFaint}
                      />
                      <Text style={[s.loginTabText, loginTab === tab.key && s.loginTabTextActive]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Champ contact */}
                {loginTab === 'phone' ? (
                  <InputField
                    iconName="phone"
                    placeholder="Numéro de téléphone"
                    value={phone}
                    onChangeText={(v) => { setPhone(v); setErrors(p => ({ ...p, contact: '' })); }}
                    keyboardType="phone-pad"
                    prefix="+216  "
                    error={errors.contact}
                    maxLength={8}
                  />
                ) : (
                  <InputField
                    iconName="envelope"
                    placeholder="Adresse e-mail"
                    value={email}
                    onChangeText={(v) => { setEmail(v); setErrors(p => ({ ...p, contact: '' })); }}
                    keyboardType="email-address"
                    error={errors.contact}
                  />
                )}

                {/* Mot de passe */}
                <InputField
                  iconName="lock"
                  placeholder="Mot de passe"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrors(p => ({ ...p, password: '' })); }}
                  secureTextEntry
                  error={errors.password}
                />

                {/* Enregistrer connexion */}
                <TouchableOpacity style={s.checkRow} onPress={() => setSaveLogin(!saveLogin)} activeOpacity={0.7}>
                  <View style={[s.checkbox, saveLogin && s.checkboxOn]}>
                    {saveLogin && <FontAwesome6 name="check" size={9} color="#fff" />}
                  </View>
                  <Text style={s.checkText}>
                    Mémoriser mes informations de connexion
                  </Text>
                </TouchableOpacity>

                {/* Bouton connexion */}
                <TouchableOpacity
                  style={[s.primaryBtn, !canLogin && s.primaryBtnOff]}
                  onPress={handleLogin}
                  disabled={loading || !canLogin}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={canLogin ? [C.green, C.greenDark] : ['#B0D8C8', '#9DC9B6']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.primaryBtnGrad}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.primaryBtnText}>Se connecter</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={s.forgotBtn} onPress={() => navigation.navigate('ForgetPassword')}>
                  <Text style={s.forgotText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </View>

              {/* Séparateur social */}
              <View style={s.divRow}>
                <View style={s.divLine} />
                <Text style={s.divText}>ou continuer avec</Text>
                <View style={s.divLine} />
              </View>

              <TouchableOpacity style={s.socialCard} onPress={handleFacebook} activeOpacity={0.82}>
                <View style={[s.socialIconBox, { backgroundColor: 'rgba(24,119,242,0.1)' }]}>
                  <FontAwesome6 name="facebook" size={20} color={C.facebook} />
                </View>
                <Text style={s.socialCardText}>Facebook</Text>
                <FontAwesome6 name="chevron-right" size={11} color={C.textFaint} />
              </TouchableOpacity>

              <TouchableOpacity style={s.socialCard} onPress={handleGoogle} activeOpacity={0.82}>
                <View style={[s.socialIconBox, { backgroundColor: 'rgba(234,67,53,0.08)' }]}>
                  <FontAwesome6 name="google" size={18} color={C.google} />
                </View>
                <Text style={s.socialCardText}>Google</Text>
                <FontAwesome6 name="chevron-right" size={11} color={C.textFaint} />
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity style={s.socialCard} onPress={handleApple} activeOpacity={0.82}>
                  <View style={[s.socialIconBox, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
                    <FontAwesome6 name="apple" size={20} color={C.text} />
                  </View>
                  <Text style={s.socialCardText}>Apple</Text>
                  <FontAwesome6 name="chevron-right" size={11} color={C.textFaint} />
                </TouchableOpacity>
              )}

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={s.bottomBar}>
          <Text style={s.bottomBarText}>Pas encore de compte ? </Text>
          <TouchableOpacity onPress={() => goTo('register')}>
            <Text style={s.bottomBarLink}>S'inscrire</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe:      { flex: 1, backgroundColor: 'transparent' },
  scroll:    { paddingHorizontal: 16, paddingBottom: 32 },

  // Blobs décoratifs (identiques à LocalScreen)
  blobTopRight: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 999,
    backgroundColor: 'rgba(45,189,126,0.10)',
  },
  blobBottomLeft: {
    position: 'absolute', bottom: -60, left: -70,
    width: 240, height: 240, borderRadius: 999,
    backgroundColor: 'rgba(59,126,246,0.07)',
  },

  // ── Header (calqué sur LocalScreen header)
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  headerLogo: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  headerAppName: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  headerCloseBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // ── Titres
  pageTitle: {
    fontSize: 26, fontWeight: '800', color: C.text,
    letterSpacing: -0.4, marginTop: 28, marginBottom: 4, marginLeft: 2,
  },
  pageSubtitle: {
    fontSize: 14, color: C.textDim, marginBottom: 20, marginLeft: 2,
  },

  // ── Indicateur de progression (étapes inscription)
  progressRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20, marginLeft: 2,
  },
  progressDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: C.border, borderWidth: 2, borderColor: C.border,
  },
  progressDotActive: { backgroundColor: C.green, borderColor: C.green },
  progressLine: { flex: 1, height: 3, backgroundColor: C.border, marginHorizontal: 6, borderRadius: 2 },
  progressLineActive: { backgroundColor: C.green },

  // ── Carte blanche (même style que card LocalScreen)
  card: {
    backgroundColor: C.card,
    borderRadius: 20, borderWidth: 1, borderColor: '#F0F0F0',
    padding: 18, marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
    gap: 4,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardTitleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardTitleBadgeText: { fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text },

  // ── Champs prénom + nom côte à côte
  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },

  // ── Toggle téléphone / e-mail
  toggleRow: {
    flexDirection: 'row', gap: 8, marginBottom: 8,
    padding: 4, backgroundColor: '#F3F4F6', borderRadius: 12,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10,
  },
  toggleBtnActive:     { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  toggleBtnText:       { fontSize: 13, fontWeight: '600', color: C.textFaint },
  toggleBtnTextActive: { color: C.green },

  // ── Champs de saisie
  inputGroup: { gap: 3 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: R.md, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: SP.md, paddingVertical: 2, minHeight: HIT.min,
  },
  inputWrapFocused: { borderColor: C.green, backgroundColor: 'rgba(45,189,126,0.04)' },
  inputWrapError:   { borderColor: C.red,   backgroundColor: 'rgba(239,68,68,0.04)' },
  inputIconLeft:    { marginRight: SP.sm },
  inputIconRight:   { marginLeft: SP.sm, padding: 4 },
  inputPrefix:      { ...T.bodyLg, color: C.green, fontWeight: '700', marginRight: 4 },
  inputText:        { flex: 1, ...T.bodyLg, color: C.text, paddingVertical: SP.md },
  errText:          { ...T.bodyMd, color: C.red, marginLeft: 4 },

  // ── Erreur globale
  errGlobalBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.20)', marginBottom: 16,
  },
  errGlobal: { flex: 1, fontSize: 13, color: C.red, fontWeight: '500' },

  // ── Récapitulatif identité (étape 2 inscription)
  identitySummary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.greenGlow, borderRadius: 14,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(45,189,126,0.20)',
  },
  identityAvatar: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  identityAvatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  identityName:       { fontSize: 15, fontWeight: '700', color: C.text },
  identityContact:    { fontSize: 12, color: C.textDim, marginTop: 1 },
  identityEditBtn:    { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  identityEditText:   { fontSize: 12, color: C.green, fontWeight: '600' },

  // ── Bouton principal avec dégradé
  primaryBtn: { borderRadius: R.lg, marginTop: SP.sm, overflow: 'hidden' },
  primaryBtnOff: { opacity: 0.7 },
  primaryBtnGrad: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    minHeight: HIT.min, paddingVertical: SP.md,
    shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { ...T.titleMd, color: '#FFFFFF', letterSpacing: 0.5 },

  // ── Onglets connexion (Téléphone / E-mail)
  loginTabBar: {
    flexDirection: 'row', gap: 8,
    padding: 4, backgroundColor: '#F3F4F6', borderRadius: 14,
    marginBottom: 14,
  },
  loginTabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 9, borderRadius: 11,
  },
  loginTabBtnActive: {
    backgroundColor: C.white,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  loginTabText:       { fontSize: 13, fontWeight: '600', color: C.textFaint },
  loginTabTextActive: { color: C.text, fontWeight: '700' },

  // ── Checkbox
  checkRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  checkbox:   {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.green,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: C.green },
  checkText:  { flex: 1, fontSize: 13, color: C.textDim },

  // ── Mot de passe oublié
  forgotBtn:  { marginTop: 14, alignItems: 'center' },
  forgotText: { fontSize: 13, color: C.green, fontWeight: '600' },

  // ── Divider
  divRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { fontSize: 12, color: C.textFaint, fontWeight: '500', whiteSpace: 'nowrap' },

  // ── Cartes sociales
  socialCard: {
    flexDirection: 'row', alignItems: 'center', gap: SP.base,
    backgroundColor: C.card,
    borderRadius: R.md, borderWidth: 1, borderColor: '#F0F0F0',
    padding: SP.base, marginBottom: SP.sm, minHeight: HIT.min,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  socialIconBox: {
    width: 40, height: 40, borderRadius: R.sm,
    justifyContent: 'center', alignItems: 'center',
  },
  socialCardText: { flex: 1, ...T.titleMd, color: C.text },

  // ── Conditions d'utilisation
  termsText: {
    fontSize: 11, color: C.textFaint, textAlign: 'center',
    marginTop: 20, lineHeight: 17,
  },
  termsLink: { color: C.blue },

  // ── Barre du bas
  bottomBar: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingVertical: 16, backgroundColor: C.white,
  },
  bottomBarText: { fontSize: 14, color: C.textDim },
  bottomBarLink: { fontSize: 14, fontWeight: '800', color: C.green },

  // ── OTP
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SP.sm },
  codeBox: {
    flex: 1, height: HIT.min + 4, borderRadius: R.md,
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border,
    fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center',
  },
  codeBoxFilled: { borderColor: C.green, backgroundColor: C.greenGlow },
  otpHint: {
    ...T.bodyMd, color: C.textDim, textAlign: 'center',
    marginBottom: SP.xs,
  },
  otpResend: {
    textAlign: 'center', ...T.labelLg, color: C.green, marginTop: SP.xs,
  },
  otpResendDisabled: { color: C.textFaint },
});
