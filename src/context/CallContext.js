// src/context/CallContext.js
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { API_URL } from '../environments/environment';

const SERVER_BASE = API_URL.replace('/api', '');

const CallContext = createContext(null);

export function CallProvider({ children, navigationRef }) {
  // { from: userId, callerName, offer }
  const [incomingCall, setIncomingCall] = useState(null);
  const socketRef = useRef(null);

  // ── Connect (or reconnect) the global socket ──────────────────────────────
  const connect = async () => {
    // Already connected → nothing to do
    if (socketRef.current?.connected) return;

    const userId = await AsyncStorage.getItem('userId');
    if (!userId) return;

    // Disconnect stale socket if any
    socketRef.current?.disconnect();

    const socket = io(SERVER_BASE, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('register', userId));

    socket.on('incoming-call', ({ callerName, from, callerId, offer }) => {
      setIncomingCall({
        from:       String(from || callerId),
        callerName: callerName || 'Utilisateur',
        offer,
      });
    });
  };

  // Connect on first mount (covers users already logged in)
  useEffect(() => {
    connect();
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, []);

  // ── Reject ────────────────────────────────────────────────────────────────
  const rejectIncomingCall = () => {
    if (incomingCall) socketRef.current?.emit('call-reject', { to: incomingCall.from });
    setIncomingCall(null);
  };

  // ── Accept ────────────────────────────────────────────────────────────────
  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    const recipient = {
      _id:    incomingCall.from,
      prenom: incomingCall.callerName?.split(' ')[0] || '',
      nom:    incomingCall.callerName?.split(' ').slice(1).join(' ') || '',
      phone:  null,
    };
    const { offer } = incomingCall;
    setIncomingCall(null);
    navigationRef.current?.navigate('Call', { recipient, isIncoming: true, offer });
  };

  return (
    <CallContext.Provider value={{ incomingCall, rejectIncomingCall, acceptIncomingCall, socketRef, connect }}>
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
