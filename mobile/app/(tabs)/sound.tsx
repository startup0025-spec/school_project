import React, { useEffect, useRef, useState } from 'react';
import {
  DeviceEventEmitter,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Carousel, CarouselRef } from 'react-native-reanimated-carousel';
import { useColors } from '@/hooks/useColors';
import { useRipple, type WaterSource } from '@/context/RippleContext';
import { useAppMode } from '@/context/AppModeContext';
import { WaveformVisualizer, type WaveformMode } from '@/components/WaveformVisualizer';
import { WATER_SOURCE_LABELS } from '@/constants/mockData';
import {
  playDynamicMix,
  stopAmbientSound,
} from '@/lib/services/audio_engine_service';

interface WaterCategoryItem {
  value: WaterSource;
  label: string;
  subLabel: string;
  description: string;
  iconName: keyof typeof Feather.glyphMap;
}

const CAROUSEL_CATEGORIES: WaterCategoryItem[] = [
  {
    value: 'sea',
    label: '연안',
    subLabel: '바다 / 해안',
    description: '파도 소리가 깊고 넓게 스르륵 밀려와요.',
    iconName: 'anchor',
  },
  {
    value: 'national_river',
    label: '국가하천',
    subLabel: '큰 강물',
    description: '웅장하고 깊은 물길이 흘러가요.',
    iconName: 'wind',
  },
  {
    value: 'lake',
    label: '호소',
    subLabel: '호수 / 저수지',
    description: '잔잔하고 평화로운 수면 소리가 들려요.',
    iconName: 'sun',
  },
  {
    value: 'local_river',
    label: '지방하천',
    subLabel: '도심 하천',
    description: '활기차게 요동치는 하천 물길이에요.',
    iconName: 'activity',
  },

];

const { width: PAGE_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = Math.min(PAGE_WIDTH * 0.72, 290);

export default function SoundScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { waterSource, setWaterSource, safetyLevel } = useRipple();
  const { mode } = useAppMode();
  const [playing, setPlaying] = useState(true);

  const carouselRef = useRef<CarouselRef>(null);
  const isProduction = mode === 'PRODUCTION';

  // Synchronize carousel position when active waterSource updates (e.g. via geofence trigger in PROD mode)
  useEffect(() => {
    const targetIdx = CAROUSEL_CATEGORIES.findIndex((item) => item.value === waterSource);
    if (targetIdx !== -1 && carouselRef.current) {
      carouselRef.current.scrollTo({ index: targetIdx, animated: true });
    }
  }, [waterSource]);

  // Lockscreen event listeners for 2-way state synchronization
  useEffect(() => {
    const playSub = DeviceEventEmitter.addListener('onMediaSessionPlay', () => {
      setPlaying(true);
    });
    const pauseSub = DeviceEventEmitter.addListener('onMediaSessionPause', () => {
      setPlaying(false);
    });
    return () => {
      playSub.remove();
      pauseSub.remove();
    };
  }, []);

  const isInitialMount = useRef(true);

  // Control audio engine when playing state or waterSource changes
  useEffect(() => {
    if (isInitialMount.current) {
      playDynamicMix(waterSource, safetyLevel === 'danger').catch((err) =>
        console.warn('[SoundScreen] Auto-play on mount failed:', err)
      );
      isInitialMount.current = false;
      return;
    }
    if (playing) {
      playDynamicMix(waterSource, safetyLevel === 'danger').catch((err) =>
        console.warn('[SoundScreen] playDynamicMix failed:', err)
      );
    } else {
      stopAmbientSound().catch((err) =>
        console.warn('[SoundScreen] stopAmbientSound failed:', err)
      );
    }
  }, [playing, waterSource, safetyLevel]);

  const glitch = safetyLevel === 'danger';
  const info = WATER_SOURCE_LABELS[waterSource] || {
    label: '수변 공간',
    description: '물소리가 은은하게 섞여서 들려와요.',
  };

  let visualMode: WaveformMode = 'flow';
  if (glitch) visualMode = 'glitch';
  else if (!playing) visualMode = 'idle';

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <ScrollView 
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
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

      <View style={styles.carouselHeader}>
        <Text style={[styles.carouselModeText, { color: colors.mutedForeground }]}>
          {isProduction
            ? 'PROD 모드: 위치 지오펜스 감지에 따라 소리가 자동 전환됩니다'
            : 'DEMO 모드: 3D 카루셀을 수동으로 넘겨 5가지 물소리를 들어보세요'}
        </Text>
      </View>

      {/* 3D Carousel container with pointerEvents for DEMO ('auto') vs PROD ('none') */}
      <View
        style={styles.carouselWrapper}
        pointerEvents={isProduction ? 'none' : 'auto'}
      >
        <Carousel
          ref={carouselRef}
          loop={true}
          itemSize={ITEM_WIDTH}
          style={styles.carouselStyle}
          layout={{
            type: 'parallax',
            scale: 0.92,
            offset: 48,
            adjacentScale: 0.78,
          }}
          data={CAROUSEL_CATEGORIES}
          scrollEnabled={!isProduction}
          onSnapToItem={(index: number) => {
            if (!isProduction) {
              const item = CAROUSEL_CATEGORIES[index];
              if (item && item.value !== waterSource) {
                Haptics.selectionAsync();
                setWaterSource(item.value);
              }
            }
          }}
          renderItem={({ item }: { item: WaterCategoryItem }) => {
            const active = item.value === waterSource;
            return (
              <Pressable
                onPress={() => {
                  if (!isProduction && !active) {
                    Haptics.selectionAsync();
                    setWaterSource(item.value);
                  }
                }}
                style={[
                  styles.cardItem,
                  {
                    backgroundColor: active ? colors.card : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                testID={`category-${item.value}`}
              >
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.iconBadge,
                      { backgroundColor: active ? colors.primary : colors.border },
                    ]}
                  >
                    <Feather
                      name={item.iconName}
                      size={16}
                      color={active ? colors.primaryForeground : colors.foreground}
                    />
                  </View>
                  <Text
                    style={[
                      styles.subLabel,
                      { color: active ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {item.subLabel}
                  </Text>
                </View>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                  {item.label}
                </Text>
                <Text
                  style={[styles.itemDesc, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      </ScrollView>
      
      <View style={[styles.nowPlaying, { backgroundColor: colors.secondary, borderRadius: colors.radius, marginBottom: tabBarHeight + 16 }]}>
        <View style={styles.nowPlayingText}>
          <Text style={[styles.nowPlayingTitle, { color: colors.foreground }]}>화면을 꺼도 소리는 계속 흘러요</Text>
          <Text style={[styles.nowPlayingSub, { color: colors.mutedForeground }]}>
            이동하면 소리가 자연스럽게 섞여요
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
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
    marginTop: 20,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  carouselHeader: {
    marginTop: 16,
    marginBottom: 4,
  },
  carouselModeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  carouselWrapper: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselStyle: {
    width: PAGE_WIDTH - 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardItem: {
    width: ITEM_WIDTH,
    height: 145,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  itemTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginTop: 6,
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
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
