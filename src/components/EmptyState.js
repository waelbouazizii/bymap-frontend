import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { T, SP, R, HIT } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';

export default function EmptyState({ icon = 'inbox', title, subtitle, actionLabel, onAction }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceVariant }]}>
        <FontAwesome6 name={icon} size={32} color={colors.onSurfaceVariant} />
      </View>
      {title ? (
        <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionLabel, { color: colors.onPrimary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SP.xxxl,
    paddingHorizontal: SP.xl,
    gap: SP.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SP.sm,
  },
  title: {
    ...T.titleLg,
    textAlign: 'center',
  },
  subtitle: {
    ...T.bodyMd,
    textAlign: 'center',
    marginTop: 2,
  },
  actionBtn: {
    marginTop: SP.sm,
    paddingVertical: SP.md,
    paddingHorizontal: SP.xl,
    borderRadius: R.lg,
    minHeight: HIT.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...T.labelLg,
  },
});
