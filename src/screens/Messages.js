// src/screens/Messages.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../environments/environment';
import { useCall } from '../context/CallContext';
import EmptyState from '../components/EmptyState';
import { R, SP, T, HIT } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';

export default function Messages() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();
  const route      = useRoute();
  const { recipient } = route.params;

  const [messages, setMessages] = useState([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [myId,     setMyId]     = useState(null);

  const flatRef  = useRef(null);
  const pollRef  = useRef(null);

  const { socketRef } = useCall();

  // ── Get local userId ───────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => { if (id) setMyId(id); });
  }, []);

  // ── Fetch messages ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/messages/${recipient._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMessages(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [recipient._id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  // ── Envoyer ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: recipient._id, content: trimmed }),
      });
      if (res.ok) { const msg = await res.json(); setMessages(p => [...p, msg]); setText(''); }
    } catch {}
    finally { setSending(false); }
  };

  const handleCall = async () => {
    const [userId, userName] = await Promise.all([
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('userName'),
    ]);
    socketRef.current?.emit('call-offer', {
      to:         recipient._id,
      offer:      null,
      callerId:   userId,
      callerName: userName || 'Utilisateur',
    });
    navigation.navigate('Call', { recipient, isIncoming: false });
  };

  const renderItem = ({ item, index }) => {
    const isMe    = item.sender?._id === myId || item.sender === myId;
    const prev    = messages[index - 1];
    const showTime = !prev || new Date(item.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000;
    const timeStr = new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return (
      <View>
        {showTime && (
          <View style={styles.timeLabelRow}>
            <View style={styles.timeLabelLine} />
            <Text style={styles.timeLabel}>{timeStr}</Text>
            <View style={styles.timeLabelLine} />
          </View>
        )}
        <View style={[styles.bubbleRow, isMe ? styles.rowMe : styles.rowOther]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  const recipientName = `${recipient.prenom || ''} ${recipient.nom || ''}`.trim() || 'Contact';
  const initial = recipient.prenom?.[0]?.toUpperCase() || '?';

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F5F3' }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={16} color="#1A1A2E" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.headerName}>{recipientName}</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerSub}>En ligne</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.7}>
            <FontAwesome6 name="phone" size={16} color="#2DBD7E" />
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2DBD7E" />
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={item => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <EmptyState icon="comments" title="Aucun message" subtitle={`Démarrez la conversation avec ${recipientName}`} />
              }
            />
          )}

          {/* ── Input bar ── */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Écrire un message…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.base, paddingVertical: SP.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  backBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.outline,
    justifyContent: 'center', alignItems: 'center',
  },
  callBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: 'rgba(45,189,126,0.12)', borderWidth: 1, borderColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SP.sm },
  avatarCircle: {
    width: 44, height: 44, borderRadius: R.full,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  avatarLetter: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  headerName:   { ...T.titleMd, color: colors.onSurface },
  onlineRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:    { width: 7, height: 7, borderRadius: R.full, backgroundColor: '#2DBD7E' },
  headerSub:    { ...T.bodyMd, color: '#2DBD7E', fontWeight: '600', fontSize: 11 },

  // ── List
  listContent: { padding: SP.base, gap: 3, paddingBottom: SP.sm },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Time label
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginVertical: SP.md, paddingHorizontal: SP.sm },
  timeLabelLine:{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outline },
  timeLabel:    { ...T.labelSm, color: colors.onSurfaceVariant, textTransform: 'none', letterSpacing: 0 },

  // ── Bubbles — MD3/HIG: large radius, pinched corner on sender side
  bubbleRow:  { flexDirection: 'row', marginVertical: 2 },
  rowMe:      { justifyContent: 'flex-end' },
  rowOther:   { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%', borderRadius: R.lg,
    paddingHorizontal: SP.base, paddingVertical: SP.sm,
  },
  bubbleMe: {
    backgroundColor: '#2DBD7E', borderBottomRightRadius: R.xs,
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  bubbleOther: {
    backgroundColor: colors.surface, borderBottomLeftRadius: R.xs,
    borderWidth: 1, borderColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  bubbleText:   { ...T.bodyMd, color: colors.onSurfaceVariant },
  bubbleTextMe: { color: '#FFFFFF' },

  // ── Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SP.sm,
    paddingHorizontal: SP.base, paddingVertical: SP.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 6,
  },
  input: {
    flex: 1, minHeight: HIT.min, maxHeight: 120,
    backgroundColor: colors.surfaceVariant,
    borderRadius: R.xl, paddingHorizontal: SP.base, paddingVertical: SP.sm,
    ...T.bodyLg, color: colors.onSurface,
    borderWidth: 1, borderColor: colors.outline,
  },
  sendBtn: {
    width: HIT.min, height: HIT.min, borderRadius: R.full,
    backgroundColor: '#2DBD7E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2DBD7E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
});
