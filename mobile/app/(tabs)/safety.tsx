import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useRipple, type SafetyLevel } from '@/context/RippleContext';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { SegmentedControl } from '@/components/SegmentedControl';

const SAFETY_OPTIONS: { value: SafetyLevel; label: string }[] = [
  { value: 'safe', label: '안전' },
  { value: 'danger', label: '위험' },
];

export default function SafetyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { safetyLevel, setSafetyLevel } = useRipple();
  const danger = safetyLevel === 'danger';

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 96 },
      ]}
    >
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>안전 가드</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {danger ? '이 구역은 지금 조심해야 해요' : '지금 이 구역은 평온해요'}
      </Text>

      <View
        style={styles.controlBlock}
        pointerEvents={process.env.EXPO_PUBLIC_BUILD_MODE === 'PRODUCTION' ? 'none' : 'auto'}
      >
        <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>수위·경보 시뮬레이션</Text>
        <SegmentedControl options={SAFETY_OPTIONS} value={safetyLevel} onChange={setSafetyLevel} />
      </View>

      <View
        style={[
          styles.visualCard,
          { backgroundColor: colors.card, borderColor: danger ? colors.destructive : colors.border },
        ]}
      >
        <WaveformVisualizer mode={danger ? 'glitch' : 'flow'} color={danger ? colors.destructive : colors.primary} />
      </View>

      {danger ? (
        <View style={[styles.warningBanner, { backgroundColor: colors.warningSoft, borderColor: colors.destructive }]}>
          <Feather name="alert-triangle" size={16} color={colors.destructive} />
          <Text style={[styles.warningText, { color: colors.foreground }]}>
            거긴 소리가 별로네요. 오늘은 위험하니까 다른 데로 가요.
          </Text>
          <Pressable
            onPress={() => router.push('/map')}
            style={styles.warningAction}
            testID="go-elsewhere"
          >
            <Text style={[styles.warningActionText, { color: colors.destructive }]}>다른 곳 보기</Text>
            <Feather name="arrow-right" size={14} color={colors.destructive} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.safeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check-circle" size={16} color={colors.primary} />
          <Text style={[styles.safeText, { color: colors.mutedForeground }]}>
            수위와 경보 상태를 조용히 지켜보고 있어요. 위험해지면 소리와 알림으로 먼저 알려드려요.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
    lineHeight: 29,
  },
  controlBlock: {
    marginTop: 24,
    marginBottom: 20,
  },
  controlLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
    marginLeft: 4,
  },
  visualCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    minWidth: '70%',
  },
  warningAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 26,
  },
  warningActionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  safeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
});
