/**
 * Lightweight Base64 decoder compatible with Hermes engine in React Native.
 */
function decodeBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  const input = String(str).replace(/=+$/, '');
  
  if (input.length % 4 === 1) {
    throw new Error("Invalid base64 string length");
  }
  
  for (
    let bc = 0, bs = 0, buffer, idx = 0;
    (buffer = input.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Retrieves dynamically decrypted API credentials.
 */
export const getAPIKeys = () => {
  const kmaBase64 = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';
  const busanBase64 = process.env.EXPO_PUBLIC_BUSAN_SERVICE_KEY || '';

  return {
    KMA_SERVICE_KEY: kmaBase64 ? decodeBase64(kmaBase64) : 'FALLBACK_DEMO_KEY',
    BUSAN_SERVICE_KEY: busanBase64 ? decodeBase64(busanBase64) : 'FALLBACK_DEMO_KEY',
  };
};
