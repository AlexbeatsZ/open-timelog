import { Capacitor, registerPlugin } from '@capacitor/core';
export const isAndroid = Capacitor.getPlatform() === 'android';
export const nativeFiles = registerPlugin<{
  save(options: { name: string; data: string; mime: string }): Promise<void>;
  open(): Promise<{ name: string; data: string }>;
}>('TimelogFiles');
