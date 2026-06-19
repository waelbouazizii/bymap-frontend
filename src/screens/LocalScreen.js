// src/screens/LocalScreen.js
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUser, logout as apiLogout, checkFavorite, toggleFavorite } from '../utils/api';
import { getAccessToken } from '../security/secureStorage';
import { getActiveServerUrl } from '../utils/serverBalancer';
import TUNISIA from '../../assets/tunisia.json';
import { useTranslation } from 'react-i18next';
import BottomTabBar from '../components/BottomTabBar';
import { PubCardSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { R, SP, T, HIT } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';
import { environment } from '../environments/environment';
const API_URL = environment.apiUrl;
const SERVER_BASE = API_URL.replace('/api', '');
const { width } = Dimensions.get('window');

// Module-level cache so /zones is only fetched once per app session.
let _zonesCache = null;
async function fetchZonesCache() {
  if (_zonesCache) return _zonesCache;
  try {
    const res  = await fetch(`${API_URL}/zones`);
    const data = await res.json();
    _zonesCache = Array.isArray(data) ? data : (data.zones || []);
  } catch { _zonesCache = []; }
  return _zonesCache;
}

// Resolves a zone/delegation name to its parent gouvernorat.
// Checks the backend /zones API first (custom zones like "Lessouda"),
// then falls back to Tunisia.json (standard administrative delegations).
async function resolveZoneParent(name) {
  if (!name) return null;
  const n = name.toLowerCase();

  // 1. Backend zones API — handles admin-created zones
  const zones = await fetchZonesCache();
  const apiMatch = zones.find(z => z.name && z.name.toLowerCase() === n);
  if (apiMatch?.gouvernorat) return apiMatch.gouvernorat;

  // 2. Tunisia.json — handles standard delegations (e.g. "Ariana Ville")
  for (const [gov, rows] of Object.entries(TUNISIA)) {
    if (gov.toLowerCase() === n) return null; // it IS a governorate, no parent
    const delegs = new Set(rows.map(r => r.delegation?.toLowerCase()));
    if (delegs.has(n)) return gov;
  }
  return null;
}

const fixMediaUrl = (url) => {
  if (!url) return null;
  // Backend stores raw http://IP:PORT/uploads/... URLs (its own internal address).
  // Convert http://IP:PORT/path → https://IP.nip.io/path so React Native can load it:
  //  - nip.io DNS resolves IP.nip.io to IP (free, wildcard DNS service)
  //  - HTTPS avoids Android cleartext-traffic block
  //  - Points directly to the server that actually holds the file
  const ipMatch = url.match(/^https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/);
  if (ipMatch) return `https://${ipMatch[1]}.nip.io${ipMatch[3] || '/'}`;
  // Domain-based absolute URL — normalise host to the currently-active proxy server
  const base = getActiveServerUrl().replace('/api', '');
  if (/^https?:\/\//.test(url)) return url.replace(/^https?:\/\/[^/]+/, base);
  return base + (url.startsWith('/') ? url : '/' + url);
};

// Extract display URL from a media item — handles strings and objects with various backend field names
const getMediaUri = (m) => {
  if (!m) return null;
  const raw = (typeof m === 'string') ? m : (m.url || m.path || m.uri || m.src || m.filename || null);
  return fixMediaUrl(raw);
};

// True when media item represents an image — handles MIME types, category names, and URL extension fallback
const isImageMedia = (m) => {
  if (!m) return false;
  if (typeof m === 'string') return /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?.*)?$/i.test(m);
  const t = (m.type || m.mimetype || m.mimeType || m.contentType || '').toLowerCase();
  if (t === 'image' || t.startsWith('image/')) return true;
  const url = m.url || m.path || m.uri || m.src || m.filename || '';
  return /\.(jpe?g|png|gif|webp|bmp|heic|avif)(\?.*)?$/i.test(url);
};

// Temps relatif : "2min", "3h", "1j"
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
};

// ── Static brand colors (not theme-sensitive)
const BRAND = {
  local:     '#2DBD7E',
  localGlow: 'rgba(45,189,126,0.12)',
  duo:       '#3B7EF6',
  duoGlow:   'rgba(59,126,246,0.12)',
};

