/**
 * Retrieves API credentials directly from environment variables.
 * (Public Data Portal now issues safe 64-character hex strings, no decoding needed)
 */
export const getAPIKeys = () => {
  const kmaKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';
  const busanKey = process.env.EXPO_PUBLIC_BUSAN_SERVICE_KEY || '';

  return {
    KMA_SERVICE_KEY: kmaKey ? kmaKey : 'FALLBACK_DEMO_KEY',
    BUSAN_SERVICE_KEY: busanKey ? busanKey : 'FALLBACK_DEMO_KEY',
  };
};
