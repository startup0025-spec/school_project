import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useRipple, type DiaryEntry } from '@/context/RippleContext';

const extractKey = (item: DiaryEntry) => item.id;

export default function DiaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { diaryEntries } = useRipple();

  // contentContainerStyle 레퍼런스 고정으로 자식 뷰 리렌더링 차단
  const contentContainerStyle = useMemo(() => ({
    paddingBottom: insets.bottom + 100,
  }), [insets.bottom]);

  const renderItem = useCallback(({ item, index }: { item: DiaryEntry; index: number }) => (
    <View style={styles.row}>
      <View style={styles.timelineCol}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        {index !== diaryEntries.length - 1 && (
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        )}
      </View>
      <View style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.entryHeader}>
          <Text style={[styles.entryLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
          {item.placeName && (
            <View style={styles.placeBadge}>
              <Feather name="map-pin" size={11} color={colors.primary} />
              <Text style={[styles.placeText, { color: colors.primary }]}>{item.placeName}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.entryText, { color: colors.foreground }]}>{item.detail}</Text>
      </View>
    </View>
  ), [colors, diaryEntries.length]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + 20 },
      ]}
    >
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>흔적 없는 기록</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>고요했던 순간들</Text>

      {diaryEntries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="feather" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            아직 조용히 머문 기록이 없어요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={diaryEntries}
          keyExtractor={extractKey}
          renderItem={renderItem}
          scrollEnabled={diaryEntries.length > 0}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
        />
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
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
    marginBottom: 18,
  },

  row: {
    flexDirection: 'row',
    gap: 14,
  },
  timelineCol: {
    alignItems: 'center',
    width: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  entryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  placeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  entryLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  entryText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    lineHeight: 21,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 120,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