// ── Menu items ────────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { key: 'home',      tKey: 'common.home',        icon: 'house' },
  { key: 'map',       tKey: 'profile.tabMap',     icon: 'map' },
  { key: 'favorites', tKey: 'map.myFavorites',    icon: 'heart' },
  { key: 'myads',     tKey: 'profile.myAds',      icon: 'clipboard-list' },
  { key: 'settings',  tKey: 'profile.settings',   icon: 'gear' },
  { key: 'help',      tKey: 'profile.helpSupport', icon: 'circle-question' },
  { key: 'logout',    tKey: 'profile.logout',     icon: 'right-from-bracket', danger: true },
];

// ── Bottom Tab Bar items ───────────────────────────────────────────────────────
const TAB_ITEMS = [
  { key: 'globe',    tKey: 'common.globe',    icon: 'globe',   authRequired: false },
  { key: 'messages', tKey: 'common.messages', icon: 'message', authRequired: true  },
  { key: 'profile',  tKey: 'common.profile',  icon: 'user',    authRequired: true  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PubCard styles (separate so PubCard can call useTheme itself)
// ─────────────────────────────────────────────────────────────────────────────
const makeCardStyles = (colors, isDark) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: R.xl,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.28 : 0.13,
    shadowRadius: 16,
    elevation: 8,
  },
  heroWrap: { height: 190, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroBadge: { position: 'absolute', top: 10, left: 10 },
  imageLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    paddingHorizontal: SP.base, paddingTop: SP.md, paddingBottom: SP.sm,
  },
  cardAvatar: {
    width: 42, height: 42, borderRadius: R.full,
    justifyContent: 'center', alignItems: 'center',
  },
  cardAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  cardAuthorName: { ...T.titleMd, color: colors.onSurface },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cardLocation: { ...T.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  cardTime: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  modeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.full },
  modeBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  cardDesc: {
    ...T.bodyMd, color: colors.onSurfaceVariant,
    paddingHorizontal: SP.base, paddingBottom: SP.sm,
  },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    gap: SP.md, paddingHorizontal: SP.base, paddingVertical: SP.md,
    backgroundColor: colors.surfaceVariant,
  },
  cardMetaStat: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  cardMetaText: { ...T.bodyMd, color: colors.onSurfaceVariant },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SP.md, paddingVertical: 8, borderRadius: R.lg,
  },
  contactBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Composant PubCard — carte LOCAL (vert) ou DUO (bleu)
