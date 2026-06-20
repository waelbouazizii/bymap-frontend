// src/screens/FavoritesScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { getFavorites, toggleFavorite, getCurrentUser } from '../utils/api';
import { useTranslation } from 'react-i18next';
import TUNISIA_DATA from '../../assets/tunisia.json';
import BottomTabBar from '../components/BottomTabBar';
import EmptyState from '../components/EmptyState';
import { R, SP, T, HIT } from '../theme/index';

// ─── Lookup coords par nom de zone depuis tunisia.json ────────────────────────
const ZONE_COORDS = {};
Object.entries(TUNISIA_DATA).forEach(([gov, places]) => {
  places.forEach(p => {
    if (p.lat == null) return;
    if (p.delegation && !ZONE_COORDS[p.delegation]) ZONE_COORDS[p.delegation] = { lat: p.lat, lng: p.lng };
    if (p.localite   && !ZONE_COORDS[p.localite])   ZONE_COORDS[p.localite]   = { lat: p.lat, lng: p.lng };
  });
  const first = places.find(p => p.lat != null);
  if (first && !ZONE_COORDS[gov]) ZONE_COORDS[gov] = { lat: first.lat, lng: first.lng };
});

const GOVERNORATE_COORDS = {
  'Tunis':{ lat:36.8065,lng:10.1815 },'Ariana':{ lat:36.8665,lng:10.1647 },
  'Ben Arous':{ lat:36.7474,lng:10.2326 },'Manouba':{ lat:36.8094,lng:9.9799 },
  'Nabeul':{ lat:36.4511,lng:10.7357 },'Zaghouan':{ lat:36.4029,lng:10.1427 },
  'Bizerte':{ lat:37.2744,lng:9.8739 },'Béja':{ lat:36.7254,lng:9.1819 },
  'Jendouba':{ lat:36.5011,lng:8.7757 },'Kef':{ lat:36.1826,lng:8.7149 },
  'Siliana':{ lat:36.0850,lng:9.3708 },'Sousse':{ lat:35.8283,lng:10.6346 },
  'Monastir':{ lat:35.7643,lng:10.8113 },'Mahdia':{ lat:35.5047,lng:11.0622 },
  'Sfax':{ lat:34.7399,lng:10.7600 },'Kairouan':{ lat:35.6781,lng:10.0963 },
  'Kasserine':{ lat:35.1676,lng:8.8365 },'Sidi Bouzid':{ lat:35.0382,lng:9.4849 },
  'Gabès':{ lat:33.8814,lng:10.0982 },'Médenine':{ lat:33.3550,lng:10.5054 },
  'Tataouine':{ lat:32.9211,lng:10.4516 },'Gafsa':{ lat:34.4250,lng:8.7842 },
  'Tozeur':{ lat:33.9197,lng:8.1335 },'Kébili':{ lat:33.7046,lng:8.9690 },
};

function lookupCoords(zoneName) {
  if (!zoneName) return null;
  // Recherche exacte
  let c = ZONE_COORDS[zoneName] || GOVERNORATE_COORDS[zoneName];
  if (c) return c;
  // Recherche insensible à la casse
  const lower = zoneName.toLowerCase();
  const key = Object.keys(ZONE_COORDS).find(k => k.toLowerCase() === lower)
           || Object.keys(GOVERNORATE_COORDS).find(k => k.toLowerCase() === lower);
  return key ? (ZONE_COORDS[key] || GOVERNORATE_COORDS[key]) : null;
}

const TAB_ITEMS = [
  { key: 'globe',    tKey: 'common.globe',    icon: 'globe',   authRequired: false },
  { key: 'messages', tKey: 'common.messages', icon: 'message', authRequired: true  },
  { key: 'profile',  tKey: 'common.profile',  icon: 'user',    authRequired: true  },
];

const C = {
  green:     '#2DBD7E',
  greenGlow: 'rgba(45,189,126,0.10)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  red:       '#EF4444',
  redGlow:   'rgba(239,68,68,0.08)',
};

