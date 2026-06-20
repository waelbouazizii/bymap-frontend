// src/screens/ProfileScreen.js
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, FlatList, Switch, Alert, Modal,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '../security/secureStorage';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { getCurrentUser, logout as apiLogout } from '../utils/api';
import { environment } from '../environments/environment';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, LANGUAGE_MAP, LANGUAGE_NAMES } from '../i18n/index';
import BottomTabBar from '../components/BottomTabBar';
import { useTheme } from '../theme/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL     = environment.apiUrl;
const SERVER_BASE = API_URL.replace('/api', '');

const fixMediaUrl = (url) => {
  if (!url) return null;
  let filename = null;
  if (/^https?:\/\//.test(url)) {
    const m = url.match(/\/uploads\/(.+)$/);
    if (!m) return url.replace(/^https?:\/\/[^/]+/, SERVER_BASE);
    filename = m[1];
  } else if (url.startsWith('/api/media?path=')) {
    filename = url.slice('/api/media?path='.length);
  } else if (url.startsWith('/uploads/')) {
    filename = url.slice('/uploads/'.length);
  } else {
    return url;
  }
  if (Platform.OS === 'web' && window.location.protocol === 'https:') return `/api/media?path=${filename}`;
  return `${SERVER_BASE}/api/media?path=${filename}`;
};

const getMediaUri = (m) => {
  if (!m) return null;
  const raw = (typeof m === 'string') ? m : (m.url || m.path || m.uri || m.src || m.filename || null);
  return fixMediaUrl(raw);
};

const isImageMedia = (m) => {
  if (!m) return false;
  if (typeof m === 'string') return /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?.*)?$/i.test(m);
  const t = (m.type || m.mimetype || m.mimeType || m.contentType || '').toLowerCase();
  if (t === 'image' || t.startsWith('image/')) return true;
  const url = m.url || m.path || m.uri || m.src || m.filename || '';
  return /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?.*)?$/i.test(url);
};

// ── Palette mint clair ─────────────────────────────────────────────────────────
const C = {
  green:     '#2DBD7E', greenGlow: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6', blueGlow:  'rgba(59,126,246,0.10)',
  red:       '#EF4444',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  inputBg:   '#F8FAFB',
  cardBg:    '#FFFFFF',
};

// ── VIEW 900 — Profile principal ───────────────────────────────────────────────
function ProfileMain({ user, localCount, duoCount, onEditProfile, onSettings, onMyAds, onHelpSupport, onLogOut, onBuyPoints }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const solde      = typeof user?.pointsSolde        === 'number' ? user.pointsSolde        : 0;
  const freePosts  = typeof user?.freePostsRemaining === 'number' ? user.freePostsRemaining : 0;
  const userName = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || t('profile.unknown') : t('profile.unknown');
  return (
    <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

      {/* ── Hero block ── */}
      <LinearGradient colors={['#0f2848', '#1a3a5c']} style={styles.profileHero}>
        <View style={styles.avatarCircle}>
          {user?.avatar
            ? <Image source={{ uri: fixMediaUrl(user.avatar) }} style={styles.avatarImage} />
            : <FontAwesome6 name="circle-user" size={52} color="rgba(255,255,255,0.8)" />}
        </View>
        <Text style={styles.profileName}>{userName}</Text>
        <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || user?.phone || ''}</Text>

        {/* Mini stats strip */}
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{localCount + duoCount}</Text>
            <Text style={styles.heroStatLabel}>PUBLICATIONS</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{freePosts}</Text>
            <Text style={styles.heroStatLabel}>POSTS GRATUITS</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{solde}</Text>
            <Text style={styles.heroStatLabel}>POINTS</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Scrollable content ── */}
      <View style={styles.profileContent}>

        {/* Soldes : deux cartes côte à côte */}
        <View style={styles.soldesRow}>
          <LinearGradient
            colors={['#2DBD7E', '#1AA368']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.soldeCard, { shadowColor: '#2DBD7E' }]}
          >
            <View style={styles.soldeCardTop}>
              <FontAwesome6 name="newspaper" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={[styles.soldeCardLabel, { color: 'rgba(255,255,255,0.8)' }]}>Posts gratuits</Text>
            </View>
            <Text style={styles.soldeCardValue}>{freePosts}</Text>
            <Text style={styles.soldeCardSub}>
              {freePosts === 0 ? 'Épuisés' : freePosts === 1 ? 'Dernier post' : 'restants'}
            </Text>
          </LinearGradient>

          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.soldeCard, { shadowColor: '#F59E0B' }]}
          >
            <View style={styles.soldeCardTop}>
              <FontAwesome6 name="coins" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={[styles.soldeCardLabel, { color: 'rgba(255,255,255,0.8)' }]}>Solde de points</Text>
            </View>
            <Text style={styles.soldeCardValue}>{solde}</Text>
            <Text style={styles.soldeCardSub}>
              {solde === 0 ? 'Épuisés' : solde <= 10 ? 'Solde faible !' : 'points'}
            </Text>
            {solde === 0 && (
              <TouchableOpacity style={styles.buyPointsBtn} onPress={onBuyPoints} activeOpacity={0.85}>
                <Text style={styles.buyPointsBtnText}>+ Acheter</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        <View style={styles.activeAdsBox}>
          <Text style={styles.activeAdsTitle}>{t('profile.activeAds')}</Text>
          <View style={styles.activeAdsRow}>
            <View style={[styles.activeAdsCard, { borderColor: C.green }]}>
              <Text style={[styles.activeAdsCount, { color: C.green }]}>{localCount}</Text>
              <Text style={styles.activeAdsLabel}>LOCAL</Text>
            </View>
            <View style={[styles.activeAdsCard, { borderColor: C.blue }]}>
              <Text style={[styles.activeAdsCount, { color: C.blue }]}>{duoCount}</Text>
              <Text style={styles.activeAdsLabel}>DUO</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.viewMyAdsBtn} onPress={onMyAds} activeOpacity={0.85}>
          <Text style={styles.viewMyAdsBtnText}>{t('profile.viewMyAds')}</Text>
          <FontAwesome6 name="arrow-right" size={14} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.menuList}>
          <MenuRow icon="pen-to-square"      color="#2DBD7E" label={t('profile.editProfile')}  onPress={onEditProfile} />
          <MenuRow icon="gear"               color="#3B7EF6" label={t('profile.settings')}     onPress={onSettings}    />
          <MenuRow icon="clipboard-list"     color="#F59E0B" label={t('profile.myAds')}        onPress={onMyAds}       />
          <MenuRow icon="circle-question"    color="#7C3AED" label={t('profile.helpSupport')}  onPress={onHelpSupport} />
          <MenuRow icon="right-from-bracket"                 label={t('profile.logout')}       onPress={onLogOut} danger />
        </View>
      </View>
    </ScrollView>
  );
}

