// src/screens/PublicationDetail.js
import React, { useState } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Image, FlatList, Dimensions, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getAccessToken } from '../security/secureStorage';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getCurrentUser } from '../utils/api';
import { useTranslation } from 'react-i18next';
import { environment } from '../environments/environment';
import { getActiveServerUrl } from '../utils/serverBalancer';

const API_URL    = environment.apiUrl;
const SERVER_BASE = API_URL.replace('/api', '');
const { width }  = Dimensions.get('window');

// ── Couleurs — thème clair mint (même que LocalScreen) ────────────────────────
const C = {
  local:       '#2DBD7E',
  localGlow:   'rgba(45,189,126,0.12)',
  duo:         '#3B7EF6',
  duoGlow:     'rgba(59,126,246,0.12)',
  glass:       '#FFFFFF',
  glassMid:    '#E8F5EE',
  glassBorder: '#E5E7EB',
  white:       '#1A1A2E',
  textDim:     '#4B5563',
  textFaint:   '#9CA3AF',
  red:         '#EF4444',
};

function fixMediaUrl(url) {
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
}

function getMediaUri(m) {
  if (!m) return null;
  const raw = (typeof m === 'string') ? m : (m.url || m.path || m.uri || m.src || m.filename || null);
  return fixMediaUrl(raw);
}

function isVideoMedia(m) {
  if (!m) return false;
  if (typeof m === 'string') return /\.(mp4|mov|avi|webm|mkv|m4v|3gp)(\?.*)?$/i.test(m);
  const t = (m.type || m.mimetype || m.mimeType || m.contentType || '').toLowerCase();
  if (t === 'video' || t.startsWith('video/')) return true;
  const url = m.url || m.path || m.uri || m.src || m.filename || '';
  return /\.(mp4|mov|avi|webm|mkv|m4v|3gp)(\?.*)?$/i.test(url);
}

// ── Video item ────────────────────────────────────────────────────────────────
function VideoItem({ uri, shouldPlay, onPress }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; });
  React.useEffect(() => {
    if (shouldPlay) player.play(); else player.pause();
  }, [shouldPlay, player]);
  return (
    <TouchableOpacity style={styles.mediaSlide} activeOpacity={0.9} onPress={onPress}>
      <VideoView player={player} style={styles.mediaImage} contentFit="cover" nativeControls={false} />
      {!shouldPlay && (
        <View style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <FontAwesome6 name="play" size={22} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Download image helper ─────────────────────────────────────────────────────
async function downloadImage(uri) {
  try {
    const dest = new File(Paths.cache, `bymap_${Date.now()}.jpg`);
    const file = await File.downloadFileAsync(uri, dest);

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      await MediaLibrary.saveToLibraryAsync(file.uri);
      Alert.alert('Téléchargé', 'Image enregistrée dans votre galerie.');
    } else {
      // Expo Go or permission denied — share instead so the user can save manually
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', dialogTitle: 'Enregistrer l\'image' });
      } else {
        Alert.alert('Permission refusée', "Autorisez l'accès à la galerie pour télécharger.");
      }
    }
  } catch {
    Alert.alert('Erreur', "Impossible de télécharger l'image.");
  }
}

// ── Carousel ──────────────────────────────────────────────────────────────────
function MediaCarousel({ medias }) {
  const [index,  setIndex]  = useState(0);
  const [paused, setPaused] = useState(true);
  if (!medias || medias.length === 0) return null;

  return (
    <View>
      <FlatList
        data={medias} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={e => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          setPaused(true);
        }}
        renderItem={({ item, index: i }) => {
          const uri = getMediaUri(item);
          if (isVideoMedia(item)) return (
            <VideoItem uri={uri} shouldPlay={i === index && !paused} onPress={() => setPaused(p => !p)} />
          );
          return (
            <View style={styles.mediaSlide}>
              <Image source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => downloadImage(uri)}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="download" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          );
        }}
      />
      {medias.length > 1 && (
        <View style={styles.dotsRow}>
          {medias.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotActive]} />)}
        </View>
      )}
    </View>
  );
}

