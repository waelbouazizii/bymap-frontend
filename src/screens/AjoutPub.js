// src/screens/AjoutPub.js
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Modal, FlatList,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { R, SP, T, HIT } from '../theme/index';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { getAccessToken } from '../security/secureStorage';
import TUNISIA from '../../assets/tunisia.json';
import { environment } from '../environments/environment';

const API_URL = environment.apiUrl;

// ── Palette mint clair ─────────────────────────────────────────────────────────
const C = {
  green:     '#2DBD7E', greenGlow: 'rgba(45,189,126,0.12)',
  blue:      '#3B7EF6', blueGlow:  'rgba(59,126,246,0.10)',
  bg:        '#F2F5F3',
  white:     '#FFFFFF',
  text:      '#1A1A2E',
  textDim:   '#4B5563',
  textFaint: '#9CA3AF',
  border:    '#E5E7EB',
  inputBg:   '#F8FAFB',
  red:       '#EF4444',
};

// ── Helpers tunisia.json ───────────────────────────────────────────────────────
const GOUVERNORATS = Object.keys(TUNISIA).sort();
// Case-insensitive key lookup so typed values like "tunis" match "Tunis"
function govKey(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  return Object.keys(TUNISIA).find(k => k.toLowerCase() === n) || null;
}
function getDelegations(gov) {
  const key = govKey(gov);
  if (!key) return [];
  return [...new Set(TUNISIA[key].map(r => r.delegation))].sort();
}
function getLocalites(gov, deleg) {
  const key = govKey(gov);
  if (!key || !deleg) return [];
  return TUNISIA[key].filter(r => r.delegation === deleg).map(r => r.localite).filter(Boolean).sort();
}

