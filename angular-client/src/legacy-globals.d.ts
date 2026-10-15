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

interface GestourantDashboardSummary {
  occupiedTables: number;
  availableTables: number;
  lowStockProducts: number;
}

interface GestourantTable {
  id: number;
  tableNumber: number;
  seats: number;
  status: 'LIBRE' | 'OCUPADA';
  floorX?: number | null;
  floorY?: number | null;
  joinedTableId?: number | null;
  billRequested?: boolean;
  qrToken: string;
}

interface GestourantTableBridge {
  list: (session: GestourantSession) => Promise<GestourantTable[]>;
  create: (session: GestourantSession, table: { tableNumber: number; seats: number }) => Promise<GestourantTable>;
  join: (session: GestourantSession, tableIds: { firstTableId: number; secondTableId: number }) => Promise<void>;
  updatePosition: (session: GestourantSession, id: number, position: { x: number; y: number }) => Promise<GestourantTable>;
}

interface GestourantProduct {
  id: number;
  name: string;
  category: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  stock: number;
  active: boolean;
}

interface GestourantProductsBridge {
  list: (session: GestourantSession) => Promise<GestourantProduct[]>;
  save: (session: GestourantSession, product: Omit<GestourantProduct, 'id'>, id: number | null) => Promise<GestourantProduct>;
  remove: (session: GestourantSession, id: number) => Promise<void>;
}

interface GestourantActiveOrder {
  id: number;
  tableNumber: number;
}

interface GestourantInvoice {
  invoiceNumber: string;
  issuedAt: string;
  tableNumber: number;
  paymentMethod: string;
  total: number;
  employee?: string;
}

interface GestourantHistoryReport {
  from: string;
  to: string;
  facturas: number;
  efectivo: number;
  digital: number;
  total: number;
  invoices: GestourantInvoice[];
}

interface GestourantReportsBridge {
  getHistory: (
    session: GestourantSession,
    from: string,
    to: string,
    administrator: boolean,
  ) => Promise<GestourantHistoryReport>;
}

interface GestourantBackup {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}

interface GestourantBackupRestoreResult {
  safetyBackupFileName: string;
}

interface GestourantBackupsBridge {
  list: (session: GestourantSession) => Promise<GestourantBackup[]>;
  create: (session: GestourantSession) => Promise<GestourantBackup>;
  download: (session: GestourantSession, id: string) => Promise<void>;
  restore: (session: GestourantSession, id: string) => Promise<GestourantBackupRestoreResult>;
}

interface GestourantRequestsBridge {
  listOrders: (session: GestourantSession) => Promise<GestourantStaffRequest[]>;
  approve: (session: GestourantSession, id: number) => Promise<void>;
  reject: (session: GestourantSession, id: number) => Promise<void>;
  listKitchen: (session: GestourantSession) => Promise<GestourantKitchenRequest[]>;
  advanceKitchen: (session: GestourantSession, id: number) => Promise<void>;
}

interface GestourantRequestItem {
  quantity: number;
  name: string;
  removedIngredients?: string | null;
  subtotal?: number;
}

interface GestourantStaffRequest {
  id: number;
  tableNumber: number;
  createdAt: string;
  items: GestourantRequestItem[];
  total: number;
}

interface GestourantKitchenRequest {
  id: number;
  tableNumber: number;
  createdAt: string;
  status: string;
  items: GestourantRequestItem[];
}

type GestourantDashboardView = 'tables' | 'orders' | 'kitchen' | 'products' | 'reports' | 'backups';

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
declare var __GESTOURANT_SESSION_READY__: ((session: GestourantSession) => void) | undefined;
declare var __GESTOURANT_PUBLIC_HOME__: ((notice: string) => void) | undefined;
declare var __GESTOURANT_LOAD_DASHBOARD_OVERVIEW__:
  | ((session: GestourantSession) => Promise<GestourantDashboardSummary>)
  | undefined;
declare var __GESTOURANT_TABLES__: GestourantTableBridge | undefined;
declare var __GESTOURANT_REQUESTS__: GestourantRequestsBridge | undefined;
declare var __GESTOURANT_PRODUCTS__: GestourantProductsBridge | undefined;
declare var __GESTOURANT_OPEN_TABLE_DETAIL__: ((tableId: number) => Promise<void>) | undefined;
declare var __GESTOURANT_SHOW_TABLE_QR__: ((table: GestourantTable) => Promise<void>) | undefined;
declare var __GESTOURANT_PENDING_REQUEST_COUNT_CHANGED__: ((count: number) => void) | undefined;
declare var __GESTOURANT_PRODUCT_PHOTO__: ((product: GestourantProduct) => string) | undefined;
declare var __GESTOURANT_ADD_ORDER_PRODUCT__: ((productId: number) => Promise<void>) | undefined;
declare var __GESTOURANT_GET_ACTIVE_ORDER__: (() => Promise<GestourantActiveOrder | null>) | undefined;
declare var __GESTOURANT_REPORTS__: GestourantReportsBridge | undefined;
declare var __GESTOURANT_DOWNLOAD_REPORT__:
  | ((report: GestourantHistoryReport, includeEmployee: boolean) => Promise<void>)
  | undefined;
declare var __GESTOURANT_BACKUPS__: GestourantBackupsBridge | undefined;
declare var __GESTOURANT_OPEN_LEGACY_VIEW__:
  | ((view: GestourantDashboardView) => Promise<void>)
  | undefined;
declare var __GESTOURANT_RETURN_TO_ANGULAR_DASHBOARD__:
  | ((session: GestourantSession) => void)
  | undefined;
declare var __GESTOURANT_LOGOUT__: (() => Promise<void>) | undefined;
declare var turnstile:
  | {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove?: (widgetId: string) => void;
    }
  | undefined;
