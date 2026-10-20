import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'io.github.alexbeatsz.opentimelog',
  appName: '时迹',
  webDir: 'dist',
  backgroundColor: '#172328',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https', hostname: 'localhost' },
};
export default config;
