// src/screens/ConversationsList.js
import React, { useState, useCallback, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { getAccessToken } from '../security/secureStorage';
import { API_URL } from '../environments/environment';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import BottomTabBar from '../components/BottomTabBar';
import { R, SP, T, HIT } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function ConversationsList() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const navigation = useNavigation();
  const { t }      = useTranslation();
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConvs(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchConversations();
  }, [fetchConversations]));

  const renderItem = ({ item }) => {
    const contact = item.contact;
    const lastMsg = item.lastMessage;
    const unread  = item.unread ?? 0;
    const name    = `${contact?.prenom || ''} ${contact?.nom || ''}`.trim() || 'Inconnu';
    const initial = name[0]?.toUpperCase() || '?';
    const preview = lastMsg?.content || '';
    const time    = timeAgo(lastMsg?.createdAt);

    return (
      <TouchableOpacity
        style={[styles.row, unread > 0 && styles.rowUnread]}
        onPress={() => navigation.navigate('Messages', { recipient: contact })}
        activeOpacity={0.75}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, unread > 0 && styles.avatarUnread]}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>

        {/* Body */}
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread > 0 && styles.nameBold]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.time, unread > 0 && { color: '#2DBD7E', fontWeight: '700' }]}>{time}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, unread > 0 && styles.previewBold]} numberOfLines={1}>
              {preview || t('conversations.startConversation')}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <LinearGradient colors={['#0a1628', '#0f2848']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('conversations.title')}</Text>
            {convs.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{convs.length}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2DBD7E" />
            </View>
          ) : (
            <FlatList
              style={StyleSheet.absoluteFillObject}
              data={convs}
              keyExtractor={(item, i) => item.contact?._id || String(i)}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <EmptyState
                  icon="comments"
                  title={t('conversations.noConversations')}
                  subtitle={t('conversations.noConversationsSub')}
                />
              }
            />
          )}
        </View>
        <BottomTabBar activeTab="messages" navigation={navigation} isAuthenticated={true} />
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors, isDark) => StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.base, paddingVertical: SP.sm,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  headerTitle:  { ...T.titleLg, color: '#FFFFFF' },
  headerBadge:  { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: R.full, paddingHorizontal: SP.sm, paddingVertical: 3 },
  headerBadgeText: { ...T.labelSm, color: '#FFFFFF', textTransform: 'none', letterSpacing: 0 },

  // ── List
  listContent: { paddingTop: SP.sm, paddingBottom: 80, paddingHorizontal: 0 },

  // ── Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    backgroundColor: colors.surface, gap: SP.md,
    minHeight: HIT.min + SP.base,
  },
  rowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#2DBD7E',
    backgroundColor: 'rgba(45,189,126,0.04)',
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceVariant, marginLeft: 82 },

  // ── Avatar
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 56, height: 56, borderRadius: R.full,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  avatarUnread: {
    backgroundColor: '#3B7EF6',
    shadowColor: '#3B7EF6',
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: R.full,
    backgroundColor: '#2DBD7E', borderWidth: 2, borderColor: colors.surface,
  },

  // ── Row body
  rowBody:   { flex: 1, gap: 3 },
  rowTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  name:        { ...T.titleMd, color: colors.onSurface, flex: 1 },
  nameBold:    { fontWeight: '800', color: colors.onSurface },
  time:        { ...T.bodyMd, color: colors.onSurfaceVariant, fontSize: 12 },
  preview:     { ...T.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  previewBold: { color: colors.onSurface, fontWeight: '600' },

  badge: {
    minWidth: 22, height: 22, borderRadius: R.full,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
