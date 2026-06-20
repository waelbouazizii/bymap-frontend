// src/screens/DuoScreen.js
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  FlatList, ScrollView, Animated, ActivityIndicator, Image, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentUser } from '../utils/api';
import { getAccessToken } from '../security/secureStorage';
import { environment } from '../environments/environment';
import { getActiveServerUrl } from '../utils/serverBalancer';
import BottomTabBar from '../components/BottomTabBar';
import { PubCardSkeleton } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { R, SP, T, HIT } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';

const API_URL     = environment.apiUrl;
const SERVER_BASE = API_URL.replace('/api', '');

const C = {
  local:       '#2DBD7E',
  localGlow:   'rgba(45,189,126,0.12)',
  duo:         '#3B7EF6',
  duoGlow:     'rgba(59,126,246,0.12)',
  intl:        '#7C3AED',
  intlGlow:    'rgba(124,58,237,0.10)',
  glassBorder: '#E5E7EB',
  textFaint:   '#9CA3AF',
  red:         '#EF4444',
};

// 3 niveaux
const LEVELS = [
  { key: 'entrants',      label: 'Entrants',      icon: 'arrow-right', color: C.local, endColor: '#1AA368', glow: C.localGlow },
  { key: 'sortants',      label: 'Sortants',      icon: 'arrow-left',  color: C.duo,   endColor: '#1A6CE8', glow: C.duoGlow   },
  { key: 'international', label: 'International', icon: 'globe',       color: C.intl,  endColor: '#5B21B6', glow: C.intlGlow  },
];

