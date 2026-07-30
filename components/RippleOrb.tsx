import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type OrbMode = 'calm' | 'walking' | 'busy' | 'danger';

interface OrbConfig {
  intensity: number;
  colorFrom: string;
  colorTo: string;
  noisy: boolean;
}

const MODE_CONFIG: Record<OrbMode, OrbConfig> = {
  calm: { intensity: 0.12, colorFrom: '#9FD1CB', colorTo: '#2F6F6B', noisy: false },
  walking: { intensity: 0.48, colorFrom: '#79B8B1', colorTo: '#28615D', noisy: false },
  busy: { intensity: 0.85, colorFrom: '#4F8B85', colorTo: '#173330', noisy: false },
  danger: { intensity: 1, colorFrom: '#E7B7AC', colorTo: '#C1503F', noisy: true },
};

interface RippleOrbProps {
  mode: OrbMode;
  size?: number;
  rawSpeedMps?: number;
}

export function RippleOrb({ mode, size = 240, rawSpeedMps }: RippleOrbProps) {
  const config = MODE_CONFIG[mode];
  
  // Continuous speed mapping
  let activeIntensity = config.intensity;
  if (rawSpeedMps !== undefined) {
    // 0 m/s -> ~0.12 (calm)
    // 1.5 m/s -> ~0.48 (walking)
    // 4.0 m/s -> ~0.85 (busy)
    activeIntensity = Math.max(0.05, Math.min(1.2, 0.12 + (rawSpeedMps / 4.0) * 0.73));
  }

  const progress = useSharedValue(0);

  useEffect(() => {
    const duration = Math.max(400, 2600 - activeIntensity * 1600);
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeIntensity]);

  const wobbleStyle = useAnimatedStyle(() => {
    const t = progress.value * Math.PI * 2;
    const amp = activeIntensity * 8 + (config.noisy ? Math.random() * 6 : 0);
    return {
      transform: [
        { translateX: Math.sin(t * 2.1) * amp },
        { translateY: Math.cos(t * 2.7) * amp * 0.6 },
      ],
    };
  });

  const center = size / 2;
  const baseRadius = size * 0.24;
  const maxRadius = size * 0.47;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={wobbleStyle}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="core" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={config.colorTo} stopOpacity={0.95} />
              <Stop offset="100%" stopColor={config.colorFrom} stopOpacity={0.2} />
            </RadialGradient>
          </Defs>
          {[0, 1, 2].map((i) => (
            <RippleRing
              key={i}
              index={i}
              progress={progress}
              center={center}
              baseRadius={baseRadius}
              maxRadius={maxRadius}
              intensity={activeIntensity}
              color={config.colorTo}
              noisy={config.noisy}
            />
          ))}
          <Circle cx={center} cy={center} r={baseRadius * 0.75} fill="url(#core)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

function RippleRing({
  index,
  progress,
  center,
  baseRadius,
  maxRadius,
  intensity,
  color,
  noisy,
}: {
  index: number;
  progress: SharedValue<number>;
  center: number;
  baseRadius: number;
  maxRadius: number;
  intensity: number;
  color: string;
  noisy: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    const phase = index / 3;
    const t = (progress.value + phase) % 1;
    const spread = (0.6 + intensity * 0.4) * (noisy ? 0.7 + Math.random() * 0.5 : 1);
    const radius = baseRadius + t * (maxRadius - baseRadius) * spread;
    const opacity = Math.max(0, (1 - t) * (0.55 - intensity * 0.15));
    return { r: radius, opacity };
  });

  return (
    <AnimatedCircle
      cx={center}
      cy={center}
      animatedProps={animatedProps}
      fill="none"
      stroke={color}
      strokeWidth={intensity > 0.6 ? 3 : 1.6}
    />
  );
}
