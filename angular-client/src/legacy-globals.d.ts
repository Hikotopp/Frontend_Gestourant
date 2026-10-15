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