// ── InfoRow avec icône FontAwesome6 ───────────────────────────────────────────
const InfoRow = ({ iconName, label, value }) =>
  value ? (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <FontAwesome6 name={iconName} size={13} color={C.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  ) : null;

// ─────────────────────────────────────────────────────────────────────────────
export default function PublicationDetail() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { t }      = useTranslation();
  const pub        = route.params?.publication;

  const [liked,      setLiked]      = useState(false);
  const [nbLikes,    setNbLikes]    = useState(pub?.nbLikes ?? pub?.likes?.length ?? 0);
  const [avgRating,  setAvgRating]  = useState(pub?.avgRating ?? 0);
  const [nbRatings,  setNbRatings]  = useState(pub?.nbRatings ?? pub?.ratings?.length ?? 0);
  const [userRating, setUserRating] = useState(0);

  React.useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user || !pub?.ratings) return;
        const mine = pub.ratings.find(r => String(r.user) === String(user._id));
        if (mine) setUserRating(mine.value);
      } catch {}
    })();
  }, []);

  if (!pub) return (
    <View style={{ flex: 1, backgroundColor: '#F2F5F3' }}>
      <SafeAreaView style={styles.safe}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: C.textDim }}>
          {t('publicationDetail.notFound')}
        </Text>
      </SafeAreaView>
    </View>
  );

  const isLocal   = pub.mode === 'local';
  const accent    = isLocal ? C.local : C.duo;
  const accentGlow = isLocal ? C.localGlow : C.duoGlow;

  const authorName    = [pub.auteur?.prenom, pub.auteur?.nom].filter(Boolean).join(' ') || 'Anonyme';
  const authorInitial = authorName[0]?.toUpperCase() || '?';

  const formattedDate = pub.createdAt
    ? new Date(pub.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const handleLike = async () => {
    try {
      const token = await getAccessToken();
      if (!token) { Alert.alert(t('publicationDetail.loginRequired'), t('publicationDetail.loginToLike')); return; }
      const res = await fetch(`${API_URL}/publications/${pub._id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const data = await res.json(); setLiked(data.liked); setNbLikes(data.nbLikes); }
    } catch {}
  };

  const handleRate = async (value) => {
    try {
      const token = await getAccessToken();
      if (!token) { Alert.alert(t('publicationDetail.loginRequired'), t('publicationDetail.loginToRate')); return; }
      const res = await fetch(`${API_URL}/publications/${pub._id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        const data = await res.json();
        setAvgRating(data.avgRating);
        setNbRatings(data.nbRatings);
        setUserRating(data.userRating);
      }
    } catch {}
  };

  const handleContact = async () => {
    const user = await getCurrentUser();
    if (!user) { navigation.navigate('Login'); return; }
    if (!pub.auteur?._id) { Alert.alert('Contact', 'Aucune information disponible pour cet auteur.'); return; }
    navigation.navigate('Messages', {
      recipient: {
        _id: pub.auteur._id,
        prenom: pub.auteur.prenom || '',
        nom: pub.auteur.nom || '',
        phone: pub.auteur.phone || pub.auteur.telephone || '',
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F5F3' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={[styles.modeBadge, { backgroundColor: accentGlow, borderColor: accent }]}>
            <FontAwesome6
              name={isLocal ? 'location-dot' : 'handshake'}
              size={12}
              color={accent}
            />
            <Text style={[styles.modeText, { color: accent }]}>{isLocal ? t('common.local') : t('common.duo')}</Text>
          </View>

          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* ── Carousel ── */}
          <MediaCarousel medias={pub.medias} />

          <View style={styles.body}>

            {/* ── Auteur + Like ── */}
            <View style={styles.authorCard}>
              {/* Barre accent */}
              <View style={[styles.cardAccentBar, { backgroundColor: accent }]} />

              <View style={styles.authorRow}>
                <LinearGradient
                  colors={isLocal ? [C.local, '#28A745'] : [C.duo, '#0A6FCC']}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarLetter}>{authorInitial}</Text>
                </LinearGradient>

                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName}>{authorName}</Text>
                  {formattedDate ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <FontAwesome6 name="calendar" size={10} color={C.textFaint} />
                      <Text style={styles.authorDate}>{formattedDate}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity style={styles.likeBtn} onPress={handleLike} activeOpacity={0.8}>
                  <FontAwesome6
                    name="heart"
                    size={20}
                    color={liked ? C.red : C.textFaint}
                    solid={liked}
                  />
                  <Text style={[styles.likeCount, liked && { color: C.red }]}>{nbLikes}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Description ── */}
            {pub.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('publicationDetail.description')}</Text>
                <View style={styles.descCard}>
                  <Text style={styles.descText}>{pub.description}</Text>
                </View>
              </View>
            ) : null}

            {/* ── Note ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('publicationDetail.rating')}</Text>
              <View style={styles.ratingCard}>
                <View style={styles.ratingAvgRow}>
                  <Text style={styles.ratingAvgNum}>
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                  </Text>
                  <View>
                    <View style={styles.starsRow}>
                      {[1,2,3,4,5].map(s => (
                        <FontAwesome6
                          key={s} name="star" size={15}
                          color={s <= Math.round(avgRating) ? '#F59E0B' : '#E5E7EB'}
                          solid={s <= Math.round(avgRating)}
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingCountText}>
                      {t('publicationDetail.ratingCount', { count: nbRatings })}
                    </Text>
                  </View>
                </View>
                <View style={styles.ratingDivider} />
                <View style={styles.ratingUserRow}>
                  <Text style={styles.ratingUserLabel}>{t('publicationDetail.rateThis')}</Text>
                  <View style={styles.starsRow}>
                    {[1,2,3,4,5].map(s => (
                      <TouchableOpacity key={s} onPress={() => handleRate(s)} activeOpacity={0.7}>
                        <FontAwesome6
                          name="star" size={30}
                          color={s <= userRating ? '#F59E0B' : '#D1D5DB'}
                          solid={s <= userRating}
                          style={{ marginHorizontal: 4 }}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* ── Localisation ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('publicationDetail.location')}</Text>
              {isLocal ? (
                <View style={styles.locCard}>
                  <InfoRow iconName="city"          label={t('publicationDetail.city')}        value={pub.localisation?.ville} />
                  <InfoRow iconName="map"            label={t('publicationDetail.governorate')} value={pub.localisation?.gouvernorat} />
                  <InfoRow iconName="location-dot"   label={t('publicationDetail.delegation')}  value={pub.localisation?.delegation} />
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={styles.locCard}>
                    <View style={[styles.locPrefixBar, { backgroundColor: accent }]}>
                      <FontAwesome6 name="circle-dot" size={10} color="#FFFFFF" />
                      <Text style={styles.locPrefixText}>{t('publicationDetail.departure')}</Text>
                    </View>
                    <InfoRow iconName="city" label={t('publicationDetail.city')}        value={pub.localisationDebut?.ville} />
                    <InfoRow iconName="map"  label={t('publicationDetail.governorate')} value={pub.localisationDebut?.gouvernorat} />
                  </View>
                  <View style={styles.locCard}>
                    <View style={[styles.locPrefixBar, { backgroundColor: accent }]}>
                      <FontAwesome6 name="flag-checkered" size={10} color="#FFFFFF" />
                      <Text style={styles.locPrefixText}>{t('publicationDetail.arrival')}</Text>
                    </View>
                    <InfoRow iconName="city" label={t('publicationDetail.city')}        value={pub.localisationFin?.ville} />
                    <InfoRow iconName="map"  label={t('publicationDetail.governorate')} value={pub.localisationFin?.gouvernorat} />
                  </View>
                </View>
              )}
            </View>

            {/* ── Stats ── */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <FontAwesome6 name="eye" size={16} color={C.textFaint} />
                <Text style={styles.statValue}>{pub.vues ?? 0}</Text>
                <Text style={styles.statLabel}>{t('publicationDetail.views')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <FontAwesome6 name="heart" size={16} color={C.textFaint} />
                <Text style={styles.statValue}>{nbLikes}</Text>
                <Text style={styles.statLabel}>{t('publicationDetail.likes')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <FontAwesome6 name="images" size={16} color={C.textFaint} />
                <Text style={styles.statValue}>{pub.medias?.length ?? 0}</Text>
                <Text style={styles.statLabel}>{t('publicationDetail.media')}</Text>
              </View>
            </View>

            <View style={{ height: 16 }} />
          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: accent }]}
            onPress={handleContact}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="comment" size={16} color="#FFFFFF" />
            <Text style={styles.contactText}>{t('publicationDetail.contact')}</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ── Styles — thème clair mint ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  modeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },

  // ── Carousel
  mediaSlide:  { width, height: 280, backgroundColor: '#E5E7EB' },
  mediaImage:  { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  playCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  dotsRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 5 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: C.duo, width: 18, borderRadius: 3 },

  // ── Body
  body: { padding: 16, gap: 16 },

  // ── Author card
  authorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  cardAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, borderRadius: 2,
  },
  authorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 18, paddingRight: 14, paddingVertical: 14,
  },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  authorName:   { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  authorDate:   { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  likeBtn:      { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  likeCount:    { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },

  // ── Sections
  section:      { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E', paddingLeft: 2 },

  descCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  descText: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  locCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 16, padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  locPrefixBar: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 2,
  },
  locPrefixText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  infoValue: { fontSize: 14, color: '#1A1A2E', fontWeight: '600', marginTop: 1 },

  // ── Stats
  ratingCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, gap: 14,
  },
  ratingAvgRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ratingAvgNum: { fontSize: 38, fontWeight: '900', color: '#1A1A2E', width: 62 },
  starsRow:     { flexDirection: 'row', gap: 2 },
  ratingCountText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  ratingDivider:   { height: 1, backgroundColor: '#F3F4F6' },
  ratingUserRow:   { gap: 10 },
  ratingUserLabel: { fontSize: 13, fontWeight: '700', color: '#4B5563' },

  statsRow: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statItem:    { alignItems: 'center', flex: 1, gap: 4 },
  statValue:   { fontSize: 20, fontWeight: '800', color: '#1A1A2E' },
  statLabel:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  statDivider: { width: 1, height: 36, backgroundColor: '#E5E7EB' },

  // ── Footer
  footer: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 10,
  },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 15, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  contactText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  downloadBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
});
