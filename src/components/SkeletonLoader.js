import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { R, SP } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';

const { width: SW } = Dimensions.get('window');

function SkeletonBlock({ width, height, borderRadius, style }) {
  const { isDark } = useTheme();
  const translateX = useSharedValue(-SW);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(SW, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const baseColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const shimmerColor = isDark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(255,255,255,0.6)';

  return (
    <View
      style={[
        { width, height, borderRadius: borderRadius ?? R.md, backgroundColor: baseColor, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: SW * 0.6,
            background: 'transparent',
          },
          shimmerStyle,
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: shimmerColor,
            opacity: 0.7,
          }}
        />
      </Animated.View>
    </View>
  );
}

export function PubCardSkeleton() {
  const { isDark } = useTheme();
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[styles.accentBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <SkeletonBlock width={40} height={40} borderRadius={R.full} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width="60%" height={13} />
            <SkeletonBlock width="35%" height={11} />
          </View>
          <SkeletonBlock width={40} height={18} borderRadius={R.full} />
        </View>
        <SkeletonBlock width="100%" height={13} style={{ marginTop: SP.sm }} />
        <SkeletonBlock width="80%" height={13} style={{ marginTop: 6 }} />
        <SkeletonBlock width="55%" height={13} style={{ marginTop: 6 }} />
        <SkeletonBlock width="100%" height={160} borderRadius={R.md} style={{ marginTop: SP.md }} />
        <View style={[styles.footer, { marginTop: SP.sm }]}>
          <SkeletonBlock width={60} height={22} borderRadius={R.full} />
          <SkeletonBlock width={60} height={22} borderRadius={R.full} />
          <SkeletonBlock width={80} height={30} borderRadius={R.md} />
        </View>
      </View>
    </View>
  );
}

export default SkeletonBlock;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: R.lg,
    borderWidth: 1,
    marginHorizontal: SP.base,
    marginVertical: SP.sm,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: SP.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    justifyContent: 'space-between',
  },
});