const fixMediaUrl = (url) => {
  if (!url) return null;
  const ipMatch = url.match(/^https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/);
  if (ipMatch) {
    if (Platform.OS === 'web') {
      const uploadPath = ipMatch[3] || '/';
      if (window.location.protocol === 'https:') {
        const filename = uploadPath.replace(/^\/+uploads\/+/, '');
        return `/api/media?path=${encodeURIComponent(filename)}`;
      }
      return `http://${ipMatch[1]}:5000${uploadPath}`;
    }
    return `https://${ipMatch[1]}.nip.io${ipMatch[3] || '/'}`;
  }
  const base = getActiveServerUrl().replace('/api', '');
  if (/^https?:\/\//.test(url)) return url.replace(/^https?:\/\/[^/]+/, base);
  return base + (url.startsWith('/') ? url : '/' + url);
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

const timeAgo = (d) => {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60)    return `${Math.floor(s)}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
};

// Catégorisation côté client
const matchZone = (str, zone) =>
  !!(str && zone && str.toLowerCase().includes(zone.toLowerCase()));

const getCategories = (pub, zone) => {
  const deb = pub.localisationDebut;
  const fin = pub.localisationFin;
  const inDeb = matchZone(deb?.ville, zone) || matchZone(deb?.gouvernorat, zone);
  const inFin = matchZone(fin?.ville, zone) || matchZone(fin?.gouvernorat, zone);
  const crossGov = deb?.gouvernorat && fin?.gouvernorat && deb.gouvernorat !== fin.gouvernorat;
  const cats = new Set();
  if (inFin && !inDeb)  cats.add('entrants');
  if (inDeb && !inFin)  cats.add('sortants');
  if (inDeb && inFin) { cats.add('entrants'); cats.add('sortants'); }
  if (crossGov && (inDeb || inFin)) cats.add('international');
  if (cats.size === 0) { cats.add('entrants'); cats.add('sortants'); }
  return cats;
};

const makeDuoCardStyles = (colors, isDark) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: R.xl, overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.28 : 0.13,
    shadowRadius: 16, elevation: 8,
  },
  heroWrap: { height: 190, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroBadge: { position: 'absolute', top: 10, left: 10 },
  imageLoader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.06)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, paddingHorizontal: SP.base, paddingTop: SP.md, paddingBottom: SP.sm },
  cardAvatar: { width: 44, height: 44, borderRadius: R.full, justifyContent: 'center', alignItems: 'center' },
  cardAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  cardAuthorName: { ...T.titleMd, color: colors.onSurface },
  cardRoute: { ...T.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  cardGov: { ...T.bodyMd, fontWeight: '500', marginTop: 2, fontSize: 11 },
  cardTime: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.full },
  modeBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  cardDesc: { ...T.bodyMd, color: colors.onSurfaceVariant, paddingHorizontal: SP.base, paddingBottom: SP.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.base, paddingVertical: SP.md, backgroundColor: colors.surfaceVariant },
  cardMetaStat: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  cardMetaText: { ...T.bodyMd, color: colors.onSurfaceVariant },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SP.md, paddingVertical: 8, borderRadius: R.lg },
  contactBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PubCard
// ─────────────────────────────────────────────────────────────────────────────
const PubCard = ({ item, level, onPress, onContact, currentUser }) => {
  const { colors, isDark } = useTheme();
  const cardStyles = useMemo(() => makeDuoCardStyles(colors, isDark), [colors, isDark]);
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const [imgError,    setImgError]    = useState(false);
  const [imgLoading,  setImgLoading]  = useState(true);
  const [liked,       setLiked]       = useState(false);
  const [nbLikes,     setNbLikes]     = useState(item.nbLikes ?? item.likes?.length ?? 0);
  const [vues,        setVues]        = useState(item.vues ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  const lvl = LEVELS.find(l => l.key === level) || LEVELS[0];
  const deb = item.localisationDebut;
  const fin = item.localisationFin;
  const routeLine = [deb?.ville, fin?.ville].filter(Boolean).join(' → ');
  const govLine   = (deb?.gouvernorat && fin?.gouvernorat && deb.gouvernorat !== fin.gouvernorat)
    ? `${deb.gouvernorat} → ${fin.gouvernorat}` : (deb?.gouvernorat || '');
  const authorName    = [item.auteur?.prenom, item.auteur?.nom].filter(Boolean).join(' ') || 'Anonyme';
  const authorInitial = authorName[0]?.toUpperCase() || '?';
  const imageUri = getMediaUri(item.medias?.find(isImageMedia));

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 200 }).start();

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
        setLiked(data.liked); setNbLikes(data.nbLikes);
        Animated.sequence([
          Animated.spring(heartScale, { toValue: 1.5, useNativeDriver: true, tension: 300, friction: 4 }),
          Animated.spring(heartScale, { toValue: 1,   useNativeDriver: true, tension: 200, friction: 6 }),
        ]).start();
      }
    } catch {}
    setLikeLoading(false);
  };

  const gradColors = [lvl.color, lvl.endColor];
  const hasImage = imageUri && !imgError;

  return (
    <Animated.View style={[cardStyles.card, { shadowColor: lvl.color, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => { setVues(v => v + 1); onPress(); }}
        onPressIn={onPressIn} onPressOut={onPressOut}
      >
        {/* Hero image at top */}
        {hasImage ? (
          <View style={cardStyles.heroWrap}>
            <Image
              source={{ uri: imageUri }} style={cardStyles.heroImage} resizeMode="cover"
              onLoadStart={() => setImgLoading(true)}
              onLoadEnd={() => setImgLoading(false)}
              onError={() => { setImgError(true); setImgLoading(false); }}
            />
            {imgLoading && (
              <View style={cardStyles.imageLoader}>
                <ActivityIndicator size="small" color={lvl.color} />
              </View>
            )}
            <View style={cardStyles.heroBadge}>
              <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cardStyles.modeBadge}>
                <FontAwesome6 name={lvl.icon} size={10} color="#FFFFFF" />
                <Text style={cardStyles.modeBadgeText}>{lvl.label.toUpperCase()}</Text>
              </LinearGradient>
            </View>
          </View>
        ) : null}

        {/* Author row */}
        <View style={cardStyles.cardHeader}>
          <LinearGradient colors={gradColors} style={cardStyles.cardAvatar}>
            <Text style={cardStyles.cardAvatarText}>{authorInitial}</Text>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <Text style={cardStyles.cardAuthorName} numberOfLines={1}>{authorName}</Text>
            {routeLine ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <FontAwesome6 name="route" size={11} color={C.textFaint} />
                <Text style={cardStyles.cardRoute} numberOfLines={1}>{routeLine}</Text>
                <Text style={cardStyles.cardTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            ) : null}
            {govLine ? (
              <Text style={[cardStyles.cardGov, { color: lvl.color }]} numberOfLines={1}>{govLine}</Text>
            ) : null}
          </View>

          {!hasImage && (
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cardStyles.modeBadge}>
              <FontAwesome6 name={lvl.icon} size={10} color="#FFFFFF" />
              <Text style={cardStyles.modeBadgeText}>{lvl.label.toUpperCase()}</Text>
            </LinearGradient>
          )}
        </View>

        {item.description ? (
          <Text style={cardStyles.cardDesc} numberOfLines={3}>{item.description}</Text>
        ) : null}

        {/* Footer */}
        <View style={cardStyles.cardFooter}>
          <TouchableOpacity
            style={cardStyles.cardMetaStat} onPress={handleLike} activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <FontAwesome6 name="heart" size={20} color={liked ? C.red : C.textFaint} solid={liked} />
            </Animated.View>
            <Text style={[cardStyles.cardMetaText, liked && { color: C.red, fontWeight: '700' }]}>{nbLikes}</Text>
          </TouchableOpacity>

          <View style={cardStyles.cardMetaStat}>
            <FontAwesome6 name="eye" size={18} color={C.textFaint} />
            <Text style={cardStyles.cardMetaText}>{vues}</Text>
          </View>

          {item.medias?.length > 1 && (
            <View style={cardStyles.cardMetaStat}>
              <FontAwesome6 name="images" size={16} color={C.textFaint} />
              <Text style={cardStyles.cardMetaText}>{item.medias.length}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity onPress={onContact} activeOpacity={0.8}>
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cardStyles.contactBtn}>
              <FontAwesome6 name="comment" size={14} color="#FFFFFF" />
              <Text style={cardStyles.contactBtnText}>Contacter</Text>
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
export default function DuoScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const zoneName   = route.params?.zone || '';

  const [search,       setSearch]      = useState('');
  const [publications, setPubs]        = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [refreshing,   setRefreshing]  = useState(false);
  const [loadingMore,  setLoadingMore] = useState(false);
  const [page,         setPage]        = useState(1);
  const [hasMore,      setHasMore]     = useState(true);
  const [currentUser,  setCurrentUser] = useState(null);
  const [activeLevel,  setActiveLevel] = useState('entrants');

  useFocusEffect(useCallback(() => { getCurrentUser().then(setCurrentUser); }, []));

  const fetchPubs = useCallback(async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const params = new URLSearchParams({
        page: pageNum, limit: 50,
        mode: 'duo',
        ...(zoneName.trim() && { ville: zoneName.trim() }),
        ...(search.trim()   && { search: search.trim() }),
      });
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/publications?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = data.publications ?? [];
      setPubs(prev => pageNum === 1 ? list : [...prev, ...list]);
      setHasMore(pageNum < (data.pages ?? 1));
      setPage(pageNum);
    } catch {}
    finally {
      setLoading(false); setRefreshing(false); setLoadingMore(false);
    }
  }, [zoneName, search]);

  useFocusEffect(useCallback(() => { fetchPubs(1); }, [fetchPubs]));

  const onRefresh    = () => { setRefreshing(true); fetchPubs(1); };
  const onEndReached = () => { if (!loadingMore && hasMore) fetchPubs(page + 1); };

  // Filtrage par niveau
  const byLevel = (lvl) => publications.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(p.description?.toLowerCase().includes(q) ||
            p.localisationDebut?.ville?.toLowerCase().includes(q) ||
            p.localisationFin?.ville?.toLowerCase().includes(q))) return false;
    }
    return getCategories(p, zoneName).has(lvl);
  });

  const lists  = { entrants: byLevel('entrants'), sortants: byLevel('sortants'), international: byLevel('international') };
  const lvl    = LEVELS.find(l => l.key === activeLevel);
  const data   = lists[activeLevel];

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F6FB' }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <LinearGradient colors={['#0a1628', '#0f2848']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={15} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={search} onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <FontAwesome6 name="xmark" size={15} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.menuBtn} onPress={() => navigation.navigate('Map')} activeOpacity={0.8}>
            <FontAwesome6 name="map" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Titre zone ── */}
        <View style={styles.zoneRow}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <View style={styles.countryBadge}>
              <Text style={styles.countryCode}>TN</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Tunisia</Text>
              {zoneName ? (
                <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                  <FontAwesome6 name="location-dot" size={11} color={C.local} />
                  <Text style={styles.sectionZone}>{zoneName}</Text>
                </View>
              ) : null}
              <Text style={styles.sectionSub}>International DUO</Text>
            </View>
          </View>
          {/* ── Stats par niveau ── */}
          {!loading && (
            <View style={styles.statsRow}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.statChip, { borderColor: l.color, backgroundColor: activeLevel === l.key ? l.color : 'transparent' }]}
                  onPress={() => setActiveLevel(l.key)}
                  activeOpacity={0.75}
                >
                  <FontAwesome6 name={l.icon} size={11} color={activeLevel === l.key ? '#fff' : l.color} />
                  <Text style={[styles.statChipText, { color: activeLevel === l.key ? '#fff' : l.color }]}>
                    {lists[l.key]?.length ?? 0}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Tabs 3 niveaux ── */}
        <View style={styles.tabsRow}>
          {LEVELS.map((l) => {
            const active = activeLevel === l.key;
            const count  = lists[l.key]?.length ?? 0;
            return (
              <TouchableOpacity
                key={l.key}
                style={[styles.levelTab, active && { borderBottomColor: l.color, borderBottomWidth: 3 }]}
                onPress={() => setActiveLevel(l.key)}
                activeOpacity={0.75}
              >
                <FontAwesome6 name={l.icon} size={14} color={active ? l.color : '#9CA3AF'} />
                <Text style={[styles.levelTabText, active && { color: l.color, fontWeight:'800' }]}>
                  {l.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.levelBadge, { backgroundColor: active ? l.color : '#E5E7EB' }]}>
                    <Text style={[styles.levelBadgeText, active && { color:'#FFF' }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        

        {/* ── Liste ── */}
        <View style={{ flex: 1 }}>
          {loading ? (
            <ScrollView style={StyleSheet.absoluteFillObject} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: SP.sm }}>
              {[1, 2, 3].map(i => <PubCardSkeleton key={i} />)}
            </ScrollView>
          ) : (
            <FlatList
              style={StyleSheet.absoluteFillObject}
              key={activeLevel}
              data={data}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lvl.color} />}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.3}
              ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical:16 }} color={lvl.color} /> : null}
              renderItem={({ item }) => (
                <PubCard
                  item={item}
                  level={activeLevel}
                  currentUser={currentUser}
                  onPress={() => navigation.navigate('PublicationDetail', { publication: item })}
                  onContact={() => {
                    if (!currentUser) navigation.navigate('Login');
                    else navigation.navigate('Messages', { recipient: item.auteur });
                  }}
                />
              )}

            />
          )}
        </View>

        {/* ── Bottom Tab Bar ── */}
        <BottomTabBar activeTab="publications" navigation={navigation} isAuthenticated={!!currentUser} />

      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex:1, backgroundColor:'transparent' },

  header: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal: SP.base, paddingVertical: SP.sm, gap: SP.sm,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor:'rgba(255,255,255,0.12)',
    justifyContent:'center', alignItems:'center',
  },
  searchBox: {
    flex:1, flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(255,255,255,0.10)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)',
    borderRadius: R.full, paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: SP.sm,
    minHeight: HIT.min,
  },
  searchInput: { flex:1, ...T.bodyMd, color:'#FFFFFF', padding:0 },
  menuBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.md, backgroundColor:'#2DBD7E',
    justifyContent:'center', alignItems:'center',
    shadowColor:'#2DBD7E', shadowOpacity:0.3, shadowRadius:8,
    shadowOffset:{width:0,height:3}, elevation:5,
  },

  zoneRow: {
    backgroundColor:'#FFFFFF', borderBottomWidth:1, borderBottomColor:'#F0F0F0',
    paddingHorizontal:16, paddingTop:12, paddingBottom:12,
  },
  countryBadge: {
    width:44, height:44, borderRadius:12,
    borderWidth:1.5, borderColor:'#2DBD7E',
    backgroundColor:'rgba(45,189,126,0.10)',
    justifyContent:'center', alignItems:'center',
  },
  countryCode:  { fontSize:16, fontWeight:'900', color:'#2DBD7E', letterSpacing:0.5 },
  sectionTitle: { fontSize:18, fontWeight:'800', color:'#1A1A2E', letterSpacing:-0.3 },
  sectionZone:  { fontSize:12, fontWeight:'700', color:'#2DBD7E' },
  sectionSub:   { fontSize:11, fontWeight:'600', color:'#3B7EF6', marginTop:2 },
  statsRow: {
    flexDirection:'row', gap:8, marginTop:10,
  },
  statChip: {
    flexDirection:'row', alignItems:'center', gap:5,
    borderRadius:20, borderWidth:1.5,
    paddingHorizontal:10, paddingVertical:5,
  },
  statChipText: { fontSize:12, fontWeight:'800' },

  // Tabs niveaux
  tabsRow: {
    flexDirection:'row', backgroundColor:'#FFFFFF',
    borderBottomWidth:1, borderBottomColor:'#F0F0F0',
  },
  levelTab: {
    flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center',
    paddingVertical:12, gap:5,
    borderBottomWidth:3, borderBottomColor:'transparent',
  },
  levelTabText: { fontSize:12, fontWeight:'600', color:'#9CA3AF' },
  levelBadge: {
    minWidth:18, height:18, borderRadius:9,
    justifyContent:'center', alignItems:'center', paddingHorizontal:5,
  },
  levelBadgeText: { fontSize:10, fontWeight:'800', color:'#6B7280' },

  levelBanner: {
    flexDirection:'row', alignItems:'center', gap:7,
    paddingHorizontal:16, paddingVertical:9,
  },
  levelBannerText: { fontSize:12, fontWeight:'600' },

  loaderBox:  { flex:1, justifyContent:'center', alignItems:'center', gap: SP.md },
  loaderText: { ...T.bodyMd, color:'#6B7280' },
  listContent: { paddingHorizontal: SP.base, paddingTop: SP.md, paddingBottom:120, gap: SP.md },

  // Card styles are in makeDuoCardStyles (used inside PubCard via useMemo)

  fab: {
    position:'absolute', bottom: 90, right: SP.xl,
    width:56, height:56, borderRadius: R.full,
    justifyContent:'center', alignItems:'center',
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.2, shadowRadius:14, elevation:10,
  },
  fabIcon: { fontSize:28, color:'#FFFFFF', fontWeight:'300', lineHeight:32 },
});