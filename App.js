// App.js
import './src/i18n/index'; // initialise i18n (doit être le premier import)
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, savePushTokenToServer } from './src/utils/notifications';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { getStoredLanguage, changeAppLanguage } from './src/i18n/index';
import { useTranslation } from 'react-i18next';
import { createStackNavigator } from '@react-navigation/stack';

import { CallProvider, useCall } from './src/context/CallContext';
import { SecurityProvider } from './src/security/SecurityProvider.js';
import { ThemeProvider } from './src/theme/ThemeContext';
import { D, shadow } from './src/theme/index';
import { FontAwesome6 } from '@expo/vector-icons';
import { patchFetchWithFailover } from './src/utils/serverBalancer';

patchFetchWithFailover();

import Welcome         from './src/screens/Welcome';
import MapScreen       from './src/screens/MapScreen';
import LoginScreen     from './src/screens/LoginScreen';
import LocalScreen     from './src/screens/LocalScreen';
import ProfileScreen   from './src/screens/ProfileScreen';
import AdminDashboard        from './src/screens/admin/AdminDashboard';
import AdminNotifications    from './src/screens/admin/AdminNotifications';
import AjoutePub          from './src/screens/AjoutPub';
import PublicationDetail  from './src/screens/PublicationDetail';
import Messages           from './src/screens/Messages';
import CallScreen         from './src/screens/CallScreen';
import ForgetPassword     from './src/screens/ForgetPassword';
import ConversationsList  from './src/screens/ConversationsList';
import DuoScreen          from './src/screens/DuoScreen';
import FavoritesScreen    from './src/screens/FavoritesScreen';
import WelcomeNewUser    from './src/screens/WelcomeNewUser';

// ── Global incoming-call overlay (visible from any screen) ────────────────────
function IncomingCallOverlay() {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useCall();
  const { t } = useTranslation();
  if (!incomingCall) return null;

  const initial = incomingCall.callerName?.[0]?.toUpperCase() || '?';

  return (
    <Modal transparent animationType="slide" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <Text style={styles.callerName}>{incomingCall.callerName}</Text>
          <Text style={styles.label}>{t('call.incoming', 'Appel vocal entrant…')}</Text>
          <View style={styles.btns}>
            <TouchableOpacity style={styles.rejectBtn} onPress={rejectIncomingCall} activeOpacity={0.8}>
              <FontAwesome6 name="phone-slash" size={26} color={D.white} />
              <Text style={styles.btnLabel}>{t('call.reject', 'Refuser')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={acceptIncomingCall} activeOpacity={0.8}>
              <FontAwesome6 name="phone" size={26} color={D.white} />
              <Text style={styles.btnLabel}>{t('call.accept', 'Accepter')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const Stack = createStackNavigator();

export default function App() {
  const navigationRef   = useNavigationContainerRef();
  const [langReady, setLangReady] = useState(false);
  const notifListener   = useRef(null);
  const responseListener = useRef(null);

  // Restaure la langue persistée avant le premier rendu
  useEffect(() => {
    getStoredLanguage().then(code => {
      changeAppLanguage(code).finally(() => setLangReady(true));
    });
  }, []);

  // Push notifications : demande permission + enregistre le token
  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) savePushTokenToServer(token);
    });

    // Notification reçue en foreground (affichée automatiquement par le handler)
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    // Tap sur une notification → naviguer vers l'écran concerné
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen && navigationRef.isReady()) {
        navigationRef.navigate(data.screen, data.params || {});
      }
    });

    return () => {
      notifListener.current && Notifications.removeNotificationSubscription(notifListener.current);
      responseListener.current && Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  if (!langReady) return null; // écran blanc pendant <100ms

  return (
    <ThemeProvider>
    <SecurityProvider>
    <NavigationContainer ref={navigationRef}>
      <CallProvider navigationRef={navigationRef}>
        <Stack.Navigator
          initialRouteName="Welcome"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Welcome"           component={Welcome}          />
          <Stack.Screen name="Map"               component={MapScreen}        />
          <Stack.Screen name="Login"             component={LoginScreen}      />
          <Stack.Screen name="Local"             component={LocalScreen}      />
          <Stack.Screen name="Profile"           component={ProfileScreen}    />
          <Stack.Screen name="AdminDashboard"      component={AdminDashboard}      />
          <Stack.Screen name="AdminNotifications" component={AdminNotifications}  />
          <Stack.Screen name="AjoutePub"         component={AjoutePub}        />
          <Stack.Screen name="PublicationDetail" component={PublicationDetail}/>
          <Stack.Screen name="Messages"          component={Messages}         />
          <Stack.Screen name="Call"              component={CallScreen}       />
          <Stack.Screen name="ForgetPassword"    component={ForgetPassword}   />
          <Stack.Screen name="ConversationsList" component={ConversationsList}/>
          <Stack.Screen name="Duo"              component={DuoScreen}        />
          <Stack.Screen name="Favorites"        component={FavoritesScreen}  />
          <Stack.Screen name="WelcomeNew"       component={WelcomeNewUser}   />
        </Stack.Navigator>

        {/* Shown on top of any screen when a call arrives */}
        <IncomingCallOverlay />
      </CallProvider>
    </NavigationContainer>
    </SecurityProvider>
    </ThemeProvider>
  );
}

// ── Styles for the overlay ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  card: {
    backgroundColor: D.navyMid,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.glassBorder,
    padding: 32, alignItems: 'center', gap: 10,
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: D.blue,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    ...shadow.blue,
  },
  avatarLetter: { fontSize: 38, color: D.white, fontWeight: '800' },
  callerName:   { fontSize: 22, fontWeight: '800', color: D.white },
  label:        { fontSize: 13, color: D.textDim, marginBottom: 10 },
  btns: { flexDirection: 'row', gap: 44, marginTop: 10 },
  rejectBtn: {
    alignItems: 'center', gap: 6,
    backgroundColor: D.red,
    width: 72, height: 72, borderRadius: 36, justifyContent: 'center',
  },
  acceptBtn: {
    alignItems: 'center', gap: 6,
    backgroundColor: D.green,
    width: 72, height: 72, borderRadius: 36, justifyContent: 'center',
  },
  btnLabel: { fontSize: 11, color: D.white, fontWeight: '700', marginTop: 4 },
});
