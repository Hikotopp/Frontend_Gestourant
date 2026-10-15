interface ImportMeta {
  readonly env?: {
    readonly PROD?: boolean;
    readonly VITE_API_URL?: string;
  };
}

declare var __GESTOURANT_CONFIG__: {
  apiBase?: string;
  development?: boolean;
  production?: boolean;
};

declare var __GESTOURANT_OPEN_AUTH__:
  | ((mode: 'login' | 'register') => Promise<void>)
  | undefined;

declare var __GESTOURANT_NOTICE_CHANGED__: ((notice: string) => void) | undefined;

interface GestourantAuthConfig {
  captchaEnabled: boolean;
  captchaSiteKey: string;
  googleEnabled: boolean;
  microsoftEnabled: boolean;
}

interface GestourantSession {
  token: string;
  username: string;
  email: string;
  role: string;
  previousSessionClosed?: boolean;
}

interface GestourantAuthBridge {
  getConfig: () => Promise<GestourantAuthConfig>;
  login: (credentials: Record<string, unknown>) => Promise<GestourantSession>;
  register: (account: Record<string, unknown>) => Promise<GestourantSession>;
  registerOAuthAccount: (account: Record<string, unknown>) => Promise<GestourantSession>;
}

declare var __GESTOURANT_AUTH_ACTIVE__: boolean | undefined;
declare var __GESTOURANT_COOKIE_NOTICE_ACTIVE__: boolean | undefined;
declare var __GESTOURANT_AUTH__: GestourantAuthBridge | undefined;
declare var __GESTOURANT_AUTH_INITIALIZED__: Promise<void> | undefined;
declare var __GESTOURANT_AUTH_CONFIG_CHANGED__: ((config: GestourantAuthConfig) => void) | undefined;
declare var __GESTOURANT_COMPLETE_AUTH__: ((session: GestourantSession) => void) | undefined;
declare var __GESTOURANT_SESSION_READY__: (() => void) | undefined;
declare var __GESTOURANT_PUBLIC_HOME__: ((notice: string) => void) | undefined;
declare var turnstile:
  | {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove?: (widgetId: string) => void;
    }
  | undefined;