// ── VIEW 901 — Edit Profile ────────────────────────────────────────────────────
function EditProfileView({ user, onSave }) {
  const { t } = useTranslation();
  const [fullName,      setFullName]      = useState(`${user?.prenom || ''} ${user?.nom || ''}`.trim());
  const [phone,         setPhone]         = useState(user?.phone || '');
  const [email,         setEmail]         = useState(user?.email || '');
  const [preferredZone, setPreferredZone] = useState(user?.preferredZone || '');
  const [saving,        setSaving]        = useState(false);
  const [avatarUri,     setAvatarUri]     = useState(user?.avatar || null);
  const [uploading,     setUploading]     = useState(false);

  const handleChangePhoto = () => {
    Alert.alert(t('profile.changePhoto'), t('profile.chooseSource'), [
      { text: t('profile.gallery'), onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert(t('profile.permissionDenied'), t('profile.galleryPermission')); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) uploadAvatar(result.assets[0]);
      }},
      { text: t('profile.camera'), onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert(t('profile.permissionDenied'), t('profile.cameraPermission')); return; }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled) uploadAvatar(result.assets[0]);
      }},
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (asset) => {
    setUploading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('avatar', { uri: asset.uri, name: `avatar_${Date.now()}.jpg`, type: 'image/jpeg' });
      const res = await fetch(`${API_URL}/users/me/avatar`, { method: 'PUT', headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: formData });
      if (!res.ok) throw new Error(t('profile.uploadFailed'));
      const data = await res.json();
      setAvatarUri(fixMediaUrl(data.avatarUrl) || asset.uri);
    } catch (err) { Alert.alert(t('common.error'), err.message || t('profile.changePhotoFailed')); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getAccessToken();
      const [prenom, ...rest] = fullName.trim().split(' ');
      const nom = rest.join(' ');
      const res = await fetch(`${API_URL}/users/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ prenom, nom, phone, email, preferredZone }) });
      if (!res.ok) throw new Error(t('profile.updateError'));
      onSave();
    } catch (err) { Alert.alert(t('common.error'), err.message || t('profile.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarCircle}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          : <FontAwesome6 name="circle-user" size={52} color={C.green} />}
      </View>
      <TouchableOpacity style={styles.changePhotoBtn} activeOpacity={0.75} onPress={handleChangePhoto} disabled={uploading}>
        {uploading
          ? <ActivityIndicator size="small" color={C.green} />
          : <>
              <FontAwesome6 name="camera" size={13} color={C.green} />
              <Text style={styles.changePhotoText}>{t('profile.changePhoto')}</Text>
            </>}
      </TouchableOpacity>
      <View style={styles.fieldList}>
        <Field label={t('profile.fullName')}      value={fullName}      onChangeText={setFullName}     placeholder={t('profile.fullName')} />
        <Field label={t('profile.phone')}         value={phone}         onChangeText={setPhone}         placeholder={t('login.phone')} keyboardType="phone-pad" />
        <Field label={t('profile.email')}         value={email}         onChangeText={setEmail}         placeholder={t('login.email')} keyboardType="email-address" />
        <Field label={t('profile.preferredZone')} value={preferredZone} onChangeText={setPreferredZone} placeholder={t('profile.preferredZonePlaceholder')} />
      </View>
      <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('profile.saveProfile')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const LANGUAGES = ['العربية', 'Français', 'English'];

// ── VIEW 902 — Settings ────────────────────────────────────────────────────────
function SettingsView({ onChangePassword }) {
  const { t, i18n } = useTranslation();
  const [language,        setLanguage]        = useState(LANGUAGE_NAMES[i18n.language] || 'Français');
  const [notifications,   setNotifications]   = useState(true);
  const [locationAccess,  setLocationAccess]  = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showLangPicker,  setShowLangPicker]  = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const res   = await fetch(`${API_URL}/users/me/settings?_t=${Date.now()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.language) setLanguage(data.settings.language);
          if (data.settings?.notifications  !== undefined) setNotifications(data.settings.notifications);
          if (data.settings?.locationAccess !== undefined) setLocationAccess(data.settings.locationAccess);
        }
      } catch {}
      finally { setLoadingSettings(false); }
    })();
  }, []);

  const handleSelectLanguage = async (lang) => {
    setLanguage(lang);
    setShowLangPicker(false);
    const code = LANGUAGE_MAP[lang] || 'fr';
    await changeAppLanguage(code);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/users/me/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ language, notifications, locationAccess }) });
      if (!res.ok) throw new Error();
      Alert.alert(t('common.success'), t('profile.settingsSaved'));
    } catch { Alert.alert(t('common.error'), t('common.networkError')); }
    finally { setSaving(false); }
  };

  if (loadingSettings) return <ActivityIndicator style={{ flex: 1 }} color={C.green} />;

  return (
    <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {showLangPicker && (
        <View style={styles.langModal}>
          <View style={styles.langModalPanel}>
            <Text style={styles.langModalTitle}>{t('profile.language')}</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity key={lang} style={[styles.langOption, language === lang && styles.langOptionActive]} onPress={() => handleSelectLanguage(lang)} activeOpacity={0.8}>
                <Text style={[styles.langOptionText, language === lang && { color: '#FFFFFF' }]}>{lang}</Text>
                {language === lang && <FontAwesome6 name="check" size={14} color="#FFFFFF" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.langCancelBtn} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.langCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('profile.preferences')}</Text>
      <View style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={() => setShowLangPicker(true)} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>{t('profile.language')}</Text>
          <View style={styles.settingsRowRight}>
            <Text style={styles.settingsRowValue}>{language}</Text>
            <FontAwesome6 name="chevron-right" size={13} color={colors.onSurfaceVariant} />
          </View>
        </TouchableOpacity>
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.outline }]}>
          <Text style={styles.settingsRowLabel}>{t('profile.notifications')}</Text>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: colors.outline, true: C.green }} thumbColor="#FFFFFF" />
        </View>
        <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.outline }]}>
          <Text style={styles.settingsRowLabel}>{t('profile.locationAccess')}</Text>
          <Switch value={locationAccess} onValueChange={setLocationAccess} trackColor={{ false: colors.outline, true: C.blue }} thumbColor="#FFFFFF" />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('profile.account')}</Text>
      <View style={styles.settingsGroup}>
        <TouchableOpacity style={styles.settingsRow} onPress={onChangePassword} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>{t('profile.changePassword')}</Text>
          <FontAwesome6 name="chevron-right" size={13} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.outline }]} activeOpacity={0.7}>
          <Text style={styles.settingsRowLabel}>{t('profile.privacy')}</Text>
          <FontAwesome6 name="chevron-right" size={13} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.outline }]}
          onPress={() => Alert.alert(t('profile.deleteAccount'), t('profile.areYouSure'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive' }])}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingsRowLabel, { color: C.red }]}>{t('profile.deleteAccount')}</Text>
          <FontAwesome6 name="chevron-right" size={13} color={C.red} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32 }, saving && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('common.save').toUpperCase()}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 902b — Change Password ────────────────────────────────────────────────
function ChangePasswordView({ onSuccess }) {
  const { t } = useTranslation();
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [saving,      setSaving]      = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) return Alert.alert(t('common.error'), t('profile.allFieldsRequired'));
    if (newPwd.length < 6) return Alert.alert(t('common.error'), t('forgetPassword.errMin6'));
    if (newPwd !== confirmPwd) return Alert.alert(t('common.error'), t('forgetPassword.errMatch'));
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/users/me/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.message || t('common.error'));
      Alert.alert(t('common.success'), t('profile.passwordChanged'), [{ text: 'OK', onPress: onSuccess }]);
    } catch (err) { Alert.alert(t('common.error'), err.message); }
    finally { setSaving(false); }
  };

  const PwdField = ({ label, value, onChange, show, onToggle }) => (
    <View style={styles.pwdFieldWrap}>
      <FontAwesome6 name="lock" size={14} color={colors.onSurfaceVariant} style={{ marginRight: 10 }} />
      <TextInput style={styles.pwdField} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={colors.onSurfaceVariant} secureTextEntry={!show} autoCapitalize="none" />
      <TouchableOpacity style={styles.pwdEye} onPress={onToggle}>
        <FontAwesome6 name={show ? 'eye-slash' : 'eye'} size={14} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pwdIconWrap}>
        <View style={styles.pwdIconCircle}>
          <FontAwesome6 name="lock" size={32} color={C.green} />
        </View>
      </View>
      <Text style={styles.pwdTitle}>{t('profile.changePasswordTitle')}</Text>
      <Text style={styles.pwdSub}>{t('profile.changePasswordSub')}</Text>
      <View style={[styles.fieldList, { marginTop: 24 }]}>
        <PwdField label={t('profile.currentPassword')} value={currentPwd} onChange={setCurrentPwd} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
        <PwdField label={t('profile.newPassword')}     value={newPwd}     onChange={setNewPwd}     show={showNew}     onToggle={() => setShowNew(v => !v)} />
        <PwdField label={t('profile.confirmPassword')} value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
      </View>
      <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{t('profile.saveProfile')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── VIEW 903 — Profile Updated ─────────────────────────────────────────────────
function ProfileUpdatedView({ user, onBackToProfile }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}>
        <FontAwesome6 name="check" size={32} color={C.green} />
      </View>
      <Text style={styles.updatedTitle}>{t('profile.profileUpdated')}</Text>
      <View style={[styles.avatarCircle, { marginTop: 20, width: 64, height: 64, borderRadius: 32 }]}>
        <Text style={{ fontSize: 22, color: C.green, fontWeight: '700' }}>{(user?.prenom?.[0] || '') + (user?.nom?.[0] || '') || '?'}</Text>
      </View>
      <Text style={[styles.profileName, { marginTop: 8 }]}>{user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || t('profile.unknown') : t('profile.unknown')}</Text>
      <Text style={styles.profileEmail}>{user?.email || ''}</Text>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32, width: '100%' }]} onPress={onBackToProfile} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{t('profile.backToProfile')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── VIEW 601 — My Ads ──────────────────────────────────────────────────────────
function MyAdsView({ ads, loading, onSelectAd, onRenew, onDelete, renewing, user }) {
  const { t } = useTranslation();
  const [qrItem, setQrItem] = useState(null);
  const qrViewRef = useRef(null);

  const buildQrFile = async () => {
    const fileUri = await qrViewRef.current.capture();
    return fileUri;
  };

  const handleShare = async () => {
    try {
      const fileUri = await buildQrFile();
      await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: qrItem.description || 'QR Code' });
    } catch (e) { Alert.alert(t('common.error'), t('profile.qrShareError')); }
  };

  const getTimeLeft = (pub) => {
    const exp  = pub.expiresAt ? new Date(pub.expiresAt) : new Date(new Date(pub.createdAt).getTime() + 24 * 3600 * 1000);
    const diff = Math.max(0, Math.round((exp - Date.now()) / 3600000));
    return { diff, label: diff > 0 ? t('profile.hoursLeft', { diff }) : t('profile.expired') };
  };
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.green} />;
  return (
    <>
      {/* Carte A4 hors-écran pour capture */}
      <ViewShot ref={qrViewRef} options={{ format: 'jpg', quality: 1 }} style={styles.qrHidden}>
        <View style={styles.qrA4Card}>
          {/* Logo + nom de l'appli */}
          <View style={styles.qrA4Header}>
            <Image source={require('../../assets/logo.png')} style={styles.qrA4Logo} resizeMode="contain" />
            <Text style={styles.qrA4Brand}>BYMAP</Text>
          </View>

          <View style={styles.qrA4Sep} />

          {/* Nom de l'utilisateur */}
          <Text style={styles.qrA4Name}>
            {`${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Utilisateur'}
          </Text>

          {/* QR Code */}
          <View style={styles.qrA4QrWrap}>
            {!!qrItem && (
              <QRCode
                value={`${API_URL}/publications/${qrItem._id}/scan`}
                size={180}
                color="#1A1A2E"
                backgroundColor="#FFFFFF"
              />
            )}
          </View>

          <View style={styles.qrA4Sep} />

          {/* Phrase d'accueil */}
          <Text style={styles.qrA4Welcome}>Bienvenue sur mon espace !</Text>
        </View>
      </ViewShot>

      <Modal visible={!!qrItem} transparent animationType="fade" onRequestClose={() => setQrItem(null)}>
        <TouchableOpacity style={styles.qrOverlay} onPress={() => setQrItem(null)} activeOpacity={1}>
          <TouchableOpacity style={styles.qrCard} onPress={() => {}} activeOpacity={1}>
            <Text style={styles.qrAdTitle} numberOfLines={2}>
              {qrItem?.description || `#${qrItem?._id?.slice(-6)?.toUpperCase()}`}
            </Text>
            <View style={styles.qrCodeWrap}>
              {!!qrItem && (
                <QRCode
                  value={`${API_URL}/publications/${qrItem._id}/scan`}
                  size={200}
                  color="#1A1A2E"
                  backgroundColor="#FFFFFF"
                />
              )}
            </View>
            <TouchableOpacity style={styles.qrShareBtn} onPress={handleShare} activeOpacity={0.82}>
              <FontAwesome6 name="share-nodes" size={20} color="#FFFFFF" />
              <Text style={styles.qrShareBtnText}>{t('profile.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrItem(null)} activeOpacity={0.85}>
              <Text style={styles.qrCloseBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <FlatList
        data={ads} keyExtractor={item => item._id}
        contentContainerStyle={styles.adsList} showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <View style={styles.adsListHeader}>
            <Text style={styles.adsListTitle}>{t('profile.myAds')}</Text>
            <View style={styles.adsListCount}><Text style={styles.adsListCountText}>{ads.length}</Text></View>
          </View>
          {/* ── Bandeau solde renouvellement ── */}
          <View style={styles.renewSoldeBanner}>
            <View style={styles.renewSoldeItem}>
              <FontAwesome6 name="newspaper" size={13} color={C.green} />
              <Text style={[styles.renewSoldeVal, { color: (user?.freePostsRemaining ?? 0) === 0 ? C.red : C.green }]}>
                {user?.freePostsRemaining ?? 0}
              </Text>
              <Text style={styles.renewSoldeLabel}>posts gratuits</Text>
            </View>
            <View style={styles.renewSoldeSep} />
            <View style={styles.renewSoldeItem}>
              <FontAwesome6 name="coins" size={13} color="#F59E0B" />
              <Text style={[styles.renewSoldeVal, { color: (user?.pointsSolde ?? 0) <= 10 ? C.red : '#F59E0B' }]}>
                {user?.pointsSolde ?? 0}
              </Text>
              <Text style={styles.renewSoldeLabel}>points</Text>
            </View>
            <View style={styles.renewSoldeSep} />
            <Text style={styles.renewSoldeHint}>Renouveler = 1 post gratuit ou 10 pts</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <FontAwesome6 name="inbox" size={52} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('profile.noAds')}</Text>
          <Text style={styles.emptyText}>{t('profile.noAdsSub')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLocal  = item.mode === 'local';
        const accent   = isLocal ? C.green : C.blue;
        const accentGlow = isLocal ? C.greenGlow : C.blueGlow;
        const { diff: hoursLeft, label: left } = getTimeLeft(item);
        const expired  = hoursLeft <= 0;
        const firstImg = item.medias?.find(isImageMedia);
        const locLine  = isLocal
          ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(', ')
          : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');
        return (
          <TouchableOpacity style={styles.adCard} onPress={() => onSelectAd(item)} activeOpacity={0.92}>
            {/* ── Cover image ── */}
            <View style={styles.adCardCover}>
              {firstImg
                ? <Image source={{ uri: getMediaUri(firstImg) }} style={styles.adCardCoverImg} resizeMode="cover" />
                : <View style={[styles.adCardCoverPlaceholder, { backgroundColor: accentGlow }]}>
                    <FontAwesome6 name={isLocal ? 'location-dot' : 'handshake'} size={42} color={accent} />
                  </View>
              }
              {/* Mode badge — top left */}
              <View style={[styles.adModeBadge, { backgroundColor: accentGlow, borderColor: accent }]}>
                <View style={[styles.adModeDot, { backgroundColor: accent }]} />
                <Text style={[styles.adModeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
              </View>
              {/* Time badge — top right */}
              <View style={[styles.adTimeBadge, {
                backgroundColor: expired ? 'rgba(239,68,68,0.12)' : 'rgba(255,149,0,0.12)',
                borderColor: expired ? C.red : '#FF9500',
              }]}>
                <FontAwesome6
                  name={expired ? 'triangle-exclamation' : 'clock'}
                  size={10}
                  color={expired ? C.red : '#FF9500'}
                />
                <Text style={[styles.adTimeBadgeText, { color: expired ? C.red : '#FF9500' }]}>
                  {` ${left}`}
                </Text>
              </View>
            </View>

            {/* ── Body ── */}
            <View style={styles.adCardBody}>
              {!!item.description && (
                <Text style={styles.adCardDesc} numberOfLines={2}>{item.description}</Text>
              )}
              {!!locLine && (
                <View style={styles.adCardLocRow}>
                  <FontAwesome6 name="location-dot" size={11} color={colors.onSurfaceVariant} />
                  <Text style={styles.adCardLoc} numberOfLines={1}>{locLine}</Text>
                </View>
              )}
            </View>

            {/* ── Divider ── */}
            <View style={styles.adCardDivider} />

            {/* ── Actions ── */}
            <View style={styles.adCardActions}>
              <TouchableOpacity style={styles.adRenewBtn} onPress={() => onRenew(item)} activeOpacity={0.8} disabled={renewing}>
                <FontAwesome6 name="rotate" size={13} color={C.blue} style={{ marginRight: 6 }} />
                <Text style={styles.adRenewBtnText}>{renewing ? '…' : t('profile.renew')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adQrBtn} onPress={() => setQrItem(item)} activeOpacity={0.8}>
                <FontAwesome6 name="qrcode" size={16} color={C.green} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.adDeleteBtn} onPress={() => onDelete(item)} activeOpacity={0.8}>
                <FontAwesome6 name="trash" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
    />
    </>
  );
}

// ── VIEW 602 — Ad Detail ───────────────────────────────────────────────────────
function AdDetailView({ ad, onRenew, onDelete, renewing, user }) {
  const { t } = useTranslation();
  const isLocal    = ad.mode === 'local';
  const accent     = isLocal ? C.green : C.blue;
  const accentGlow = isLocal ? C.greenGlow : C.blueGlow;
  const exp        = ad.expiresAt ? new Date(ad.expiresAt) : new Date(new Date(ad.createdAt).getTime() + 24 * 3600 * 1000);
  const hoursLeft  = Math.max(0, Math.round((exp - Date.now()) / 3600000));
  const expired    = hoursLeft <= 0;
  const firstImg   = ad.medias?.find(isImageMedia);
  const locLabel   = isLocal
    ? [ad.localisation?.ville, ad.localisation?.gouvernorat].filter(Boolean).join(', ')
    : [ad.localisationDebut?.ville, '→', ad.localisationFin?.ville].filter(Boolean).join(' ');
  const freePosts  = user?.freePostsRemaining ?? 0;
  const points     = user?.pointsSolde ?? 0;

  return (
    <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} contentContainerStyle={styles.adDetailContent} showsVerticalScrollIndicator={false}>

      {/* ── Hero image ── */}
      <View style={styles.adDetailHero}>
        {firstImg
          ? <Image source={{ uri: getMediaUri(firstImg) }} style={styles.adDetailImage} resizeMode="cover" />
          : <View style={[styles.adDetailImagePlaceholder, { backgroundColor: accentGlow }]}>
              <FontAwesome6 name={isLocal ? 'location-dot' : 'handshake'} size={48} color={accent} />
            </View>}
        {/* Mode pill overlay */}
        <View style={[styles.adDetailModePill, { backgroundColor: accent }]}>
          <View style={styles.adDetailModeDot} />
          <Text style={styles.adDetailModeText}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
        </View>
        {/* Time pill overlay */}
        <View style={[styles.adDetailTimePill, {
          backgroundColor: expired ? 'rgba(239,68,68,0.92)' : 'rgba(255,149,0,0.92)',
        }]}>
          <FontAwesome6 name={expired ? 'triangle-exclamation' : 'clock'} size={10} color="#FFF" />
          <Text style={styles.adDetailTimePillText}>
            {' '}{expired ? t('profile.expired') : t('profile.hoursLeft', { diff: hoursLeft })}
          </Text>
        </View>
      </View>

      {/* ── Location pill ── */}
      {!!locLabel && (
        <View style={styles.adDetailLocRow}>
          <View style={[styles.adDetailLocPill, { borderColor: accent, backgroundColor: accentGlow }]}>
            <FontAwesome6 name={isLocal ? 'location-dot' : 'route'} size={12} color={accent} />
            <Text style={[styles.adDetailLocText, { color: accent }]}> {locLabel}</Text>
          </View>
        </View>
      )}

      {/* ── Description card ── */}
      {!!ad.description && (
        <View style={styles.adDetailCard}>
          <Text style={styles.adDetailCardLabel}>Description</Text>
          <Text style={styles.adDetailDesc}>{ad.description}</Text>
        </View>
      )}

      {/* ── Stats card ── */}
      <View style={[styles.adDetailCard, { flexDirection: 'row', padding: 0, overflow: 'hidden' }]}>
        {[
          { icon: 'eye',         count: ad.vues ?? 0,                          label: t('profile.views') },
          { icon: 'heart',       count: ad.nbLikes ?? ad.likes?.length ?? 0,   label: t('profile.contacts') },
          { icon: 'qrcode',      count: ad.nbScans ?? 0,                       label: t('profile.scans') },
        ].map((s, i) => (
          <View key={i} style={[styles.adDetailStatCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.outline }]}>
            <FontAwesome6 name={s.icon} size={18} color={accent} />
            <Text style={[styles.adDetailStatCount, { color: accent }]}>{s.count}</Text>
            <Text style={styles.adDetailStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Solde renouvellement ── */}
      <View style={styles.adDetailSoldeCard}>
        <Text style={styles.adDetailSoldeTitle}>Coût du renouvellement</Text>
        <View style={styles.adDetailSoldeRow}>
          <View style={styles.adDetailSoldeItem}>
            <FontAwesome6 name="newspaper" size={14} color={C.green} />
            <Text style={[styles.adDetailSoldeVal, { color: freePosts === 0 ? C.red : C.green }]}>{freePosts}</Text>
            <Text style={styles.adDetailSoldeLabel}>posts gratuits</Text>
          </View>
          <View style={styles.adDetailSoldeDivider} />
          <View style={styles.adDetailSoldeItem}>
            <FontAwesome6 name="coins" size={14} color="#F59E0B" />
            <Text style={[styles.adDetailSoldeVal, { color: points <= 10 ? C.red : '#F59E0B' }]}>{points}</Text>
            <Text style={styles.adDetailSoldeLabel}>points</Text>
          </View>
          <View style={styles.adDetailSoldeDivider} />
          <View style={styles.adDetailSoldeHintBox}>
            <Text style={styles.adDetailSoldeHint}>1 post gratuit</Text>
            <Text style={styles.adDetailSoldeHintOr}>ou</Text>
            <Text style={styles.adDetailSoldeHint}>10 pts</Text>
          </View>
        </View>
      </View>

      {/* ── Actions ── */}
      <TouchableOpacity
        style={[styles.adDetailRenewBtn, { backgroundColor: accent }, renewing && { opacity: 0.7 }]}
        onPress={onRenew}
        activeOpacity={0.85}
        disabled={renewing}
      >
        {renewing
          ? <ActivityIndicator color="#FFFFFF" />
          : <>
              <FontAwesome6 name="rotate" size={16} color="#FFF" />
              <Text style={styles.adDetailRenewBtnText}>{t('profile.renew24')}</Text>
            </>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.adDetailDeleteBtn} onPress={onDelete} activeOpacity={0.85}>
        <FontAwesome6 name="trash" size={14} color={C.red} />
        <Text style={styles.adDetailDeleteBtnText}>{t('profile.deleteAd')}</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── VIEW 603 — Renewed ─────────────────────────────────────────────────────────
function RenewedView({ onBackToAds, renewResult }) {
  const { t } = useTranslation();
  const usedFree  = renewResult?.usedFreePost ?? false;
  const freePosts = renewResult?.freePostsRemaining ?? 0;
  const points    = renewResult?.pointsSolde ?? 0;
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.checkCircle}>
        <FontAwesome6 name="check" size={32} color={C.green} />
      </View>
      <Text style={styles.updatedTitle}>{t('profile.renewed')}</Text>
      <Text style={styles.renewedSub}>
        {usedFree
          ? `1 post gratuit utilisé · il vous reste ${freePosts} post${freePosts !== 1 ? 's' : ''} gratuit${freePosts !== 1 ? 's' : ''}`
          : `10 points déduits · il vous reste ${points} pt${points !== 1 ? 's' : ''}`}
      </Text>
      {/* ── Soldes mis à jour ── */}
      <View style={[styles.renewSoldeBanner, { marginTop: 20, width: '85%' }]}>
        <View style={styles.renewSoldeItem}>
          <FontAwesome6 name="newspaper" size={13} color={C.green} />
          <Text style={[styles.renewSoldeVal, { color: freePosts === 0 ? C.red : C.green }]}>{freePosts}</Text>
          <Text style={styles.renewSoldeLabel}>posts gratuits</Text>
        </View>
        <View style={styles.renewSoldeSep} />
        <View style={styles.renewSoldeItem}>
          <FontAwesome6 name="coins" size={13} color="#F59E0B" />
          <Text style={[styles.renewSoldeVal, { color: points <= 10 ? C.red : '#F59E0B' }]}>{points}</Text>
          <Text style={styles.renewSoldeLabel}>points</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24, width: '80%' }]} onPress={onBackToAds} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{t('profile.backToAds')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── VIEW 604 — Delete Confirm ──────────────────────────────────────────────────
function DeleteAdView({ onCancel, onConfirmDelete, deleting }) {
  const { t } = useTranslation();
  return (
    <View style={styles.updatedCenter}>
      <View style={styles.deleteCircle}>
        <FontAwesome6 name="triangle-exclamation" size={32} color={C.red} />
      </View>
      <Text style={styles.updatedTitle}>{t('profile.deleteAdConfirm')}</Text>
      <Text style={styles.deleteSub}>{t('profile.deleteAdSub')}{'\n'}{t('profile.deleteAdFinal')}</Text>
      <View style={styles.deleteActionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>{t('common.cancel').toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onConfirmDelete} activeOpacity={0.85} disabled={deleting}>
          {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmDeleteBtnText}>{t('common.delete').toUpperCase()}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── VIEW 905 — Acheter des points ──────────────────────────────────────────────
const BUY_PACKAGES = [
  { pts: 10,  prix: 1  },
  { pts: 50,  prix: 5  },
  { pts: 100, prix: 10 },
  { pts: 200, prix: 20 },
];

function BuyPointsView({ user, onSuccess }) {
  const [selected, setSelected] = useState(null);
  const [buying,   setBuying]   = useState(false);
  const solde = typeof user?.pointsSolde === 'number' ? user.pointsSolde : 100;

  const handleBuy = async () => {
    if (!selected) return;
    setBuying(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/users/me/points/buy`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ quantite: selected.pts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      Alert.alert(
        'Succès',
        `${selected.pts} points ajoutés !\nNouveau solde : ${data.pointsSolde} pts`,
        [{ text: 'OK', onPress: () => onSuccess(data.user) }]
      );
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Erreur réseau');
    } finally {
      setBuying(false);
    }
  };

  return (
    <ScrollView style={Platform.OS === 'web' ? StyleSheet.absoluteFillObject : { flex: 1 }} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pointsIconCircle}>
        <FontAwesome6 name="coins" size={36} color="#F59E0B" />
      </View>
      <Text style={styles.buyTitle}>Acheter des points</Text>
      <Text style={styles.buySub}>
        Solde actuel : <Text style={{ color: '#F59E0B', fontWeight: '800' }}>{solde} pts</Text>
      </Text>
      <Text style={[styles.buySub, { marginTop: 4 }]}>10 points = 1 dinar</Text>

      <View style={{ width: '100%', gap: 12, marginTop: 24, marginBottom: 32 }}>
        {BUY_PACKAGES.map(pkg => (
          <TouchableOpacity
            key={pkg.pts}
            style={[styles.pkgCard, selected?.pts === pkg.pts && styles.pkgCardSelected]}
            onPress={() => setSelected(pkg)}
            activeOpacity={0.85}
          >
            <View style={styles.pkgLeft}>
              <FontAwesome6 name="coins" size={18} color={selected?.pts === pkg.pts ? '#FFFFFF' : '#F59E0B'} />
              <Text style={[styles.pkgPts, selected?.pts === pkg.pts && { color: '#FFFFFF' }]}>
                {pkg.pts} points
              </Text>
            </View>
            <Text style={[styles.pkgPrix, selected?.pts === pkg.pts && { color: '#FFFFFF' }]}>
              {pkg.prix} TND
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: '#F59E0B' }, (!selected || buying) && { opacity: 0.6 }]}
        onPress={handleBuy}
        activeOpacity={0.85}
        disabled={!selected || buying}
      >
        {buying
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.primaryBtnText}>
              {selected
                ? `Acheter ${selected.pts} pts — ${selected.prix} TND`
                : 'Sélectionnez un forfait'}
            </Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Utilitaires ────────────────────────────────────────────────────────────────
function MenuRow({ icon, label, onPress, danger, color }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const iconColor = danger ? C.red : (color ?? colors.onSurfaceVariant);
  const boxBg = danger ? 'rgba(239,68,68,0.10)' : (color ? `${color}1F` : colors.surfaceVariant);
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuRowLeft}>
        <View style={[styles.menuRowIconBox, { backgroundColor: boxBg }]}>
          <FontAwesome6 name={icon} size={15} color={iconColor} />
        </View>
        <Text style={[styles.menuRowLabel, danger && { color: C.red }]}>{label}</Text>
      </View>
      <FontAwesome6 name="chevron-right" size={13} color={danger ? C.red : colors.onSurfaceVariant} />
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TextInput
      style={styles.textField} value={value} onChangeText={onChangeText}
      placeholder={placeholder || label} placeholderTextColor={colors.onSurfaceVariant}
      keyboardType={keyboardType || 'default'} autoCapitalize="none"
    />
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();
  const { t }      = useTranslation();
  const [view,       setView]       = useState('main');
  const [currentUser,setCurrentUser]= useState(null);
  const [loading,    setLoading]    = useState(true);
  const [myAds,      setMyAds]      = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [renewing,    setRenewing]    = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [renewResult, setRenewResult] = useState(null);

  const fetchMyAds = async () => {
    setAdsLoading(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/users/me/ads?_t=${Date.now()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data  = await res.json();
      const ads   = data.publications ?? data;
      setMyAds(Array.isArray(ads) ? ads : []);
    } catch { setMyAds([]); }
    finally { setAdsLoading(false); }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    const fetchUser = async () => {
      try {
        const token = await getAccessToken();
        const res   = await fetch(`${API_URL}/users/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setCurrentUser({ ...u, avatar: u.avatarUrl });
          await AsyncStorage.setItem('currentUser', JSON.stringify(u));
        } else {
          const cached = await getCurrentUser();
          setCurrentUser(cached);
        }
      } catch {
        const cached = await getCurrentUser();
        setCurrentUser(cached);
      }
    };
    Promise.all([fetchUser(), fetchMyAds()]).finally(() => setLoading(false));
  }, []));

  const goToMyAds = () => { fetchMyAds(); setView('myads'); };

  const handleRenew = async (ad) => {
    const target = ad || selectedAd;
    if (!target) return;
    setRenewing(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/publications/${target._id}/renew`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Solde insuffisant', data.message || t('profile.renewError'));
        return;
      }
      // Mettre à jour le solde affiché localement
      setRenewResult(data);
      setCurrentUser(prev => prev ? {
        ...prev,
        pointsSolde:        data.pointsSolde,
        freePostsRemaining: data.freePostsRemaining,
      } : prev);
      await AsyncStorage.setItem('currentUser', JSON.stringify({
        ...currentUser,
        pointsSolde:        data.pointsSolde,
        freePostsRemaining: data.freePostsRemaining,
      }));
      setView('renewed');
    } catch { Alert.alert(t('common.error'), t('profile.renewError')); }
    finally { setRenewing(false); }
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedAd) return; setDeleting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/publications/${selectedAd._id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `${t('common.error')} ${res.status}`); }
      setSelectedAd(null); setView('myads'); await fetchMyAds();
    } catch (err) { Alert.alert(t('common.error'), err.message || t('profile.deleteError')); }
    finally { setDeleting(false); }
  };

  const handleBuyPointsSuccess = async (updatedUser) => {
    setCurrentUser({ ...updatedUser, avatar: updatedUser.avatarUrl });
    await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
    setView('main');
  };

  const handleLogOut = async () => {
    Alert.alert(t('common.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.logout'), style: 'destructive', onPress: async () => { await apiLogout(); navigation.navigate('Login'); } },
    ]);
  };

  const localCount = myAds.filter(a => a.mode === 'local').length;
  const duoCount   = myAds.filter(a => a.mode === 'duo').length;

  const TITLES = {
    main:          t('common.profile'),
    edit:          t('profile.editProfile'),
    settings:      t('profile.settings'),
    changepassword:t('profile.changePasswordTitle'),
    updated:       t('common.profile'),
    myads:         t('profile.myAds'),
    addetail:      t('profile.adDetailTitle'),
    renewed:       t('profile.renewed'),
    deleteconfirm: t('common.delete'),
    buypoints:     'Acheter des points',
  };

  const handleBack = () => {
    if (view === 'edit' || view === 'settings' || view === 'myads' || view === 'buypoints') setView('main');
    else if (view === 'changepassword') setView('settings');
    else if (view === 'addetail') setView('myads');
    else if (view === 'renewed') setView('myads');
    else if (view === 'deleteconfirm') setView('addetail');
    else navigation.goBack();
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.green} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <LinearGradient colors={['#0a1628', '#0f2848']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{TITLES[view]}</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        {view === 'main'          && <ProfileMain user={currentUser} localCount={localCount} duoCount={duoCount} onEditProfile={() => setView('edit')} onSettings={() => setView('settings')} onMyAds={goToMyAds} onHelpSupport={() => {}} onLogOut={handleLogOut} onBuyPoints={() => setView('buypoints')} />}
        {view === 'buypoints'     && <BuyPointsView user={currentUser} onSuccess={handleBuyPointsSuccess} />}
        {view === 'edit'          && <EditProfileView user={currentUser} onSave={() => getCurrentUser().then(u => { setCurrentUser(u); setView('updated'); })} />}
        {view === 'settings'      && <SettingsView onChangePassword={() => setView('changepassword')} />}
        {view === 'changepassword'&& <ChangePasswordView onSuccess={() => setView('settings')} />}
        {view === 'updated'       && <ProfileUpdatedView user={currentUser} onBackToProfile={() => setView('main')} />}
        {view === 'myads'         && <MyAdsView ads={myAds} loading={adsLoading} renewing={renewing} user={currentUser} onSelectAd={(ad) => { setSelectedAd(ad); setView('addetail'); }} onRenew={(ad) => { setSelectedAd(ad); handleRenew(ad); }} onDelete={(ad) => { setSelectedAd(ad); setView('deleteconfirm'); }} />}
        {view === 'addetail' && selectedAd && <AdDetailView ad={selectedAd} renewing={renewing} onRenew={handleRenew} onDelete={() => setView('deleteconfirm')} user={currentUser} />}
        {view === 'renewed'       && <RenewedView renewResult={renewResult} onBackToAds={() => { fetchMyAds(); setView('myads'); }} />}
        {view === 'deleteconfirm' && <DeleteAdView deleting={deleting} onCancel={() => setView('addetail')} onConfirmDelete={handleDeleteConfirmed} />}

        {/* ── Bottom Tab Bar ── */}
        <BottomTabBar activeTab="profile" navigation={navigation} isAuthenticated={!!currentUser} />
      </SafeAreaView>
    </View>
  );
}

// ── Styles — thème clair mint ──────────────────────────────────────────────────
const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },

  // Hero section
  profileHero: { alignItems: 'center', paddingTop: 24, paddingBottom: 28, paddingHorizontal: 16, gap: 4 },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  profileName:  { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 16 },
  heroStatsRow:    { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 4 },
  heroStat:        { alignItems: 'center', gap: 2 },
  heroStatNum:     { fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 },
  heroStatLabel:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Content area below hero
  profileContent: { paddingHorizontal: 16, paddingTop: 16, alignItems: 'center', gap: 12 },

  // Legacy (used by other views that still need it)
  pageContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 120, alignItems: 'center' },

  // Active Ads Box
  activeAdsBox: {
    width: '100%', borderRadius: 18, padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  activeAdsTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 12, letterSpacing: 0.3 },
  activeAdsRow:   { flexDirection: 'row', gap: 12 },
  activeAdsCard:  {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, borderWidth: 2,
    backgroundColor: colors.surfaceVariant,
  },
  activeAdsCount: { fontSize: 28, fontWeight: '900' },
  activeAdsLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, marginTop: 2, letterSpacing: 0.5 },

  // View My Ads Button
  viewMyAdsBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 16,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  viewMyAdsBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Menu list
  menuList: { width: '100%', gap: 8 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuRowLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRowIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
  menuRowLabel:   { fontSize: 15, fontWeight: '600', color: colors.onSurface },

  // Field list
  fieldList: { width: '100%', gap: 12, marginBottom: 28 },
  textField: {
    width: '100%', backgroundColor: colors.surfaceVariant,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.outline,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: colors.onSurface,
  },

  // Change photo button
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surfaceVariant, borderRadius: 10,
    borderWidth: 1, borderColor: colors.outline,
    paddingHorizontal: 20, paddingVertical: 9, marginBottom: 24,
  },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: '#2DBD7E' },

  // Primary button
  primaryBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Section label
  sectionLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 8, letterSpacing: 0.4 },

  // Settings
  settingsGroup: {
    width: '100%', borderRadius: 14, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingsRowLabel: { fontSize: 15, color: colors.onSurface, fontWeight: '500' },
  settingsRowValue: { fontSize: 14, color: colors.onSurfaceVariant },
  settingsRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Password change view
  pwdIconWrap: { marginBottom: 12, alignItems: 'center' },
  pwdIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(45,189,126,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  pwdTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface, marginBottom: 6 },
  pwdSub:   { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 4 },
  pwdFieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceVariant, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.outline, paddingHorizontal: 14,
  },
  pwdField: { flex: 1, fontSize: 14, color: colors.onSurface, paddingVertical: 14 },
  pwdEye:   { padding: 8 },

  // Updated center
  updatedCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#2DBD7E',
    backgroundColor: 'rgba(45,189,126,0.10)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  updatedTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface },

  // My Ads list
  adsList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120, gap: 16 },
  adsListHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  adsListTitle:  { fontSize: 18, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.3 },
  adsListCount:  { backgroundColor: '#2DBD7E', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  adsListCountText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle:{ fontSize: 16, fontWeight: '700', color: colors.onSurfaceVariant },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant },

  // Ad card
  adCard: {
    backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  adCardCover:            { height: 160, width: '100%' },
  adCardCoverImg:         { width: '100%', height: '100%' },
  adCardCoverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  adModeBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  adModeDot:  { width: 6, height: 6, borderRadius: 3 },
  adModeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  adTimeBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4,
  },
  adTimeBadgeText: { fontSize: 11, fontWeight: '700' },
  adCardBody:    { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 6 },
  adCardDesc:    { fontSize: 14, color: colors.onSurface, fontWeight: '600', lineHeight: 20 },
  adCardLocRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  adCardLoc:     { fontSize: 12, color: colors.onSurfaceVariant, flex: 1 },
  adCardDivider: { height: 1, backgroundColor: colors.outline, marginHorizontal: 16 },
  adCardActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  adRenewBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, paddingVertical: 10,
    backgroundColor: 'rgba(59,126,246,0.08)', borderWidth: 1.5, borderColor: '#3B7EF6',
  },
  adRenewBtnText: { fontSize: 13, color: '#3B7EF6', fontWeight: '700' },
  adQrBtn: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(45,189,126,0.08)', borderWidth: 1.5, borderColor: '#2DBD7E',
  },
  adDeleteBtn: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1.5, borderColor: '#EF4444',
  },

  // QR modal
  qrHidden: { position: 'absolute', left: -2000, top: 0 },

  // Carte A4 hors-écran
  qrA4Card: {
    width: 300,
    backgroundColor: colors.surface,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  qrA4Header: { alignItems: 'center', marginBottom: 4 },
  qrA4Logo:   { width: 64, height: 64, marginBottom: 6 },
  qrA4Brand:  { fontSize: 24, fontWeight: '900', color: '#2DBD7E', letterSpacing: 5 },
  qrA4Sep:    { width: '70%', height: 1.5, backgroundColor: '#2DBD7E', marginVertical: 18 },
  qrA4Name:   { fontSize: 20, fontWeight: '800', color: colors.onSurface, textAlign: 'center', marginBottom: 18 },
  qrA4QrWrap: {
    padding: 14, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  qrA4Welcome: { fontSize: 15, color: colors.onSurfaceVariant, textAlign: 'center', fontStyle: 'italic' },
  qrOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  qrCard: {
    width: 280, backgroundColor: colors.surface, borderRadius: 24,
    padding: 24, alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  qrAdTitle: {
    fontSize: 14, fontWeight: '700', color: colors.onSurface,
    textAlign: 'center', lineHeight: 20,
  },
  qrCodeWrap: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.outline,
  },
  qrShareBtn: {
    width: '100%', borderRadius: 16, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38, shadowRadius: 14, elevation: 10,
  },
  qrShareBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },
  qrCloseBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', backgroundColor: colors.surfaceVariant,
    borderWidth: 1, borderColor: colors.outline,
  },
  qrCloseBtnText: { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 14 },
  adCardImage:            { width: 90, height: 90 },
  adCardImagePlaceholder: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },

  // Ad detail
  adDetailContent: { paddingBottom: 120, paddingTop: 0 },

  // Hero section
  adDetailHero: { position: 'relative', width: '100%' },
  adDetailImage: { width: '100%', height: 220 },
  adDetailImagePlaceholder: {
    width: '100%', height: 200,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  adDetailModePill: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  adDetailModeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF',
  },
  adDetailModeText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.8 },
  adDetailTimePill: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  adDetailTimePillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  // Location row
  adDetailLocRow: { paddingHorizontal: 16, paddingTop: 14 },
  adDetailLocPill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  adDetailLocText: { fontSize: 13, fontWeight: '700' },

  // Content card
  adDetailCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.outline,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  adDetailCardLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  adDetailDesc: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 21 },

  // Stats cells inside adDetailCard
  adDetailStatCell: {
    flex: 1, alignItems: 'center', paddingVertical: 16, gap: 5,
  },
  adDetailStatCount: { fontSize: 24, fontWeight: '900' },
  adDetailStatLabel: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600' },

  // Solde renewal card
  adDetailSoldeCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.outline,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  adDetailSoldeTitle: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 },
  adDetailSoldeRow: { flexDirection: 'row', alignItems: 'center' },
  adDetailSoldeItem: { flex: 1, alignItems: 'center', gap: 3 },
  adDetailSoldeVal: { fontSize: 20, fontWeight: '900' },
  adDetailSoldeLabel: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant },
  adDetailSoldeDivider: { width: 1, height: 36, backgroundColor: colors.outline },
  adDetailSoldeHintBox: { flex: 1, alignItems: 'center', gap: 1 },
  adDetailSoldeHint: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  adDetailSoldeHintOr: { fontSize: 10, color: colors.onSurfaceVariant },

  // Renew & delete buttons
  adDetailRenewBtn: {
    marginHorizontal: 16, marginTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  adDetailRenewBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  adDetailDeleteBtn: {
    marginHorizontal: 16, marginTop: 10, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#EF4444', paddingVertical: 14,
  },
  adDetailDeleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },

  // Legacy (still used by statsRow/statCard in MyAdsView header)
  statsTitle:      { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  statsRow:        { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  statCard: {
    flex: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 14,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statCount: { fontSize: 26, fontWeight: '900', color: colors.onSurface },
  statLabel: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2 },
  deleteAdBtn:     { marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 2, borderColor: '#EF4444', paddingVertical: 15, alignItems: 'center' },
  deleteAdBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  renewedSub: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },

  // Bandeau solde renouvellement
  renewSoldeBanner: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    backgroundColor: colors.surfaceVariant, borderRadius: 14,
    borderWidth: 1, borderColor: colors.outline,
    paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 16, marginBottom: 8, gap: 6,
  },
  renewSoldeItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  renewSoldeVal:   { fontSize: 16, fontWeight: '900' },
  renewSoldeLabel: { fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' },
  renewSoldeSep:   { width: 1, height: 18, backgroundColor: colors.outline, marginHorizontal: 4 },
  renewSoldeHint:  { fontSize: 11, color: colors.onSurfaceVariant, fontStyle: 'italic', flexShrink: 1 },
  deleteCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 3, borderColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  deleteSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  deleteActionsRow:    { flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' },
  cancelBtn:           { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: colors.outline, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.surfaceVariant },
  cancelBtnText:       { color: colors.onSurfaceVariant, fontWeight: '700', fontSize: 14 },
  confirmDeleteBtn:    { flex: 1, borderRadius: 14, backgroundColor: '#EF4444', paddingVertical: 15, alignItems: 'center' },
  confirmDeleteBtnText:{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // Language modal
  langModal:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  langModalPanel: {
    width: '80%', backgroundColor: colors.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  langModalTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface, marginBottom: 14, textAlign: 'center' },
  langOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
    backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.outline,
  },
  langOptionActive:  { backgroundColor: '#2DBD7E', borderColor: '#2DBD7E' },
  langOptionText:    { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  langCancelBtn:     { alignItems: 'center', marginTop: 8, paddingVertical: 10 },
  langCancelText:    { fontSize: 14, color: colors.onSurfaceVariant, fontWeight: '600' },

  // Soldes : deux cartes côte à côte (vue 900)
  soldesRow: {
    flexDirection: 'row', gap: 10, width: '100%',
  },
  soldeCard: {
    flex: 1, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 16,
    alignItems: 'flex-start', gap: 2,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  soldeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  soldeCardLabel: { fontSize: 12, fontWeight: '700' },
  soldeCardValue: { fontSize: 30, fontWeight: '900', lineHeight: 34, color: '#FFFFFF' },
  soldeCardSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  buyPointsBtn:    { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  buyPointsBtnText:{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  // Buy points view (vue 905)
  pointsIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  buyTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface, marginBottom: 6 },
  buySub:   { fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },
  pkgCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1.5, borderColor: '#F59E0B',
    paddingHorizontal: 18, paddingVertical: 16,
  },
  pkgCardSelected: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  pkgLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pkgPts:  { fontSize: 15, fontWeight: '800', color: '#92400E' },
  pkgPrix: { fontSize: 15, fontWeight: '700', color: '#92400E' },

});
