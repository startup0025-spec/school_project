import * as Notifications from 'expo-notifications';
import { Place } from '../../core_engine/src/models/place_model';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false, // Calm UX: no loud notification sounds, just the ambient audio
    shouldSetBadge: false,
  }),
});

/**
 * Triggers a local push notification when the user enters a specific water spot.
 * @param place The Place object the user has entered.
 */
export const NOTIFICATION_STORAGE_KEY = '@anywayTheSea:notifications';

export async function triggerWelcomeNotification(place: Place): Promise<void> {
  const text = `지금 [${place.name}] 반경에 들어오셨네요. 잠시 조용한 휴식을 즐겨보세요.`;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '물소리가 머무는 자리 🌊',
        body: text,
      },
      trigger: null, // Trigger immediately
    });
    
    // AsyncStorage 기록 (선 띡 연결)
    const newNoti = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      text
    };
    
    const saved = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    let history = [];
    if (saved) {
      try { history = JSON.parse(saved); } catch(e) { /* ignore json parse error */ }
    }
    history.unshift(newNoti);
    history = history.slice(0, 50);
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(history));

    console.log(`[Notification Service] Welcome notification triggered & saved for ${place.name}`);
  } catch (error) {
    console.error('[Notification Service] Failed to trigger notification:', error);
  }
}

/**
 * [Step 3] 위험/경보 상황 발생 시 긴급 대피 알림을 트리거함.
 * geofencing_service.ts가 checkGeofenceAndSafety() 연산 결과 Danger 판정 시 호출.
 * ※ MP3 파일 추후 추가 시 실가동 예정 — 현재 emergency_siren.wav는 464B 플레이스홀더 상태
 */
export async function triggerDangerNotification(place: Place): Promise<void> {
  const text = `[위험 경보] ${place.name} 권역의 수위 또는 기상 상태가 위험합니다. 즉시 대피하세요.`;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ 위험 경보 — 즉시 대피',
        body: text,
        sound: false, // Calm UX: 알림음없이 푸시만 (실제 경보음은 playEmergencySiren이 담당)
      },
      trigger: null,
    });

    // AsyncStorage 이력 저장
    const newNoti = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      text,
      level: 'DANGER',
    };

    const saved = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    let history: unknown[] = [];
    if (saved) {
      try { history = JSON.parse(saved); } catch (e) { /* ignore json parse error */ }
    }
    history.unshift(newNoti);
    history = history.slice(0, 50);
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(history));

    console.log(`[Notification Service] Danger notification triggered & saved for ${place.name}`);
  } catch (error) {
    console.error('[Notification Service] Failed to trigger danger notification:', error);
  }
}
