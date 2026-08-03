import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export type AppMode = 'PRODUCTION' | 'DEMO';

interface AppModeContextValue {
  mode: AppMode;
  isLoaded: boolean;
  switchMode: () => void;
}

const AppModeContext = createContext<AppModeContextValue>({
  mode: 'PRODUCTION',
  isLoaded: false,
  switchMode: () => {},
});

const APP_MODE_KEY = '@anywayTheSea:app_mode';

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppMode>('PRODUCTION');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadMode() {
      try {
        const stored = await AsyncStorage.getItem(APP_MODE_KEY);
        if (stored === 'DEMO' || stored === 'PRODUCTION') {
          setMode(stored);
        } else {
          // Default
          setMode('PRODUCTION');
        }
      } catch (err) {
        console.warn('Failed to load app mode from AsyncStorage', err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadMode();
  }, []);

  const switchMode = () => {
    const nextMode: AppMode = mode === 'PRODUCTION' ? 'DEMO' : 'PRODUCTION';
    Alert.alert(
      '모드 전환',
      `앱을 [${nextMode === 'DEMO' ? '시연용' : '배포용'}] 모드로 즉시 전환합니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '전환하기',
          style: 'default',
          onPress: async () => {
            await AsyncStorage.setItem(APP_MODE_KEY, nextMode);
            setMode(nextMode);
            Alert.alert('모드 전환 완료', `앱이 [${nextMode === 'DEMO' ? '시연용' : '배포용'}] 모드로 성공적으로 전환되었습니다.`);
          },
        },
      ]
    );
  };

  return (
    <AppModeContext.Provider value={{ mode, isLoaded, switchMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
