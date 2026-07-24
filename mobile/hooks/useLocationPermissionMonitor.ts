import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A hook that monitors the application state and checks for permission revocation errors
 * that may have been logged by the background geofencing service.
 * @param onRevoked Callback to execute when a permission revocation is detected (e.g., showing a UI banner).
 */
export function useLocationPermissionMonitor(onRevoked: () => void) {
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Only check when the app comes into the foreground
      if (nextAppState === 'active') {
        try {
          const errorRaw = await AsyncStorage.getItem('@anywayTheSea:permission_error');
          if (errorRaw) {
            const parsed = JSON.parse(errorRaw);
            if (parsed.error === 'PERMISSION_REVOKED') {
              onRevoked();
              
              // Clear the error so we don't repeatedly fire the callback
              // unless the background task logs it again.
              await AsyncStorage.removeItem('@anywayTheSea:permission_error');
            }
          }
        } catch (e) {
          console.error('[Permission Monitor] Failed to parse permission error log:', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [onRevoked]);
}
