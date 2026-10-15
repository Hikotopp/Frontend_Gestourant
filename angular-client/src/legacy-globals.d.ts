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
