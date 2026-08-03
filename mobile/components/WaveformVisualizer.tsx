import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type WaveformMode = 'flow' | 'glitch' | 'idle';

interface WaveformVisualizerProps {
  mode: WaveformMode;
  color: string;
  barCount?: number;
  height?: number;
}

export function WaveformVisualizer({
  mode,
  color,
  barCount = 20,
  height = 64,
}: WaveformVisualizerProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const duration = mode === 'glitch' ? 650 : mode === 'idle' ? 3200 : 1900;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [mode, progress]);

  return (
    <View style={[styles.row, { height }]}>
      {Array.from({ length: barCount }).map((_, i) => (
        <Bar key={i} index={i} total={barCount} progress={progress} mode={mode} color={color} maxHeight={height} />
      ))}
    </View>
  );
}

function Bar({
  index,
  total,
  progress,
  mode,
  color,
  maxHeight,
}: {
  index: number;
  total: number;
  progress: SharedValue<number>;
  mode: WaveformMode;
  color: string;
  maxHeight: number;
}) {
  const style = useAnimatedStyle(() => {
    const phase = index / total;
    const t = (progress.value + phase) % 1;
    let ratio: number;
    let opacity: number;
    if (mode === 'glitch') {
      ratio = 0.15 + Math.random() * 0.8;
      opacity = 0.45 + Math.random() * 0.55;
    } else if (mode === 'idle') {
      ratio = 0.16 + Math.sin(t * Math.PI * 2) * 0.04;
      opacity = 0.5;
    } else {
      ratio = 0.22 + (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * 0.6;
      opacity = 0.85;
    }
    return { height: Math.max(4, ratio * maxHeight), opacity };
  });

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  bar: {
    width: 5,
    borderRadius: 3,
  },
});
