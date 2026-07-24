import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useRipple, type WaterSource } from '@/context/RippleContext';
import { WaveformVisualizer, type WaveformMode } from '@/components/WaveformVisualizer';
import { WATER_SOURCE_LABELS } from '@/constants/mockData';
import {
  playDynamicMix,
  stopAmbientSound,
} from '@/lib/services/audio_engine_service';

const SOURCE_OPTIONS: { value: WaterSource; label: string }[] = [
  { value: 'stream', label: '시냇물' },
  { value: 'river', label: '강물' },
  { value: 'sea', label: '바다' },
];

export default function SoundScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { waterSource, setWaterSource, safetyLevel } = useRipple();
  const [playing, setPlaying] = useState(true);

  // 화면 마운트 시 자동 재생 (isInitialMount로 이중 기동 준수)
  const isInitialMount = useRef(true);

  // [Step 4-A] 재생 상태 및 워터소스 변화 시 오디오 엔진 제어
  useEffect(() => {
    if (isInitialMount.current) {
      // 첫 렌더링: 자동 재생 시작 (playDynamicMix 연동)
      playDynamicMix(waterSource).catch((err) =>
        console.warn('[SoundScreen] Auto-play on mount failed:', err)
      );
      isInitialMount.current = false;
      return;
    }
    if (playing) {
      // 재생 켜지거나 워터소스 변경 시 오디오 엔진 연결
      playDynamicMix(waterSource).catch((err) =>
        console.warn('[SoundScreen] playDynamicMix failed:', err)
      );
    } else {
      // 일시정지: 오디오 엔진 정지
      stopAmbientSound().catch((err) =>
        console.warn('[SoundScreen] stopAmbientSound failed:', err)
      );
    }
  }, [playing, waterSource]);

  const glitch = safetyLevel === 'danger';
  const info = WATER_SOURCE_LABELS[waterSource];

  let visualMode: WaveformMode = 'flow';
  if (glitch) visualMode = 'glitch';
  else if (!playing) visualMode = 'idle';

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 96 },
      ]}
    >
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>지금 흐르는 소리</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {glitch ? '소리가 흐려지고 있어요' : info.label}
      </Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]}>
        {glitch
          ? '이 근처는 지금 소리가 좋지 않아요. 다른 물길로 옮겨볼까요.'
          : info.description}
      </Text>

      <View style={[styles.visualCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <WaveformVisualizer mode={visualMode} color={glitch ? colors.destructive : colors.primary} />
      </View>

      <View style={styles.chipRow}>
        {SOURCE_OPTIONS.map((option) => {
          const active = option.value === waterSource;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (!active) {
                  Haptics.selectionAsync();
                  setWaterSource(option.value);
                }
              }}
              style={[
                styles.chip,
                { borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              testID={`source-${option.value}`}
            >
              <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.nowPlaying, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
        <View style={styles.nowPlayingText}>
          <Text style={[styles.nowPlayingTitle, { color: colors.foreground }]}>화면을 꺼도 소리는 계속 흘러요</Text>
          <Text style={[styles.nowPlayingSub, { color: colors.mutedForeground }]}>
            이동하면 소리가 자연스럽게 섞여요
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            // 클릭 시 UI 상태 + 오디오 엔진 제어를 함께 토글
            setPlaying((p) => !p);
          }}
          style={[styles.playButton, { backgroundColor: colors.primary }]}
          testID="toggle-play"
        >
          <Feather name={playing ? 'pause' : 'play'} size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
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
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  desc: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    lineHeight: 20,
  },
  visualCard: {
    marginTop: 28,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  nowPlaying: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  nowPlayingText: {
    flex: 1,
  },
  nowPlayingTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  nowPlayingSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
