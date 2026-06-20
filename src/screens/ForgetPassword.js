// src/screens/ForgetPassword.js
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { API_URL } from '../environments/environment';
import { D, G, shadow, DarkBackground, R, T, SP, HIT } from '../theme/index';

// ── Alias palette ─────────────────────────────────────────────────────────────
const C = {
  blue:      D.blue,
  blueLight: D.blueGlow,
  white:     D.white,
  red:       D.red,
  green:     D.green,
  greyLight: D.textFaint,
};

// ── Champ de saisie ───────────────────────────────────────────────────────────
function Field({ iconName, placeholder, value, onChangeText, secureTextEntry, keyboardType, error }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.field, error && styles.fieldError]}>
        <FontAwesome6 name={iconName} size={16} color={D.textFaint} />
        <TextInput
          style={styles.fieldInput}
          placeholder={placeholder}
          placeholderTextColor={D.textFaint}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShow(s => !s)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome6 name={show ? 'eye' : 'eye-slash'} size={16} color={D.textFaint} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ── Code à 6 chiffres ─────────────────────────────────────────────────────────
function CodeInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, v) => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[i]     = clean;
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
    <View style={styles.codeRow}>
      {Array.from({ length: 6 }).map((_, i) => (
        <TextInput
          key={i}
          ref={r => { inputs.current[i] = r; }}
          style={[styles.codeBox, digits[i] && styles.codeBoxFilled]}
          value={digits[i] || ''}
          onChangeText={v => handleKey(i, v)}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace') handleBackspace(i, digits[i]);
          }}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function ForgetPassword() {
  const navigation = useNavigation();
  const { t }      = useTranslation();

  const [step,        setStep]        = useState('email');
  const [email,       setEmail]       = useState('');
  const [code,        setCode]        = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [countdown,   setCountdown]   = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email.trim()) { setError(t('forgetPassword.errEmail')); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      fadeAnim.setValue(0); setStep('code'); setCountdown(60);
    } catch { setError(t('common.networkError')); }
    finally  { setLoading(false); }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCountdown(60); setCode('');
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    if (code.length < 6) { setError(t('forgetPassword.errCode')); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/verify-reset-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      fadeAnim.setValue(0); setStep('password');
    } catch { setError(t('common.networkError')); }
    finally  { setLoading(false); }
  };

  const handleReset = async () => {
    if (newPassword.length < 6) { setError(t('forgetPassword.errMin6')); return; }
    if (newPassword !== confirm)  { setError(t('forgetPassword.errMatch')); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      fadeAnim.setValue(0); setStep('success');
    } catch { setError(t('common.networkError')); }
    finally  { setLoading(false); }
  };

  const meta = {
    email:    { title: t('forgetPassword.title'),       sub: t('forgetPassword.subtitle'),              iconName: 'key',           iconColor: D.blue   },
    code:     { title: t('forgetPassword.stepVerif'),   sub: t('forgetPassword.codeSentTo', { email }), iconName: 'envelope',      iconColor: D.blue   },
    password: { title: t('forgetPassword.stepNewPass'), sub: t('forgetPassword.stepNewPassSub'),         iconName: 'lock',          iconColor: D.blue   },
    success:  { title: t('forgetPassword.stepSuccess'), sub: t('forgetPassword.stepSuccessSub'),         iconName: 'circle-check',  iconColor: D.green  },
  }[step];

  return (
    <DarkBackground style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

              {/* Icône */}
              <View style={[styles.iconCircle, { backgroundColor: meta.iconColor + '33' }]}>
                <FontAwesome6 name={meta.iconName} size={30} color={meta.iconColor} />
              </View>

              <Text style={styles.title}>{meta.title}</Text>
              <Text style={styles.subtitle}>{meta.sub}</Text>

              {/* Étape 1 — Email */}
              {step === 'email' && (
                <View style={styles.form}>
                  <Field
                    iconName="envelope"
                    placeholder={t('forgetPassword.emailPlaceholder')}
                    value={email}
                    onChangeText={v => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    error={error}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtnWrap, loading && { opacity: 0.7 }]}
                    onPress={handleSendCode} disabled={loading} activeOpacity={0.88}
                  >
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>{t('forgetPassword.sendCode')}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Étape 2 — Code */}
              {step === 'code' && (
                <View style={styles.form}>
                  <CodeInput value={code} onChange={v => { setCode(v); setError(''); }} />
                  {error ? <Text style={[styles.errorText, { textAlign: 'center' }]}>{error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.primaryBtnWrap, loading && { opacity: 0.7 }]}
                    onPress={handleVerifyCode} disabled={loading} activeOpacity={0.88}
                  >
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>{t('forgetPassword.verifyCode')}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResend} disabled={countdown > 0} activeOpacity={0.7}>
                    <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                      {countdown > 0 ? t('forgetPassword.resendIn', { countdown }) : t('forgetPassword.resend')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Étape 3 — Nouveau mot de passe */}
              {step === 'password' && (
                <View style={styles.form}>
                  <Field iconName="lock" placeholder={t('forgetPassword.newPassword')}     value={newPassword} onChangeText={v => { setNewPassword(v); setError(''); }} secureTextEntry />
                  <Field iconName="lock" placeholder={t('forgetPassword.confirmPassword')} value={confirm}     onChangeText={v => { setConfirm(v);    setError(''); }} secureTextEntry error={error} />
                  <TouchableOpacity
                    style={[styles.primaryBtnWrap, loading && { opacity: 0.7 }]}
                    onPress={handleReset} disabled={loading} activeOpacity={0.88}
                  >
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      {loading ? <ActivityIndicator color={D.white} /> : <Text style={styles.primaryBtnText}>{t('forgetPassword.reset')}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Succès */}
              {step === 'success' && (
                <View style={styles.form}>
                  <TouchableOpacity style={styles.primaryBtnWrap} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
                    <LinearGradient colors={G.blue} style={styles.primaryBtn}>
                      <Text style={styles.primaryBtnText}>{t('forgetPassword.loginNow')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </DarkBackground>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SP.base },

  header: { paddingHorizontal: SP.base, paddingVertical: SP.md },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: D.white, fontWeight: '700' },

  card: {
    backgroundColor: D.glassMid,
    borderRadius: R.xl, padding: SP.xxl, alignItems: 'center', gap: SP.md,
    borderWidth: 1, borderColor: D.glassBorder,
    ...shadow.soft,
  },

  iconCircle: {
    width: 80, height: 80, borderRadius: R.full,
    justifyContent: 'center', alignItems: 'center', marginBottom: SP.xs,
  },
  title:    { ...T.headline, color: D.white, textAlign: 'center' },
  subtitle: { ...T.bodyMd, color: D.textDim, textAlign: 'center', marginBottom: SP.sm },

  form: { width: '100%', gap: SP.md },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: D.glassInput, borderRadius: R.md,
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    borderWidth: 1.5, borderColor: D.glassBorder,
    minHeight: HIT.min,
  },
  fieldError: { borderColor: D.red },
  fieldInput: { flex: 1, ...T.bodyLg, color: D.white },
  errorText:  { ...T.labelSm, color: D.red, marginLeft: SP.xs, textTransform: 'none', letterSpacing: 0 },

  codeRow:      { flexDirection: 'row', justifyContent: 'space-between', gap: SP.sm },
  codeBox: {
    flex: 1, height: 56, borderRadius: R.md,
    backgroundColor: D.glassInput, borderWidth: 1.5, borderColor: D.glassBorder,
    fontSize: 22, fontWeight: '800', color: D.white,
  },
  codeBoxFilled: { borderColor: D.blue, backgroundColor: D.blueGlow },

  primaryBtnWrap: { borderRadius: R.lg, overflow: 'hidden', ...shadow.blue },
  primaryBtn:     { borderRadius: R.lg, paddingVertical: SP.base, alignItems: 'center', minHeight: HIT.min, justifyContent: 'center' },
  primaryBtnText: { ...T.titleMd, color: D.white, fontWeight: '800' },

  resendText:     { textAlign: 'center', ...T.bodyMd, color: D.blue, fontWeight: '600' },
  resendDisabled: { color: D.textFaint },
});