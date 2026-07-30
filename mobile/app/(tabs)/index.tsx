import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useRipple, type Movement, type OrbMode } from '@/context/RippleContext';
import { RippleOrb } from '@/components/RippleOrb';
import { RippleBar } from '@/components/RippleBar';
import { SegmentedControl } from '@/components/SegmentedControl';

const MOVEMENT_OPTIONS: { value: Movement; label: string }[] = [
  { value: 'calm', label: '고요' },
  { value: 'walking', label: '걷는 중' },
  { value: 'busy', label: '바쁘게' },
];

const MOVEMENT_COPY: Record<Movement, string> = {
  calm: '물결이 잔잔해요. 지금처럼만 있어도 충분해요.',
  walking: '적당히 흔들리고 있어요. 나쁘지 않은 속도예요.',
  busy: '물결이 거세게 흔들리고 있어요. 잠깐 숨을 고르는 것도 좋아요.',
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { movement, setMovement, safetyLevel, currentMessage, orbMode, rawSpeedMps } = useRipple();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setBannerDismissed(false);
  }, [currentMessage]);

  const danger = safetyLevel === 'danger';
  const warning = safetyLevel === 'warning';
  const isAlert = danger || warning;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>오늘의 물결</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>잔물결</Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={[styles.bellButton, { backgroundColor: colors.secondary }]}
          testID="notifications-button"
        >
          <Feather name="bell" size={18} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={styles.orbArea}>
        <RippleOrb 
          mode={orbMode} 
          size={260} 
          rawSpeedMps={process.env.EXPO_PUBLIC_BUILD_MODE === 'PRODUCTION' ? rawSpeedMps : undefined} 
        />
      </View>

      <Text style={[styles.copy, { color: colors.foreground }]}>{MOVEMENT_COPY[movement]}</Text>

      {process.env.EXPO_PUBLIC_BUILD_MODE !== 'PRODUCTION' ? (
        <View style={styles.controlBlock}>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>[DEMO] 강제 상태 주입 (GPS 오버라이드)</Text>
          <SegmentedControl options={MOVEMENT_OPTIONS} value={movement} onChange={setMovement} />
        </View>
      ) : (
        <View style={styles.controlBlock}>
          <RippleBar mode={orbMode} rawSpeedMps={rawSpeedMps} />
        </View>
      )}

      {!bannerDismissed && (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: isAlert ? colors.warningSoft : colors.card,
              borderColor: danger ? colors.destructive : (warning ? colors.primary : colors.border),
            },
          ]}
        >
          <Feather
            name={isAlert ? 'alert-triangle' : 'feather'}
            size={16}
            color={danger ? colors.destructive : colors.primary}
          />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>{currentMessage}</Text>
          <Pressable
            onPress={() => setBannerDismissed(true)}
            style={styles.dismiss}
            testID="dismiss-banner"
          >
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    marginTop: 2,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  copy: {
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  controlBlock: {
    marginBottom: 20,
  },
  controlLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
    marginLeft: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  dismiss: {
    padding: 2,
  },
});
