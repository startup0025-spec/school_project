import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { type OrbMode } from '@/context/RippleContext';
import { useColors } from '@/hooks/useColors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface RippleBarProps {
  mode: OrbMode;
  rawSpeedMps?: number;
}

export function RippleBar({ mode, rawSpeedMps }: RippleBarProps) {
  const colors = useColors();
  
  let activeIntensity = 0.12;
  if (rawSpeedMps !== undefined) {
    activeIntensity = Math.max(0.05, Math.min(1.2, 0.12 + (rawSpeedMps / 4.0) * 0.73));
    activeIntensity = Math.round(activeIntensity * 10) / 10;
  } else {
    if (mode === 'walking') activeIntensity = 0.48;
    else if (mode === 'busy') activeIntensity = 0.85;
    else if (mode === 'danger') activeIntensity = 1.0;
  }

  const progress = useSharedValue(0);

  useEffect(() => {
    const duration = Math.max(400, 2600 - activeIntensity * 1600);
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [mode, activeIntensity, progress]);

  const animatedProps = useAnimatedProps(() => {
    const t = progress.value * Math.PI * 2;
    const amp = activeIntensity * 15;
    const width = 300;
    const height = 40;
    const midY = height / 2;
    
    // Envelope sine wave
    let d = `M 0 ${midY}`;
    for (let x = 0; x <= width; x += 10) {
      const phase = (x / width) * Math.PI * 4; // 2 full waves
      // Math.sin((x/width)*Math.PI) creates an envelope pinning the ends to 0
      const y = midY + Math.sin(t + phase) * amp * Math.sin((x / width) * Math.PI);
      d += ` L ${x} ${y}`;
    }
    return { d };
  });

  return (
    <View style={{ height: 40, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width="300" height="40">
        <AnimatedPath
          animatedProps={animatedProps}
          fill="none"
          stroke={colors.primary}
          strokeWidth={activeIntensity > 0.6 ? 3 : 2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