// ─── Carte zone favori ────────────────────────────────────────────────────────
function FavoriteCard({ item, onNavigate, onDelete }) {
  const { t }     = useTranslation();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [deleting, setDeleting] = useState(false);

  // Coordonnées : stockées en DB ou retrouvées depuis tunisia.json
  const coords = (item.lat != null && item.lng != null)
    ? { lat: item.lat, lng: item.lng }
    : lookupCoords(item.zoneName);

  const hasCoords = coords != null;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    Animated.timing(scaleAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(async () => {
      try { await toggleFavorite(item.zoneName); } catch (_) {}
      onDelete(item._id);
    });
  };

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      {/* Barre latérale : verte si coords trouvées, grise sinon */}
      <View style={[styles.cardAccent, !hasCoords && { backgroundColor: C.textFaint }]} />

      <View style={styles.cardBody}>
        {/* Icône + nom + coords */}
        <View style={styles.cardLeft}>
          <View style={[styles.cardIconWrap, !hasCoords && { backgroundColor: 'rgba(156,163,175,0.10)' }]}>
            <FontAwesome6 name="heart" size={16} color={hasCoords ? C.green : C.textFaint} solid />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardZoneName} numberOfLines={1}>{item.zoneName}</Text>
            {hasCoords ? (
              <View style={styles.coordsRow}>
                <FontAwesome6 name="location-dot" size={10} color={C.green} />
                <Text style={styles.coordsText}>
                  {coords.lat.toFixed(4)}°N  {coords.lng.toFixed(4)}°E
                </Text>
              </View>
            ) : (
              <View style={styles.coordsRow}>
                <FontAwesome6 name="circle-exclamation" size={10} color={C.textFaint} />
                <Text style={[styles.coordsText, { color: C.textFaint }]}>{t('common.unknownPosition')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          {/* Naviguer vers la zone */}
          <TouchableOpacity
            style={[styles.actionBtn, !hasCoords && styles.actionBtnDisabled]}
            onPress={() => onNavigate(item, coords)}
            activeOpacity={hasCoords ? 0.75 : 1}
            disabled={!hasCoords}
          >
            <FontAwesome6 name="location-crosshairs" size={15} color={hasCoords ? C.green : C.textFaint} />
          </TouchableOpacity>

          {/* Supprimer */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnRed]}
            onPress={handleDelete}
            activeOpacity={0.75}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator size={14} color={C.red} />
              : <FontAwesome6 name="heart-crack" size={15} color={C.red} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function FavoritesScreen() {
  const navigation = useNavigation();
  const { t }      = useTranslation();
  const [favorites,    setFavorites]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [currentUser,  setCurrentUser]  = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, user] = await Promise.all([getFavorites(), getCurrentUser()]);
      setFavorites(data);
      setCurrentUser(user);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = () => { setRefreshing(true); load(true); };

  const handleTab = (key) => {
    const item = TAB_ITEMS.find(t => t.key === key);
    if (item?.authRequired && !currentUser) { navigation.navigate('Login'); return; }
    if (key === 'globe')    navigation.navigate('Map');
    if (key === 'messages') navigation.navigate('ConversationsList');
    if (key === 'profile')  navigation.navigate(currentUser?.role === 'admin' ? 'AdminDashboard' : 'Profile');
  };

  const handleNavigate = (item, coords) => {
    navigation.navigate('Map', {
      snapToZone: {
        name: item.zoneName,
        lat:  coords?.lat ?? undefined,
        lng:  coords?.lng ?? undefined,
      },
    });
  };

  const handleDelete = (id) => {
    setFavorites(prev => prev.filter(f => f._id !== id));
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <FontAwesome6 name="chevron-left" size={16} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <FontAwesome6 name="heart" size={18} color={C.green} solid />
          <Text style={styles.headerTitle}>{t('favorites.title')}</Text>
        </View>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>{favorites.length}</Text>
        </View>
      </View>

      {/* ── Contenu ── */}
      <View style={{ flex: 1 }}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      ) : (
        <FlatList
          style={StyleSheet.absoluteFillObject}
          data={favorites}
          keyExtractor={item => item._id}
          contentContainerStyle={favorites.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.green} />
          }
          renderItem={({ item }) => (
            <FavoriteCard
              item={item}
              onNavigate={handleNavigate}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="heart"
              title={t('favorites.noFavorites')}
              subtitle={t('favorites.noFavoritesSub')}
              actionLabel={t('favorites.exploreMap')}
              onAction={() => navigation.navigate('Map')}
            />
          }
        />
      )}
      </View>

      {/* ── Bottom Tab Bar ── */}
      <BottomTabBar activeTab="profile" navigation={navigation} isAuthenticated={!!currentUser} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.base, paddingVertical: SP.sm,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: C.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: SP.sm,
  },
  headerTitle: { ...T.titleLg, color: C.text },
  headerCount: {
    minWidth: 36, height: 26, borderRadius: R.full,
    backgroundColor: C.greenGlow,
    borderWidth: 1, borderColor: C.green,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SP.sm,
  },
  headerCountText: { ...T.labelLg, color: C.green },

  // ── Listes ──────────────────────────────────────────────────────────────────
  listContent:    { padding: SP.base, gap: SP.md },
  emptyContainer: { flex: 1 },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Carte ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: C.white,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 3,
  },
  cardAccent: {
    width: 3, backgroundColor: C.green,
  },
  cardBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.base, paddingVertical: SP.md, gap: SP.md,
    minHeight: HIT.min + 16,
  },
  cardLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SP.md,
  },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: R.full,
    backgroundColor: C.greenGlow,
    justifyContent: 'center', alignItems: 'center',
  },
  cardZoneName: { ...T.titleMd, color: C.text },
  cardSub:      { ...T.bodyMd, color: C.textFaint, marginTop: 2 },
  coordsRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  coordsText:   { ...T.bodyMd, color: C.green, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // ── Boutons d'action ────────────────────────────────────────────────────────
  cardActions: { flexDirection: 'row', gap: SP.sm },
  actionBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: C.greenGlow,
    borderWidth: 1, borderColor: C.green,
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnRed: {
    backgroundColor: C.redGlow,
    borderColor: C.red,
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(156,163,175,0.08)',
    borderColor: C.textFaint,
  },
});
