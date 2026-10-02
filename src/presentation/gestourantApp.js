import '../style.css';
import '../order-editor.css';
import '../auth-experience.css';
import '../service-ui.css';
import '../public-home.css';
import '../floor-layout.css';
import '../floor-polish.css';
import '../kitchen-board.css';
import '../qr-network.css';
import QRCode from 'qrcode';
import {
  formatIdleCountdown,
  IDLE_LOCK_AFTER_MS,
  IDLE_LOGOUT_AFTER_MS
} from '../application/idleSessionPolicy';
import { brandMark } from './brandMark';
import { isAvailableForOrder } from '../domain/product';
import { guestOrderingView } from './guestOrdering';
import { productPhoto } from './productPhoto';

let services;
let logger;
const app = document.querySelector('#app');
let tables = [];
let products = [];
let activeOrder = null;
let productCategoryFilter = 'TODOS';
let authConfig = { captchaEnabled: false, captchaSiteKey: '', googleEnabled: false, microsoftEnabled: false };
let idleWarningTimer;
let idleLogoutTimer;
let idleActivityHandler;
let idleVisibilityHandler;
let idleLocked = false;
let idleCountdownTimer;
let idleLockDeadline = 0;
let idleLogoutDeadline = 0;
let idleLogoutStarted = false;
let currentSession = null;
let authNotice = '';
let guestRequestPoll;
let guestRequestBadgePoll;
let tableMapPoll;
let kitchenPoll;
let demoSelectedTableId = 4;
let demoNextItemId = 4;
const demoTables = [
  { id: 4, seats: 4, status: 'OCUPADA' },
  { id: 7, seats: 2, status: 'LIBRE' },
  { id: 9, seats: 6, status: 'OCUPADA' }
];
const demoOrders = {
  4: [
    { id: 1, name: 'Hamburguesa de la casa', price: 28000, note: 'Sin maní' },
    { id: 2, name: 'Limonada natural', price: 7000, note: '' }
  ],
  7: [],
  9: [{ id: 3, name: 'Pasta al pesto', price: 24000, note: '' }]
};
const themeOptions = [
  { id: 'light', label: 'Claro', icon: '☼' },
  { id: 'dark', label: 'Oscuro', icon: '◐' },
  { id: 'bistro', label: 'Bistró', icon: '✦' }
];

function themeSwitcher() {
  const currentTheme = localStorage.getItem('gestourant_theme') || 'light';
  return `<div class="theme-switcher" role="group" aria-label="Tema visual">${themeOptions.map(theme => `<button type="button" class="theme-button ${theme.id === currentTheme ? 'active' : ''}" data-theme="${theme.id}" aria-pressed="${theme.id === currentTheme}" title="Tema ${theme.label}"><span>${theme.icon}</span><small>${theme.label}</small></button>`).join('')}</div>`;
}
function applyTheme(theme) {
  const selectedTheme = themeOptions.some(option => option.id === theme) ? theme : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  localStorage.setItem('gestourant_theme', selectedTheme);
  document.querySelectorAll('.theme-button').forEach(button => {
    const isActive = button.dataset.theme === selectedTheme;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function bindThemeControls() {
  document.querySelectorAll('.theme-button').forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.theme)));
  applyTheme(localStorage.getItem('gestourant_theme') || 'light');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function icon(name, className = '') {
  const paths = {
    overview: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    tables: '<rect x="7" y="7" width="10" height="10" rx="3"/><path d="M4 9v6m16-6v6M9 4h6m-6 16h6"/>',
    orders: '<path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
    products: '<path d="M4 7h16v13H4zM7 7l1-4h8l1 4M8 11h8m-8 4h5"/>',
    kitchen: '<path d="M4 10h16l-2 10H6L4 10Zm0 0a4 4 0 0 1 8 0 4 4 0 0 1 8 0M9 14v2m6-2v2"/>',
    reports: '<path d="M4 19V5m0 14h17M7 15l4-4 3 2 6-7"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.tables}</svg>`;
}

function diningTableIcon() {
  return '<svg class="dining-table-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="18" y="18" width="28" height="28" rx="9" fill="currentColor" fill-opacity=".13" stroke="currentColor" stroke-width="2"/><rect x="25" y="25" width="14" height="14" rx="7" stroke="currentColor" stroke-width="1.6"/><path d="M24 7v6m16-6v6M24 51v6m16-6v6M7 24h6m-6 16h6m38-16h6m-6 16h6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="2" fill="currentColor"/></svg>';
}

function socialLoginOptions() {
  const providers = [
    { id: 'google', label: 'Google', enabled: authConfig.googleEnabled },
    { id: 'microsoft', label: 'Microsoft', enabled: authConfig.microsoftEnabled }
  ];
  const apiRoot = (apiBase || 'http://localhost:8081').replace(/\/+$/, '');
  return `<div class="social-login"><div class="social-divider"><span>o continúa con</span></div><div class="social-buttons">${providers.map(provider => provider.enabled
    ? `<a class="social-button" data-oauth-provider="${provider.id}" href="${escapeHtml(apiRoot)}/oauth2/authorization/${provider.id}"><span class="social-mark ${provider.id}">${provider.id === 'google' ? 'G' : 'M'}</span>Continuar con ${provider.label}</a>`
    : `<button class="social-button social-button-disabled" type="button" disabled aria-describedby="provider-setup-note"><span class="social-mark ${provider.id}">${provider.id === 'google' ? 'G' : 'M'}</span>Continuar con ${provider.label}<small>No configurado</small></button>`).join('')}</div>${providers.some(provider => !provider.enabled) ? '<p id="provider-setup-note" class="provider-setup-note">Algunos proveedores de acceso todavía no están configurados.</p>' : ''}</div>`;
}

function oauthConsentField(text, required = false) {
  return `<label class="oauth-consent"><input type="checkbox" name="privacyConsent" ${required ? 'required' : ''}><span>${text} <a href="/politica-tratamiento.html" target="_blank" rel="noopener">Leer política</a>.</span></label>`;
}

function showSpanishFormValidation(form, message) {
  const invalidField = [...form.elements].find(field => field.willValidate && !field.validity.valid);
  if (!invalidField) return true;
  const validity = invalidField.validity;
  const label = invalidField.closest('label')?.innerText.split('\n')[0].trim() || 'este campo';
  let text = `Revisa el campo «${label}».`;
  if (validity.valueMissing && invalidField.type === 'checkbox') {
    text = 'Debes autorizar el tratamiento de tus datos para continuar.';
  } else if (validity.valueMissing) {
    text = `Completa el campo «${label}».`;
  } else if (validity.typeMismatch && invalidField.type === 'email') {
    text = 'Escribe un correo electrónico válido.';
  } else if (validity.tooShort) {
    text = `Este campo debe tener al menos ${invalidField.minLength} caracteres.`;
  } else if (validity.tooLong) {
    text = `Este campo no puede superar ${invalidField.maxLength} caracteres.`;
  } else if (validity.rangeUnderflow) {
    text = `El valor debe ser igual o mayor que ${invalidField.min}.`;
  } else if (validity.rangeOverflow) {
    text = `El valor debe ser igual o menor que ${invalidField.max}.`;
  } else if (validity.stepMismatch) {
    text = 'Ingresa un valor válido para este campo.';
  }
  message.textContent = '';
  showToast(text, true);
  invalidField.focus();
  return false;
}

function bindSocialLogin(root) {
  root.querySelectorAll('[data-oauth-provider]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    link.setAttribute('aria-disabled', 'true');
    window.location.assign(link.href);
  }));
}

function initializeCaptcha(containerId) {
  if (!authConfig.captchaEnabled || !authConfig.captchaSiteKey) return;
  const render = () => {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.widgetId || !window.turnstile) return;
    const widgetId = window.turnstile.render(container, {
      sitekey: authConfig.captchaSiteKey,
      callback: token => { const field = container.closest('form')?.querySelector('[name="captchaToken"]'); if (field) field.value = token; },
      'expired-callback': () => { const field = container.closest('form')?.querySelector('[name="captchaToken"]'); if (field) field.value = ''; },
      'error-callback': () => { showToast('No se pudo cargar la verificación. Recarga la página para intentarlo de nuevo.', true); }
    });
    container.dataset.widgetId = widgetId;
  };
  if (window.turnstile) {
    render();
    return;
  }
  if (document.querySelector('script[data-turnstile]')) {
    window.addEventListener('turnstile-ready', render, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.dataset.turnstile = 'true';
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;
  script.addEventListener('load', () => {
    window.dispatchEvent(new Event('turnstile-ready'));
    render();
  }, { once: true });
  script.addEventListener('error', () => showToast('No se pudo cargar Cloudflare Turnstile.', true), { once: true });
  document.head.appendChild(script);
}

function resetCaptcha(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !window.turnstile || !container.dataset.widgetId) return;
  const field = container.closest('form')?.querySelector('[name="captchaToken"]');
  if (field) field.value = '';
  window.turnstile.reset(container.dataset.widgetId);
}

function showCookieNotice() {
  if (localStorage.getItem('gestourant_cookie_consent')) return;
  let notice = document.querySelector('#cookie-notice');
  if (notice) return;
  notice = document.createElement('aside');
  notice.id = 'cookie-notice';
  notice.className = 'cookie-notice';
  notice.setAttribute('aria-label', 'Preferencias de cookies');
  notice.innerHTML = `<div><p class="eyebrow">TU PRIVACIDAD</p><strong>Cookies y almacenamiento</strong><p>Usamos almacenamiento esencial para mantener tu sesión y preferencias, y protección anti-bots cuando está habilitada. Consulta nuestra <a href="/politica-tratamiento.html" target="_blank" rel="noopener">política de datos y cookies</a>.</p></div><div class="cookie-actions"><button type="button" class="outline" data-cookie-choice="necessary">Solo necesarias</button><button type="button" class="primary" data-cookie-choice="all">Aceptar</button></div>`;
  document.body.appendChild(notice);
  notice.querySelectorAll('[data-cookie-choice]').forEach(button => button.addEventListener('click', () => {
    localStorage.setItem('gestourant_cookie_consent', button.dataset.cookieChoice);
    notice.remove();
  }));
}

