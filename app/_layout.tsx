import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RippleProvider } from '@/context/RippleContext';
import { useColors } from '@/hooks/useColors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as TaskManager from 'expo-task-manager';
import { Alert, Linking } from 'react-native';
import { configureBackgroundAudioSession } from '@/lib/services/audio_engine_service';
import {
  startAdaptiveTracking,
  LOCATION_TRACKING_TASK,
} from '@/lib/services/geofencing_service';
import { useLocationPermissionMonitor } from '@/hooks/useLocationPermissionMonitor';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: '뒤로',
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: '알림' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useLocationPermissionMonitor(() => {
    Alert.alert(
      '위치 권한 오류',
      '백그라운드 위치 권한이 해제되어 물소리를 재생할 수 없습니다. 설정에서 "항상 허용"으로 변경해주세요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '설정으로 이동', onPress: () => Linking.openSettings() }
      ]
    );
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      // 백그라운드 오디오 세션 등록 (지오펜싱이 물소리를 재생할 수 있도록 선행 등록)
      configureBackgroundAudioSession();

      // [Step 1] 적응형 지오펜싱 백그라운드 위치 추적 기동
      TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK).then((isRunning: boolean) => {
        if (isRunning) {
          console.log('[Layout] Geofencing task already running. Skipping re-registration.');
          return;
        }
        startAdaptiveTracking().catch((err) => {
          console.warn('[Layout] Geofencing start failed:', err?.message);
          // 권한 거부 시 사용자에게 안내 (앱 강제 종료 없이 graceful 처리)
          if (
            err?.message?.toLowerCase().includes('permission') ||
            err?.message?.toLowerCase().includes('denied')
          ) {
            Alert.alert(
              '위치 권한 필요',
              '물소리 자동 재생을 위해 앱 정보 -> 권한 -> 위치 설정에서 "항상 허용"으로 변경해주세요.',
              [
                { text: '닫기', style: 'cancel' },
                { text: '설정으로 이동', onPress: () => Linking.openSettings() }
              ]
            );
          }
        });
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RippleProvider>
                <RootLayoutNav />
              </RippleProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