// ─────────────────────────────────────────────────────────────────────────────
const PubCard = ({ item, onPress, onContact, currentUser }) => {
  const { colors, isDark } = useTheme();
  const cardStyles = useMemo(() => makeCardStyles(colors, isDark), [colors, isDark]);
  const { t }      = useTranslation();
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

  const [imgError,    setImgError]    = useState(false);
  const [imgLoading,  setImgLoading]  = useState(true);
  const [liked,       setLiked]       = useState(false);
  const [nbLikes,     setNbLikes]     = useState(item.nbLikes ?? item.likes?.length ?? 0);
  const [vues,        setVues]        = useState(item.vues ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const handleLike = async () => {
    if (likeLoading) return;
    if (!currentUser) { onContact(); return; }
    setLikeLoading(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/publications/${item._id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setNbLikes(data.nbLikes);
        Animated.sequence([
          Animated.spring(heartScale, { toValue: 1.5, useNativeDriver: true, tension: 300, friction: 4 }),
          Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 6 }),
        ]).start();
      }
    } catch {}
    setLikeLoading(false);
  };

  const handleCardPress = () => { setVues(v => v + 1); onPress(); };

  const isLocal     = item.mode === 'local';
  const accent      = isLocal ? BRAND.local : BRAND.duo;
  const accentEnd   = isLocal ? '#1AA368' : '#1A6CE8';
  const gradColors  = [accent, accentEnd];

  const authorName    = [item.auteur?.prenom, item.auteur?.nom].filter(Boolean).join(' ') || 'Anonyme';
  const authorInitial = authorName[0]?.toUpperCase() || '?';
  const locLine = isLocal
    ? [item.localisation?.ville, item.localisation?.gouvernorat].filter(Boolean).join(' · ')
    : [item.localisationDebut?.ville, '→', item.localisationFin?.ville].filter(Boolean).join(' ');

  const firstImage = item.medias?.find(isImageMedia);
  const imageUri   = getMediaUri(firstImage);
  const hasImage   = !!imageUri && !imgError;

  return (
    <Animated.View style={[cardStyles.card, { shadowColor: accent, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity activeOpacity={1} onPress={handleCardPress} onPressIn={onPressIn} onPressOut={onPressOut}>

        {/* ── Hero image (top of card) ── */}
        {hasImage ? (
          <View style={cardStyles.heroWrap}>
            <Image
              source={{ uri: imageUri }}
              style={cardStyles.heroImage}
              resizeMode="cover"
              onLoadStart={() => setImgLoading(true)}
              onLoadEnd={() => setImgLoading(false)}
              onError={() => { console.warn('[ByMap] Image failed to load:', imageUri); setImgError(true); setImgLoading(false); }}
            />
            {imgLoading && <View style={cardStyles.imageLoader}><ActivityIndicator size="small" color={accent} /></View>}
            <View style={cardStyles.heroBadge}>
              <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cardStyles.modeBadge}>
                <Text style={cardStyles.modeBadgeText}>{isLocal ? t('common.local') : t('common.duo')}</Text>
              </LinearGradient>
            </View>
          </View>
        ) : null}

        {/* ── Header : avatar + nom + meta ── */}
        <View style={cardStyles.cardHeader}>
          <LinearGradient colors={isLocal ? [BRAND.local, '#1AA368'] : [BRAND.duo, '#1A6CE8']} style={cardStyles.cardAvatar}>
            <Text style={cardStyles.cardAvatarText}>{authorInitial}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.cardAuthorName} numberOfLines={1}>{authorName}</Text>
            <View style={cardStyles.cardMetaRow}>
              {locLine ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                  <FontAwesome6 name="location-dot" size={11} color={colors.onSurfaceVariant} />
                  <Text style={cardStyles.cardLocation} numberOfLines={1}>{locLine}</Text>
                </View>
              ) : null}
              <Text style={cardStyles.cardTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
          {/* Mode badge only when there's no hero image */}
          {!hasImage ? (
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cardStyles.modeBadge}>
              <Text style={cardStyles.modeBadgeText}>{isLocal ? t('common.local') : t('common.duo')}</Text>
            </LinearGradient>
          ) : null}
        </View>

        {/* ── Description ── */}
        {item.description ? (
          <Text style={cardStyles.cardDesc} numberOfLines={3}>{item.description}</Text>
        ) : null}

        {/* ── Footer : likes + vues + contact ── */}
        <View style={cardStyles.cardFooter}>

          <TouchableOpacity
            style={cardStyles.cardMetaStat}
            onPress={handleLike}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <FontAwesome6 name="heart" size={20} color={liked ? '#EF4444' : colors.onSurfaceVariant} solid={liked} />
            </Animated.View>
            <Text style={[cardStyles.cardMetaText, liked && { color: '#EF4444', fontWeight: '700' }]}>{nbLikes}</Text>
          </TouchableOpacity>

          <View style={cardStyles.cardMetaStat}>
            <FontAwesome6 name="eye" size={18} color={colors.onSurfaceVariant} />
            <Text style={cardStyles.cardMetaText}>{vues}</Text>
          </View>

          {item.medias?.length > 1 && (
            <View style={cardStyles.cardMetaStat}>
              <FontAwesome6 name="images" size={16} color={colors.onSurfaceVariant} />
              <Text style={cardStyles.cardMetaText}>{item.medias.length}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onContact} activeOpacity={0.8}>
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cardStyles.contactBtn}>
              <FontAwesome6 name="comment" size={14} color="#FFFFFF" />
              <Text style={cardStyles.contactBtnText}>{t('local.contact')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </TouchableOpacity>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────
export default function LocalScreen() {
  const { colors, isDark } = useTheme();
  const C = useMemo(() => ({
    ...BRAND,
    navy:        colors.background,
    navyMid:     colors.surfaceVariant,
    navyLight:   '#2DBD7E',
    glass:       colors.surface,
    glassMid:    isDark ? 'rgba(45,189,126,0.08)' : '#E8F5EE',
    glassBorder: colors.outline,
    white:       colors.onSurface,
    textDim:     colors.onSurfaceVariant,
    textFaint:   colors.onSurfaceVariant,
    red:         colors.error,
  }), [colors, isDark]);
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const navigation = useNavigation();
  const route      = useRoute();
  const { t }      = useTranslation();
  const zoneName   = route.params?.zone || '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState('publications');
  const [search,      setSearch]      = useState('');
  const [publications,setPubs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [modeFilter,  setModeFilter]  = useState('all'); // 'all' | 'local' | 'duo'
  const [currentUser, setCurrentUser] = useState(null);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNewPost,  setHasNewPost]  = useState(false);
  const [isFavorite,  setIsFavorite]  = useState(false);
  const prevPubsCount = useRef(0);

  // ── Animation FAB ──────────────────────────────────────────────────────────
  const fabPulse    = useRef(new Animated.Value(1)).current;
  const fabAnim     = useRef(null);

  // ── Scanner QR ────────────────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned,     setScanned]     = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (fabAnim.current) fabAnim.current.stop();
    if (modeFilter === 'local' || modeFilter === 'duo') {
      fabAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fabPulse, { toValue: 1.18, duration: 380, useNativeDriver: true }),
          Animated.timing(fabPulse, { toValue: 1,    duration: 380, useNativeDriver: true }),
        ])
      );
      fabAnim.current.start();
    } else {
      Animated.spring(fabPulse, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => { if (fabAnim.current) fabAnim.current.stop(); };
  }, [modeFilter]);

  // ── Menu latéral ───────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim   = useRef(new Animated.Value(width * 0.72)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.spring(menuAnim,    { toValue: 0,   useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayAnim, { toValue: 1,   duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const closeMenu = () => {
    Animated.parallel([
      Animated.spring(menuAnim,    { toValue: width * 0.72, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  // ── Charger l'utilisateur connecté ────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      getCurrentUser().then(u => {
        setCurrentUser(u);
        if (u && zoneName) {
          checkFavorite(zoneName).then(setIsFavorite).catch(() => setIsFavorite(false));
        } else {
          setIsFavorite(false);
        }
      });
    }, [zoneName])
  );

  // ── Fetch publications depuis le backend ───────────────────────────────────
  const fetchPubs = useCallback(async (pageNum = 1, reset = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);

      // Resolve the zone's parent gouvernorat (e.g. "Lessouda" → "Sidi Bouzid").
      // Checks backend /zones API (custom admin zones) then Tunisia.json.
      // When a parent is found we query the broader gouvernorat and filter
      // client-side so only posts tagged to this specific zone appear.
      const parentGov  = await resolveZoneParent(zoneName);
      const queryVille = parentGov || zoneName;

      const params = new URLSearchParams({
        page:  pageNum,
        limit: 200,
        ...(modeFilter !== 'all' && { mode: modeFilter }),
        ...(queryVille           && { ville: queryVille }),
        ...(search.trim()        && { search: search.trim() }),
      });

      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/publications?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error('Erreur réseau');
      const data = await res.json();

      let incoming = data.publications ?? [];
      // Debug: log raw media structure so we can verify the backend format
      if (__DEV__ && incoming.length > 0) {
        console.log('[ByMap] pub keys:', Object.keys(incoming[0]));
        console.log('[ByMap] pub.medias:', JSON.stringify(incoming[0]?.medias?.slice(0, 2)));
      }
      // Client-side filter when we resolved a parent governorate — keeps only
      // posts whose gouvernorat, delegation, or localite matches the zone name.
      if (parentGov && zoneName) {
        const zn = zoneName.toLowerCase();
        incoming = incoming.filter(p => {
          const loc = p.localisation || {};
          return (
            (loc.gouvernorat && loc.gouvernorat.toLowerCase() === zn) ||
            (loc.delegation  && loc.delegation.toLowerCase()  === zn) ||
            (loc.localite    && loc.localite.toLowerCase()    === zn)
          );
        });
      }
      setPubs(prev => {
        const next = reset || pageNum === 1 ? incoming : [...prev, ...incoming];
        if (next.length > prevPubsCount.current) {
          setHasNewPost(true);
        }
        prevPubsCount.current = next.length;
        return next;
      });
      setHasMore(pageNum < data.pages);
      setPage(pageNum);
    } catch (err) {
      console.error('[FETCH PUBS]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [modeFilter, zoneName, search]);

  // Charger au montage et quand les filtres changent
  useEffect(() => {
    fetchPubs(1, true);
  }, [fetchPubs]);

  // Pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchPubs(1, true);
  };

  // Pagination infinie
  const onEndReached = () => {
    if (!loadingMore && hasMore) fetchPubs(page + 1);
  };

  // ── Scanner QR — ouvrir et gérer le scan ─────────────────────────────────
  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(t('common.error'), t('profile.cameraPermission'));
        return;
      }
    }
    setScanned(false);
    setScannerOpen(true);
  };

  const handleScan = async ({ data: qrData }) => {
    if (scanned) return;
    setScanned(true);
    setScannerOpen(false);
    const match = qrData.match(/publications\/([a-f0-9]{24})(?:\/scan)?/i);
    if (!match) {
      Alert.alert('QR invalide', 'Ce QR code ne correspond pas à une publication ByMap.');
      setScanned(false);
      return;
    }
    const pubId = match[1];
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/publications/${pubId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        navigation.navigate('PublicationDetail', { publication: json.publication });
      } else {
        Alert.alert(t('common.error'), 'Publication introuvable.');
      }
    } catch {
      Alert.alert(t('common.error'), t('common.networkError'));
    }
    setScanned(false);
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleMenuItem = async (key) => {
    closeMenu();
    if (key === 'map')       { navigation.navigate('Map');       return; }
    if (key === 'favorites') { navigation.navigate('Favorites'); return; }
    if (key === 'logout')    { await apiLogout(); setCurrentUser(null); return; }
  };

  const handleTab = (key) => {
    const item = TAB_ITEMS.find(t => t.key === key);
    if (item?.authRequired && !currentUser) {
      navigation.navigate('Login');
      return;
    }
    setActiveTab(key);
    if (key === 'globe')    navigation.navigate('Map');
    if (key === 'messages') navigation.navigate('ConversationsList');
    if (key === 'profile')  navigation.navigate(currentUser?.role === 'admin' ? 'AdminDashboard' : 'Profile');
  };

  const handleFabPress = () => {
    if (!currentUser) navigation.navigate('Login');
    else navigation.navigate('AjoutePub', {
      mode:     modeFilter !== 'all' ? modeFilter : undefined,
      zoneName: zoneName || undefined,
    });
  };

  // ── Compteurs local / duo ─────────────────────────────────────────────────
  const localCount = publications.filter(p => p.mode === 'local').length;
  const duoCount   = publications.filter(p => p.mode === 'duo').length;

  // ── Filtrer côté client : recherche texte ────────────────────────────────
  const filtered = publications.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.description?.toLowerCase().includes(q) ||
      p.localisation?.ville?.toLowerCase().includes(q) ||
      p.localisationDebut?.ville?.toLowerCase().includes(q) ||
      p.localisationFin?.ville?.toLowerCase().includes(q)
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safe}>

        {/* ── Header + Zone block (unified dark gradient) ── */}
        <LinearGradient colors={['#0a1628', '#0f2848']} style={styles.headerBlock}>

          {/* Search row */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Map')} activeOpacity={0.7}>
              <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.searchBox}>
              <FontAwesome6 name="magnifying-glass" size={15} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder={t('common.search')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <FontAwesome6 name="xmark" size={15} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.8}>
              <FontAwesome6 name="qrcode" size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.8}>
              <View style={styles.menuLine} />
              <View style={[styles.menuLine, { width: 14 }]} />
              <View style={styles.menuLine} />
            </TouchableOpacity>
          </View>

          {/* Zone + filters */}
          <View style={styles.zoneSection}>
            <View style={styles.zoneTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                {zoneName ? <FontAwesome6 name="location-dot" size={16} color="rgba(255,255,255,0.7)" /> : null}
                <Text style={[styles.sectionTitle, { flex: 1 }]} numberOfLines={1}>
                  {zoneName || t('local.allPubs')}
                </Text>
                {currentUser && zoneName ? (
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={async () => {
                      try {
                        const next = await toggleFavorite(zoneName);
                        setIsFavorite(next);
                      } catch (_) {}
                    }}
                    activeOpacity={0.7}
                  >
                    <FontAwesome6
                      name="heart"
                      size={18}
                      color={isFavorite ? '#FF4C6A' : 'rgba(255,255,255,0.35)'}
                      solid={isFavorite}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              {hasNewPost && <View style={styles.greenDot} />}
            </View>
            {publications.length > 0 && (
              <Text style={styles.zoneSubtitle}>
                <Text style={styles.zoneSubLocal}>{localCount} local</Text>
                {'  ·  '}
                <Text style={styles.zoneSubDuo}>{duoCount} duo</Text>
              </Text>
            )}

            {/* Filter pills on dark background */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterPill, modeFilter !== 'all' && { opacity: 0.5 }]}
                onPress={() => setModeFilter('all')}
                activeOpacity={0.75}
              >
                {modeFilter === 'all' ? (
                  <View style={[styles.filterPillInner, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <FontAwesome6 name="globe" size={14} color="#FFFFFF" />
                    <Text style={[styles.filterText, { color: '#FFFFFF' }]}>Tous</Text>
                  </View>
                ) : (
                  <View style={[styles.filterPillInner, styles.filterPillDark]}>
                    <FontAwesome6 name="globe" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={[styles.filterText, { color: 'rgba(255,255,255,0.7)' }]}>Tous</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, modeFilter !== 'local' && { opacity: 0.5 }]}
                onPress={() => setModeFilter(modeFilter === 'local' ? 'all' : 'local')}
                activeOpacity={0.75}
              >
                {modeFilter === 'local' ? (
                  <LinearGradient colors={[BRAND.local, '#1AA368']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.filterPillInner, { shadowColor: BRAND.local, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 }]}>
                    <Text style={[styles.filterText, { color: '#FFFFFF' }]}>LOCAL</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.filterPillInner, styles.filterPillDark]}>
                    <Text style={[styles.filterText, { color: 'rgba(255,255,255,0.7)' }]}>LOCAL</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterPill, modeFilter !== 'duo' && { opacity: 0.5 }]}
                onPress={() => setModeFilter(modeFilter === 'duo' ? 'all' : 'duo')}
                activeOpacity={0.75}
              >
                {modeFilter === 'duo' ? (
                  <LinearGradient colors={[BRAND.duo, '#1A6CE8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.filterPillInner, { shadowColor: BRAND.duo, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 }]}>
                    <Text style={[styles.filterText, { color: '#FFFFFF' }]}>DUO</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.filterPillInner, styles.filterPillDark]}>
                    <Text style={[styles.filterText, { color: 'rgba(255,255,255,0.7)' }]}>DUO</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ── Liste des publications ── */}
        {loading ? (
          <ScrollView contentContainerStyle={{ paddingTop: SP.sm }} showsVerticalScrollIndicator={false}>
            {[1, 2, 3].map(i => <PubCardSkeleton key={i} />)}
          </ScrollView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.duo} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color={C.duo} />
              ) : null
            }
            renderItem={({ item }) => (
              <PubCard
                item={item}
                currentUser={currentUser}
                onPress={() => navigation.navigate('PublicationDetail', { publication: item })}
                onContact={() => {
                  if (!currentUser) navigation.navigate('Login');
                  else navigation.navigate('Messages', { recipient: item.auteur });
                }}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="inbox"
                title={t('local.noPubs')}
                subtitle={zoneName ? t('local.noPubsZone', { zone: zoneName }) : t('local.beFirst')}
              />
            }
          />
        )}

        {/* ── FAB + ── */}
        <Animated.View style={[
          styles.fab,
          modeFilter === 'local' && { shadowColor: C.local, shadowOpacity: 0.5 },
          modeFilter === 'duo'   && { shadowColor: C.duo,   shadowOpacity: 0.5 },
          { transform: [{ scale: fabPulse }] },
        ]}>
          <TouchableOpacity
            style={[
              styles.fabInner,
              modeFilter === 'local' && { backgroundColor: C.local },
              modeFilter === 'duo'   && { backgroundColor: C.duo   },
            ]}
            activeOpacity={0.85}
            onPress={handleFabPress}
          >
            <FontAwesome6 name="plus" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Bottom Tab Bar ── */}
        <BottomTabBar activeTab="publications" navigation={navigation} isAuthenticated={!!currentUser} />

        {/* ════════ MENU LATÉRAL ════════ */}
        {menuOpen && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.menuOverlay, { opacity: overlayAnim }]}>
              <TouchableWithoutFeedback onPress={closeMenu}>
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
            </Animated.View>

            <Animated.View style={[styles.menuPanel, { transform: [{ translateX: menuAnim }] }]}>
              <View style={styles.menuHeader}>
                <View style={styles.menuLogo}>
                  <FontAwesome6 name="location-dot" size={26} color={C.local} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuAppName}>ByMap</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <FontAwesome6
                      name={currentUser ? 'circle-check' : 'lock'}
                      size={11}
                      color={currentUser ? C.local : '#FF6B6B'}
                    />
                    <Text style={[styles.menuAppSub, { color: currentUser ? C.local : '#FF6B6B' }]}>
                      {currentUser ? 'Connecté' : 'Non connecté'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.menuClose} onPress={closeMenu}>
                  <FontAwesome6 name="xmark" size={16} color="#1A1A2E" />
                </TouchableOpacity>
              </View>

              {currentUser ? (
                <View style={styles.menuUserCard}>
                  <FontAwesome6 name="circle-user" size={38} color="#9CA3AF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuUserName}>{currentUser.prenom || ''} {currentUser.nom || ''}</Text>
                    <Text style={styles.menuUserEmail} numberOfLines={1}>{currentUser.email || currentUser.phone || ''}</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.menuLoginBanner}
                  onPress={() => { closeMenu(); navigation.navigate('Login'); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.menuLoginBannerText}>{t('map.loginRegister')} →</Text>
                </TouchableOpacity>
              )}

              <ScrollView style={styles.menuItemsList} showsVerticalScrollIndicator={false}>
                {MENU_ITEMS.map((item) => {
                  if (item.key === 'logout' && !currentUser) return null;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.menuItem, item.danger && styles.menuItemDanger]}
                      onPress={() => handleMenuItem(item.key)}
                      activeOpacity={0.75}
                    >
                      <FontAwesome6
                        name={item.icon}
                        size={22}
                        color={item.danger ? '#EF4444' : '#6B7280'}
                        style={{ width: 28, textAlign: 'center' }}
                      />
                      <Text style={[styles.menuItemLabel, item.danger && styles.menuItemLabelDanger]}>
                        {t(item.tKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.menuFooter}>ByMap v1.0.0</Text>
            </Animated.View>
          </View>
        )}

      </SafeAreaView>

      {/* ── QR Scanner ── */}
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerContainer}>
          {permission?.granted && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleScan}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
          )}

          {/* Masques semi-transparents autour du viseur */}
          <View style={styles.scannerMask}>
            <View style={styles.scannerMaskRow}>
              <View style={styles.scannerMaskSide} />
              <View style={styles.scannerViewfinder}>
                <View style={[styles.scannerCorner, styles.scannerCornerTL]} />
                <View style={[styles.scannerCorner, styles.scannerCornerTR]} />
                <View style={[styles.scannerCorner, styles.scannerCornerBL]} />
                <View style={[styles.scannerCorner, styles.scannerCornerBR]} />
              </View>
              <View style={styles.scannerMaskSide} />
            </View>
          </View>

          <Text style={styles.scannerHint}>
            {t('local.scanHint')}
          </Text>

          <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerOpen(false)} activeOpacity={0.8}>
            <FontAwesome6 name="xmark" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

