// src/screens/admin/AdminNotifications.js
import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../environments/environment';
import { R, SP, T, HIT } from '../../theme/index';

const C = {
  green:     '#2DBD7E',
  greenDark: '#22A06B',
  greenGlow: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6',
  blueGlow:  'rgba(59,126,246,0.12)',
  orange:    '#F59E0B',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  red:       '#EF4444',
};

const LAST_SEEN_KEY = 'admin_notif_last_seen';

// Formate la date de création
const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs  = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);

  if (diffMin < 1)  return "À l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH   < 24) return `il y a ${diffH}h`;
  if (diffD   < 7)  return `il y a ${diffD}j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function AdminNotifications() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [lastSeen,      setLastSeen]      = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res   = await fetch(`${API_URL}/admin/notifications?limit=50`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Charger la date du dernier accès et marquer comme vu
  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY).then(val => {
      setLastSeen(val ? new Date(val) : null);
      // Marquer comme vu maintenant
      AsyncStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    });
    fetchNotifications();
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

  const isNew = (createdAt) => {
    if (!lastSeen) return true;
    return new Date(createdAt) > lastSeen;
  };

  const renderItem = ({ item }) => {
    const name    = [item.prenom, item.nom].filter(Boolean).join(' ') || '—';
    const initial = name[0]?.toUpperCase() || '?';
    const newItem = isNew(item.createdAt);

    return (
      <View style={[styles.card, newItem && styles.cardNew]}>
        {newItem && <View style={styles.newDot} />}

        {/* Avatar */}
        <LinearGradient
          colors={item.role === 'admin' ? ['#F59E0B', '#D97706'] : [C.green, C.greenDark]}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </LinearGradient>

        {/* Infos */}
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
            {item.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardEmail} numberOfLines={1}>{item.email || '—'}</Text>

          {/* Soldes */}
          <View style={styles.soldesRow}>
            <FontAwesome6 name="coins" size={10} color={C.orange} />
            <Text style={[styles.soldeText, { color: C.orange }]}>{item.pointsSolde} pts</Text>
            <View style={styles.soldeSep} />
            <FontAwesome6 name="newspaper" size={10} color={C.green} />
            <Text style={[styles.soldeText, { color: C.green }]}>{item.freePostsRemaining} gratuits</Text>
          </View>
        </View>

        {/* Date */}
        <View style={styles.cardRight}>
          <FontAwesome6 name="user-plus" size={13} color={newItem ? C.green : C.textFaint} />
          <Text style={[styles.cardDate, { color: newItem ? C.green : C.textFaint }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <LinearGradient colors={[C.green, C.greenDark]} style={styles.headerIcon}>
              <FontAwesome6 name="bell" size={15} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSub}>Créations de comptes</Text>
            </View>
          </View>
          <View style={[styles.countBadge, { backgroundColor: C.greenGlow }]}>
            <Text style={[styles.countBadgeText, { color: C.green }]}>{notifications.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={C.green} />
            <Text style={styles.loaderText}>Chargement…</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <FontAwesome6 name="bell-slash" size={52} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Aucune notification</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderItem}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
    gap: SP.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  headerIcon:    { width: 36, height: 36, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { ...T.titleLg, color: C.text },
  headerSub:     { ...T.bodyMd, fontSize: 11, color: C.textFaint, marginTop: 1 },
  countBadge:    { paddingHorizontal: SP.sm, paddingVertical: 4, borderRadius: R.full },
  countBadgeText:{ ...T.labelLg },

  loader:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SP.sm },
  loaderText: { ...T.bodyMd, color: C.textFaint },

  listPad:   { padding: SP.base, paddingBottom: 40 },
  separator: { height: SP.sm },

  // Carte notification
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: C.white, borderRadius: R.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#F0F0F0',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    position: 'relative', overflow: 'hidden',
  },
  cardNew: {
    borderColor: C.green,
    backgroundColor: '#F0FDF4',
  },
  newDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.green,
  },
  avatar:     { width: HIT.min, height: HIT.min, borderRadius: R.full, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },

  cardBody:   { flex: 1, gap: 2 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName:   { ...T.titleMd, color: C.text, flex: 1 },
  cardEmail:  { ...T.bodyMd, color: C.textFaint },

  adminBadge:     { backgroundColor: '#FEF3C7', borderRadius: R.xs, paddingHorizontal: 6, paddingVertical: 2 },
  adminBadgeText: { ...T.labelSm, color: '#D97706' },

  soldesRow:  { flexDirection: 'row', alignItems: 'center', gap: SP.xs, marginTop: SP.xs },
  soldeText:  { ...T.bodyMd, fontWeight: '700' },
  soldeSep:   { width: 1, height: 10, backgroundColor: '#E5E7EB', marginHorizontal: 2 },

  cardRight: { alignItems: 'center', gap: 4, minWidth: 52 },
  cardDate:  { ...T.labelSm, textAlign: 'center' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: SP.md },
  emptyTitle: { ...T.titleMd, color: C.textFaint },
});
