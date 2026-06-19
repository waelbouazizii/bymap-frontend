import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { HIT, R, SP, T } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';

const TABS = [
  { key: 'map',          icon: 'map',         size: 22, tKey: 'common.map',          authRequired: false },
  { key: 'publications', icon: 'newspaper',   size: 19, tKey: 'common.publications', authRequired: false },
  { key: 'messages',     icon: 'comment',     size: 22, tKey: 'common.messages',     authRequired: true  },
  { key: 'profile',      icon: 'circle-user', size: 22, tKey: 'common.profile',      authRequired: true  },
];

const TAB_ROUTES = {
  map:          'Map',
  publications: 'Local',
  messages:     'ConversationsList',
  profile:      'Profile',
};

export default function BottomTabBar({ activeTab, navigation, isAuthenticated }) {
  const { t } = useTranslation();
  const { isDark, colors } = useTheme();

  const handlePress = (tab) => {
    if (tab.authRequired && !isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate(TAB_ROUTES[tab.key]);
  };

  const visibleTabs = TABS.filter(tab => tab.key !== activeTab);
  const iconColor = isDark ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.55)';

  const content = (
    <View style={[styles.row, { borderTopColor: colors.tabBarBorder }]}>
      {visibleTabs.map((tab) => {
          return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => handlePress(tab)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrap}>
              <FontAwesome6
                name={tab.icon}
                size={tab.size}
                color={iconColor}
              />
            </View>
            <Text style={[styles.label, { color: iconColor }]}>
              {t(tab.tKey, tab.key)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.container, { borderTopColor: colors.tabBarBorder }]}
      >
        {content}
      </BlurView>
    );
  }

  return (
    <View style={[styles.container, {
      backgroundColor: colors.tabBar,
      borderTopColor: colors.tabBarBorder,
    }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    paddingBottom: Platform.OS === 'ios' ? 24 : SP.sm,
    paddingTop: SP.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: HIT.min,
    gap: 3,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 30,
  },
  label: {
    ...T.labelSm,
    letterSpacing: 0.3,
    textTransform: 'none',
    fontSize: 10,
    fontWeight: '600',
  },
});
