// src/screens/admin/AdminDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  Dimensions, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from '../../security/secureStorage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { API_URL } from '../../environments/environment';
import { R, SP, T, HIT } from '../../theme/index';

const { height } = Dimensions.get('window');

// ── Palette — même thème que LocalScreen ─────────────────────────────────────
const C = {
  green:      '#2DBD7E',
  greenDark:  '#22A06B',
  greenGlow:  'rgba(45,189,126,0.12)',
  blue:       '#3B7EF6',
  blueGlow:   'rgba(59,126,246,0.12)',
  orange:     '#F59E0B',
  orangeGlow: 'rgba(245,158,11,0.12)',
  bg:         '#F2F5F3',
  white:      '#FFFFFF',
  text:       '#1A1A2E',
  textDim:    '#4B5563',
  textFaint:  '#9CA3AF',
  border:     '#E5E7EB',
  borderLight:'#F0F0F0',
  inputBg:    '#F8FAFB',
  red:        '#EF4444',
  redGlow:    'rgba(239,68,68,0.10)',
};

// ── Config stats avec icônes FontAwesome6 ─────────────────────────────────────
const STAT_CONFIG = [
  { key: 'totalUsers',        label: 'Utilisateurs', icon: 'users',        color: C.blue,   glow: C.blueGlow   },
  { key: 'totalPublications', label: 'Publications',  icon: 'newspaper',    color: C.orange, glow: C.orangeGlow },
  { key: 'lieux',             label: 'Lieux actifs',  icon: 'location-dot', color: C.green,  glow: C.greenGlow  },
];

const CATEGORIES = ['Restaurant', 'Hôtel', 'Musée', 'Parc', 'Commerce', 'Sport', 'Santé', 'Autre'];

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, glow, onPress }) => (
  <TouchableOpacity
    style={[styles.statCard, { borderTopColor: color }]}
    onPress={onPress} activeOpacity={onPress ? 0.78 : 1}
  >
    <View style={[styles.statIconBox, { backgroundColor: glow }]}>
      <FontAwesome6 name={icon} size={19} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {onPress && (
      <View style={[styles.statArrow, { backgroundColor: glow }]}>
        <FontAwesome6 name="chevron-right" size={10} color={color} />
      </View>
    )}
  </TouchableOpacity>
);