function clearIdleMonitoring() {
  clearTimeout(idleWarningTimer);
  clearTimeout(idleLogoutTimer);
  clearInterval(idleCountdownTimer);
  idleCountdownTimer = null;
  if (idleActivityHandler) {
    ['pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach(type => document.removeEventListener(type, idleActivityHandler));
    idleActivityHandler = null;
  }
  if (idleVisibilityHandler) {
    document.removeEventListener('visibilitychange', idleVisibilityHandler);
    window.removeEventListener('focus', idleVisibilityHandler);
    idleVisibilityHandler = null;
  }
  idleLockDeadline = 0;
  idleLogoutDeadline = 0;
  idleLogoutStarted = false;
}

function setupIdleMonitoring(session) {
  clearIdleMonitoring();
  currentSession = session;
  idleLocked = false;
  const lockAfter = IDLE_LOCK_AFTER_MS;
  const logoutAfter = IDLE_LOGOUT_AFTER_MS;
  const expireIdleSession = async () => {
    if (idleLogoutStarted || !currentSession) return;
    idleLogoutStarted = true;
    authNotice = 'La sesión se cerró por 5 minutos de inactividad.';
    await logout(currentSession, true);
  };
  const schedule = () => {
    if (idleLocked) return;
    clearTimeout(idleWarningTimer);
    clearTimeout(idleLogoutTimer);
    idleLockDeadline = Date.now() + lockAfter;
    idleLogoutDeadline = Date.now() + logoutAfter;
    idleWarningTimer = setTimeout(showSessionLock, lockAfter);
    idleLogoutTimer = setTimeout(expireIdleSession, logoutAfter);
  };
  idleVisibilityHandler = () => {
    if (document.hidden || !currentSession) return;
    const now = Date.now();
    if (now >= idleLogoutDeadline) expireIdleSession();
    else if (now >= idleLockDeadline) showSessionLock();
    else if (idleLocked) updateIdleCountdown();
  };
  let lastMove = 0;
  idleActivityHandler = event => {
    if (event.type === 'mousemove') {
      const now = Date.now();
      if (now - lastMove < 1000) return;
      lastMove = now;
    }
    schedule();
  };
  ['pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach(type => document.addEventListener(type, idleActivityHandler, { passive: true }));
  document.addEventListener('visibilitychange', idleVisibilityHandler);
  window.addEventListener('focus', idleVisibilityHandler);
  schedule();
}

function updateIdleCountdown() {
  const countdown = document.querySelector('#idle-countdown');
  if (!countdown) return;
  countdown.textContent = formatIdleCountdown(idleLogoutDeadline);
}

function showSessionLock() {
  if (idleLocked || !currentSession) return;
  if (Date.now() >= idleLogoutDeadline) {
    authNotice = 'La sesión se cerró por 5 minutos de inactividad.';
    void logout(currentSession, true);
    return;
  }
  idleLocked = true;
  const providers = socialLoginOptions();
  const overlay = document.createElement('div');
  overlay.className = 'session-lock';
  overlay.id = 'session-lock';
  overlay.innerHTML = `<section class="session-lock-card" role="dialog" aria-modal="true" aria-labelledby="session-lock-title"><span class="lock-icon">◉</span><p class="eyebrow accent">SESIÓN PAUSADA</p><h2 id="session-lock-title">Confirma que eres tú</h2><p class="muted">La pantalla se bloqueó tras 2 minutos sin actividad. Verifica tu contraseña para seguir trabajando.</p><p class="muted" role="status">La sesión se cerrará en <strong id="idle-countdown" class="idle-countdown">03:00</strong> si no la desbloqueas.</p><form id="unlock-form" novalidate><label>Cuenta<input name="identifier" value="${escapeHtml(currentSession.email)}" readonly autocomplete="username"></label><label>Contraseña<div class="password-wrap"><input name="password" type="password" required autocomplete="current-password" autofocus></div></label><div id="unlock-captcha" class="captcha-slot"></div><input type="hidden" name="captchaToken"><p id="unlock-error" class="form-message" role="alert"></p><button class="primary" type="submit">Desbloquear sesión</button></form><div class="unlock-social">${providers}<button type="button" class="text-button" id="unlock-logout">Cerrar sesión</button></div></section>`;
  document.body.appendChild(overlay);
  updateIdleCountdown();
  idleCountdownTimer = window.setInterval(() => {
    if (Date.now() >= idleLogoutDeadline) {
      authNotice = 'La sesión se cerró por 5 minutos de inactividad.';
      void logout(currentSession, true);
      return;
    }
    updateIdleCountdown();
  }, 1000);
  document.querySelector('#unlock-form').addEventListener('submit', unlockSession);
  bindSocialLogin(overlay);
  document.querySelector('#unlock-logout').addEventListener('click', () => logout(currentSession));
  initializeCaptcha('unlock-captcha');
  document.querySelector('#session-lock input[name="password"]').focus();
}

async function unlockSession(event) {
  event.preventDefault();
  const unlockForm = event.currentTarget;
  const validationMessage = document.querySelector('#unlock-error');
  validationMessage.textContent = '';
  if (!showSpanishFormValidation(unlockForm, validationMessage)) return;
  const form = new FormData(event.currentTarget);
  const message = validationMessage;
  const submitButton = unlockForm.querySelector('[type="submit"]');
  const captchaToken = form.get('captchaToken');
  if (authConfig.captchaEnabled && !captchaToken) { message.textContent = 'Completa la verificación de seguridad.'; return; }
  submitButton.disabled = true;
  try {
    const data = await services.auth.login({
      identifier: form.get('identifier'),
      password: form.get('password'),
      captchaToken,
      website: ''
    });
    if (!idleLocked || !currentSession) return;
    sessionStorage.setItem('gestourant_session', JSON.stringify(data));
    currentSession = data;
    document.querySelector('#session-lock')?.remove();
    setupIdleMonitoring(data);
    showToast('Sesión desbloqueada.');
  } catch (error) {
    if (idleLocked && currentSession) {
      message.textContent = error.message;
      resetCaptcha('unlock-captcha');
    }
  } finally {
    if (submitButton.isConnected && idleLocked && currentSession) submitButton.disabled = false;
  }
}

function publicHomeView() {
  currentSession = null;
  app.innerHTML = `<main class="public-home">
    <header class="public-nav"><a href="#" class="public-brand" aria-label="Gestourant, inicio">${brandMark()}<span>Gestourant</span></a><nav aria-label="Navegación de la página"><a href="#funciones">Funciones</a><a href="#demo">Explorar demo</a></nav><div class="public-nav-actions"><button type="button" class="public-login" data-public-auth="login">Iniciar sesión</button><button type="button" class="public-signup" data-public-auth="register">Crear cuenta ${icon('arrow')}</button></div></header>
    ${authNotice ? `<p class="public-notice" role="status">${escapeHtml(authNotice)}</p>` : ''}
    <section class="public-hero"><div class="public-hero-copy"><p class="eyebrow">EL SERVICIO, BAJO CONTROL</p><h1>Un restaurante que fluye, <em>mesa a mesa.</em></h1><p class="public-lead">Coordina sala, pedidos y menú desde un solo lugar. Menos vueltas entre el salón y la cocina; más atención para tus clientes.</p><div class="public-hero-actions"><button type="button" class="public-signup" data-public-auth="register">Conoce Gestourant ${icon('arrow')}</button><a class="public-text-link" href="#demo">Explorar demo interactiva <span>↓</span></a></div><div class="public-trust"><span>✓ Pedidos por mesa</span><span>✓ Cambios al instante</span><span>✓ Control de inventario</span></div></div><div class="public-hero-visual"><img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85" alt="Platos servidos en un restaurante" loading="eager"><div class="hero-photo-caption"><span class="live-dot"></span><span><strong>El servicio conectado</strong><small>Sala, carta y pedidos en sincronía</small></span></div><div class="hero-floating-card"><span>${icon('tables')}</span><div><strong>La sala está en marcha</strong><small>Mesas y cuentas a la vista</small></div></div></div></section>
    <section class="public-proof-bar" aria-label="Funciones principales"><span>DISEÑADO PARA EL DÍA A DÍA</span><strong>Atiende con claridad</strong><i></i><strong>Organiza tu operación</strong><i></i><strong>Cuida cada pedido</strong></section>
    <section id="funciones" class="public-features"><div class="public-section-heading"><p class="eyebrow">UNA OPERACIÓN MÁS SIMPLE</p><h2>Todo el servicio, en su lugar.</h2><p>Herramientas prácticas para que el equipo sepa qué está pasando y qué sigue.</p></div><div class="public-feature-grid"><article class="public-feature-card"><span class="public-feature-icon">${icon('tables')}</span><p class="eyebrow">01 · SALÓN</p><h3>Un mapa vivo de mesas</h3><p>Consulta cuáles están libres o en servicio. Abre la cuenta desde la mesa y mantén el contexto mientras atiendes.</p></article><article class="public-feature-card"><span class="public-feature-icon">${icon('orders')}</span><p class="eyebrow">02 · PEDIDOS</p><h3>La cuenta al día</h3><p>Agrega productos, retira lo que cambió y deja indicaciones de ingredientes para que el equipo las confirme con cocina.</p></article><article class="public-feature-card"><span class="public-feature-icon">${icon('products')}</span><p class="eyebrow">03 · CARTA</p><h3>Menú e inventario conectados</h3><p>Presenta platos con fotos, precios y disponibilidad. El stock acompaña la operación para ayudar a evitar pedidos agotados.</p></article></div></section>
    <section id="demo" class="public-demo-section"><div class="public-section-heading"><p class="eyebrow">PRUÉBALO SIN RIESGO</p><h2>Explora un turno de ejemplo.</h2><p>Selecciona una mesa, simula un cambio y mira cómo se actualiza la cuenta. Esta demostración no guarda ni envía datos.</p></div><div class="public-demo"><div class="demo-floor"><div class="demo-panel-heading"><span><small>VISTA DE SALA</small><strong>Salón principal</strong></span><span class="demo-tag"><i></i>Demo interactiva</span></div><div id="demo-table-list" class="demo-table-list"></div><div class="demo-floor-note">${icon('tables')}<span>Prueba una mesa ocupada o abre una cuenta de muestra en una mesa libre.</span></div></div><div id="demo-order-panel" class="demo-order-panel" aria-live="polite"></div></div><div class="demo-disclaimer">Todo lo que hagas aquí es una simulación en tu navegador. No se conecta a cuentas, mesas ni inventario reales.</div></section>
    <section class="public-cta"><div><p class="eyebrow">LISTO PARA TU PRÓXIMO TURNO</p><h2>Haz que el servicio avance con más calma.</h2><p>Entra a tu espacio de trabajo o crea una cuenta para comenzar.</p></div><div class="public-cta-actions"><button type="button" class="public-signup" data-public-auth="register">Crear una cuenta ${icon('arrow')}</button><button type="button" class="public-login" data-public-auth="login">Ya tengo cuenta</button></div></section>
    <footer class="public-footer"><a href="#" class="public-brand">${brandMark()}<span>Gestourant</span></a><span>Herramientas para que cada servicio fluya mejor.</span><a href="/politica-tratamiento.html" target="_blank" rel="noopener">Privacidad y tratamiento de datos</a></footer>
  </main>`;
  bindThemeControls();
  app.querySelector('.public-brand').addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  app.querySelectorAll('.public-footer .public-brand').forEach(link => link.addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
  app.querySelectorAll('[data-public-auth]').forEach(button => button.addEventListener('click', () => {
    authNotice = '';
    button.dataset.publicAuth === 'login' ? loginView() : registerView();
    window.scrollTo(0, 0);
  }));
  app.onclick = event => {
    const tableButton = event.target.closest('[data-demo-table]');
    const openButton = event.target.closest('[data-demo-open]');
    const addButton = event.target.closest('[data-demo-add]');
    const removeButton = event.target.closest('[data-demo-remove]');
    const saveNoteButton = event.target.closest('[data-demo-save-note]');
    if (tableButton) {
      demoSelectedTableId = Number(tableButton.dataset.demoTable);
      renderDemo();
    } else if (openButton) {
      const table = demoTables.find(item => item.id === demoSelectedTableId);
      if (table) table.status = 'OCUPADA';
      renderDemo();
    } else if (addButton) {
      const item = { id: demoNextItemId++, name: addButton.dataset.name, price: Number(addButton.dataset.price), note: '' };
      demoOrders[demoSelectedTableId].push(item);
      const table = demoTables.find(entry => entry.id === demoSelectedTableId);
      if (table) table.status = 'OCUPADA';
      renderDemo();
    } else if (removeButton) {
      demoOrders[demoSelectedTableId] = demoOrders[demoSelectedTableId].filter(item => item.id !== Number(removeButton.dataset.demoRemove));
      renderDemo();
    } else if (saveNoteButton) {
      const note = app.querySelector('#demo-allergy-note').value.trim();
      const item = demoOrders[demoSelectedTableId][0];
      if (item) item.note = note;
      renderDemo();
    }
  };
  renderDemo();
  showCookieNotice();
}

function renderDemo() {
  const tableList = document.querySelector('#demo-table-list');
  const orderPanel = document.querySelector('#demo-order-panel');
  if (!tableList || !orderPanel) return;
  tableList.innerHTML = demoTables.map(table => `<button type="button" class="demo-table ${table.status === 'OCUPADA' ? 'is-busy' : 'is-free'} ${table.id === demoSelectedTableId ? 'selected' : ''}" data-demo-table="${table.id}" aria-pressed="${table.id === demoSelectedTableId}"><span class="demo-table-icon">${diningTableIcon()}</span><span><strong>Mesa ${table.id}</strong><small>${table.seats} puestos</small></span><span class="demo-table-state"><i></i>${table.status === 'LIBRE' ? 'Libre' : 'En servicio'}</span></button>`).join('');
  const table = demoTables.find(item => item.id === demoSelectedTableId);
  if (!table) return;
  const items = demoOrders[table.id];
  const total = items.reduce((sum, item) => sum + item.price, 0);
  orderPanel.innerHTML = `<div class="demo-order-heading"><div><span class="demo-order-kicker">CUENTA DE MUESTRA</span><h3>Mesa ${table.id}</h3></div><span class="demo-order-status ${table.status === 'LIBRE' ? 'is-free' : 'is-busy'}"><i></i>${table.status === 'LIBRE' ? 'Disponible' : 'En servicio'}</span></div>${table.status === 'LIBRE' ? `<div class="demo-empty-order"><span>${icon('orders')}</span><strong>Lista para recibir</strong><small>Abre una cuenta de prueba y agrega algo del menú.</small><button type="button" class="demo-open-button" data-demo-open>Abrir cuenta de prueba ${icon('arrow')}</button></div>` : `<div class="demo-order-lines">${items.map(item => `<article class="demo-order-line"><span class="demo-line-icon">${icon('products')}</span><span class="demo-line-name"><strong>${item.name}</strong>${item.note ? `<small>Indicación: ${item.note}</small>` : '<small>Preparado al momento</small>'}</span><strong class="demo-line-price">$ ${item.price.toLocaleString('es-CO')}</strong><button type="button" class="demo-remove" data-demo-remove="${item.id}" aria-label="Quitar ${item.name}">×</button></article>`).join('') || '<p class="demo-no-items">Aún no hay productos en la cuenta de prueba.</p>'}</div>${items.length ? `<div class="demo-allergy-editor"><label for="demo-allergy-note">Indicación de ingrediente <small>Ej. sin maní</small></label><div><input id="demo-allergy-note" maxlength="90" placeholder="Escribe una indicación" value="${escapeHtml(items[0].note)}"><button type="button" data-demo-save-note>Guardar</button></div></div>` : ''}<div class="demo-total"><span>Total de ejemplo</span><strong>$ ${total.toLocaleString('es-CO')} COP</strong></div><div class="demo-add-area"><span>Agregar a la cuenta</span><div><button type="button" data-demo-add data-name="Limonada natural" data-price="7000">＋ Limonada <strong>$ 7.000</strong></button><button type="button" data-demo-add data-name="Postre de la casa" data-price="9000">＋ Postre <strong>$ 9.000</strong></button></div></div>`}<p class="demo-confirm-note">Las indicaciones de alergias siempre deben confirmarse con cocina.</p>`;
}

function loginView() {
  clearIdleMonitoring();
  currentSession = null;
  document.querySelector('#session-lock')?.remove();
  app.innerHTML = `
    <main class="login-layout">
      <section class="brand-panel">
        <div class="brand">${brandMark()}Gestourant</div><button type="button" id="back-home" class="auth-home-link">← Página principal</button>
        <div class="hero-copy"><p class="eyebrow">OPERACIÓN INTELIGENTE</p><h1>Tu restaurante, en perfecto ritmo.</h1><p>Organiza tu sala, atiende con claridad y toma decisiones desde un solo lugar.</p></div>
        <div class="login-proof"><span>✦</span><div><strong>Una operación más simple</strong><small>Mesas, pedidos y equipo en armonía.</small></div></div>
      </section>
      <section class="login-panel"><div class="login-theme">${themeSwitcher()}</div><form id="login-form" class="login-card" novalidate>
        <p class="eyebrow accent">BIENVENIDO DE NUEVO</p><h2>Inicia sesión</h2><p class="muted">Tu espacio de trabajo te espera.</p>
        ${authNotice ? `<p class="auth-notice" role="status">${escapeHtml(authNotice)}</p>` : ''}
        <label>Correo o usuario<input id="identifier" name="identifier" autocomplete="username" placeholder="ej. maria@restaurante.com" required /></label>
        <label>Contraseña<div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required /><button type="button" id="toggle-password" aria-label="Mostrar contraseña">◉</button></div></label>
        <div id="login-captcha" class="captcha-slot"></div>
        <label class="honeypot" aria-hidden="true">No llenar<input name="website" tabindex="-1" autocomplete="off" /></label>
        <input type="hidden" name="captchaToken" />
        <p id="login-error" class="form-message" role="alert"></p>
        <button id="login-button" class="primary" type="submit">Iniciar sesión <span>→</span></button>
        ${socialLoginOptions()}
        <p class="privacy-link">Al continuar, consulta nuestra <a href="/politica-tratamiento.html" target="_blank" rel="noopener">política de datos personales</a>.</p>
        <p class="demo-note">¿Aún no tienes cuenta? <button type="button" class="text-button" id="show-register">Crear cuenta</button></p>
      </form></section>
    </main>`;
  bindThemeControls();
  document.querySelector('#back-home').addEventListener('click', publicHomeView);
  document.querySelector('#toggle-password').addEventListener('click', () => {
    const field = document.querySelector('#password'); field.type = field.type === 'password' ? 'text' : 'password';
  });
  document.querySelector('#login-form').addEventListener('submit', authenticate);
  document.querySelector('#show-register').addEventListener('click', registerView);
  bindSocialLogin(document.querySelector('#login-form'));
  initializeCaptcha('login-captcha');
  showCookieNotice();
}

function registerView() {
  app.innerHTML = `<main class="login-layout"><section class="brand-panel"><div class="brand">${brandMark()}Gestourant</div><button type="button" id="back-home" class="auth-home-link">← Página principal</button><div class="hero-copy"><p class="eyebrow">EMPIEZA HOY</p><h1>La operación clara comienza aquí.</h1><p>Crea tu acceso y conoce el espacio de trabajo de Gestourant.</p></div><div class="login-proof"><span>✦</span><div><strong>Tu información, protegida</strong><small>Acceso seguro para cada miembro del equipo.</small></div></div></section><section class="login-panel"><div class="login-theme">${themeSwitcher()}</div><form id="register-form" class="login-card" novalidate><p class="eyebrow accent">NUEVA CUENTA</p><h2>Crear cuenta</h2><p class="muted">Completa tus datos para comenzar.</p>${authNotice ? `<p class="auth-notice" role="status">${escapeHtml(authNotice)}</p>` : ''}<label>Nombre de usuario<input name="username" autocomplete="username" placeholder="ej. maria.lopez" required minlength="3" /></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" placeholder="maria@restaurante.com" required /></label><label>Contraseña<div class="password-wrap"><input id="register-password" name="password" type="password" autocomplete="new-password" placeholder="Mínimo 10 caracteres y un número" required minlength="10" /><button type="button" id="toggle-password" aria-label="Mostrar contraseña">◉</button></div></label>${oauthConsentField('Autorizo el tratamiento de mis datos para crear mi cuenta.', true)}<label class="honeypot" aria-hidden="true">No llenar<input name="website" tabindex="-1" autocomplete="off" /></label><input type="hidden" name="captchaToken" /><div id="register-captcha" class="captcha-slot"></div><p class="form-hint">Los permisos administrativos los asigna el responsable del sistema.</p><p id="register-error" class="form-message" role="alert"></p><button id="register-button" class="primary" type="submit">Crear mi cuenta <span>→</span></button>${socialLoginOptions()}<p class="privacy-link">Al continuar, consulta nuestra <a href="/politica-tratamiento.html" target="_blank" rel="noopener">política de datos personales</a>.</p><p class="demo-note">¿Ya tienes cuenta? <button type="button" class="text-button" id="show-login">Iniciar sesión</button></p></form></section></main>`;
  bindThemeControls();
  document.querySelector('#back-home').addEventListener('click', publicHomeView);
  document.querySelector('#toggle-password').addEventListener('click', () => { const field = document.querySelector('#register-password'); field.type = field.type === 'password' ? 'text' : 'password'; });
  document.querySelector('#show-login').addEventListener('click', loginView);
  document.querySelector('#register-form').addEventListener('submit', register);
  bindSocialLogin(document.querySelector('#register-form'));
  initializeCaptcha('register-captcha');
  showCookieNotice();
}

function oauthRegistrationView(code) {
  clearIdleMonitoring();
  currentSession = null;
  app.innerHTML = `<main class="login-layout"><section class="brand-panel"><div class="brand">${brandMark()}Gestourant</div><button type="button" id="back-home" class="auth-home-link">← Página principal</button><div class="hero-copy"><p class="eyebrow">UN ÚLTIMO PASO</p><h1>Tu cuenta, con tu permiso.</h1><p>Tu proveedor de acceso confirmó tu identidad. Antes de crear tu cuenta de Gestourant, revisa y autoriza el tratamiento de tus datos.</p></div><div class="login-proof"><span>✓</span><div><strong>Tu decisión importa</strong><small>Solo crearemos tu cuenta si aceptas expresamente.</small></div></div></section><section class="login-panel"><div class="login-theme">${themeSwitcher()}</div><form id="oauth-register-form" class="login-card" novalidate><p class="eyebrow accent">CONFIRMA LA CREACIÓN</p><h2>Crear cuenta con tu proveedor</h2><p class="muted">Si ya tienes una cuenta de Gestourant vinculada, iniciarás sesión directamente y no verás este paso.</p>${authNotice ? `<p class="auth-notice" role="status">${escapeHtml(authNotice)}</p>` : ''}<input type="hidden" name="code" value="${escapeHtml(code)}">${oauthConsentField('He leído y autorizo el tratamiento de mis datos personales para crear mi cuenta de Gestourant.', true)}<p class="form-hint">Si no deseas crearla, puedes volver al inicio de sesión. No guardaremos una cuenta.</p><p id="oauth-register-error" class="form-message" role="alert"></p><button id="oauth-register-button" class="primary" type="submit">Autorizar y crear cuenta <span>→</span></button><p class="demo-note">¿No quieres continuar? <button type="button" class="text-button" id="cancel-oauth-register">Volver al inicio de sesión</button></p><p class="privacy-link">Lee nuestra <a href="/politica-tratamiento.html" target="_blank" rel="noopener">política de datos personales</a>.</p></form></section></main>`;
  bindThemeControls();
  document.querySelector('#back-home').addEventListener('click', publicHomeView);
  document.querySelector('#oauth-register-form').addEventListener('submit', registerOAuthAccount);
  document.querySelector('#cancel-oauth-register').addEventListener('click', () => {
    authNotice = '';
    loginView();
  });
  showCookieNotice();
}

async function registerOAuthAccount(event) {
  event.preventDefault();
  const oauthForm = event.currentTarget;
  const validationMessage = document.querySelector('#oauth-register-error');
  validationMessage.textContent = '';
  if (!showSpanishFormValidation(oauthForm, validationMessage)) return;
  const form = new FormData(event.currentTarget);
  const button = document.querySelector('#oauth-register-button');
  const message = validationMessage;
  if (form.get('privacyConsent') !== 'on') {
    message.textContent = 'Debes autorizar el tratamiento para crear la cuenta.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Creando cuenta…';
  try {
    const data = await services.auth.registerOAuthAccount({
      code: form.get('code'),
      privacyConsent: true
    });
    authNotice = '';
    sessionStorage.setItem('gestourant_session', JSON.stringify(data));
    dashboardView(data);
  } catch (error) {
    message.textContent = error instanceof TypeError
      ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.'
      : error.status === 401
        ? 'El paso de registro expiró o ya se usó. Vuelve a iniciar con tu cuenta de Google o Microsoft.'
        : error.status === 409
          ? 'Ya existe una cuenta de Gestourant con ese correo. Inicia sesión con ella; no la vinculamos automáticamente.'
          : error.message;
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = 'Autorizar y crear cuenta <span>→</span>';
    }
  }
}

async function authenticate(event) {
  event.preventDefault();
  const loginForm = event.currentTarget;
  const message = document.querySelector('#login-error');
  message.textContent = '';
  if (!showSpanishFormValidation(loginForm, message)) return;
  const form = new FormData(loginForm), button = document.querySelector('#login-button');
  const credentials = { identifier: form.get('identifier').trim(), password: form.get('password'), website: form.get('website'), captchaToken: form.get('captchaToken') };
  if (authConfig.captchaEnabled && !credentials.captchaToken) { message.textContent = 'Completa la verificación de seguridad.'; return; }
  message.textContent = ''; button.disabled = true; button.textContent = 'Ingresando…';
  try {
    const data = await services.auth.login(credentials);
    logger.info('Login succeeded', { username: data.username, role: data.role });
    authNotice = '';
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) {
    message.textContent = error instanceof TypeError ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.' : error.message;
    resetCaptcha('login-captcha');
  } finally { button.disabled = false; button.innerHTML = 'Iniciar sesión <span>→</span>'; }
}

async function register(event) {
  event.preventDefault();
  const registerForm = event.currentTarget;
  const message = document.querySelector('#register-error');
  message.textContent = '';
  if (!showSpanishFormValidation(registerForm, message)) return;
  const form = new FormData(registerForm), button = document.querySelector('#register-button');
  const account = { username: form.get('username').trim(), email: form.get('email').trim(), password: form.get('password'), website: form.get('website'), captchaToken: form.get('captchaToken'), privacyConsent: form.get('privacyConsent') === 'on' };
  if (!/\d/.test(account.password)) { message.textContent = 'La contraseña debe incluir al menos un número.'; return; }
  if (authConfig.captchaEnabled && !account.captchaToken) { message.textContent = 'Completa la verificación de seguridad.'; return; }
  message.textContent = ''; button.disabled = true; button.textContent = 'Creando cuenta…';
  try {
    const data = await services.auth.register(account);
    logger.info('Registration succeeded', { username: data.username, role: data.role });
    authNotice = '';
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) { message.textContent = error instanceof TypeError ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.' : error.message; resetCaptcha('register-captcha'); }
  finally { button.disabled = false; button.innerHTML = 'Crear mi cuenta <span>→</span>'; }
}

function dashboardView(session) {
  if (guestRequestBadgePoll) window.clearInterval(guestRequestBadgePoll);
  currentSession = session;
  const user = escapeHtml(session.username || 'Equipo');
  const role = session.role === 'ADMINISTRADOR' ? 'Administrador' : 'Empleado';
  app.innerHTML = `<main class="dashboard"><aside class="sidebar"><div class="brand">${brandMark()}Gestourant</div><div class="restaurant"><span class="avatar">${user.charAt(0).toUpperCase()}</span><div><strong>Restaurante Central</strong><small>${role} · Turno activo</small></div></div><nav aria-label="Navegación principal"><a data-view="overview">${icon('overview')}<span>Resumen</span></a><a class="active" data-view="tables">${icon('tables')}<span>Mesas</span></a><a data-view="orders">${icon('orders')}<span>Pedidos</span><b class="nav-pending-count" id="nav-pending-count" hidden>0</b></a><a data-view="kitchen">${icon('kitchen')}<span>Cocina</span></a><a data-view="products">${icon('products')}<span>Menú e inventario</span></a><a data-view="reports">${icon('reports')}<span>Reportes</span></a></nav><div class="sidebar-footer">${themeSwitcher()}<button id="logout" class="logout">↪ Cerrar sesión</button></div></aside><section id="content" class="workspace"></section><aside id="detail" class="detail"><div class="detail-empty"><span>${icon('tables')}</span><h3>Tu sala está lista</h3><p>Selecciona una mesa para ver la cuenta y comenzar el servicio.</p></div></aside></main>`;
  bindThemeControls();
  document.querySelector('#logout').addEventListener('click', () => logout(session));
  document.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', () => navigate(link.dataset.view, session)));
  navigate('overview', session);
  updateGuestRequestBadge(session);
  guestRequestBadgePoll = window.setInterval(() => updateGuestRequestBadge(session), 5000);
  setupIdleMonitoring(session);
  showCookieNotice();
}

async function loadTables(session) {
  try {
    tables = await services.tables.list(session);
  } catch (error) { showToast(error.message, true); }
  renderTables();
}

async function navigate(view, session) {
  if (tableMapPoll) {
    window.clearInterval(tableMapPoll);
    tableMapPoll = null;
  }
  if (guestRequestPoll) {
    window.clearInterval(guestRequestPoll);
    guestRequestPoll = null;
  }
  if (kitchenPoll) {
    window.clearInterval(kitchenPoll);
    kitchenPoll = null;
  }
  document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  document.querySelector('#detail')?.classList.remove('open');
  const content = document.querySelector('#content');
  document.querySelector('#detail').innerHTML = '<div class="detail-empty"><span>⌁</span><h3>Selecciona una mesa</h3><p>Verás aquí el resumen de la atención.</p></div>';
  if (view === 'overview') { content.innerHTML = overviewView(session); await loadOverview(session); return; }
  if (view === 'tables') { content.innerHTML = tablesView(session); bindTableAdmin(session); await loadTables(session); tableMapPoll = window.setInterval(() => refreshTableMap(session), 5000); return; }
  if (view === 'products') {
    content.innerHTML = productsView(session);
    bindProductAdmin(session);
    document.querySelector('#return-to-order')?.addEventListener('click', () => navigate('tables', session).then(() => activeOrder?.table?.id && selectTable(activeOrder.table.id)));
    document.querySelector('#choose-table')?.addEventListener('click', () => navigate('tables', session));
    await loadProducts(session);
    return;
  }
  if (view === 'orders') { content.innerHTML = ordersView(); loadGuestRequests(session); guestRequestPoll = window.setInterval(() => loadGuestRequests(session), 5000); return; }
  if (view === 'kitchen') { content.innerHTML = kitchenView(); loadKitchenRequests(session); kitchenPoll = window.setInterval(() => loadKitchenRequests(session), 5000); return; }
  content.innerHTML = reportsView(); await loadReport(session);
}

function overviewView(session) {
  const user = escapeHtml(session.username || 'Equipo');
  return `<header class="overview-header"><div><p class="eyebrow">CENTRO DE OPERACIÓN</p><h1>Hola, ${user}</h1><p class="muted">Este es el pulso de tu restaurante para comenzar la jornada.</p></div><div class="header-actions"><span class="date">● Sistema listo</span></div></header><section class="overview-grid"><article class="overview-card overview-primary"><span class="overview-icon">⌂</span><div><small>Mesas ocupadas</small><strong id="overview-busy">...</strong><p>Controla el ritmo de la sala</p></div><button class="overview-link" data-quick-view="tables">Ver sala →</button></article><article class="overview-card"><span class="overview-icon">◇</span><div><small>Mesas disponibles</small><strong id="overview-free">...</strong><p>Listas para recibir clientes</p></div><button class="overview-link" data-quick-view="tables">Abrir mapa →</button></article><article class="overview-card"><span class="overview-icon">✦</span><div><small>Stock por revisar</small><strong id="overview-low-stock">...</strong><p>Productos con cinco unidades o menos</p></div><button class="overview-link" data-quick-view="products">Ver inventario →</button></article></section><section class="overview-actions"><div><p class="eyebrow">ACCESOS RÁPIDOS</p><h2>Continúa tu operación</h2><p class="muted">Elige el siguiente paso según el momento de tu servicio.</p></div><div class="quick-actions"><button class="quick-action" data-quick-view="tables"><span>⌘</span><strong>Gestionar mesas</strong><small>Abre mesas y revisa pedidos</small></button><button class="quick-action" data-quick-view="orders"><span>▤</span><strong>Revisar pedidos</strong><small>Consulta las cuentas abiertas</small></button><button class="quick-action" data-quick-view="products"><span>◫</span><strong>Ver inventario</strong><small>Consulta disponibilidad del menú</small></button></div></section>`;
}

async function loadOverview(session) {
  document.querySelectorAll('[data-quick-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.quickView, session)));
  try {
    const [loadedTables, loadedProducts] = await Promise.all([services.tables.list(session), services.products.list(session)]);
    tables = loadedTables;
    products = loadedProducts;
    document.querySelector('#overview-busy').textContent = tables.filter(table => table.status === 'OCUPADA').length;
    document.querySelector('#overview-free').textContent = tables.filter(table => table.status === 'LIBRE').length;
    document.querySelector('#overview-low-stock').textContent = products.filter(product => product.active && product.stock <= 5).length;
  } catch (error) { showToast(error.message, true); }
}

function tablesView(session) {
  const occupied = tables.filter(table => table.status === 'OCUPADA').length;
  const available = tables.length - occupied;
  const adminTools = session.role === 'ADMINISTRADOR' ? `<details class="admin-tools table-tools"><summary><span><strong>Configurar sala</strong><small>Agregar mesas o unir espacios</small></span><span class="tools-plus">＋</span></summary><div class="table-tools-content"><form id="create-table-form" class="inline-form"><input name="tableNumber" type="number" min="1" placeholder="N.º mesa" required><input name="seats" type="number" min="1" placeholder="Puestos" required><button class="primary" type="submit">＋ Agregar mesa</button></form><form id="join-table-form" class="inline-form"><select name="firstTableId" required><option value="">Primera mesa</option>${tables.filter(table => table.status === 'LIBRE' && !table.joinedTableId).map(table => `<option value="${table.id}">Mesa ${table.tableNumber}</option>`).join('')}</select><select name="secondTableId" required><option value="">Segunda mesa</option>${tables.filter(table => table.status === 'LIBRE' && !table.joinedTableId).map(table => `<option value="${table.id}">Mesa ${table.tableNumber}</option>`).join('')}</select><button class="outline" type="submit">Unir mesas</button></form></div></details>` : '';
  return `<header class="page-heading"><div><p class="eyebrow">SERVICIO · SALA PRINCIPAL</p><h1>Mapa de mesas</h1><p class="muted">Elige una mesa para abrir su cuenta y atender el pedido.</p></div><div class="service-status"><span class="live-dot"></span>Servicio en curso</div></header>
    <section class="service-metrics"><article><span class="metric-icon occupied-icon">${icon('tables')}</span><div><small>En servicio</small><strong>${occupied}</strong></div></article><article><span class="metric-icon available-icon">${icon('tables')}</span><div><small>Disponibles</small><strong>${available}</strong></div></article><article><span class="metric-icon total-icon">${icon('overview')}</span><div><small>Total de mesas</small><strong>${tables.length}</strong></div></article></section>
    ${adminTools}<section class="floor-panel"><div class="floor-head"><div><p class="eyebrow">PLANTA DEL RESTAURANTE</p><h2>Salón principal</h2><p>Elige una mesa; puedes moverla en el croquis y abrir su cuenta.</p></div><div class="floor-tools">${session.role === 'ADMINISTRADOR' ? '<label class="floor-arrange-toggle"><input id="arrange-floor" type="checkbox"> Acomodar mesas</label>' : ''}<div class="floor-legend"><span><i class="legend-dot free-dot"></i>Disponible</span><span><i class="legend-dot busy-dot"></i>En servicio</span></div></div></div><div class="floor-map-background"><div class="floor-zone floor-zone-kitchen">COCINA</div><div class="floor-zone floor-zone-entry">ENTRADA</div><div class="floor-zone floor-zone-window">VENTANAL</div><div id="table-grid" class="floor-map"></div></div><footer class="floor-footer"><span>Las cuentas abiertas se guardan automáticamente.</span><span>${available} mesa${available === 1 ? '' : 's'} lista${available === 1 ? '' : 's'} para recibir clientes</span></footer></section>`;
}
function bindTableAdmin(session) {
  const createForm = document.querySelector('#create-table-form');
  const joinForm = document.querySelector('#join-table-form');
  createForm?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await services.tables.create(session, { tableNumber: Number(data.get('tableNumber')), seats: Number(data.get('seats')) }); showToast('Mesa creada.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } });
  joinForm?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await services.tables.join(session, { firstTableId: Number(data.get('firstTableId')), secondTableId: Number(data.get('secondTableId')) }); showToast('Mesas unidas.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } });
}
function productsView(session) {
  const adminTools = session.role === 'ADMINISTRADOR' ? `<details class="admin-tools menu-admin-tools"><summary><span><strong id="product-form-title">Administrar menú</strong><small>Crear o actualizar platos, bebidas y precios</small></span><span class="tools-plus">＋</span></summary><form id="create-product-form" class="product-form"><label>Nombre del producto<input name="name" maxlength="120" placeholder="Ej. Trucha a la plancha" required></label><label>Categoría<select name="category"><option value="PLATO">Plato</option><option value="BEBIDA">Bebida</option><option value="OTRO">Otro</option></select></label><label class="form-wide">Descripción<textarea name="description" maxlength="500" placeholder="Descripción e ingredientes principales" required></textarea></label><label class="form-wide">Foto del producto<input name="imageUrl" type="url" maxlength="1000" placeholder="https://… (opcional)"><small>Usa una imagen propia o de tu proveedor, con permiso de uso.</small></label><label>Precio (COP)<input name="price" type="number" min="1" step="1" placeholder="28000" required></label><label>Existencias<input name="stock" type="number" min="0" step="1" placeholder="20" required></label><label class="product-active"><input name="active" type="checkbox" checked> Disponible para pedidos</label><div class="product-form-actions"><button id="product-submit" class="primary" type="submit">＋ Guardar producto</button><button id="cancel-product-edit" class="outline hidden-field" type="button">Cancelar</button></div></form></details>` : '';
  const orderContext = activeOrder ? `<div class="active-order-banner"><span class="order-live-indicator"></span><div><strong>Pedido en curso · Mesa ${activeOrder.table.tableNumber}</strong><small>Pedido #${activeOrder.id} · Los productos se agregarán a esta cuenta</small></div><button id="return-to-order" class="outline" type="button">Ver cuenta ${icon('arrow')}</button></div>` : `<div class="active-order-banner no-active-order"><div>${icon('tables')}<span><strong>Para tomar un pedido</strong><small>Selecciona una mesa libre o en servicio.</small></span></div><button id="choose-table" class="outline" type="button">Elegir mesa ${icon('arrow')}</button></div>`;
  return `<header class="page-heading"><div><p class="eyebrow">CARTA · COCINA Y BAR</p><h1>Menú del restaurante</h1><p class="muted">Platos y bebidas disponibles durante el servicio.</p></div><span class="menu-count">${products.filter(product => product.active).length} productos disponibles</span></header>${orderContext}${adminTools}<section class="menu-section"><div class="menu-toolbar"><div><p class="eyebrow">LA CARTA</p><h2>Elige algo delicioso</h2></div><label class="menu-search"><span>⌕</span><input id="product-search" type="search" placeholder="Buscar en el menú…" aria-label="Buscar productos"></label></div><div class="catalog-filters menu-filters"><button class="filter-button active" data-category-filter="TODOS">Todo el menú</button><button class="filter-button" data-category-filter="PLATO">Platos</button><button class="filter-button" data-category-filter="BEBIDA">Bebidas</button><button class="filter-button" data-category-filter="OTRO">Otros</button></div><div id="product-list" class="product-list menu-grid"><p class="muted">Cargando menú…</p></div></section>`;
}
function ordersView() { return `<header class="page-heading"><div><p class="eyebrow">OPERACIÓN · PEDIDOS QR</p><h1>Solicitudes de clientes</h1><p class="muted">Revisa cada solicitud; solo al confirmarla pasa a la cuenta y se descuenta del inventario.</p></div><div class="service-status"><span class="live-dot"></span>Actualización automática</div></header><section id="guest-request-queue" class="guest-request-queue"><p class="muted">Cargando solicitudes…</p></section>`; }
function kitchenView() { return `<header class="page-heading"><div><p class="eyebrow">SERVICIO · PREPARACIÓN</p><h1>Comandas de cocina</h1><p class="muted">Pedidos confirmados por el equipo. Actualiza el estado para que el cliente sepa cómo va.</p></div><div class="service-status"><span class="live-dot"></span>Actualización automática</div></header><section id="kitchen-request-queue" class="guest-request-queue"><p class="muted">Cargando comandas…</p></section>`; }
function reportsView() { return `<header><div><p class="eyebrow">CONTROL</p><h1>Reportes</h1><p class="muted">Resumen de caja del día.</p></div></header><section class="metrics report-metrics"><article><span>Facturas</span><strong id="report-invoices">...</strong></article><article><span>Efectivo</span><strong id="report-cash">...</strong></article><article><span>Total vendido</span><strong id="report-total">...</strong></article></section>`; }

async function loadProducts(session) {
  try { products = await services.products.list(session); renderProducts(); } catch (error) { showToast(error.message, true); }
}

function bindProductAdmin(session) {
  const form = document.querySelector('#create-product-form');
  if (form) {
    const submitButton = document.querySelector('#product-submit');
    const cancelButton = document.querySelector('#cancel-product-edit');
    const resetForm = () => { form.reset(); form.dataset.editingId = ''; document.querySelector('#product-form-title').textContent = 'Administrar menú'; submitButton.textContent = '＋ Guardar producto'; cancelButton.classList.add('hidden-field'); };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        const imageUrl = data.get('imageUrl').trim();
        if (imageUrl && !imageUrl.startsWith('https://')) throw new Error('La imagen debe tener una dirección segura que comience con https://');
        const product = { name: data.get('name').trim(), description: data.get('description').trim(), category: data.get('category'), imageUrl, price: Number(data.get('price')), stock: Number(data.get('stock')), active: data.get('active') === 'on' };
        const editingId = form.dataset.editingId;
        await services.products.save(session, product, editingId);
        showToast(editingId ? 'Producto actualizado.' : 'Producto guardado en el menú.');
        navigate('products', session);
      } catch (error) { showToast(error.message, true); }
    });
    cancelButton.addEventListener('click', resetForm);
  }
  document.querySelectorAll('[data-category-filter]').forEach(button => button.addEventListener('click', () => {
    productCategoryFilter = button.dataset.categoryFilter;
    document.querySelectorAll('[data-category-filter]').forEach(item => item.classList.toggle('active', item === button));
    renderProducts();
  }));
  document.querySelector('#product-search')?.addEventListener('input', () => renderProducts());
}

function renderProducts() {
  const list = document.querySelector('#product-list');
  if (!list) return;
  const search = document.querySelector('#product-search')?.value.trim().toLocaleLowerCase('es') || '';
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  const isAdmin = session?.role === 'ADMINISTRADOR';
  const visibleProducts = products.filter(product => {
    const matchesCategory = productCategoryFilter === 'TODOS' || product.category === productCategoryFilter;
    const matchesSearch = !search || `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase('es').includes(search);
    return matchesCategory && matchesSearch && (isAdmin || product.active);
  });
  list.innerHTML = visibleProducts.length ? visibleProducts.map(product => `<article class="product-card ${!product.active ? 'inactive' : ''}" data-product-id="${product.id}">
    <div class="product-photo-wrap"><img class="product-photo" src="${escapeHtml(productPhoto(product))}" alt="${escapeHtml(product.name)}" loading="lazy"><span class="product-category">${escapeHtml(product.category || 'PLATO')}</span>${!product.active ? '<span class="menu-unavailable">Pausado</span>' : ''}</div>
    <div class="product-card-body"><div class="product-card-title"><h3>${escapeHtml(product.name)}</h3><strong>$ ${Number(product.price).toLocaleString('es-CO')}</strong></div>
      <p>${escapeHtml(product.description || 'Preparado al momento en nuestra cocina.')}</p>
      <div class="product-card-footer"><span class="stock ${product.stock < 5 ? 'low' : ''}">${product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}</span><div class="product-actions">${product.active && product.stock ? (activeOrder ? '<button class="primary add-product" type="button">＋ Agregar</button>' : '<button class="outline select-table-for-product" type="button">Elegir mesa</button>') : '<span class="unavailable">No disponible</span>'}${isAdmin ? '<button class="outline edit-product" type="button" aria-label="Editar producto">Editar</button><button class="danger delete-product" type="button" aria-label="Eliminar producto">Eliminar</button>' : ''}</div></div>
    </div></article>`).join('') : '<div class="menu-empty"><span>⌕</span><h3>No encontramos productos</h3><p>Ajusta la búsqueda o elige otra categoría.</p></div>';
  list.querySelectorAll('.product-photo').forEach(image => image.addEventListener('error', () => {
    image.src = defaultFoodPhoto;
    image.classList.add('photo-fallback');
  }, { once: true }));
  list.querySelectorAll('.add-product').forEach(button => button.addEventListener('click', () => addProduct(Number(button.closest('[data-product-id]').dataset.productId))));
  list.querySelectorAll('.select-table-for-product').forEach(button => button.addEventListener('click', () => navigate('tables', session)));
  list.querySelectorAll('.edit-product').forEach(button => button.addEventListener('click', () => editProduct(Number(button.closest('[data-product-id]').dataset.productId))));
  list.querySelectorAll('.delete-product').forEach(button => button.addEventListener('click', () => deleteProduct(Number(button.closest('[data-product-id]').dataset.productId))));
}

function editProduct(id) { const product = products.find(item => item.id === id), form = document.querySelector('#create-product-form'); if (!product || !form) return; form.dataset.editingId = String(id); form.elements.name.value = product.name; form.elements.category.value = product.category || 'PLATO'; form.elements.description.value = product.description || ''; form.elements.imageUrl.value = product.imageUrl || ''; form.elements.price.value = product.price; form.elements.stock.value = product.stock; form.elements.active.checked = product.active; document.querySelector('#product-form-title').textContent = 'Editar producto'; document.querySelector('#product-submit').textContent = 'Guardar cambios'; document.querySelector('#cancel-product-edit').classList.remove('hidden-field'); form.closest('details').open = true; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function deleteProduct(id) { const product = products.find(item => item.id === id), session = JSON.parse(sessionStorage.getItem('gestourant_session')); if (!product || !window.confirm(`¿Eliminar ${product.name} del menú?`)) return; try { await services.products.remove(session, id); showToast('Producto eliminado.'); navigate('products', session); } catch (error) { showToast(error.message, true); } }

async function loadReport(session) {
  try { const report = await services.reports.getCashClose(session); document.querySelector('#report-invoices').textContent = report.facturas; document.querySelector('#report-cash').textContent = `$ ${Number(report.efectivo).toLocaleString('es-CO')}`; document.querySelector('#report-total').textContent = `$ ${Number(report.total).toLocaleString('es-CO')}`; } catch (error) { showToast(error.message, true); }
}

async function logout(session, inactivity = false) {
  const sessionToClose = session || currentSession;
  if (!sessionToClose) return;
  clearIdleMonitoring();
  if (guestRequestPoll) window.clearInterval(guestRequestPoll);
  if (guestRequestBadgePoll) window.clearInterval(guestRequestBadgePoll);
  if (tableMapPoll) window.clearInterval(tableMapPoll);
  guestRequestPoll = null;
  guestRequestBadgePoll = null;
  tableMapPoll = null;
  idleLocked = false;
  sessionStorage.removeItem('gestourant_session');
  currentSession = null;
  document.querySelector('#session-lock')?.remove();
  publicHomeView();
  try {
    await services.auth.logout(sessionToClose);
    logger.info('Logout completed', { username: sessionToClose.username });
  } catch (error) {
    logger.warn('Server logout could not be recorded', { message: error.message });
    if (!inactivity) showToast('La sesión local se cerró, pero no se pudo registrar el cierre en el servidor.', true);
  }
}

function renderTables() {
  const grid = document.querySelector('#table-grid');
  if (!grid) return;
  const arranging = document.querySelector('#arrange-floor')?.checked || false;
  grid.innerHTML = tables.length ? tables.map((table, index) => `<div class="floor-table-wrap" style="left:${Number(table.floorX ?? (15 + (index % 4) * 22))}%;top:${Number(table.floorY ?? (18 + (Math.floor(index / 4) % 4) * 22))}%">
    <button type="button" class="floor-table-button ${table.status === 'OCUPADA' ? 'busy' : ''} ${table.billRequested ? 'bill-requested' : ''}" data-id="${table.id}" aria-label="Mesa ${table.tableNumber}, ${table.status === 'LIBRE' ? 'disponible' : 'en servicio'}, ${table.seats} puestos${table.billRequested ? ', pidió la cuenta' : ''}">
      <span class="table-graphic">${diningTableIcon()}</span><span class="table-card-number">${String(table.tableNumber).padStart(2, '0')}</span>
      <span class="table-card-info"><strong>Mesa ${table.tableNumber}</strong><small>${table.seats} puestos${table.joinedTableId ? ' · Salón unido' : ''}</small></span>
      <span class="table-card-status"><i></i>${table.billRequested ? 'Pide la cuenta' : table.status === 'LIBRE' ? 'Disponible' : 'En servicio'}</span></button>
    <button type="button" class="floor-qr-button" data-qr-id="${table.id}" aria-label="Ver QR de Mesa ${table.tableNumber}">QR</button></div>`).join('') : '<div class="menu-empty"><span>＋</span><h3>Aún no hay mesas</h3><p>Configura la sala para comenzar a recibir pedidos.</p></div>';
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  grid.querySelectorAll('.floor-table-button').forEach(button => {
    button.classList.toggle('selected', Number(document.querySelector('#detail .detail-content')?.dataset.tableId) === Number(button.dataset.id));
  });
  grid.querySelectorAll('.floor-table-button').forEach(button => {
    button.addEventListener('click', event => {
      if (button.dataset.dragged === 'true') {
        event.preventDefault();
        button.dataset.dragged = 'false';
        return;
      }
      selectTable(Number(button.dataset.id));
    });
    bindFloorTablePosition(button, grid, session);
  });
  grid.querySelectorAll('.floor-qr-button').forEach(button => button.addEventListener('click', () => {
    const table = tables.find(item => item.id === Number(button.dataset.qrId));
    if (table) showTableQr(table);
  }));
  const arrangeToggle = document.querySelector('#arrange-floor');
  if (arrangeToggle && arranging) {
    arrangeToggle.checked = true;
    grid.classList.add('is-arranging');
  }
  arrangeToggle?.addEventListener('change', () => {
    grid.classList.toggle('is-arranging', arrangeToggle.checked);
    showToast(arrangeToggle.checked ? 'Arrastra una mesa para cambiar su ubicación.' : 'Ubicación del croquis guardada.');
  });
}

async function refreshTableMap(session) {
  if (document.querySelector('#arrange-floor')?.checked) return;
  try {
    tables = await services.tables.list(session);
    renderTables();
  } catch (error) {
    logger.warn('Could not refresh floor plan', { status: error.status || 'network-error' });
  }
}

function bindFloorTablePosition(button, map, session) {
  if (session.role !== 'ADMINISTRADOR') return;
  let start = null;
  let moved = false;
  button.addEventListener('pointerdown', event => {
    if (!document.querySelector('#arrange-floor')?.checked || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY };
    moved = false;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (!start || !document.querySelector('#arrange-floor')?.checked) return;
    if (!moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
    moved = true;
    const bounds = map.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(10, Math.min(88, ((event.clientY - bounds.top) / bounds.height) * 100));
    const wrap = button.closest('.floor-table-wrap');
    wrap.style.left = `${x}%`;
    wrap.style.top = `${y}%`;
    button.dataset.nextX = x.toFixed(2);
    button.dataset.nextY = y.toFixed(2);
  });
  button.addEventListener('pointerup', async () => {
    if (!start) return;
    start = null;
    if (!moved) return;
    button.dataset.dragged = 'true';
    const position = { x: Number(button.dataset.nextX), y: Number(button.dataset.nextY) };
    try {
      const table = await services.tables.updatePosition(session, button.dataset.id, position);
      Object.assign(tables.find(item => item.id === table.id), table);
      showToast('Ubicación de mesa guardada.');
    } catch (error) {
      showToast(`No se pudo guardar la ubicación: ${error.message}`, true);
      renderTables();
    }
  });
  button.addEventListener('keydown', async event => {
    if (!document.querySelector('#arrange-floor')?.checked || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const table = tables.find(item => item.id === Number(button.dataset.id));
    const x = Math.max(6, Math.min(94, Number(table.floorX) + (event.key === 'ArrowLeft' ? -2 : event.key === 'ArrowRight' ? 2 : 0)));
    const y = Math.max(10, Math.min(88, Number(table.floorY) + (event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : 0)));
    try {
      const updated = await services.tables.updatePosition(session, table.id, { x, y });
      Object.assign(table, updated);
      renderTables();
      document.querySelector(`.floor-table-button[data-id="${table.id}"]`)?.focus();
    } catch (error) { showToast(error.message, true); }
  });
}

async function showTableQr(table) {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('mesa', table.qrToken);
  const localOnly = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  try {
    const image = await QRCode.toDataURL(url.toString(), { width: 360, margin: 2, color: { dark: '#153f35', light: '#ffffff' } });
    document.querySelector('#table-qr-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'table-qr-overlay';
    overlay.className = 'table-qr-overlay';
    overlay.innerHTML = `<section class="table-qr-card" role="dialog" aria-modal="true" aria-labelledby="table-qr-title"><button type="button" class="table-qr-close" aria-label="Cerrar">×</button><p class="eyebrow">MENÚ DIGITAL</p><h2 id="table-qr-title">Mesa ${table.tableNumber}</h2><img src="${image}" alt="Código QR para que los clientes de la Mesa ${table.tableNumber} abran el menú"><p>Escanea para ver la cuenta, explorar la carta y enviar pedidos al equipo.</p>${localOnly ? '<p class="table-qr-local-note">Este QR usa la dirección local de este computador. Para probarlo aquí, mantén Gestourant abierto. Para escanearlo con un celular, abre Gestourant desde la dirección IP local del computador y genera el QR de nuevo.</p>' : ''}<a class="table-qr-url" href="${escapeHtml(url.toString())}" target="_blank" rel="noopener">Probar enlace: ${escapeHtml(url.toString())}</a><div class="table-qr-actions"><button type="button" class="outline" data-print-qr>Imprimir código</button><button type="button" class="primary" data-close-qr>Listo</button></div></section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.table-qr-close').addEventListener('click', close);
    overlay.querySelector('[data-close-qr]').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('[data-print-qr]').addEventListener('click', () => window.print());
  } catch (error) {
    showToast(`No se pudo generar el código QR: ${error.message}`, true);
  }
}

async function loadGuestRequests(session) {
  const queue = document.querySelector('#guest-request-queue');
  if (!queue) return;
  try {
    const requests = await services.guest.listStaffRequests(session);
    const badge = document.querySelector('#nav-pending-count');
    if (badge) {
      badge.textContent = String(requests.length);
      badge.hidden = requests.length === 0;
    }
    queue.innerHTML = requests.length ? requests.map(request => `<article class="staff-request-card" data-request-id="${request.id}"><div class="staff-request-header"><div><span class="staff-request-table">MESA ${request.tableNumber}</span><h2>Solicitud #${request.id}</h2></div><time>${new Date(request.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</time></div><div class="staff-request-items">${request.items.map(item => `<div><span><strong>${item.quantity} × ${escapeHtml(item.name)}</strong>${item.removedIngredients ? `<small>⚠ Sin ${escapeHtml(item.removedIngredients)}</small>` : ''}</span><strong>$ ${Number(item.subtotal).toLocaleString('es-CO')}</strong></div>`).join('')}</div><div class="staff-request-footer"><strong>Total estimado · $ ${Number(request.total).toLocaleString('es-CO')} COP</strong><div><button class="outline reject-guest-request" type="button">Rechazar</button><button class="primary approve-guest-request" type="button">Confirmar y enviar a cocina</button></div></div></article>`).join('') : '<div class="staff-request-empty"><span>✓</span><h2>Todo al día</h2><p>No hay solicitudes pendientes. Las nuevas solicitudes aparecerán aquí automáticamente.</p></div>';
    queue.querySelectorAll('.approve-guest-request').forEach(button => button.addEventListener('click', () => resolveGuestRequest(button, session, 'approve')));
    queue.querySelectorAll('.reject-guest-request').forEach(button => button.addEventListener('click', () => resolveGuestRequest(button, session, 'reject')));
  } catch (error) {
    queue.innerHTML = `<div class="staff-request-error"><strong>No pudimos cargar las solicitudes.</strong><p>${escapeHtml(error.message)}</p><button class="outline" type="button" id="retry-guest-requests">Intentar de nuevo</button></div>`;
    queue.querySelector('#retry-guest-requests').addEventListener('click', () => loadGuestRequests(session));
  }
}

async function updateGuestRequestBadge(session) {
  const badge = document.querySelector('#nav-pending-count');
  if (!badge) return;
  try {
    const requests = await services.guest.listStaffRequests(session);
    badge.textContent = String(requests.length);
    badge.hidden = requests.length === 0;
  } catch (error) {
    logger.warn('Could not refresh QR order notification count', { status: error.status || 'network-error' });
  }
}

async function loadKitchenRequests(session) {
  const queue = document.querySelector('#kitchen-request-queue');
  if (!queue) return;
  try {
    const requests = await services.kitchen.listRequests(session);
    queue.innerHTML = requests.length ? requests.map(request => {
      const preparing = request.status === 'PREPARANDO';
      return `<article class="staff-request-card kitchen-ticket ${preparing ? 'is-preparing' : ''}" data-kitchen-request-id="${request.id}"><div class="staff-request-header"><div><span class="staff-request-table">MESA ${request.tableNumber} · COMANDA #${request.id}</span><h2>${preparing ? 'En preparación' : 'Nueva comanda'}</h2></div><time>${new Date(request.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</time></div><div class="staff-request-items">${request.items.map(item => `<div><span><strong>${item.quantity} × ${escapeHtml(item.name)}</strong>${item.removedIngredients ? `<small class="kitchen-modification">⚠ PREPARAR SIN: ${escapeHtml(item.removedIngredients)} · CONFIRMAR CON COCINA</small>` : ''}</span></div>`).join('')}</div><div class="staff-request-footer"><strong>${preparing ? 'La preparación está en curso' : 'Confirmado · agregado a la cuenta'}</strong><div><button type="button" class="primary advance-kitchen-request">${preparing ? 'Marcar listo para servir' : 'Iniciar preparación'}</button></div></div></article>`;
    }).join('') : '<div class="staff-request-empty"><span>✓</span><h2>Cocina al día</h2><p>Las solicitudes aparecerán aquí después de que el equipo las confirme.</p></div>';
    queue.querySelectorAll('.advance-kitchen-request').forEach(button => button.addEventListener('click', () => advanceKitchenRequest(button, session)));
  } catch (error) {
    queue.innerHTML = `<div class="staff-request-error"><strong>No pudimos cargar las comandas.</strong><p>${escapeHtml(error.message)}</p><button class="outline" type="button" id="retry-kitchen-requests">Intentar de nuevo</button></div>`;
    queue.querySelector('#retry-kitchen-requests').addEventListener('click', () => loadKitchenRequests(session));
  }
}

async function advanceKitchenRequest(button, session) {
  const card = button.closest('[data-kitchen-request-id]');
  button.disabled = true;
  try {
    await services.kitchen.advanceRequest(session, card.dataset.kitchenRequestId);
    showToast('Estado de cocina actualizado.');
    await loadKitchenRequests(session);
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
  }
}

async function resolveGuestRequest(button, session, action) {
  const card = button.closest('[data-request-id]');
  card.querySelectorAll('button').forEach(control => { control.disabled = true; });
  try {
    if (action === 'approve') await services.guest.approveStaffRequest(session, card.dataset.requestId);
    else await services.guest.rejectStaffRequest(session, card.dataset.requestId);
    showToast(action === 'approve' ? 'Pedido confirmado, agregado a la cuenta y enviado a cocina.' : 'Solicitud rechazada.');
    await loadGuestRequests(session);
    if (action === 'approve') await loadTables(session);
  } catch (error) {
    showToast(error.message, true);
    card.querySelectorAll('button').forEach(control => { control.disabled = false; });
  }
}

async function selectTable(id) {
  const table = tables.find(item => item.id === id), detail = document.querySelector('#detail');
  if (!table || !detail) return;
  activeOrder = null;
  document.querySelectorAll('.floor-table-button').forEach(card => card.classList.toggle('selected', Number(card.dataset.id) === id));
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  detail.classList.add('open');
  const adminActions = session.role === 'ADMINISTRADOR' ? `<div class="detail-actions"><button id="edit-table" class="outline">Editar mesa</button><button id="delete-table" class="danger">Eliminar</button>${table.joinedTableId ? '<button id="unjoin-table" class="outline full">Separar mesas</button>' : ''}</div>` : '';
  detail.innerHTML = `<div class="detail-content" data-table-id="${table.id}"><div class="detail-topline"><span class="table-number">${String(table.tableNumber).padStart(2, '0')}</span><button id="close-table-detail" class="icon-button" type="button" aria-label="Cerrar detalle">${icon('close')}</button></div><span class="service-pill ${table.status === 'OCUPADA' ? 'is-busy' : 'is-free'}"><i></i>${table.status === 'LIBRE' ? 'Disponible' : 'En servicio'}</span><h2>Mesa ${table.tableNumber}</h2><p class="muted">${table.seats} puestos · Salón principal${table.joinedTableId ? ' · Mesa unida' : ''}</p><button id="show-table-qr" class="outline table-detail-qr" type="button">▦ Mostrar QR de menú</button>${table.billRequested ? '<p class="bill-request-alert">El cliente está solicitando la cuenta.</p>' : ''}<div class="detail-separator"></div><div class="detail-row"><span>Estado de mesa</span><strong>${table.status === 'LIBRE' ? 'Lista para recibir' : 'Cuenta abierta'}</strong></div><div id="order-detail"></div>${table.status === 'LIBRE' ? `<button id="table-action" class="primary"><span>Abrir cuenta</span>${icon('arrow')}</button><p class="table-action-hint">Empieza el servicio y registra el primer pedido.</p>` : '<div class="order-loading"><span class="loading-dot"></span> Cargando cuenta abierta…</div>'}${adminActions}</div>`;
  document.querySelector('#close-table-detail').addEventListener('click', () => { detail.classList.remove('open'); document.querySelectorAll('.floor-table-button').forEach(card => card.classList.remove('selected')); activeOrder = null; });
  document.querySelector('#show-table-qr').addEventListener('click', () => showTableQr(table));
  document.querySelector('#table-action')?.addEventListener('click', () => openTable(table.id, session));
  if (session.role === 'ADMINISTRADOR') { document.querySelector('#edit-table').addEventListener('click', () => editTable(table, session)); document.querySelector('#delete-table').addEventListener('click', () => deleteTable(table, session)); document.querySelector('#unjoin-table')?.addEventListener('click', () => unjoinTable(table, session)); }
  if (table.status === 'OCUPADA') await loadOpenOrder(table.id, session);
}

async function editTable(table, session) { const tableNumber = Number(window.prompt('Número de mesa:', table.tableNumber)); const seats = Number(window.prompt('Cantidad de puestos:', table.seats)); if (!tableNumber || !seats) return; try { await services.tables.update(session, table.id, { tableNumber, seats }); showToast('Mesa actualizada.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
async function deleteTable(table, session) { if (!window.confirm(`¿Eliminar la Mesa ${table.tableNumber}?`)) return; try { await services.tables.remove(session, table.id); showToast('Mesa eliminada.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
async function unjoinTable(table, session) { if (!table.joinedTableId) return; try { await services.tables.unjoin(session, { firstTableId: table.id, secondTableId: table.joinedTableId }); showToast('Mesas separadas.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } }

async function openTable(tableId, session) { try { await services.tables.openOrder(session, tableId); await loadTables(session); await selectTable(tableId); } catch (error) { showToast(error.message, true); } }
async function loadOpenOrder(tableId, session) {
  try {
    const [order, loadedProducts] = await Promise.all([
      services.tables.getOpenOrder(session, tableId),
      services.products.list(session)
    ]);
    if (Number(document.querySelector('#detail .detail-content')?.dataset.tableId) !== tableId) return;
    activeOrder = order;
    products = loadedProducts;
    renderOrderDetail(order, session);
  } catch (error) { showToast(error.message, true); }
}

async function refreshOrderDetail(order, session) {
  if (activeOrder?.id !== order.id) return true;
  activeOrder = order;
  renderOrderDetail(order, session);
  try {
    products = await services.products.list(session);
    if (activeOrder?.id === order.id) renderOrderDetail(order, session);
    if (document.querySelector('#product-list')) renderProducts();
    return true;
  } catch (error) {
    showToast(`El pedido sí se guardó, pero no se pudo actualizar el menú: ${error.message}`, true);
    return false;
  }
}

async function addProduct(productId) {
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  if (!activeOrder) { showToast('Selecciona una mesa ocupada o abre una mesa antes de agregar productos.', true); return; }
  try {
    const updatedOrder = await services.orders.addProduct(session, activeOrder.id, productId);
    if (await refreshOrderDetail(updatedOrder, session)) showToast('Producto agregado al pedido y guardado.');
  } catch (error) { showToast(error.message, true); }
}

async function removeOrderItem(itemId) {
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  if (!activeOrder) return;
  try {
    const updatedOrder = await services.orders.removeItem(session, activeOrder.id, itemId);
    if (await refreshOrderDetail(updatedOrder, session)) showToast('Producto retirado; inventario actualizado.');
  } catch (error) { showToast(error.message, true); }
}

async function saveItemModification(itemId, ingredients) {
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  if (!activeOrder) return;
  try {
    const updatedOrder = await services.orders.updateItem(session, activeOrder.id, itemId, ingredients);
    if (await refreshOrderDetail(updatedOrder, session)) showToast(ingredients ? 'Indicación guardada y enviada al pedido.' : 'Indicación eliminada del pedido.');
  } catch (error) { showToast(error.message, true); }
}

function renderOrderDetail(order, session) {
  const target = document.querySelector('#order-detail');
  if (!target) return;
  const availableProducts = products.filter(isAvailableForOrder);
  target.innerHTML = `<div class="order-summary"><strong>Pedido #${order.id}</strong><span>$ ${Number(order.total).toLocaleString('es-CO')} COP</span></div>
    <p class="order-live-status">Cambios guardados al instante</p>
    <div class="order-items">${(order.items || []).map(item => `<article class="order-item" data-item-id="${item.id}">
      <div class="order-item-heading"><img class="order-item-photo" src="${escapeHtml(productPhoto(item.product))}" alt="" loading="lazy"><span><strong>${escapeHtml(item.product.name)} × ${item.quantity}</strong><small>${escapeHtml(item.product.category || 'PLATO')}</small></span><strong>$ ${Number(item.subtotal).toLocaleString('es-CO')}</strong></div>
      ${item.removedIngredients ? `<p class="removed-ingredients">Sin: ${escapeHtml(item.removedIngredients)}</p>` : ''}
      <label class="allergy-label">Ingrediente a retirar (por alergia o preferencia)
        <input class="removed-ingredients-input" type="text" maxlength="500" value="${escapeHtml(item.removedIngredients || '')}" placeholder="Ej. maní, queso, cilantro">
      </label>
      <div class="order-item-actions"><button type="button" class="outline save-modification">Guardar indicación</button><button type="button" class="danger remove-order-item">Quitar producto</button></div>
    </article>`).join('') || '<small>Aún no hay productos. Agrégalos desde el menú.</small>'}</div>
    <p class="allergy-warning"><strong>Atención alergias:</strong> confirma la solicitud con cocina. Esta indicación no garantiza ausencia de contaminación cruzada.</p>
    <section class="order-menu"><h3>Agregar al pedido</h3>${availableProducts.length ? availableProducts.map(product => `<div class="order-menu-product"><img src="${escapeHtml(productPhoto(product))}" alt="" loading="lazy"><div><strong>${escapeHtml(product.name)}</strong><small>${product.stock} disponibles · $ ${Number(product.price).toLocaleString('es-CO')} COP</small></div><button type="button" class="outline add-order-product" data-product-id="${product.id}" aria-label="Agregar ${escapeHtml(product.name)}">＋</button></div>`).join('') : '<small>No hay productos disponibles en el menú.</small>'}</section>
    <label class="payment-method-label">Pago recibido en caja<select id="payment-method"><option value="EFECTIVO">Efectivo</option><option value="DIGITAL">Digital · Nequi, Bancolombia o tarjeta</option></select></label>
    <button id="close-order" class="outline full" ${order.items?.length ? '' : 'disabled'}>Registrar pago y cerrar cuenta</button>`;
  target.querySelectorAll('.save-modification').forEach(button => button.addEventListener('click', () => {
    const row = button.closest('[data-item-id]');
    saveItemModification(Number(row.dataset.itemId), row.querySelector('.removed-ingredients-input').value.trim());
  }));
  target.querySelectorAll('.remove-order-item').forEach(button => button.addEventListener('click', () => removeOrderItem(Number(button.closest('[data-item-id]').dataset.itemId))));
  target.querySelectorAll('.add-order-product').forEach(button => button.addEventListener('click', () => addProduct(Number(button.dataset.productId))));
  target.querySelectorAll('img').forEach(image => image.addEventListener('error', () => { image.src = defaultFoodPhoto; }, { once: true }));
  target.querySelector('#close-order').addEventListener('click', () => closeOrder(order.id, session, target.querySelector('#payment-method').value));
}
async function closeOrder(orderId, session, paymentMethod) { try { const invoice = await services.orders.close(session, orderId, paymentMethod); activeOrder = null; showToast(`Factura ${invoice.invoiceNumber} creada.`); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
let toastDismissTimer;
function showToast(message, error = false) { let toast = document.querySelector('#toast'); if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.setAttribute('role', 'alert'); toast.setAttribute('aria-live', 'assertive'); document.body.appendChild(toast); } window.clearTimeout(toastDismissTimer); toast.textContent = message; toast.className = error ? 'toast error' : 'toast'; toastDismissTimer = window.setTimeout(() => toast.remove(), 3500); }

async function initializeApplication() {
  const guestToken = new URLSearchParams(window.location.search).get('mesa');
  if (guestToken) {
    guestOrderingView(guestToken, services);
    return;
  }
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const oauthCode = parameters.get('oauth_code');
  const oauthError = parameters.get('oauth_error');
  const oauthRegistrationCode = parameters.get('oauth_registration');
  if (oauthCode || oauthError || oauthRegistrationCode) window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  if (oauthError) authNotice = oauthError;

  if (oauthCode) {
    try {
      const data = await services.auth.exchangeOAuthCode(oauthCode);
      sessionStorage.setItem('gestourant_session', JSON.stringify(data));
    } catch (error) {
      authNotice = error.message;
    }
  }

  try {
    authConfig = await services.auth.getConfig();
  } catch (error) {
    logger.error('Could not load authentication configuration', { message: error.message });
    authNotice ||= 'No se pudo consultar la configuración de acceso. Revisa la conexión con el servidor.';
  }

  const stored = sessionStorage.getItem('gestourant_session');
  if (stored) dashboardView(JSON.parse(stored));
  else if (oauthRegistrationCode) oauthRegistrationView(oauthRegistrationCode);
  else if (oauthCode || oauthError) loginView();
  else publicHomeView();
}

export function startGestourantApp(applicationServices, applicationLogger) {
  services = applicationServices;
  logger = applicationLogger;
  initializeApplication();
}
