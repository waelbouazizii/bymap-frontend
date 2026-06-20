// src/screens/CallScreen.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from '../utils/WebView';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { FontAwesome6 } from '@expo/vector-icons';
import { D, shadow, R, SP, T, HIT } from '../theme/index';
import { useCall } from '../context/CallContext';

// ── WebRTC HTML — runs inside a hidden WebView ────────────────────────────────
// NOTE: Use window.addEventListener (not document) — works on both Android & iOS.
// NOTE: baseUrl:'http://localhost' makes this a secure context → getUserMedia works.
const WEBRTC_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script>
var pc = null, stream = null, pending = [];
var ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]};

function post(obj) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e){}
}

// Only window.addEventListener — works on both Android and iOS with react-native-webview
window.addEventListener('message', function(e) {
  var msg;
  try { msg = JSON.parse(e.data); } catch(err) { return; }
  if      (msg.type === 'start-caller')  startCaller();
  else if (msg.type === 'start-callee')  startCallee(msg.offer);
  else if (msg.type === 'remote-answer') applyAnswer(msg.answer);
  else if (msg.type === 'ice-candidate') addCandidate(msg.candidate);
  else if (msg.type === 'mute')          setMute(true);
  else if (msg.type === 'unmute')        setMute(false);
  else if (msg.type === 'hangup')        cleanup();
});

function setMute(m) {
  if (stream) stream.getAudioTracks().forEach(function(t){ t.enabled = !m; });
}

function addCandidate(c) {
  if (!c) return;
  if (pc && pc.remoteDescription && pc.remoteDescription.type) {
    pc.addIceCandidate(c).catch(function(){});
  } else {
    pending.push(c);
  }
}

function flushPending() {
  var copy = pending.splice(0);
  for (var i = 0; i < copy.length; i++) {
    pc.addIceCandidate(copy[i]).catch(function(){});
  }
}

function buildPC() {
  pc = new RTCPeerConnection(ICE);
  pc.onicecandidate = function(e) {
    if (e.candidate) post({ type: 'ice-candidate', candidate: e.candidate });
  };
  pc.onconnectionstatechange = function() {
    post({ type: 'conn-state', state: pc.connectionState });
  };
  pc.ontrack = function() {};
}

function startCaller() {
  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(function(s) {
      stream = s;
      buildPC();
      stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });
      return pc.createOffer({ offerToReceiveAudio: true });
    })
    .then(function(offer) {
      return pc.setLocalDescription(offer);
    })
    .then(function() {
      post({ type: 'offer', offer: pc.localDescription });
    })
    .catch(function(err) {
      post({ type: 'error', message: err.message });
    });
}

function startCallee(offer) {
  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(function(s) {
      stream = s;
      buildPC();
      stream.getTracks().forEach(function(t){ pc.addTrack(t, stream); });
      return pc.setRemoteDescription(offer);
    })
    .then(function() {
      flushPending();
      return pc.createAnswer();
    })
    .then(function(answer) {
      return pc.setLocalDescription(answer);
    })
    .then(function() {
      post({ type: 'answer', answer: pc.localDescription });
    })
    .catch(function(err) {
      post({ type: 'error', message: err.message });
    });
}

function applyAnswer(answer) {
  if (!pc) return;
  pc.setRemoteDescription(answer)
    .then(function() { flushPending(); })
    .catch(function(){});
}

