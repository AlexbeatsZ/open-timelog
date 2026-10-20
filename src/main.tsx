import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { startDesktopBridge } from './desktop-bridge';

startDesktopBridge();
if (Capacitor.isNativePlatform()) {
  NativeApp.addListener('appStateChange', () => window.dispatchEvent(new Event('timelog-resume')));
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (
  import.meta.env.PROD &&
  !Capacitor.isNativePlatform() &&
  'serviceWorker' in navigator &&
  ['https:', 'http:'].includes(location.protocol)
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error) => console.warn('Offline shell unavailable', error));
  });
}