// ── MediaPicker ────────────────────────────────────────────────────────────────
function MediaPicker({ media, setMedia, accent }) {
  const pickFromGallery = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les paramètres."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' ? ['videos'] : ['images'],
      allowsMultipleSelection: true, quality: 0.85, videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const added = result.assets.map(a => ({ uri: a.uri, type: a.type || type, fileName: a.fileName || `media_${Date.now()}`, mimeType: a.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg') }));
      setMedia(prev => [...prev, ...added]);
    }
  };
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les paramètres."); return; }
    const type = await new Promise((resolve) => {
      Alert.alert('Appareil photo', 'Que voulez-vous capturer ?', [
        { text: 'Photo',  onPress: () => resolve('image') },
        { text: 'Vidéo',  onPress: () => resolve('video') },
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (!type) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: type === 'video' ? ['videos'] : ['images'], quality: 0.85, videoMaxDuration: 60 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia(prev => [...prev, { uri: asset.uri, type, fileName: asset.fileName || `media_${Date.now()}`, mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg') }]);
    }
  };
  const showOptions = () => Alert.alert('Ajouter des médias', '', [
    { text: 'Photos depuis la galerie',    onPress: () => pickFromGallery('image') },
    { text: 'Vidéos depuis la galerie',    onPress: () => pickFromGallery('video') },
    { text: 'Prendre une photo / vidéo',   onPress: pickFromCamera },
    { text: 'Annuler', style: 'cancel' },
  ]);
  const removeMedia = (index) => setMedia(prev => prev.filter((_, i) => i !== index));

  return (
    <View>
      {media.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
          {media.map((item, i) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              {item.type === 'video' && (
                <View style={styles.thumbPlayBadge}>
                  <FontAwesome6 name="play" size={8} color="#FFFFFF" />
                </View>
              )}
              <TouchableOpacity style={styles.thumbRemove} onPress={() => removeMedia(i)}>
                <FontAwesome6 name="xmark" size={10} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={[styles.thumbAdd, { borderColor: accent, backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]} onPress={showOptions} activeOpacity={0.75}>
            <FontAwesome6 name="plus" size={22} color={accent} />
          </TouchableOpacity>
        </ScrollView>
      )}
      {media.length === 0 && (
        <TouchableOpacity style={[styles.photoBox, { borderColor: accent, backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]} onPress={showOptions} activeOpacity={0.8}>
          <View style={[styles.photoIconWrap, { backgroundColor: accent === C.green ? 'rgba(45,189,126,0.15)' : 'rgba(59,126,246,0.12)' }]}>
            <FontAwesome6 name="camera" size={20} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.photoTitle, { color: accent }]}>Ajouter des médias</Text>
            <Text style={styles.photoSub}>Photo ou vidéo (max 60s)</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={14} color={accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}


// ── Selector ───────────────────────────────────────────────────────────────────
function Selector({ label, value, items, onSelect, placeholder, disabled, accent }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => items.filter(i => i.toLowerCase().includes(search.toLowerCase())), [items, search]);

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled, value && { borderColor: accent }]}
        onPress={() => { if (!disabled) { setSearch(''); setOpen(true); } }}
        activeOpacity={disabled ? 1 : 0.75}
      >
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder, value && { color: C.text }]}>
          {value || placeholder}
        </Text>
        <FontAwesome6 name="chevron-down" size={13} color={value ? accent : C.textFaint} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{label}</Text>
          <View style={styles.modalSearchWrap}>
            <FontAwesome6 name="magnifying-glass" size={13} color={C.textFaint} />
            <TextInput
              style={styles.modalSearch}
              placeholder="Rechercher..."
              placeholderTextColor={C.textFaint}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered} keyExtractor={item => item} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, item === value && { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow, borderRadius: 10 }]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text style={[styles.modalItemText, item === value && { fontWeight: '700', color: accent }]}>{item}</Text>
                {item === value && <FontAwesome6 name="check" size={14} color={accent} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>Aucun résultat</Text>}
          />
        </View>
      </Modal>
    </>
  );
}

// Shared zone cache so all LocalisationBlock instances share one fetch
let _zonesCache = null;
async function fetchZones() {
  if (_zonesCache) return _zonesCache;
  try {
    const res  = await fetch(`${API_URL}/zones`);
    const data = await res.json();
    _zonesCache = Array.isArray(data) ? data : (data.zones || []);
  } catch { _zonesCache = []; }
  return _zonesCache;
}

// ── LocalisationBlock ──────────────────────────────────────────────────────────
function LocalisationBlock({ prefix, showDeleg, mode, loc, setLoc }) {
  const accent    = mode === 'duo' ? C.blue : C.green;
  const [zones, setZones] = useState(_zonesCache || []);

  useEffect(() => {
    if (!_zonesCache) fetchZones().then(setZones);
  }, []);

  // Zones whose gouvernorat matches the selected ville → appear in Gouvernorat dropdown
  const zonesForVille = useMemo(
    () => zones.filter(z => z.gouvernorat && norm(z.gouvernorat) === norm(loc.ville)),
    [zones, loc.ville]
  );

  // Extra villes from zones whose gouvernorat is not already in Tunisia JSON
  const extraVilles = useMemo(() => {
    const known = new Set(GOUVERNORATS.map(g => norm(g)));
    return [...new Set(
      zones.map(z => z.gouvernorat).filter(g => g && !known.has(norm(g)))
    )];
  }, [zones]);

  const allVilles       = useMemo(() => [...GOUVERNORATS, ...extraVilles], [extraVilles]);
  const standardDelegs  = useMemo(() => getDelegations(loc.ville), [loc.ville]);
  const zoneGouvernorats = useMemo(() => zonesForVille.map(z => z.name), [zonesForVille]);
  const allGouvernorats  = useMemo(
    () => [...new Set([...standardDelegs, ...zoneGouvernorats])],
    [standardDelegs, zoneGouvernorats]
  );
  const localites = useMemo(() => getLocalites(loc.ville, loc.gouvernorat), [loc.ville, loc.gouvernorat]);

  const handleVille = (v) => setLoc({ ville: v, gouvernorat: '', delegation: '' });

  const handleGov = (g) => {
    // If the selected value is a zone name, store zone name as delegation too (for zone-dots)
    const matchedZone = zonesForVille.find(z => z.name === g);
    setLoc(prev => ({
      ...prev,
      gouvernorat: g,
      delegation:  matchedZone ? matchedZone.name : '',
    }));
  };

  const handleDeleg = (d) => setLoc(prev => ({ ...prev, delegation: d }));

  // Does the currently selected gouvernorat come from a zone?
  const activeZone = loc.gouvernorat
    ? zonesForVille.find(z => z.name === loc.gouvernorat) || null
    : null;

  return (
    <View style={styles.locBlock}>
      {prefix && (
        <View style={[styles.locPrefixBar, { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow, borderColor: accent }]}>
          <FontAwesome6 name={prefix === 'Début' ? 'rocket' : 'flag-checkered'} size={11} color={accent} />
          <Text style={[styles.locPrefixText, { color: accent }]}>{prefix}</Text>
        </View>
      )}

      {/* ── Ville ── */}
      <View style={styles.locRow}>
        <View style={styles.locLabelRow}>
          <FontAwesome6 name="city" size={12} color={C.textDim} />
          <Text style={styles.locLabel}>Ville</Text>
        </View>
        <Selector label="Choisir une ville" value={loc.ville} items={allVilles} onSelect={handleVille} placeholder="Sélectionner..." accent={accent} />
      </View>

      {/* ── Gouvernorat (delegations + zones de cette ville) ── */}
      <View style={[styles.locRow, !loc.ville && styles.locRowDisabled]}>
        <View style={styles.locLabelRow}>
          <FontAwesome6 name="map" size={12} color={!loc.ville ? C.textFaint : C.textDim} />
          <Text style={[styles.locLabel, !loc.ville && styles.locLabelDisabled]}>Gouvernorat</Text>
          {zoneGouvernorats.length > 0 && loc.ville && (
            <View style={[styles.zoneCountBadge, { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]}>
              <FontAwesome6 name="location-dot" size={9} color={accent} />
              <Text style={[styles.zoneCountText, { color: accent }]}>{zoneGouvernorats.length} zone{zoneGouvernorats.length > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <Selector
          label="Choisir un gouvernorat / zone"
          value={loc.gouvernorat}
          items={allGouvernorats}
          onSelect={handleGov}
          placeholder={loc.ville ? 'Sélectionner...' : "Choisir une ville d'abord"}
          disabled={!loc.ville}
          accent={accent}
        />
        {activeZone && (
          <View style={[styles.zoneActiveBadge, { borderColor: accent, backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]}>
            <FontAwesome6 name="circle-check" size={11} color={accent} />
            <Text style={[styles.zoneActiveText, { color: accent }]}>Zone : {activeZone.name}</Text>
          </View>
        )}
      </View>

      {/* ── Délégation (mode local, visible seulement si gouvernorat standard) ── */}
      {showDeleg && !activeZone && (
        <View style={[styles.locRow, !loc.gouvernorat && styles.locRowDisabled]}>
          <View style={styles.locLabelRow}>
            <FontAwesome6 name="location-pin" size={12} color={!loc.gouvernorat ? C.textFaint : C.textDim} />
            <Text style={[styles.locLabel, !loc.gouvernorat && styles.locLabelDisabled]}>Délégation</Text>
            <Text style={styles.locOptional}>(optionnel)</Text>
          </View>
          <Selector label="Choisir une délégation" value={loc.delegation} items={localites} onSelect={handleDeleg} placeholder={loc.gouvernorat ? 'Sélectionner...' : "Choisir un gouvernorat d'abord"} disabled={!loc.gouvernorat} accent={accent} />
        </View>
      )}
    </View>
  );
}

// ── Field card ─────────────────────────────────────────────────────────────────
const Field = ({ label, iconName, accent, children }) => (
  <View style={styles.fieldWrap}>
    <View style={styles.fieldLabelRow}>
      <View style={[styles.fieldIconBox, { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]}>
        <FontAwesome6 name={iconName} size={14} color={accent} />
      </View>
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
    {children}
  </View>
);

const emptyLoc = () => ({ ville: '', gouvernorat: '', delegation: '' });

// ── Zone locked badge ─────────────────────────────────────────────────────────
function ZoneBadge({ loc, accent, label }) {
  const locLabel = [loc.ville, loc.gouvernorat, loc.delegation].filter(Boolean).join(' › ');
  return (
    <View style={styles.zoneBadge}>
      <View style={[styles.zoneBadgeIcon, { backgroundColor: accent === C.green ? C.greenGlow : C.blueGlow }]}>
        <FontAwesome6 name="location-dot" size={14} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        {label ? <Text style={styles.zoneBadgeLabel}>{label}</Text> : null}
        <Text style={[styles.zoneBadgeName, { color: accent }]} numberOfLines={1}>{locLabel}</Text>
        <Text style={styles.zoneBadgeSub}>Zone sélectionnée automatiquement</Text>
      </View>
      <FontAwesome6 name="lock" size={12} color={C.textFaint} />
    </View>
  );
}

// Remove accents for loose matching (é→e, à→a, etc.)
function norm(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Résout un nom de zone (gouvernorat / délégation / localité) → { ville, gouvernorat, delegation }
function resolveZone(zoneName) {
  if (!zoneName) return emptyLoc();
  const zN = norm(zoneName);
  if (!zN) return emptyLoc();

  // 1. Exact gouvernorat (accent-insensitive)
  const exactGov = Object.keys(TUNISIA).find(k => norm(k) === zN);
  if (exactGov) return { ville: exactGov, gouvernorat: '', delegation: '' };

  // 2. Exact delegation name (accent-insensitive)
  for (const [gov, places] of Object.entries(TUNISIA)) {
    const delegs = [...new Set(places.map(p => p.delegation).filter(Boolean))];
    const d = delegs.find(d => norm(d) === zN);
    if (d) return { ville: gov, gouvernorat: d, delegation: '' };
  }

  // 3. Exact localité (accent-insensitive)
  for (const [gov, places] of Object.entries(TUNISIA)) {
    const p = places.find(p => norm(p.localite) === zN);
    if (p) return { ville: gov, gouvernorat: p.delegation || '', delegation: p.localite || '' };
  }

  // 4. Partial gouvernorat match
  const partialGov = Object.keys(TUNISIA).find(k => {
    const kN = norm(k);
    return kN.includes(zN) || zN.includes(kN);
  });
  if (partialGov) return { ville: partialGov, gouvernorat: '', delegation: '' };

  // 5. Partial delegation match
  for (const [gov, places] of Object.entries(TUNISIA)) {
    const delegs = [...new Set(places.map(p => p.delegation).filter(Boolean))];
    const d = delegs.find(d => { const dN = norm(d); return dN.includes(zN) || zN.includes(dN); });
    if (d) return { ville: gov, gouvernorat: d, delegation: '' };
  }

  return emptyLoc();
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function AjoutePub() {
  const navigation = useNavigation();
  const route      = useRoute();

  // Si un filtre (local/duo) est passé depuis LocalScreen, on le pré-sélectionne
  const initialMode = route.params?.mode && route.params.mode !== 'all'
    ? route.params.mode
    : 'local';

  // Localisation pré-remplie depuis la zone de LocalScreen
  const initialLoc = resolveZone(route.params?.zoneName);

  const [mode,    setMode]    = useState(initialMode);
  const [desc,    setDesc]    = useState('');
  const [media,   setMedia]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [loc,      setLoc]      = useState(initialLoc);
  const [locDebut, setLocDebut] = useState(initialLoc);
  const [locFin,   setLocFin]   = useState(emptyLoc());

  // true when the user arrived from a zone click — localisation is locked
  const zoneLocked = !!route.params?.zoneName && (initialLoc.ville !== '' || initialLoc.gouvernorat !== '');

  // Sync state if screen is already mounted and params change (stack reuse)
  const prevZoneName = useRef(route.params?.zoneName);
  useEffect(() => {
    const z = route.params?.zoneName;
    if (z !== prevZoneName.current) {
      prevZoneName.current = z;
      const newLoc = resolveZone(z);
      setLoc(newLoc);
      setLocDebut(newLoc);
    }
  }, [route.params?.zoneName]);

  const accent    = mode === 'duo' ? C.blue : C.green;
  const accentGlow = mode === 'duo' ? C.blueGlow : C.greenGlow;

  const handleModeChange = (m) => { setMode(m); setLoc(initialLoc); setLocDebut(initialLoc); setLocFin(emptyLoc()); };
  const canSubmit = desc.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { Alert.alert('Session expirée', 'Veuillez vous reconnecter pour publier.', [{ text: 'Se connecter', onPress: () => navigation.replace('Login') }]); return; }
      const formData = new FormData();
      formData.append('mode', mode);
      formData.append('description', desc.trim());
      if (mode === 'local') { formData.append('ville', loc.ville); formData.append('gouvernorat', loc.gouvernorat); formData.append('delegation', loc.delegation); }
      else {
        formData.append('debut_ville', locDebut.ville); formData.append('debut_gouvernorat', locDebut.gouvernorat); formData.append('debut_delegation', locDebut.delegation);
        formData.append('fin_ville', locFin.ville); formData.append('fin_gouvernorat', locFin.gouvernorat); formData.append('fin_delegation', locFin.delegation);
      }
      media.forEach((item, index) => {
        const ext = item.uri.split('.').pop() || 'jpg';
        formData.append('medias', { uri: item.uri, type: item.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'), name: item.fileName || `media_${index}.${ext}` });
      });
      const response = await fetch(`${API_URL}/publications`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await response.json();
      if (!response.ok) { Alert.alert('Erreur', data.message || 'Impossible de publier'); return; }

      // ── Alertes post-publication ──────────────────────────────────────────────
      if (data.warning?.type === 'LAST_FREE_POST') {
        Alert.alert(
          'Dernier post gratuit',
          'Il vous reste 1 post gratuit. Après celui-ci, chaque publication consommera 10 points de votre solde.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (data.warning?.type === 'LOW_POINTS') {
        Alert.alert(
          'Solde de points faible',
          `Il vous reste seulement ${data.warning.pointsSolde} point${data.warning.pointsSolde > 1 ? 's' : ''}. Rechargez votre solde pour continuer à publier.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Publication créée !', 'Votre annonce a bien été enregistrée.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch { Alert.alert('Erreur réseau', 'Vérifiez votre connexion et réessayez.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Nouvelle publication</Text>
            <View style={[styles.headerModeBadge, { backgroundColor: accentGlow, borderColor: accent }]}>
              <View style={[styles.headerModeDot, { backgroundColor: accent }]} />
              <Text style={[styles.headerModeText, { color: accent }]}>{mode === 'local' ? 'LOCAL' : 'DUO'}</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Tabs LOCAL / DUO ── */}
        <View style={styles.tabsWrap}>
          <TouchableOpacity
            style={[styles.tab, mode === 'local' && styles.tabActiveLocal]}
            onPress={() => handleModeChange('local')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="location-dot" size={14} color={mode === 'local' ? '#FFFFFF' : C.textFaint} />
            <Text style={[styles.tabText, mode === 'local' && styles.tabTextActive]}>Publication locale</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'duo' && styles.tabActiveDuo]}
            onPress={() => handleModeChange('duo')}
            activeOpacity={0.85}
          >
            <FontAwesome6 name="handshake" size={14} color={mode === 'duo' ? '#FFFFFF' : C.textFaint} />
            <Text style={[styles.tabText, mode === 'duo' && styles.tabTextActive]}>Publication duo</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Field label="Description" iconName="pen-to-square" accent={accent}>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Décrivez votre annonce..."
                placeholderTextColor={C.textFaint}
                value={desc} onChangeText={setDesc}
                multiline numberOfLines={4} textAlignVertical="top"
              />
            </Field>

            <Field label="Photo / Vidéo" iconName="camera" accent={accent}>
              <MediaPicker media={media} setMedia={setMedia} accent={accent} />
            </Field>

            {mode === 'local' ? (
              zoneLocked ? (
                <Field label="Localisation" iconName="location-dot" accent={accent}>
                  <ZoneBadge loc={loc} accent={accent} />
                </Field>
              ) : (
                <Field label="Localisation" iconName="location-dot" accent={accent}>
                  <LocalisationBlock showDeleg={true} mode="local" loc={loc} setLoc={setLoc} />
                </Field>
              )
            ) : (
              <>
                <Field label="Localisation Début" iconName="rocket" accent={accent}>
                  {zoneLocked
                    ? <ZoneBadge loc={locDebut} accent={accent} label="Départ" />
                    : <LocalisationBlock prefix="Début" showDeleg={false} mode="duo" loc={locDebut} setLoc={setLocDebut} />
                  }
                </Field>
                <Field label="Localisation Fin" iconName="flag-checkered" accent={accent}>
                  <LocalisationBlock prefix="Fin" showDeleg={false} mode="duo" loc={locFin} setLoc={setLocFin} />
                </Field>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: accent }, !canSubmit && { opacity: 0.5 }]}
              onPress={handleSubmit} activeOpacity={0.85} disabled={!canSubmit}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <>
                    <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Publier</Text>
                  </>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter:    { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  headerTitle:     { ...T.titleLg, color: '#1A1A2E' },
  headerModeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: R.full, borderWidth: 1, paddingHorizontal: SP.sm, paddingVertical: 3 },
  headerModeDot:   { width: 6, height: 6, borderRadius: 3 },
  headerModeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // ── Tabs
  tabsWrap: {
    flexDirection: 'row', margin: SP.base,
    backgroundColor: '#FFFFFF', borderRadius: R.xl, padding: SP.xs, gap: SP.xs,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SP.md, borderRadius: R.lg, gap: 7, minHeight: HIT.min - 4,
  },
  tabActiveLocal: {
    backgroundColor: '#2DBD7E',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  tabActiveDuo: {
    backgroundColor: '#3B7EF6',
    shadowColor: '#3B7EF6', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  tabText:       { ...T.labelLg, color: '#9CA3AF' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '800' },

  // ── Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SP.base, paddingTop: SP.xs, paddingBottom: SP.base },

  // ── Field card
  fieldWrap: {
    backgroundColor: '#FFFFFF', borderRadius: R.lg, padding: SP.base, marginBottom: SP.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.md },
  fieldIconBox:  { width: 30, height: 30, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  fieldLabel:    { ...T.labelLg, color: '#1A1A2E' },

  // ── Input
  input: {
    backgroundColor: '#F8FAFB', borderRadius: R.md,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    ...T.bodyLg, color: '#1A1A2E',
  },
  textarea: { minHeight: 90, paddingTop: SP.md, textAlignVertical: 'top' },

  // ── Media picker
  photoBox: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    borderRadius: R.md, borderWidth: 1.5, borderStyle: 'dashed',
    paddingHorizontal: SP.base, paddingVertical: SP.base,
  },
  photoIconWrap: { width: 42, height: 42, borderRadius: R.md, justifyContent: 'center', alignItems: 'center' },
  photoTitle:    { ...T.labelLg },
  photoSub:      { ...T.bodyMd, color: '#9CA3AF', marginTop: 2 },

  thumbRow:  { marginBottom: SP.xs },
  thumbWrap: {
    width: 90, height: 90, borderRadius: R.sm, marginRight: SP.sm,
    overflow: 'hidden', backgroundColor: '#E5E7EB',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlayBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  thumbRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
  },
  thumbAdd: {
    width: 90, height: 90, borderRadius: R.sm,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Localisation
  locBlock:         { gap: 12 },
  locPrefixBar:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 2 },
  locPrefixText:    { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  locRow:           { gap: 6 },
  locRowDisabled:   { opacity: 0.4 },
  locLabelRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  locLabel:         { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  locLabelDisabled: { color: '#9CA3AF' },
  locOptional:      { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },

  // ── Zone count badge (next to Gouvernorat label)
  zoneCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  zoneCountText: { fontSize: 10, fontWeight: '700' },

  // ── Zone active badge (shown below Gouvernorat selector when a zone is picked)
  zoneActiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 2,
  },
  zoneActiveText: { fontSize: 12, fontWeight: '700' },

  // ── Selector
  selector: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB', borderRadius: R.md,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: SP.base, paddingVertical: SP.md, minHeight: HIT.min,
  },
  selectorDisabled:    { opacity: 0.45 },
  selectorText:        { flex: 1, ...T.bodyLg, color: '#1A1A2E' },
  selectorPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  // ── Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingHorizontal: SP.base, paddingBottom: SP.xxl, maxHeight: '75%',
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 16,
  },
  modalHandle:     { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: SP.md, marginBottom: SP.base },
  modalTitle:      { ...T.titleMd, color: '#1A1A2E', marginBottom: SP.md, textAlign: 'center' },
  modalSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, backgroundColor: '#F3F4F6', borderRadius: R.md, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: SP.md, marginBottom: SP.sm },
  modalSearch:     { flex: 1, paddingVertical: SP.sm, ...T.bodyLg, color: '#1A1A2E' },
  modalItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md, paddingHorizontal: SP.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6', minHeight: HIT.min },
  modalItemText:   { flex: 1, ...T.bodyLg, color: '#1A1A2E' },
  modalEmpty:      { textAlign: 'center', color: '#9CA3AF', paddingVertical: SP.xl, ...T.bodyMd },

  // ── Zone locked badge
  zoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: '#F8FAFB', borderRadius: R.md,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
  },
  zoneBadgeIcon:  { width: 36, height: 36, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  zoneBadgeLabel: { ...T.labelSm, color: '#9CA3AF', marginBottom: 1 },
  zoneBadgeName:  { ...T.labelLg, color: '#1A1A2E' },
  zoneBadgeSub:   { ...T.bodyMd, color: '#9CA3AF', marginTop: 2 },

  // ── Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SP.sm, marginTop: SP.sm, borderRadius: R.lg, minHeight: HIT.min, paddingVertical: SP.md,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitBtnText: { ...T.titleMd, color: '#FFFFFF', letterSpacing: 1 },
});