function cleanup() {
  if (stream) { stream.getTracks().forEach(function(t){ t.stop(); }); stream = null; }
  if (pc)     { pc.close(); pc = null; }
}
<\/script>
</head>
<body style="margin:0;background:transparent;"></body></html>`;

// ─────────────────────────────────────────────────────────────────────────────
export default function CallScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { recipient, isIncoming, offer: incomingOffer } = route.params;

  const [status,   setStatus]   = useState(isIncoming ? 'connecting' : 'calling');
  const [muted,    setMuted]    = useState(false);
  const [duration, setDuration] = useState(0);

  const webviewRef    = useRef(null);
  const timerRef      = useRef(null);
  const micGrantedRef = useRef(false);   // true once Audio permission is granted
  const { socketRef } = useCall();

  // ── Request mic permission at RN level before WebView tries getUserMedia ───
  useEffect(() => {
    requestRecordingPermissionsAsync().then(({ granted }) => {
      micGrantedRef.current = granted;
      if (!granted) {
        setStatus('error_mic');
        setTimeout(() => hangUp(false), 2500);
      }
    });
    // Configure audio session for calls
    setAudioModeAsync({
      allowsRecordingIOS:      true,
      playsInSilentModeIOS:    true,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

  // ── Utilities ─────────────────────────────────────────────────────────────
  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const r = (s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
  };

  const sendWV = (msg) => {
    webviewRef.current?.postMessage(JSON.stringify(msg));
  };

  const hangUp = useCallback((notify = true) => {
    clearInterval(timerRef.current);
    sendWV({ type: 'hangup' });
    if (notify) socketRef.current?.emit('call-end', { to: recipient._id });
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Map');
  }, [recipient._id]);

  // ── WebView loaded → start WebRTC immediately ─────────────────────────────
  // By this point useEffect has already run and socket listeners are wired.
  const onWebViewLoad = useCallback(() => {
    if (!isIncoming) {
      sendWV({ type: 'start-caller' });
    } else {
      sendWV({ type: 'start-callee', offer: incomingOffer ?? null });
    }
  }, [isIncoming, incomingOffer]);

  // ── Messages from WebView (SDP, ICE, state) ───────────────────────────────
  const handleWebViewMessage = useCallback(async ({ nativeEvent }) => {
    let msg;
    try { msg = JSON.parse(nativeEvent.data); } catch { return; }

    const socket = socketRef.current;

    switch (msg.type) {

      case 'offer': {
        // Caller got SDP offer from WebView → relay to callee via socket
        const [[, userId], [, userName]] = await AsyncStorage.multiGet(['userId', 'userName']);
        socket?.emit('call-offer', {
          to:         recipient._id,
          offer:      msg.offer,
          callerId:   userId,
          callerName: userName || 'Utilisateur',
        });
        break;
      }

      case 'answer': {
        // Callee got SDP answer from WebView → relay to caller via socket
        socket?.emit('call-answer', { to: recipient._id, answer: msg.answer });
        setStatus('connected');
        startTimer();
        break;
      }

      case 'ice-candidate': {
        // ICE candidate from WebView → relay to remote peer via socket
        socket?.emit('ice-candidate', { to: recipient._id, candidate: msg.candidate });
        break;
      }

      case 'conn-state': {
        if (msg.state === 'failed' || msg.state === 'disconnected') hangUp(false);
        break;
      }

      case 'error': {
        console.warn('[WebRTC]', msg.message);
        // Distinguish mic/permission error from network error
        const isMicError = /permission|notallowed|notfound|devices/i.test(msg.message || '');
        setStatus(isMicError ? 'error_mic' : 'error_net');
        setTimeout(() => hangUp(false), 2500);
        break;
      }
    }
  }, [recipient._id, hangUp]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Caller: callee answered → apply their SDP answer and go live
    const onAnswered = ({ answer }) => {
      if (answer) sendWV({ type: 'remote-answer', answer });
      setStatus('connected');
      startTimer();
    };

    // Caller: callee rejected
    const onRejected = () => {
      setStatus('rejected');
      setTimeout(() => hangUp(false), 1500);
    };

    // Either side: remote hung up
    const onEnded = () => hangUp(false);

    // Caller: callee offline
    const onUnavailable = () => {
      setStatus('unavailable');
      setTimeout(() => hangUp(false), 1500);
    };

    // ICE candidate from remote peer → forward to our WebView
    const onIce = ({ candidate }) => {
      if (candidate) sendWV({ type: 'ice-candidate', candidate });
    };

    // No-answer timeout (30 s) — caller only
    let noAnswerTimeout;
    if (!isIncoming) {
      noAnswerTimeout = setTimeout(() => {
        setStatus('unavailable');
        setTimeout(() => hangUp(false), 1500);
      }, 30000);
    }

    socket.on('call-answered',    onAnswered);
    socket.on('call-rejected',    onRejected);
    socket.on('call-ended',       onEnded);
    socket.on('call-unavailable', onUnavailable);
    socket.on('ice-candidate',    onIce);

    return () => {
      clearTimeout(noAnswerTimeout);
      clearInterval(timerRef.current);
      socket.off('call-answered',    onAnswered);
      socket.off('call-rejected',    onRejected);
      socket.off('call-ended',       onEnded);
      socket.off('call-unavailable', onUnavailable);
      socket.off('ice-candidate',    onIce);
    };
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleMute = () => {
    setMuted(prev => {
      sendWV({ type: prev ? 'unmute' : 'mute' });
      return !prev;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const recipientName = `${recipient.prenom || ''} ${recipient.nom || ''}`.trim() || 'Contact';

  const statusLabel = {
    calling:     'Appel en cours…',
    connecting:  'Connexion…',
    connected:   fmt(duration),
    rejected:    'Appel refusé',
    unavailable: 'Pas de réponse',
    error_mic:   'Permission micro refusée',
    error_net:   'Erreur de connexion audio',
  }[status] ?? '';

  const isActive = status === 'calling' || status === 'connecting' || status === 'connected';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* Hidden WebView — WebRTC audio engine
          baseUrl:'http://localhost' = secure context → getUserMedia works     */}
      <WebView
        ref={webviewRef}
        source={{ html: WEBRTC_HTML, baseUrl: 'http://localhost' }}
        onMessage={handleWebViewMessage}
        onLoad={onWebViewLoad}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        onPermissionRequest={(req) => req.grant(req.resources)}
        style={styles.hiddenWV}
      />

      {/* Avatar + name + status */}
      <View style={styles.top}>
        <View style={[styles.bigAvatar, status === 'connected' && styles.bigAvatarActive]}>
          <Text style={styles.bigLetter}>{recipient.prenom?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.name}>{recipientName}</Text>
        <Text style={[
          styles.statusText,
          status === 'connected'  && styles.statusConnected,
          ['rejected','unavailable','error_mic','error_net'].includes(status) && styles.statusError,
        ]}>
          {statusLabel}
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.controls}>
        {isActive ? (
          <View style={styles.activeRow}>
            <TouchableOpacity
              style={[styles.roundBtn, muted && styles.roundBtnActive]}
              onPress={toggleMute} activeOpacity={0.8}
            >
              <FontAwesome6 name={muted ? 'microphone-slash' : 'microphone'} size={22} color={D.white} />
              <Text style={styles.roundLabel}>{muted ? 'Muet' : 'Micro'}</Text>
            </TouchableOpacity>

            {recipient.phone ? (
              <TouchableOpacity
                style={styles.roundBtn}
                onPress={() => Linking.openURL(`tel:${recipient.phone}`)}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="mobile-screen" size={22} color={D.white} />
                <Text style={styles.roundLabel}>GSM</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 72 }} />}

            <TouchableOpacity
              style={[styles.roundBtn, styles.hangupBtn]}
              onPress={() => hangUp(true)} activeOpacity={0.8}
            >
              <FontAwesome6 name="phone-slash" size={22} color={D.white} />
              <Text style={styles.roundLabel}>Fin</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Map')}
          >
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: D.navy, justifyContent: 'space-between' },
  hiddenWV: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  top:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SP.base },

  bigAvatar: {
    width: 110, height: 110, borderRadius: R.full,
    backgroundColor: D.blue,
    justifyContent: 'center', alignItems: 'center', marginBottom: SP.sm,
    ...shadow.blue,
  },
  bigAvatarActive: { ...shadow.green, borderWidth: 3, borderColor: D.green },
  bigLetter:       { ...T.displayLg, color: D.white },
  name:            { ...T.displaySm, color: D.white },
  statusText:      { ...T.titleMd, color: D.textDim, marginTop: 4 },
  statusConnected: { color: D.green, fontWeight: '700' },
  statusError:     { color: D.red },

  controls:  { paddingBottom: 50, paddingHorizontal: SP.xl },
  activeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },

  roundBtn: {
    width: 72, height: 72, borderRadius: R.full,
    backgroundColor: D.glass,
    alignItems: 'center', justifyContent: 'center', gap: SP.xs,
    borderWidth: 1, borderColor: D.glassBorder,
  },
  roundBtnActive: { backgroundColor: D.glassMid, borderColor: D.blue },
  hangupBtn:      { backgroundColor: D.red, borderColor: D.red, ...shadow.soft },
  roundLabel:     { ...T.labelSm, color: D.white, textTransform: 'none', letterSpacing: 0 },

  backBtn: {
    alignSelf: 'center',
    backgroundColor: D.glass, borderWidth: 1, borderColor: D.glassBorder,
    paddingHorizontal: SP.xxxl, paddingVertical: SP.base, borderRadius: R.full,
    minHeight: HIT.min, justifyContent: 'center',
  },
  backBtnText: { ...T.titleMd, color: D.white },
});
