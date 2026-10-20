import { handleApi, type ApiRequest, type ApiResult } from './api';
export type ApiConnection = { url: string; token: string; discoveryPath: string };
declare global {
  interface Window {
    timelogDesktop?: {
      onRequest(callback: (request: ApiRequest & { id: string }) => void): void;
      respond(id: string, result: ApiResult): void;
      ready(): void;
      connection(): Promise<ApiConnection | null>;
      setTheme(preference: 'system' | 'light' | 'dark'): void;
    };
  }
}
export function startDesktopBridge() {
  const bridge = window.timelogDesktop;
  if (!bridge) return;
  bridge.onRequest(async (request) => {
    const result = await handleApi(request);
    bridge.respond(request.id, result);
  });
  bridge.ready();
}