// ── Styles — thème clair mint ─────────────────────────────────────────────────
const makeStyles = (colors, isDark) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Header block (outer gradient container)
  headerBlock: {},
  // ── Header row (search/back/scan/menu)
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SP.base,
    paddingVertical: SP.sm,
    gap: SP.sm,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 18, color: '#FFFFFF', fontWeight: '600' },
  searchBox: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: R.full, paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: SP.sm,
    minHeight: HIT.min,
  },
  searchInput: { flex: 1, ...T.bodyMd, color: '#FFFFFF', padding: 0 },

  scanBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.md,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    gap: 4, paddingVertical: 8,
    shadowColor: '#2DBD7E', shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  menuLine: { width: 20, height: 2, backgroundColor: '#FFFFFF', borderRadius: 2 },

  // ── QR Scanner
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerMask: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  scannerMaskRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerMaskSide: {
    flex: 1, height: 260,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scannerViewfinder: {
    width: 260, height: 260,
    position: 'relative',
  },
  scannerCorner: {
    position: 'absolute',
    width: 36, height: 36,
    borderColor: '#2DBD7E', borderWidth: 4,
  },
  scannerCornerTL: { top: 0,    left: 0,   borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  scannerCornerTR: { top: 0,    right: 0,  borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 10 },
  scannerCornerBL: { bottom: 0, left: 0,   borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 10 },
  scannerCornerBR: { bottom: 0, right: 0,  borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 10 },
  scannerHint: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    color: '#FFFFFF', fontSize: 14, fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
    overflow: 'hidden',
  },
  scannerClose: {
    position: 'absolute', top: 56, right: 24,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Zone section (inside gradient block)
  zoneSection: {
    paddingHorizontal: SP.base,
    paddingTop: SP.sm,
    paddingBottom: SP.md,
    gap: SP.sm,
  },
  sectionTitle: {
    ...T.titleMd,
    color: '#FFFFFF',
  },
  filterRow: { flexDirection: 'row', gap: SP.sm },
  filterPill: { borderRadius: R.full, overflow: 'hidden' },
  filterPillInner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SP.base, paddingVertical: SP.sm,
    borderRadius: R.full,
    minHeight: HIT.min - 8,
  },
  filterPillDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  filterText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // ── Loader
  loaderBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SP.md },
  loaderText: { ...T.bodyMd, color: colors.onSurfaceVariant },

  // ── Liste
  listContent: {
    paddingHorizontal: SP.base, paddingTop: SP.md, paddingBottom: 120, gap: SP.md,
  },

  // ── Empty — handled by EmptyState component

  // ── FAB
  fab: {
    position: 'absolute', bottom: 100, right: SP.xl,
    width: 56, height: 56, borderRadius: R.full,
    shadowColor: '#2DBD7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  fabInner: {
    width: 56, height: 56, borderRadius: R.full,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
  },

  // ════ MENU LATÉRAL ════
  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  menuPanel: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    width: width * 0.72, backgroundColor: colors.surface,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: colors.surfaceVariant,
    borderBottomWidth: 1, borderBottomColor: colors.outline,
    gap: 12,
  },
  menuLogo: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(45,189,126,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuLogoText: { fontSize: 22 },
  menuAppName:  { fontSize: 17, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.3 },
  menuAppSub:   { fontSize: 12, marginTop: 1 },
  menuClose: {
    marginLeft: 'auto', width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surfaceVariant, justifyContent: 'center', alignItems: 'center',
  },
  menuCloseIcon:  { fontSize: 13, color: colors.onSurface, fontWeight: '700' },
  menuUserCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: colors.surfaceVariant, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, gap: 12,
    borderWidth: 1, borderColor: colors.outline,
  },
  menuUserAvatar: { fontSize: 28 },
  menuUserName:   { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  menuUserEmail:  { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  menuLoginBanner: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#2DBD7E', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  menuLoginBannerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  menuItemsList:  { flex: 1, paddingTop: 12 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.lg, paddingVertical: SP.md, gap: SP.md,
    borderRadius: R.md, marginHorizontal: SP.sm, marginBottom: 2,
    minHeight: HIT.min,
  },
  menuItemDanger:      { marginTop: 8 },
  menuItemIcon:        { fontSize: 22, width: 28, textAlign: 'center' },
  menuItemLabel:       { fontSize: 15, color: colors.onSurface, fontWeight: '600' },
  menuItemLabelDanger: { color: colors.error },
  menuFooter: {
    textAlign: 'center', color: colors.onSurfaceVariant,
    fontSize: 12, paddingBottom: 32, paddingTop: 12,
  },

  // ── Zone title row
  zoneTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greenDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 6, elevation: 4,
  },
  zoneSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: 1 },
  zoneSubLocal: { color: '#5DDBA5', fontWeight: '700' },
  zoneSubDuo:   { color: '#7BAAFF', fontWeight: '700' },
});