// ── AddLieuModal ──────────────────────────────────────────────────────────────
const AddLieuModal = ({ visible, onClose, navigation, initialCoords }) => {
  const [nom,         setNom]         = useState('');
  const [adresse,     setAdresse]     = useState('');
  const [categorie,   setCategorie]   = useState('');
  const [description, setDescription] = useState('');
  const [latitude,    setLatitude]    = useState('');
  const [longitude,   setLongitude]   = useState('');

  useEffect(() => {
    if (initialCoords) {
      setLatitude(initialCoords.latitude.toFixed(6));
      setLongitude(initialCoords.longitude.toFixed(6));
    }
  }, [initialCoords]);

  const reset = () => {
    setNom(''); setAdresse(''); setCategorie('');
    setDescription(''); setLatitude(''); setLongitude('');
  };

  const handlePickOnMap = () => { onClose(); navigation.navigate('Map', { pickMode: true }); };

  const handleConfirm = () => {
    if (!nom.trim())     { Alert.alert('Erreur', 'Le nom du lieu est obligatoire.'); return; }
    if (!adresse.trim()) { Alert.alert('Erreur', "L'adresse est obligatoire."); return; }
    if (!categorie)      { Alert.alert('Erreur', 'Choisissez une catégorie.'); return; }
    if (!latitude.trim() || !longitude.trim()) { Alert.alert('Erreur', 'Choisissez une zone sur la carte.'); return; }
    Alert.alert('Lieu ajouté', `"${nom}" a été ajouté à la carte avec succès.`, [
      { text: 'OK', onPress: () => { reset(); onClose(); } },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={m.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
          <View style={m.sheet}>
            <View style={m.sheetHandle} />

            <View style={m.header}>
              <View style={[m.headerIcon, { backgroundColor: C.greenGlow }]}>
                <FontAwesome6 name="location-dot" size={18} color={C.green} />
              </View>
              <Text style={m.title}>Ajouter un lieu</Text>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={m.closeBtn} hitSlop={8}>
                <FontAwesome6 name="xmark" size={16} color={C.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <Text style={m.label}>Nom du lieu <Text style={m.req}>*</Text></Text>
              <TextInput style={m.input} placeholder="Ex : Café Central" placeholderTextColor={C.textFaint} value={nom} onChangeText={setNom} />

              <Text style={m.label}>Adresse <Text style={m.req}>*</Text></Text>
              <TextInput style={m.input} placeholder="Ex : 12 Avenue Habib Bourguiba" placeholderTextColor={C.textFaint} value={adresse} onChangeText={setAdresse} />

              <Text style={m.label}>Catégorie <Text style={m.req}>*</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[m.chip, categorie === cat && m.chipActive]}
                      onPress={() => setCategorie(cat)} activeOpacity={0.8}
                    >
                      <Text style={[m.chipText, categorie === cat && m.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={m.label}>Description</Text>
              <TextInput style={[m.input, m.textArea]} placeholder="Décrivez ce lieu…" placeholderTextColor={C.textFaint} value={description} onChangeText={setDescription} multiline numberOfLines={3} />

              <Text style={m.label}>Zone sur la carte <Text style={m.req}>*</Text></Text>
              <TouchableOpacity style={m.mapBtn} onPress={handlePickOnMap} activeOpacity={0.85}>
                <FontAwesome6 name="map" size={17} color={C.blue} />
                <Text style={m.mapBtnText}>Choisir sur la carte</Text>
              </TouchableOpacity>

              {latitude !== '' && longitude !== '' && (
                <View style={m.coordsBox}>
                  <FontAwesome6 name="circle-check" size={16} color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={m.coordsLabel}>Zone sélectionnée</Text>
                    <Text style={m.coordsVal}>{parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setLatitude(''); setLongitude(''); }} hitSlop={8}>
                    <FontAwesome6 name="xmark" size={14} color={C.textFaint} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={m.btnRow}>
                <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }} activeOpacity={0.8}>
                  <Text style={m.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.confirmBtn} onPress={handleConfirm} activeOpacity={0.88}>
                  <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.confirmGrad}>
                    <FontAwesome6 name="check" size={13} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={m.confirmText}>Confirmer</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ── CascadePicker ─────────────────────────────────────────────────────────────
const CascadePicker = ({ visible, title, items, labelKey, subKey, loading, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? items.filter(it => (labelKey ? it[labelKey] : it).toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { setSearch(''); onClose(); }}>
      <View style={pick.overlay}>
        <View style={pick.sheet}>
          <View style={m.sheetHandle} />
          <View style={pick.header}>
            <Text style={pick.title}>{title}</Text>
            <TouchableOpacity onPress={() => { setSearch(''); onClose(); }} style={m.closeBtn} hitSlop={8}>
              <FontAwesome6 name="xmark" size={16} color={C.textDim} />
            </TouchableOpacity>
          </View>
          <View style={pick.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={14} color={C.textFaint} />
            <TextInput style={pick.searchInput} placeholder="Rechercher…" placeholderTextColor={C.textFaint} value={search} onChangeText={setSearch} autoCorrect={false} />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <FontAwesome6 name="xmark" size={13} color={C.textFaint} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading && <ActivityIndicator color={C.green} style={{ marginVertical: 24 }} />}
            {!loading && filtered.length === 0 && (
              <Text style={pick.empty}>Aucun résultat</Text>
            )}
            {filtered.map((item, i) => {
              const label = labelKey ? item[labelKey] : item;
              const sub   = subKey   ? item[subKey]   : null;
              return (
                <TouchableOpacity
                  key={i}
                  style={[pick.item, i < filtered.length - 1 && pick.itemBorder]}
                  onPress={() => { setSearch(''); onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={pick.itemLabel}>{label}</Text>
                  {sub && <Text style={pick.itemSub}>{sub}</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const PAYS_LIST = [
  { code: 'TN', name: 'Tunisie',   flag: '🇹🇳' },
  { code: 'DZ', name: 'Algérie',   flag: '🇩🇿' },
  { code: 'FR', name: 'France',    flag: '🇫🇷' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'IT', name: 'Italie',    flag: '🇮🇹' },
  { code: 'ES', name: 'Espagne',   flag: '🇪🇸' },
];

// ── AddZoneModal ──────────────────────────────────────────────────────────────
const AddZoneModal = ({ visible, onClose, navigation, initialCoords, onSaved }) => {
  const [pays,        setPays]        = useState(null);
  const [ville,       setVille]       = useState('');
  const [gouvernorat, setGouvernorat] = useState('');
  const [delegation,  setDelegation]  = useState('');
  const [nomZone,     setNomZone]     = useState('');
  const [categorie,   setCategorie]   = useState('');
  const [lat,         setLat]         = useState('');
  const [lng,         setLng]         = useState('');
  const [saving,      setSaving]      = useState(false);

  const [paysOpen,  setPaysOpen]  = useState(false);
  const [villeOpen, setVilleOpen] = useState(false);
  const [govOpen,   setGovOpen]   = useState(false);
  const [delOpen,   setDelOpen]   = useState(false);

  const isTunisia = pays?.code === 'TN';
  const [villes,       setVilles]       = useState([]);
  const [gouvernorats, setGouvernorats] = useState([]);
  const [delegations,  setDelegations]  = useState([]);
  const [loadingV, setLoadingV] = useState(false);
  const [loadingG, setLoadingG] = useState(false);
  const [loadingD, setLoadingD] = useState(false);

  useEffect(() => {
    setVille(''); setGouvernorat(''); setDelegation('');
    setVilles([]); setGouvernorats([]); setDelegations([]);
    if (!initialCoords) { setLat(''); setLng(''); }
  }, [pays]);

  useEffect(() => {
    if (!visible || !pays || !isTunisia) return;
    setLoadingV(true);
    fetch(`${API_URL}/localites/gouvernorats`).then(r => r.json()).then(d => setVilles(d.gouvernorats || [])).catch(() => Alert.alert('Erreur', 'Impossible de charger les gouvernorats.')).finally(() => setLoadingV(false));
  }, [visible, pays]);

  useEffect(() => {
    if (!visible || !pays || isTunisia) return;
    setLoadingV(true);
    fetch(`${API_URL}/pays/${pays.code}/cities`).then(r => r.json()).then(d => setVilles(d.cities || [])).catch(() => Alert.alert('Erreur', 'Impossible de charger les villes.')).finally(() => setLoadingV(false));
  }, [visible, pays]);

  useEffect(() => {
    if (!isTunisia || !ville) return;
    setLoadingG(true);
    fetch(`${API_URL}/localites/delegations?gouvernorat=${encodeURIComponent(ville)}`).then(r => r.json()).then(d => setGouvernorats(d.delegations || [])).catch(() => Alert.alert('Erreur', 'Impossible de charger les délégations.')).finally(() => setLoadingG(false));
  }, [ville, isTunisia]);

  useEffect(() => {
    if (!isTunisia || !ville || !gouvernorat) return;
    setLoadingD(true);
    fetch(`${API_URL}/localites?gouvernorat=${encodeURIComponent(ville)}&delegation=${encodeURIComponent(gouvernorat)}`).then(r => r.json()).then(d => setDelegations(d.localites || [])).catch(() => Alert.alert('Erreur', 'Impossible de charger les localités.')).finally(() => setLoadingD(false));
  }, [ville, gouvernorat, isTunisia]);

  useEffect(() => {
    if (initialCoords) { setLat(initialCoords.latitude.toFixed(6)); setLng(initialCoords.longitude.toFixed(6)); }
  }, [initialCoords]);

  const reset = () => {
    setPays(null); setVille(''); setGouvernorat(''); setDelegation('');
    setNomZone(''); setCategorie(''); setLat(''); setLng('');
    setVilles([]); setGouvernorats([]); setDelegations([]);
  };

  const handlePickOnMap = async () => {
    onClose(); await AsyncStorage.setItem('adminPickTarget', 'zone');
    navigation.navigate('Map', { pickMode: true });
  };

  const handleConfirm = async () => {
    if (!pays)           { Alert.alert('Erreur', 'Sélectionnez un pays.');                                               return; }
    if (!ville)          { Alert.alert('Erreur', isTunisia ? 'Sélectionnez un gouvernorat.' : 'Sélectionnez une ville.'); return; }
    if (!nomZone.trim()) { Alert.alert('Erreur', 'Le nom de la zone est obligatoire.');                                  return; }
    if (!lat || !lng)    { Alert.alert('Erreur', 'Coordonnées manquantes.');                                             return; }
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/admin/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:        nomZone.trim(),
          pays:        pays.name,
          gouvernorat: isTunisia ? ville       : '',
          ville:       isTunisia ? gouvernorat : ville,
          delegation:  delegation  || undefined,
          categorie:   categorie   || undefined,
          lat:         parseFloat(lat),
          lng:         parseFloat(lng),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onSaved(data.zone);
      Alert.alert('Zone ajoutée', `"${nomZone}" est maintenant visible sur la carte.`, [{ text: 'OK', onPress: () => { reset(); onClose(); } }]);
    } catch {
      Alert.alert('Erreur', "Impossible d'ajouter la zone.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CascadePicker visible={paysOpen} title="Choisir un Pays" items={PAYS_LIST.map(p => ({ ...p, label: `${p.flag}  ${p.name}` }))} labelKey="label" loading={false} onSelect={(p) => setPays(p)} onClose={() => setPaysOpen(false)} />
      <CascadePicker visible={villeOpen} title={isTunisia ? 'Choisir un Gouvernorat' : 'Choisir une Ville'} items={villes} labelKey={isTunisia ? undefined : 'name'} loading={loadingV} onSelect={isTunisia ? (v) => { setVille(v); setGouvernorat(''); setDelegation(''); } : (c) => setVille(c.name || c)} onClose={() => setVilleOpen(false)} />
      {isTunisia && <CascadePicker visible={govOpen} title="Choisir une Délégation" items={gouvernorats} loading={loadingG} onSelect={(g) => { setGouvernorat(g); setDelegation(''); }} onClose={() => setGovOpen(false)} />}
      {isTunisia && <CascadePicker visible={delOpen} title="Choisir une Localité" items={delegations} labelKey="localite" loading={loadingD} onSelect={(loc) => { setDelegation(loc.localite); setLat(loc.lat.toFixed(6)); setLng(loc.lng.toFixed(6)); }} onClose={() => setDelOpen(false)} />}

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
        <View style={m.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={m.sheet}>
              <View style={m.sheetHandle} />
              <View style={m.header}>
                <View style={[m.headerIcon, { backgroundColor: C.blueGlow }]}>
                  <FontAwesome6 name="map" size={17} color={C.blue} />
                </View>
                <Text style={m.title}>Nouvelle zone</Text>
                <TouchableOpacity onPress={() => { reset(); onClose(); }} style={m.closeBtn} hitSlop={8}>
                  <FontAwesome6 name="xmark" size={16} color={C.textDim} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                {/* Pays */}
                <Text style={m.label}>Pays <Text style={m.req}>*</Text></Text>
                <TouchableOpacity style={[m.select, pays && m.selectFilled]} onPress={() => setPaysOpen(true)} activeOpacity={0.8}>
                  <Text style={[m.selectText, !pays && m.selectPlaceholder]} numberOfLines={1}>{pays ? `${pays.flag}  ${pays.name}` : 'Sélectionner un pays…'}</Text>
                  <FontAwesome6 name="chevron-down" size={12} color={C.textFaint} />
                </TouchableOpacity>

                {/* Ville / Gouvernorat */}
                <Text style={m.label}>{isTunisia ? 'Gouvernorat' : 'Ville'} <Text style={m.req}>*</Text></Text>
                <TouchableOpacity style={[m.select, ville && m.selectFilled, !pays && m.selectDisabled]} onPress={() => pays && setVilleOpen(true)} activeOpacity={pays ? 0.8 : 1}>
                  <Text style={[m.selectText, !ville && m.selectPlaceholder]} numberOfLines={1}>{ville || (pays ? (isTunisia ? 'Sélectionner un gouvernorat…' : 'Sélectionner une ville…') : "Choisissez d'abord un pays")}</Text>
                  <FontAwesome6 name={pays ? 'chevron-down' : 'minus'} size={12} color={C.textFaint} />
                </TouchableOpacity>

                {isTunisia && (
                  <>
                    <Text style={m.label}>Délégation <Text style={m.labelOptional}>(optionnel)</Text></Text>
                    <TouchableOpacity style={[m.select, gouvernorat && m.selectFilled, !ville && m.selectDisabled]} onPress={() => ville && setGovOpen(true)} activeOpacity={ville ? 0.8 : 1}>
                      <Text style={[m.selectText, !gouvernorat && m.selectPlaceholder]} numberOfLines={1}>{gouvernorat || (ville ? 'Sélectionner une délégation…' : "Choisissez d'abord un gouvernorat")}</Text>
                      <FontAwesome6 name={ville ? 'chevron-down' : 'minus'} size={12} color={C.textFaint} />
                    </TouchableOpacity>
                    <Text style={m.label}>Localité <Text style={m.labelOptional}>(optionnel)</Text></Text>
                    <TouchableOpacity style={[m.select, delegation && m.selectFilled, !gouvernorat && m.selectDisabled]} onPress={() => gouvernorat && setDelOpen(true)} activeOpacity={gouvernorat ? 0.8 : 1}>
                      <Text style={[m.selectText, !delegation && m.selectPlaceholder]} numberOfLines={1}>{delegation || (gouvernorat ? 'Sélectionner une localité…' : "Choisissez d'abord une délégation")}</Text>
                      <FontAwesome6 name={gouvernorat ? 'chevron-down' : 'minus'} size={12} color={C.textFaint} />
                    </TouchableOpacity>
                  </>
                )}

                <Text style={m.label}>Nom de la Zone <Text style={m.req}>*</Text></Text>
                <TextInput style={m.input} placeholder="Ex : Zone Ariana Centre" placeholderTextColor={C.textFaint} value={nomZone} onChangeText={setNomZone} />

                <Text style={m.label}>Catégorie <Text style={m.labelOptional}>(optionnel)</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                    {[
                      { key: 'hotel',       label: 'Hôtel',        icon: 'bed'           },
                      { key: 'sante',       label: 'Santé',        icon: 'hospital'      },
                      { key: 'universite',  label: 'Université',   icon: 'graduation-cap'},
                      { key: 'restaurant',  label: 'Restaurant',   icon: 'utensils'      },
                      { key: 'commerce',    label: 'Commerce',     icon: 'store'         },
                      { key: 'parc',        label: 'Parc',         icon: 'tree'          },
                      { key: 'musee',       label: 'Musée',        icon: 'landmark'      },
                      { key: 'sport',       label: 'Sport',        icon: 'dumbbell'      },
                      { key: 'autre',       label: 'Autre',        icon: 'ellipsis'      },
                    ].map((cat) => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[m.catChip, categorie === cat.key && m.catChipActive]}
                        onPress={() => setCategorie(categorie === cat.key ? '' : cat.key)}
                        activeOpacity={0.8}
                      >
                        <FontAwesome6
                          name={cat.icon}
                          size={12}
                          color={categorie === cat.key ? C.green : C.textDim}
                        />
                        <Text style={[m.catChipText, categorie === cat.key && m.catChipTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={m.label}>Latitude</Text>
                    <TextInput style={[m.input, lat && m.inputFilled]} placeholder="36.8000" placeholderTextColor={C.textFaint} value={lat} onChangeText={setLat} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={m.label}>Longitude</Text>
                    <TextInput style={[m.input, lng && m.inputFilled]} placeholder="10.1800" placeholderTextColor={C.textFaint} value={lng} onChangeText={setLng} keyboardType="decimal-pad" />
                  </View>
                </View>

                <TouchableOpacity style={m.mapBtn} onPress={handlePickOnMap} activeOpacity={0.8}>
                  <FontAwesome6 name="map" size={16} color={C.blue} />
                  <Text style={m.mapBtnText}>Choisir la position sur la carte</Text>
                </TouchableOpacity>

                <View style={m.btnRow}>
                  <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }} activeOpacity={0.8}>
                    <Text style={m.cancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={m.confirmBtn} onPress={handleConfirm} activeOpacity={0.88} disabled={saving}>
                    <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.confirmGrad}>
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                        <>
                          <FontAwesome6 name="check" size={13} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={m.confirmText}>Confirmer</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

// ── EditZoneModal ─────────────────────────────────────────────────────────────
const EditZoneModal = ({ visible, zone, onClose, navigation, initialCoords, onSaved }) => {
  const [nomZone,     setNomZone]     = useState('');
  const [gouvernorat, setGouvernorat] = useState('');
  const [ville,       setVille]       = useState('');
  const [delegation,  setDelegation]  = useState('');
  const [categorie,   setCategorie]   = useState('');
  const [lat,         setLat]         = useState('');
  const [lng,         setLng]         = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (zone) {
      setNomZone(zone.name || '');
      setGouvernorat(zone.gouvernorat || '');
      setVille(zone.ville || '');
      setDelegation(zone.delegation || '');
      setCategorie(zone.categorie || '');
      setLat(zone.lat?.toString() || '');
      setLng(zone.lng?.toString() || '');
    }
  }, [zone]);

  useEffect(() => {
    if (initialCoords) {
      setLat(initialCoords.latitude.toFixed(6));
      setLng(initialCoords.longitude.toFixed(6));
    }
  }, [initialCoords]);

  const handlePickOnMap = async () => {
    if (!zone) return;
    await AsyncStorage.setItem('adminPickTarget', 'editZone');
    await AsyncStorage.setItem('editingZoneId', zone._id);
    onClose();
    navigation.navigate('Map', { pickMode: true });
  };

  const handleConfirm = async () => {
    if (!nomZone.trim()) { Alert.alert('Erreur', 'Le nom de la zone est obligatoire.'); return; }
    if (!lat || !lng)    { Alert.alert('Erreur', 'Coordonnées manquantes.'); return; }
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/admin/zones/${zone._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:        nomZone.trim(),
          pays:        zone.pays,
          gouvernorat: gouvernorat || undefined,
          ville:       ville       || undefined,
          delegation:  delegation  || undefined,
          categorie:   categorie   || undefined,
          lat:         parseFloat(lat),
          lng:         parseFloat(lng),
        }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const updated = json.zone || {
        ...zone,
        name: nomZone.trim(), gouvernorat, ville, delegation, categorie,
        lat: parseFloat(lat), lng: parseFloat(lng),
      };
      onSaved(updated);
      Alert.alert('Zone modifiée', `"${nomZone}" a été mise à jour.`, [{ text: 'OK', onPress: onClose }]);
    } catch {
      Alert.alert('Erreur', "Impossible de modifier la zone.");
    } finally {
      setSaving(false);
    }
  };

  if (!zone) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
          <View style={m.sheet}>
            <View style={m.sheetHandle} />
            <View style={m.header}>
              <View style={[m.headerIcon, { backgroundColor: C.orangeGlow }]}>
                <FontAwesome6 name="pen-to-square" size={16} color={C.orange} />
              </View>
              <Text style={m.title}>Modifier la zone</Text>
              <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={8}>
                <FontAwesome6 name="xmark" size={16} color={C.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={m.label}>Pays</Text>
              <View style={[m.input, { justifyContent: 'center', backgroundColor: '#F9FAFB' }]}>
                <Text style={{ color: C.text }}>{zone.pays || '—'}</Text>
              </View>

              <Text style={m.label}>Gouvernorat</Text>
              <TextInput style={m.input} placeholder="Gouvernorat" placeholderTextColor={C.textFaint} value={gouvernorat} onChangeText={setGouvernorat} />

              <Text style={m.label}>Ville / Délégation</Text>
              <TextInput style={m.input} placeholder="Ville" placeholderTextColor={C.textFaint} value={ville} onChangeText={setVille} />

              <Text style={m.label}>Localité <Text style={m.labelOptional}>(optionnel)</Text></Text>
              <TextInput style={m.input} placeholder="Localité" placeholderTextColor={C.textFaint} value={delegation} onChangeText={setDelegation} />

              <Text style={m.label}>Nom de la Zone <Text style={m.req}>*</Text></Text>
              <TextInput style={m.input} placeholder="Ex : Zone Ariana Centre" placeholderTextColor={C.textFaint} value={nomZone} onChangeText={setNomZone} />

              <Text style={m.label}>Catégorie <Text style={m.labelOptional}>(optionnel)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                  {[
                    { key: 'hotel',      label: 'Hôtel',      icon: 'bed'            },
                    { key: 'sante',      label: 'Santé',      icon: 'hospital'       },
                    { key: 'universite', label: 'Université', icon: 'graduation-cap' },
                    { key: 'restaurant', label: 'Restaurant', icon: 'utensils'       },
                    { key: 'commerce',   label: 'Commerce',   icon: 'store'          },
                    { key: 'parc',       label: 'Parc',       icon: 'tree'           },
                    { key: 'musee',      label: 'Musée',      icon: 'landmark'       },
                    { key: 'sport',      label: 'Sport',      icon: 'dumbbell'       },
                    { key: 'autre',      label: 'Autre',      icon: 'ellipsis'       },
                  ].map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[m.catChip, categorie === cat.key && m.catChipActive]}
                      onPress={() => setCategorie(categorie === cat.key ? '' : cat.key)}
                      activeOpacity={0.8}
                    >
                      <FontAwesome6 name={cat.icon} size={12} color={categorie === cat.key ? C.green : C.textDim} />
                      <Text style={[m.catChipText, categorie === cat.key && m.catChipTextActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Latitude</Text>
                  <TextInput style={[m.input, lat && m.inputFilled]} placeholder="36.8000" placeholderTextColor={C.textFaint} value={lat} onChangeText={setLat} keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Longitude</Text>
                  <TextInput style={[m.input, lng && m.inputFilled]} placeholder="10.1800" placeholderTextColor={C.textFaint} value={lng} onChangeText={setLng} keyboardType="decimal-pad" />
                </View>
              </View>

              <TouchableOpacity style={m.mapBtn} onPress={handlePickOnMap} activeOpacity={0.8}>
                <FontAwesome6 name="map" size={16} color={C.blue} />
                <Text style={m.mapBtnText}>Mettre à jour la position sur la carte</Text>
              </TouchableOpacity>

              <View style={m.btnRow}>
                <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={m.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.confirmBtn} onPress={handleConfirm} activeOpacity={0.88} disabled={saving}>
                  <LinearGradient colors={[C.orange, '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.confirmGrad}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <FontAwesome6 name="check" size={13} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={m.confirmText}>Enregistrer</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ── Parsing JSON zones ────────────────────────────────────────────────────────
function parseZonesFromJson(raw) {
  if (Array.isArray(raw)) {
    return raw.map(z => ({ name: (z.name || z.localite || z.nom || '').toString().trim() || 'Sans nom', gouvernorat: z.gouvernorat || '', ville: z.ville || z.delegation || '', lat: z.lat ?? z.latitude, lng: z.lng ?? z.longitude }));
  }
  if (raw.zones && Array.isArray(raw.zones)) return parseZonesFromJson(raw.zones);
  const result = [];
  for (const [gov, locs] of Object.entries(raw)) {
    if (!Array.isArray(locs)) continue;
    for (const loc of locs) result.push({ name: (loc.localite || loc.name || 'Sans nom').toString().trim(), gouvernorat: gov, ville: loc.delegation || '', lat: loc.lat, lng: loc.lng });
  }
  return result;
}

// ── ImportJsonModal ───────────────────────────────────────────────────────────
const ImportJsonModal = ({ visible, onClose, onImport }) => {
  const [fileName,   setFileName]   = useState(null);
  const [preview,    setPreview]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [parsedData, setParsedData] = useState(null);
  const [picking,    setPicking]    = useState(false);
  const [importing,  setImporting]  = useState(false);

  const reset = () => { setFileName(null); setPreview([]); setTotal(0); setParsedData(null); };

  const pickFile = async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const zones = parseZonesFromJson(JSON.parse(content));
      setFileName(asset.name); setParsedData(zones); setTotal(zones.length); setPreview(zones.slice(0, 3));
    } catch {
      Alert.alert('Erreur', "Impossible de lire le fichier. Vérifiez que c'est un JSON valide.");
    } finally {
      setPicking(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;
    setImporting(true);
    try { await onImport(parsedData); reset(); onClose(); }
    catch (e) { Alert.alert('Erreur', e.message || "Impossible d'importer les zones."); }
    finally { setImporting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={m.overlay}>
        <View style={[m.sheet, { paddingBottom: 40 }]}>
          <View style={m.sheetHandle} />
          <View style={m.header}>
            <View style={[m.headerIcon, { backgroundColor: C.orangeGlow }]}>
              <FontAwesome6 name="file-import" size={17} color={C.orange} />
            </View>
            <Text style={m.title}>Importer JSON</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={m.closeBtn} hitSlop={8}>
              <FontAwesome6 name="xmark" size={16} color={C.textDim} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={m.mapBtn} onPress={pickFile} activeOpacity={0.85} disabled={picking}>
            <FontAwesome6 name={picking ? 'clock' : 'folder-open'} size={17} color={C.blue} />
            <Text style={m.mapBtnText} numberOfLines={1}>{picking ? 'Lecture en cours…' : fileName || 'Choisir un fichier JSON'}</Text>
          </TouchableOpacity>

          {parsedData && (
            <>
              <View style={imp.infoBox}>
                <FontAwesome6 name="circle-check" size={14} color={C.green} style={{ marginRight: 6 }} />
                <Text style={imp.infoText}>{total} zone(s) trouvée(s)</Text>
              </View>
              {preview.map((z, i) => (
                <View key={i} style={imp.row}>
                  <FontAwesome6 name="location-dot" size={12} color={C.green} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={imp.rowName} numberOfLines={1}>{z.name}</Text>
                    <Text style={imp.rowSub} numberOfLines={1}>{[z.gouvernorat, z.ville].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
              ))}
              {total > 3 && <Text style={imp.more}>… et {total - 3} autre(s)</Text>}
            </>
          )}

          <View style={[m.btnRow, { marginTop: 20 }]}>
            <TouchableOpacity style={m.cancelBtn} onPress={() => { reset(); onClose(); }} activeOpacity={0.8}>
              <Text style={m.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.confirmBtn, (!parsedData || importing) && { opacity: 0.5 }]} onPress={handleImport} activeOpacity={0.88} disabled={!parsedData || importing}>
              <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={m.confirmGrad}>
                {importing ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <FontAwesome6 name="file-import" size={13} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={m.confirmText}>Importer {total > 0 ? `(${total})` : ''}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const imp = StyleSheet.create({
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.greenGlow, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(45,189,126,0.3)', padding: 12, marginBottom: 12 },
  infoText: { fontSize: 14, fontWeight: '700', color: C.green },
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  rowName: { fontSize: 13, fontWeight: '700', color: C.text },
  rowSub:  { fontSize: 11, color: C.textFaint, marginTop: 2 },
  more:    { fontSize: 12, color: C.textFaint, textAlign: 'center', paddingVertical: 8 },
});

// ── ZonesView ─────────────────────────────────────────────────────────────────
function ZonesView({ onBack, onAdd, onImport, onExport, zones, loading, onDelete, onEdit }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.subHeader}>
        {!!onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color={C.text} />
          </TouchableOpacity>
        )}
        <FontAwesome6 name="map" size={18} color={C.green} />
        <Text style={styles.subHeaderTitle}>Zones de la carte</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{zones.length}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionChip, { backgroundColor: C.blueGlow, borderColor: C.blue }]} onPress={onAdd} activeOpacity={0.85}>
          <FontAwesome6 name="plus" size={13} color={C.blue} />
          <Text style={[styles.actionChipText, { color: C.blue }]}>Ajouter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionChip, { backgroundColor: C.greenGlow, borderColor: C.green }]} onPress={onImport} activeOpacity={0.85}>
          <FontAwesome6 name="file-import" size={13} color={C.green} />
          <Text style={[styles.actionChipText, { color: C.green }]}>Importer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionChip, { backgroundColor: C.orangeGlow, borderColor: C.orange }]} onPress={onExport} activeOpacity={0.85}>
          <FontAwesome6 name="file-export" size={13} color={C.orange} />
          <Text style={[styles.actionChipText, { color: C.orange }]}>Exporter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderBox}><ActivityIndicator size="large" color={C.green} /></View>
      ) : zones.length === 0 ? (
        <View style={styles.emptyBox}>
          <FontAwesome6 name="map" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Aucune zone ajoutée</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
          {zones.map(z => (
            <View key={z._id} style={styles.zoneCard}>
              <View style={[styles.zoneIconBox, { backgroundColor: C.greenGlow }]}>
                <FontAwesome6 name="location-dot" size={20} color={C.green} />
              </View>
              <View style={styles.zoneInfo}>
                <Text style={styles.zoneName} numberOfLines={1}>{z.name}</Text>
                {z.pays ? <Text style={styles.zonePays} numberOfLines={1}>{z.pays}</Text> : null}
                {(z.gouvernorat || z.ville) ? (
                  <Text style={styles.zoneLoc} numberOfLines={1}>{[z.gouvernorat, z.ville].filter(Boolean).join(' · ')}</Text>
                ) : null}
                <Text style={styles.zoneCoords}>{z.lat?.toFixed(4)}, {z.lng?.toFixed(4)}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(z)} activeOpacity={0.75}>
                  <FontAwesome6 name="pen-to-square" size={14} color={C.orange} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(z)} activeOpacity={0.75}>
                  <FontAwesome6 name="trash" size={14} color={C.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── UsersListView ─────────────────────────────────────────────────────────────
function UsersListView({ onBack, onSelectUser }) {
  const [users,          setUsers]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const [loadMore,       setLoadMore]       = useState(false);
  const [addModal,       setAddModal]       = useState(false);
  const [modalUser,      setModalUser]      = useState(null);
  const [pointsToAdd,    setPointsToAdd]    = useState('');
  const [freePostsToAdd, setFreePostsToAdd] = useState('');
  const [adding,         setAdding]         = useState(false);

  const fetchUsers = useCallback(async (p = 1, q = search, reset = false) => {
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/admin/users?page=${p}&limit=20&search=${encodeURIComponent(q)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(prev => reset ? data.users : [...prev, ...data.users]);
      setHasMore(p < data.pages); setPage(p);
    } catch { Alert.alert('Erreur', 'Impossible de charger les utilisateurs.'); }
    finally { setLoading(false); setLoadMore(false); }
  }, [search]);

  useEffect(() => { setLoading(true); fetchUsers(1, search, true); }, [search]);

  const toggleActive = async (user) => {
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/admin/users/${user._id}/toggle`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error();
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, isActive: !u.isActive } : u));
    } catch { Alert.alert('Erreur', 'Impossible de modifier le statut.'); }
  };

  const deleteUser = (user) => {
    Alert.alert('Supprimer', `Supprimer ${[user.prenom, user.nom].filter(Boolean).join(' ') || user.email} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          const token = await getAccessToken();
          const res   = await fetch(`${API_URL}/admin/users/${user._id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) throw new Error();
          setUsers(prev => prev.filter(u => u._id !== user._id));
        } catch { Alert.alert('Erreur', 'Impossible de supprimer.'); }
      }},
    ]);
  };

  const openAddModal = (u) => {
    setModalUser(u);
    setPointsToAdd('');
    setFreePostsToAdd('');
    setAddModal(true);
  };

  const handleAddPoints = async () => {
    const pts  = parseInt(pointsToAdd    || '0', 10);
    const free = parseInt(freePostsToAdd || '0', 10);
    if (pts < 0 || free < 0 || isNaN(pts) || isNaN(free)) {
      Alert.alert('Erreur', 'Entrez des valeurs positives.'); return;
    }
    if (pts === 0 && free === 0) {
      Alert.alert('Erreur', 'Entrez au moins une valeur.'); return;
    }
    setAdding(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/admin/users/${modalUser._id}/add-points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ points: pts, freePosts: free }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setUsers(prev => prev.map(u => u._id === modalUser._id ? { ...u, pointsSolde: data.user.pointsSolde, freePostsRemaining: data.user.freePostsRemaining } : u));
      setAddModal(false);
      Alert.alert('Succès', `Solde mis à jour :\n🪙 ${data.user.pointsSolde} pts  ·  📰 ${data.user.freePostsRemaining} posts gratuits`);
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setAdding(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.subHeader}>
        {!!onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color={C.text} />
          </TouchableOpacity>
        )}
        <FontAwesome6 name="users" size={18} color={C.blue} />
        <Text style={styles.subHeaderTitle}>Utilisateurs</Text>
        <View style={[styles.countBadge, { backgroundColor: C.blueGlow }]}>
          <Text style={[styles.countBadgeText, { color: C.blue }]}>{users.length}</Text>
        </View>
      </View>

      {/* ── Modal ajout points / posts gratuits ── */}
      <Modal visible={addModal} transparent animationType="fade" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.40)' }}>
          <View style={styles.addPointsSheet}>

            <View style={styles.addPointsHeader}>
              <LinearGradient colors={[C.green, C.greenDark]} style={styles.addPointsIconBox}>
                <FontAwesome6 name="circle-plus" size={18} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.addPointsTitle}>Créditer un compte</Text>
                <Text style={styles.addPointsSub} numberOfLines={1}>
                  {modalUser ? [modalUser.prenom, modalUser.nom].filter(Boolean).join(' ') || modalUser.email : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddModal(false)} hitSlop={10}>
                <FontAwesome6 name="xmark" size={16} color={C.textDim} />
              </TouchableOpacity>
            </View>

            {/* Solde actuel */}
            {modalUser && (
              <View style={styles.addPointsCurrent}>
                <View style={styles.addPointsCurrentItem}>
                  <FontAwesome6 name="coins" size={13} color={C.orange} />
                  <Text style={[styles.addPointsCurrentVal, { color: C.orange }]}>{modalUser.pointsSolde ?? 0} pts actuels</Text>
                </View>
                <View style={styles.addPointsCurrentSep} />
                <View style={styles.addPointsCurrentItem}>
                  <FontAwesome6 name="newspaper" size={13} color={C.green} />
                  <Text style={[styles.addPointsCurrentVal, { color: C.green }]}>{modalUser.freePostsRemaining ?? 0} posts gratuits</Text>
                </View>
              </View>
            )}

            <Text style={styles.addPointsFieldLabel}>Points à ajouter</Text>
            <View style={styles.addPointsInputRow}>
              <FontAwesome6 name="coins" size={15} color={C.orange} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.addPointsInput}
                keyboardType="numeric"
                placeholder="ex: 100"
                placeholderTextColor={C.textFaint}
                value={pointsToAdd}
                onChangeText={setPointsToAdd}
              />
            </View>

            <Text style={styles.addPointsFieldLabel}>Posts gratuits à ajouter</Text>
            <View style={styles.addPointsInputRow}>
              <FontAwesome6 name="newspaper" size={15} color={C.green} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.addPointsInput}
                keyboardType="numeric"
                placeholder="ex: 5"
                placeholderTextColor={C.textFaint}
                value={freePostsToAdd}
                onChangeText={setFreePostsToAdd}
              />
            </View>

            <TouchableOpacity
              style={[styles.addPointsConfirmBtn, adding && { opacity: 0.6 }]}
              onPress={handleAddPoints}
              activeOpacity={0.82}
              disabled={adding}
            >
              {adding
                ? <ActivityIndicator color="#fff" />
                : <><FontAwesome6 name="check" size={14} color="#fff" /><Text style={styles.addPointsConfirmText}>Confirmer</Text></>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.searchBox}>
        <FontAwesome6 name="magnifying-glass" size={15} color={C.textFaint} />
        <TextInput style={styles.searchInput} placeholder="Rechercher par nom, email…" placeholderTextColor={C.textFaint} value={search} onChangeText={setSearch} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <FontAwesome6 name="xmark" size={14} color={C.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loaderBox}><ActivityIndicator size="large" color={C.green} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listPad}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent: e }) => {
            if (!hasMore || loadMore) return;
            if (e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 60) { setLoadMore(true); fetchUsers(page + 1, search, false); }
          }}
          scrollEventThrottle={200}
        >
          {users.length === 0 && (
            <View style={styles.emptyBox}>
              <FontAwesome6 name="user" size={52} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun utilisateur trouvé</Text>
            </View>
          )}
          {users.map((u) => {
            const name    = [u.prenom, u.nom].filter(Boolean).join(' ') || '—';
            const initial = name[0]?.toUpperCase() || '?';
            const active  = u.isActive !== false;
            const pts     = u.pointsSolde        ?? 0;
            const free    = u.freePostsRemaining ?? 0;
            return (
              <TouchableOpacity key={u._id} style={styles.userCard} onPress={() => onSelectUser(u)} activeOpacity={0.8}>
                <LinearGradient
                  colors={active ? [C.green, C.greenDark] : ['#D1D5DB', '#9CA3AF']}
                  style={styles.userAvatar}
                >
                  <Text style={styles.userAvatarText}>{initial}</Text>
                </LinearGradient>

                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.userEmail} numberOfLines={1}>{u.email || u.phone || '—'}</Text>

                  {/* Soldes : points + posts gratuits */}
                  <View style={styles.userSoldesRow}>
                    <FontAwesome6 name="coins" size={10} color={C.orange} />
                    <Text style={[styles.userSoldeText, { color: pts <= 10 ? C.red : C.orange }]}>{pts} pts</Text>
                    <View style={styles.userSoldeSep} />
                    <FontAwesome6 name="newspaper" size={10} color={C.green} />
                    <Text style={[styles.userSoldeText, { color: free === 0 ? C.red : C.green }]}>{free} gratuits</Text>
                  </View>

                  <View style={[styles.userBadge, { backgroundColor: active ? C.greenGlow : C.redGlow }]}>
                    <View style={[styles.userBadgeDot, { backgroundColor: active ? C.green : C.red }]} />
                    <Text style={[styles.userBadgeText, { color: active ? C.green : C.red }]}>{active ? 'Actif' : 'Inactif'}</Text>
                  </View>
                </View>

                <View style={styles.userActions}>
                  {/* Bouton + créditer */}
                  <TouchableOpacity
                    style={[styles.actionIconBtn, { backgroundColor: C.greenGlow, borderColor: C.green }]}
                    onPress={(e) => { e.stopPropagation?.(); openAddModal(u); }} activeOpacity={0.75}
                  >
                    <FontAwesome6 name="plus" size={13} color={C.green} />
                  </TouchableOpacity>
                  {/* Bouton activer/désactiver */}
                  <TouchableOpacity
                    style={[styles.actionIconBtn, { backgroundColor: active ? C.orangeGlow : C.greenGlow, borderColor: active ? C.orange : C.green }]}
                    onPress={(e) => { e.stopPropagation?.(); toggleActive(u); }} activeOpacity={0.75}
                  >
                    <FontAwesome6 name={active ? 'lock' : 'lock-open'} size={13} color={active ? C.orange : C.green} />
                  </TouchableOpacity>
                  {/* Bouton supprimer */}
                  <TouchableOpacity
                    style={[styles.actionIconBtn, { backgroundColor: C.redGlow, borderColor: C.red }]}
                    onPress={(e) => { e.stopPropagation?.(); deleteUser(u); }} activeOpacity={0.75}
                  >
                    <FontAwesome6 name="trash" size={13} color={C.red} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
          {loadMore && <ActivityIndicator color={C.green} style={{ marginVertical: 12 }} />}
        </ScrollView>
      )}
    </View>
  );
}

// ── UserPostsView ─────────────────────────────────────────────────────────────
function UserPostsView({ user, onBack }) {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/publications?auteur=${user._id}&limit=50`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) { const data = await res.json(); setPosts(data.publications || data.pubs || data.data || []); }
      } catch { Alert.alert('Erreur', 'Impossible de charger les publications.'); }
      finally { setLoading(false); }
    })();
  }, [user._id]);

  const name = [user.prenom, user.nom].filter(Boolean).join(' ') || user.email || '—';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <FontAwesome6 name="arrow-left" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.subHeaderTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.subHeaderSub}>Publications</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{posts.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderBox}><ActivityIndicator size="large" color={C.green} /></View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyBox}>
          <FontAwesome6 name="inbox" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Aucune publication</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
          {posts.map((p) => {
            const isLocal = p.mode === 'local';
            const accent  = isLocal ? C.green : C.blue;
            const glow    = isLocal ? C.greenGlow : C.blueGlow;
            const loc     = isLocal
              ? [p.localisation?.ville, p.localisation?.gouvernorat].filter(Boolean).join(', ')
              : [p.localisationDebut?.ville, '→', p.localisationFin?.ville].filter(Boolean).join(' ');
            const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : '';
            return (
              <View key={p._id} style={styles.postCard}>
                <View style={[styles.postAccentBar, { backgroundColor: accent }]} />
                <View style={{ flex: 1 }}>
                  <View style={[styles.postModeBadge, { backgroundColor: glow, borderColor: accent }]}>
                    <View style={[styles.postModeDot, { backgroundColor: accent }]} />
                    <Text style={[styles.postModeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
                  </View>
                  <Text style={styles.postDesc} numberOfLines={2}>{p.description || '—'}</Text>
                  {!!loc && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <FontAwesome6 name="location-dot" size={11} color={C.textFaint} />
                      <Text style={styles.postLoc} numberOfLines={1}>{loc}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.postMeta}>
                  <Text style={styles.postDate}>{date}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <FontAwesome6 name="heart" size={11} color={C.red} />
                    <Text style={styles.postStat}>{p.nbLikes ?? p.likes?.length ?? 0}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <FontAwesome6 name="eye" size={11} color={C.textFaint} />
                    <Text style={styles.postStat}>{p.vues ?? 0}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── Navbar tabs config ────────────────────────────────────────────────────────
const NAV_TABS = [
  { key: 'zones',        label: 'Zones',    icon: 'map'       },
  { key: 'users',        label: 'Membres',  icon: 'users'     },
  { key: 'publications', label: 'Posts',    icon: 'newspaper' },
  { key: 'parametres',   label: 'Réglages', icon: 'gear'      },
];

// ── BottomNavbar ──────────────────────────────────────────────────────────────
const BottomNavbar = ({ active, onPress }) => (
  <View style={nb.bar}>
    {NAV_TABS.map(tab => {
      const isActive = active === tab.key;
      return (
        <TouchableOpacity key={tab.key} style={nb.item} onPress={() => onPress(tab.key)} activeOpacity={0.7}>
          {isActive && <View style={nb.indicator} />}
          <View style={[nb.iconBox, isActive && nb.iconBoxActive]}>
            <FontAwesome6 name={tab.icon} size={19} color={isActive ? C.green : C.textFaint} />
          </View>
          <Text style={[nb.label, isActive && nb.labelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const nb = StyleSheet.create({
  bar:          { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 12, paddingBottom: 6 },
  item:         { flex: 1, alignItems: 'center', paddingTop: 6, paddingBottom: 2, position: 'relative' },
  indicator:    { position: 'absolute', top: 0, width: 32, height: 3, borderRadius: 1.5, backgroundColor: C.green },
  iconBox:      { width: 42, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  iconBoxActive:{ backgroundColor: C.greenGlow },
  label:        { fontSize: 10, fontWeight: '600', color: C.textFaint, marginTop: 2 },
  labelActive:  { color: C.green, fontWeight: '800' },
});

// ── PublicationsView ──────────────────────────────────────────────────────────
function PublicationsView() {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/publications?limit=80`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) { const d = await res.json(); setPosts(d.publications || d.pubs || d.data || []); }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const deletePost = async (p) => {
    Alert.alert('Supprimer', 'Supprimer cette publication ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          const token = await getAccessToken();
          const res = await fetch(`${API_URL}/publications/${p._id}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            setPosts(prev => prev.filter(x => x._id !== p._id));
          } else {
            Alert.alert('Erreur', 'Impossible de supprimer.');
          }
        } catch { Alert.alert('Erreur', 'Impossible de supprimer.'); }
      }},
    ]);
  };

  const filtered = search.trim()
    ? posts.filter(p => (p.description || '').toLowerCase().includes(search.toLowerCase()))
    : posts;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.subHeader}>
        <FontAwesome6 name="newspaper" size={18} color={C.orange} />
        <Text style={styles.subHeaderTitle}>Publications</Text>
        <View style={[styles.countBadge, { backgroundColor: C.orangeGlow }]}>
          <Text style={[styles.countBadgeText, { color: C.orange }]}>{posts.length}</Text>
        </View>
      </View>
      <View style={styles.searchBox}>
        <FontAwesome6 name="magnifying-glass" size={15} color={C.textFaint} />
        <TextInput style={styles.searchInput} placeholder="Rechercher…" placeholderTextColor={C.textFaint} value={search} onChangeText={setSearch} />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><FontAwesome6 name="xmark" size={14} color={C.textFaint} /></TouchableOpacity>}
      </View>
      {loading ? (
        <View style={styles.loaderBox}><ActivityIndicator size="large" color={C.orange} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <FontAwesome6 name="newspaper" size={52} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Aucune publication</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
          {filtered.map((p) => {
            const isLocal = p.mode === 'local';
            const accent  = isLocal ? C.green : C.blue;
            const glow    = isLocal ? C.greenGlow : C.blueGlow;
            return (
              <View key={p._id} style={styles.postCard}>
                <View style={[styles.postAccentBar, { backgroundColor: accent }]} />
                <View style={{ flex: 1 }}>
                  <View style={[styles.postModeBadge, { backgroundColor: glow, borderColor: accent }]}>
                    <View style={[styles.postModeDot, { backgroundColor: accent }]} />
                    <Text style={[styles.postModeText, { color: accent }]}>{isLocal ? 'LOCAL' : 'DUO'}</Text>
                  </View>
                  <Text style={styles.postDesc} numberOfLines={2}>{p.description || '—'}</Text>
                </View>
                <View style={styles.postMeta}>
                  <Text style={styles.postDate}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : ''}</Text>
                  <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                    <FontAwesome6 name="heart" size={11} color={C.red} />
                    <Text style={styles.postStat}>{p.nbLikes ?? 0}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deletePost(p)}
                    hitSlop={8}
                    style={{ padding: 4, borderRadius: 6, backgroundColor: C.redGlow }}
                  >
                    <FontAwesome6 name="trash" size={12} color={C.red} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ── ParametresView ────────────────────────────────────────────────────────────
function ParametresView({ stats, statsLoading, onImportTunisia, importingTunisia, onLogout }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.subHeader}>
        <FontAwesome6 name="gear" size={18} color={C.textDim} />
        <Text style={styles.subHeaderTitle}>Paramètres</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.listPad, { paddingTop: 16 }]} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.welcomeCard}>
          <View style={styles.welcomeLeft}>
            <Text style={styles.welcomeTitle}>Vue d'ensemble</Text>
            <Text style={styles.welcomeSub}>Aperçu de l'activité ByMap</Text>
          </View>
          <View style={styles.welcomeIconBox}>
            <FontAwesome6 name="shield-halved" size={36} color="rgba(255,255,255,0.25)" />
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Statistiques</Text>
        {statsLoading ? (
          <ActivityIndicator color={C.green} />
        ) : (
          <View style={styles.statsRow}>
            {STAT_CONFIG.map((cfg) => (
              <StatCard key={cfg.key} label={cfg.label} value={stats ? String(stats[cfg.key] ?? 0) : '—'} icon={cfg.icon} color={cfg.color} glow={cfg.glow} />
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Base de données</Text>
        <TouchableOpacity style={styles.quickCard} onPress={onImportTunisia} activeOpacity={0.82} disabled={importingTunisia}>
          <View style={[styles.quickCardIcon, { backgroundColor: C.orangeGlow }]}>
            {importingTunisia ? <ActivityIndicator size="small" color={C.orange} /> : <FontAwesome6 name="file-import" size={22} color={C.orange} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickCardTitle}>Importer Tunisia.json</Text>
            <Text style={styles.quickCardSub}>Réimporter les 4 868 localités</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={13} color={C.textFaint} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Compte</Text>
        <TouchableOpacity style={[styles.quickCard, { borderColor: 'rgba(239,68,68,0.2)' }]} onPress={onLogout} activeOpacity={0.82}>
          <View style={[styles.quickCardIcon, { backgroundColor: C.redGlow }]}>
            <FontAwesome6 name="right-from-bracket" size={22} color={C.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quickCardTitle, { color: C.red }]}>Déconnexion</Text>
            <Text style={styles.quickCardSub}>Quitter le panneau admin</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={13} color={C.textFaint} />
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ── AdminDashboard principal ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigation = useNavigation();
  const route      = useRoute();

  const [view,              setView]              = useState('zones');
  const [selectedUser,      setSelectedUser]      = useState(null);
  const [modalVisible,      setModalVisible]      = useState(false);
  const [pickedCoords,      setPickedCoords]      = useState(null);
  const [zoneModalVisible,  setZoneModalVisible]  = useState(false);
  const [zonePickedCoords,  setZonePickedCoords]  = useState(null);
  const [zones,             setZones]             = useState([]);
  const [zonesLoading,      setZonesLoading]      = useState(false);
  const [importModal,         setImportModal]         = useState(false);
  const [importingTunisia,    setImportingTunisia]    = useState(false);
  const [stats,               setStats]               = useState(null);
  const [statsLoading,        setStatsLoading]        = useState(true);
  const [editZoneModal,       setEditZoneModal]       = useState(false);
  const [editingZone,         setEditingZone]         = useState(null);
  const [editZonePickedCoords,setEditZonePickedCoords]= useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [statsRes] = await Promise.all([fetch(`${API_URL}/admin/stats`, { headers })]);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch { Alert.alert('Erreur', 'Impossible de charger les statistiques.'); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchZones = useCallback(async () => {
    setZonesLoading(true);
    try {
      const token = await getAccessToken();
      const res   = await fetch(`${API_URL}/admin/zones`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) { const data = await res.json(); setZones(data.zones || []); }
    } catch { Alert.alert('Erreur', 'Impossible de charger les zones.'); }
    finally { setZonesLoading(false); }
  }, []);

  useEffect(() => { if (view === 'zones') fetchZones(); }, [view, fetchZones]);

  const handleDeleteZone = (zone) => {
    Alert.alert('Supprimer', `Supprimer la zone "${zone.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          const token = await getAccessToken();
          const res   = await fetch(`${API_URL}/admin/zones/${zone._id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) throw new Error();
          setZones(prev => prev.filter(z => z._id !== zone._id));
        } catch { Alert.alert('Erreur', 'Impossible de supprimer la zone.'); }
      }},
    ]);
  };

  useEffect(() => {
    if (!route?.params?.pickedCoords) return;
    (async () => {
      const target = await AsyncStorage.getItem('adminPickTarget') || 'lieu';
      await AsyncStorage.removeItem('adminPickTarget');
      if (target === 'zone') {
        setZonePickedCoords(route.params.pickedCoords); setView('zones'); setZoneModalVisible(true);
      } else if (target === 'editZone') {
        const zoneId = await AsyncStorage.getItem('editingZoneId');
        await AsyncStorage.removeItem('editingZoneId');
        setZones(prev => {
          const zone = prev.find(z => z._id === zoneId);
          if (zone) setEditingZone(zone);
          return prev;
        });
        setEditZonePickedCoords(route.params.pickedCoords);
        setView('zones');
        setEditZoneModal(true);
      } else {
        setPickedCoords(route.params.pickedCoords); setModalVisible(true);
      }
    })();
  }, [route?.params?.pickedCoords]);

  const handleImportTunisia = () => {
    Alert.alert('Importer Tunisia.json', 'Cela va réimporter toutes les localités (4 868 entrées). Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Importer', onPress: async () => {
        setImportingTunisia(true);
        try {
          const token = await getAccessToken();
          const res = await fetch(`${API_URL}/admin/localites/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Erreur serveur');
          Alert.alert('Import réussi', `${data.imported} localités importées en base.`);
        } catch (e) { Alert.alert('Erreur', e.message || "Impossible d'importer."); }
        finally { setImportingTunisia(false); }
      }},
    ]);
  };

  const handleExportZones = async () => {
    if (zones.length === 0) { Alert.alert('Aucune zone', "Il n'y a aucune zone à exporter."); return; }
    try { await Share.share({ message: JSON.stringify(zones, null, 2), title: 'zones_bymap.json' }); }
    catch { Alert.alert('Erreur', "Impossible d'exporter les zones."); }
  };

  const handleImportZones = async (parsedZones) => {
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}/admin/zones/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ zones: parsedZones }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur serveur');
    Alert.alert('Import réussi', `${data.imported} zone(s) importée(s) sur ${data.total}.`);
    fetchZones();
  };

  const handleEditZone = (zone) => {
    setEditingZone(zone);
    setEditZonePickedCoords(null);
    setEditZoneModal(true);
  };

  const handleSaveEditZone = (updatedZone) => {
    setZones(prev => prev.map(z => z._id === updatedZone._id ? updatedZone : z));
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter du panneau admin ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => navigation.replace('Login') },
    ]);
  };


  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <AddLieuModal visible={modalVisible} onClose={() => { setModalVisible(false); setPickedCoords(null); }} navigation={navigation} initialCoords={pickedCoords} />
      <AddZoneModal visible={zoneModalVisible} onClose={() => { setZoneModalVisible(false); setZonePickedCoords(null); }} navigation={navigation} initialCoords={zonePickedCoords} onSaved={(zone) => setZones(prev => [zone, ...prev])} />
      <EditZoneModal visible={editZoneModal} zone={editingZone} onClose={() => { setEditZoneModal(false); setEditingZone(null); setEditZonePickedCoords(null); }} navigation={navigation} initialCoords={editZonePickedCoords} onSaved={handleSaveEditZone} />
      <ImportJsonModal visible={importModal} onClose={() => setImportModal(false)} onImport={handleImportZones} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <LinearGradient colors={[C.green, C.greenDark]} style={styles.headerLogo}>
          <FontAwesome6 name="shield-halved" size={16} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSub}>ByMap — Tableau de bord</Text>
        </View>
        {/* Notifications */}
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('AdminNotifications')}
          activeOpacity={0.75}
        >
          <FontAwesome6 name="bell" size={17} color={C.green} />
          <View style={styles.notifBadge} />
        </TouchableOpacity>
        {/* Déconnexion */}
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: C.redGlow, borderColor: 'rgba(239,68,68,0.25)' }]}
          onPress={handleLogout}
          activeOpacity={0.75}
        >
          <FontAwesome6 name="right-from-bracket" size={16} color={C.red} />
        </TouchableOpacity>
      </View>

      {/* ── Contenu par onglet ── */}
      <View style={{ flex: 1 }}>
        {view === 'zones'        && <ZonesView onBack={null} onAdd={() => setZoneModalVisible(true)} onImport={() => setImportModal(true)} onExport={handleExportZones} zones={zones} loading={zonesLoading} onDelete={handleDeleteZone} onEdit={handleEditZone} />}
        {view === 'users'        && <UsersListView onBack={null} onSelectUser={(u) => { setSelectedUser(u); setView('userPosts'); }} />}
        {view === 'publications' && <PublicationsView />}
        {view === 'parametres'   && <ParametresView stats={stats} statsLoading={statsLoading} onImportTunisia={handleImportTunisia} importingTunisia={importingTunisia} onLogout={handleLogout} />}
        {view === 'userPosts'    && selectedUser && <UserPostsView user={selectedUser} onBack={() => setView('users')} />}
      </View>

      {/* ── Bottom Navbar (masquée sur vues imbriquées) ── */}
      {view !== 'userPosts' && <BottomNavbar active={view} onPress={setView} />}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight,
    gap: SP.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  headerLogo:    { width: 40, height: 40, borderRadius: R.md, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { ...T.titleLg, color: C.text },
  headerSub:     { ...T.bodyMd, fontSize: 11, color: C.textFaint, marginTop: 1 },
  headerIconBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.md,
    backgroundColor: C.greenGlow, borderWidth: 1, borderColor: 'rgba(45,189,126,0.25)',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.red,
    borderWidth: 1.5, borderColor: C.white,
  },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.redGlow, paddingHorizontal: SP.md, paddingVertical: SP.sm,
    borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  logoutText: { ...T.labelLg, color: C.red },

  // Sub-header
  subHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SP.base, paddingVertical: SP.md, gap: SP.sm,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
  },
  subHeaderTitle: { flex: 1, ...T.titleLg, color: C.text },
  subHeaderSub:   { ...T.bodyMd, fontSize: 11, color: C.textFaint },
  countBadge:     { backgroundColor: C.greenGlow, borderRadius: R.full, paddingHorizontal: SP.sm, paddingVertical: 3 },
  countBadgeText: { ...T.labelLg, color: C.green },

  // Welcome card
  welcomeCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: R.xl, padding: SP.lg, marginTop: SP.lg, marginBottom: SP.xs,
    overflow: 'hidden',
    shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  welcomeLeft:    { flex: 1 },
  welcomeTitle:   { ...T.headline, color: '#FFFFFF' },
  welcomeSub:     { ...T.bodyMd, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  welcomeIconBox: { justifyContent: 'center', alignItems: 'center' },

  // Section title
  sectionTitle: { ...T.titleLg, color: C.text, marginTop: SP.lg, marginBottom: SP.md },

  // Stats
  statsRow: { flexDirection: 'row', gap: SP.md },
  statCard: {
    flex: 1, backgroundColor: C.white,
    borderRadius: R.xl, borderTopWidth: 3, padding: SP.base, gap: SP.xs,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  statIconBox:  { width: 40, height: 40, borderRadius: R.md, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' },
  statValue:    { ...T.displaySm, marginTop: SP.xs },
  statLabel:    { ...T.labelSm, color: C.textDim },
  statArrow:    { width: 24, height: 24, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end', marginTop: SP.xs },

  // Quick action cards
  quickCard: {
    flexDirection: 'row', alignItems: 'center', gap: SP.base,
    backgroundColor: C.white,
    borderRadius: R.xl, borderWidth: 1, borderColor: C.borderLight,
    padding: SP.base, marginBottom: SP.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  quickCardIcon:  { width: 52, height: 52, borderRadius: R.md, justifyContent: 'center', alignItems: 'center' },
  quickCardTitle: { ...T.titleMd, color: C.text },
  quickCardSub:   { ...T.bodyMd, color: C.textDim, marginTop: 2 },

  // Search box
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: R.full, paddingHorizontal: SP.base, paddingVertical: SP.sm,
    margin: SP.md, minHeight: HIT.min - 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, ...T.bodyLg, color: C.text, padding: 0 },

  // Zone actions row
  actionsRow: { flexDirection: 'row', gap: SP.sm, paddingHorizontal: SP.base, paddingVertical: SP.md },
  actionChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SP.sm, borderRadius: R.lg, borderWidth: 1.5, minHeight: HIT.min - 8,
  },
  actionChipText: { ...T.labelLg },

  // Zone card
  zoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: C.white,
    borderRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderLight,
    padding: SP.base, marginBottom: SP.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  zoneIconBox: { width: 46, height: 46, borderRadius: R.md, justifyContent: 'center', alignItems: 'center' },
  zoneInfo:    { flex: 1, gap: 2 },
  zoneName:    { ...T.labelLg, color: C.text },
  zonePays:    { ...T.bodyMd, fontWeight: '700', color: C.blue },
  zoneLoc:     { ...T.bodyMd, color: C.textDim },
  zoneCoords:  { ...T.bodyMd, fontSize: 11, color: C.textFaint },
  editBtn:     { width: HIT.min - 8, height: HIT.min - 8, borderRadius: R.md, backgroundColor: C.orangeGlow, borderWidth: 1.5, borderColor: C.orange, justifyContent: 'center', alignItems: 'center' },
  deleteBtn:   { width: HIT.min - 8, height: HIT.min - 8, borderRadius: R.md, backgroundColor: C.redGlow, borderWidth: 1.5, borderColor: C.red, justifyContent: 'center', alignItems: 'center' },

  // User card
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: SP.md,
    backgroundColor: C.white,
    borderRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderLight,
    padding: SP.base, marginBottom: SP.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  userAvatar:     { width: 46, height: 46, borderRadius: R.full, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  userInfo:       { flex: 1, gap: 3 },
  userName:       { ...T.titleMd, color: C.text },
  userEmail:      { ...T.bodyMd, color: C.textFaint },
  userBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: SP.sm, paddingVertical: 3, borderRadius: R.full },
  userBadgeDot:   { width: 6, height: 6, borderRadius: 3 },
  userBadgeText:  { ...T.labelSm },
  userActions:    { gap: 6 },
  actionIconBtn:  { width: HIT.min - 8, height: HIT.min - 8, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },

  userSoldesRow:  { flexDirection: 'row', alignItems: 'center', gap: SP.xs, marginBottom: 2 },
  userSoldeText:  { ...T.bodyMd, fontWeight: '700' },
  userSoldeSep:   { width: 1, height: 10, backgroundColor: C.border, marginHorizontal: 2 },

  // Modal ajout points
  addPointsSheet: {
    width: '88%', backgroundColor: C.white, borderRadius: R.xl,
    padding: SP.lg, gap: SP.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 16,
  },
  addPointsHeader:      { flexDirection: 'row', alignItems: 'center', gap: SP.md, marginBottom: SP.xs },
  addPointsIconBox:     { width: 40, height: 40, borderRadius: R.md, justifyContent: 'center', alignItems: 'center' },
  addPointsTitle:       { ...T.titleMd, color: C.text },
  addPointsSub:         { ...T.bodyMd, color: C.textFaint, marginTop: 1 },
  addPointsCurrent:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6, marginBottom: SP.xs },
  addPointsCurrentItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  addPointsCurrentVal:  { ...T.labelLg },
  addPointsCurrentSep:  { width: 1, height: 16, backgroundColor: C.border },
  addPointsFieldLabel:  { ...T.labelLg, color: C.textDim, marginTop: SP.xs },
  addPointsInputRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: SP.md, paddingVertical: 2 },
  addPointsInput:       { flex: 1, ...T.titleMd, color: C.text, paddingVertical: SP.sm },
  addPointsConfirmBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, backgroundColor: C.green, borderRadius: R.lg, minHeight: HIT.min, marginTop: SP.xs },
  addPointsConfirmText: { ...T.titleMd, color: '#fff' },

  // Post card
  postCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SP.md,
    backgroundColor: C.white,
    borderRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.borderLight,
    padding: SP.base, marginBottom: SP.md, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
  },
  postAccentBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  postModeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: R.full, borderWidth: 1, paddingHorizontal: SP.sm, paddingVertical: 3, marginBottom: 6, marginLeft: SP.sm },
  postModeDot:    { width: 6, height: 6, borderRadius: 3 },
  postModeText:   { ...T.labelSm },
  postDesc:       { ...T.bodyMd, color: C.textDim, marginLeft: SP.sm },
  postLoc:        { ...T.bodyMd, fontSize: 11, color: C.textFaint, marginLeft: SP.sm },
  postMeta:       { alignItems: 'flex-end', gap: 5, minWidth: 52 },
  postDate:       { ...T.bodyMd, fontSize: 11, color: C.textFaint },
  postStat:       { ...T.bodyMd, color: C.textDim },

  // Loader / Empty
  loaderBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: SP.md },
  emptyTitle:{ ...T.titleMd, color: C.textDim },
  listPad:   { paddingHorizontal: SP.base, paddingTop: SP.md, paddingBottom: 120 },
});

// ── Styles modaux ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%', maxHeight: height * 0.88,
    backgroundColor: C.white, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.xxl,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: SP.base },
  header:     { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.lg },
  headerIcon: { width: 38, height: 38, borderRadius: R.md, justifyContent: 'center', alignItems: 'center' },
  title:      { flex: 1, ...T.titleLg, color: C.text },
  closeBtn:   { width: HIT.min - 8, height: HIT.min - 8, borderRadius: R.sm, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  label:         { ...T.labelLg, color: C.textDim, marginBottom: SP.xs, marginTop: SP.md },
  req:           { color: C.red },
  labelOptional: { ...T.bodyMd, fontSize: 11, fontWeight: '400', color: C.textFaint },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SP.md, paddingVertical: SP.sm, borderRadius: R.full,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: C.border,
  },
  catChipActive:     { backgroundColor: C.greenGlow, borderColor: C.green },
  catChipText:       { ...T.bodyMd, color: C.textDim },
  catChipTextActive: { color: C.green, fontWeight: '700' },
  input: {
    backgroundColor: C.inputBg, borderRadius: R.md, borderWidth: 1.5,
    borderColor: C.border, paddingHorizontal: SP.base, paddingVertical: SP.md,
    ...T.bodyLg, color: C.text, marginBottom: 2,
  },
  inputFilled: { borderColor: C.green, backgroundColor: C.greenGlow },
  textArea:    { minHeight: 80, textAlignVertical: 'top' },
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.inputBg, borderRadius: R.md, borderWidth: 1.5,
    borderColor: C.border, paddingHorizontal: SP.base, paddingVertical: SP.md,
    minHeight: HIT.min,
  },
  selectFilled:      { borderColor: C.green, backgroundColor: C.greenGlow },
  selectDisabled:    { opacity: 0.4 },
  selectText:        { ...T.bodyLg, color: C.text, fontWeight: '600', flex: 1 },
  selectPlaceholder: { color: C.textFaint, fontWeight: '400' },
  chip:           { paddingHorizontal: SP.base, paddingVertical: SP.sm, borderRadius: R.full, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: C.border },
  chipActive:     { backgroundColor: C.greenGlow, borderColor: C.green },
  chipText:       { ...T.bodyMd, color: C.textDim, fontWeight: '600' },
  chipTextActive: { color: C.green },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    backgroundColor: C.blueGlow, borderRadius: R.md,
    borderWidth: 1.5, borderColor: C.blue,
    paddingHorizontal: SP.base, paddingVertical: SP.md,
    marginTop: SP.sm, marginBottom: SP.xs, minHeight: HIT.min,
  },
  mapBtnText: { ...T.labelLg, color: C.blue, flex: 1 },
  coordsBox: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    backgroundColor: C.greenGlow, borderRadius: R.md,
    borderWidth: 1.5, borderColor: 'rgba(45,189,126,0.3)',
    paddingHorizontal: SP.base, paddingVertical: SP.md, marginTop: SP.xs, marginBottom: SP.sm,
  },
  coordsLabel: { ...T.bodyMd, color: C.textDim },
  coordsVal:   { ...T.labelLg, color: C.text, marginTop: 1 },
  btnRow:     { flexDirection: 'row', gap: SP.md, marginTop: SP.base },
  cancelBtn:  { flex: 1, minHeight: HIT.min, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: C.border },
  cancelText: { ...T.titleMd, color: C.textDim },
  confirmBtn: { flex: 2, borderRadius: R.lg, overflow: 'hidden' },
  confirmGrad:{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: HIT.min },
  confirmText:{ ...T.titleMd, color: '#FFFFFF' },
});

// ── Styles pickers ────────────────────────────────────────────────────────────
const pick = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: C.white, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingTop: SP.md, maxHeight: height * 0.75 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: SP.base, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight },
  title:       { ...T.titleLg, color: C.text },
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: SP.sm, margin: SP.md, paddingHorizontal: SP.base, paddingVertical: SP.sm, backgroundColor: C.inputBg, borderRadius: R.md, borderWidth: 1.5, borderColor: C.border },
  searchInput: { flex: 1, ...T.bodyLg, color: C.text, padding: 0 },
  empty:       { textAlign: 'center', paddingVertical: SP.xl, color: C.textFaint, ...T.bodyMd },
  item:        { paddingHorizontal: SP.lg, paddingVertical: SP.md, minHeight: HIT.min - 4 },
  itemBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight },
  itemLabel:   { ...T.titleMd, color: C.text },
  itemSub:     { ...T.bodyMd, color: C.textFaint, marginTop: 2 },
});
