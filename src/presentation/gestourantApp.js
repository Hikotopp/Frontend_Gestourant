import '../style.css';
import '../order-editor.css';
import '../auth-experience.css';
import '../service-ui.css';
import '../public-home.css';
import '../floor-layout.css';
import '../floor-polish.css';
import '../kitchen-board.css';
import '../qr-network.css';
import './reports.css';
import QRCode from 'qrcode';
import { isValidRegistrationPassword } from '../shared/passwordPolicy.js';
import {
  formatIdleCountdown,
  IDLE_LOCK_AFTER_MS,
  IDLE_LOGOUT_AFTER_MS
} from '../application/idleSessionPolicy';
import { brandMark } from './brandMark';
import { isAvailableForOrder } from '../domain/product';
import { guestOrderingView } from './guestOrdering';
import { productPhoto } from './productPhoto';
import { downloadCashCloseXlsx } from './cashCloseXlsx';
import { bindLanguagePicker, getLocale, languagePicker, translate } from '../shared/locale.js';

let services;
let logger;
let apiBase = '';
const app = document.querySelector('#app');
let tables = [];
let products = [];
let activeOrder = null;
let auditCurrentPage = 0;
let activeQrTable = null;
let activeQrRenderId = 0;
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
let idleActivityReportWarningShown = false;
let currentSession = null;
let sessionValidationPoll;
let sessionValidationInProgress = false;
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
  return `<div class="theme-switcher" role="group" aria-label="${escapeHtml(translate('Tema visual'))}">${themeOptions.map(theme => `<button type="button" class="theme-button ${theme.id === currentTheme ? 'active' : ''}" data-theme="${theme.id}" aria-pressed="${theme.id === currentTheme}" title="${escapeHtml(translate('Tema {theme}', { theme: translate(theme.label) }))}"><span>${theme.icon}</span><small>${escapeHtml(translate(theme.label))}</small></button>`).join('')}</div>`;
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

function updateDocumentLocale() {
  document.documentElement.lang = getLocale();
  document.title = translate('Gestourant | Servicio de restaurante en un solo lugar');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = translate('Coordina mesas, pedidos y menú de tu restaurante con Gestourant. Explora la demo interactiva.');
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
  const apiRoot = (apiBase || window.location.origin).replace(/\/+$/, '');
  return `<div class="social-login"><div class="social-divider"><span>${escapeHtml(translate('o continúa con'))}</span></div><div class="social-buttons">${providers.map(provider => provider.enabled
    ? `<a class="social-button" data-oauth-provider="${provider.id}" href="${escapeHtml(apiRoot)}/oauth2/authorization/${provider.id}"><span class="social-mark ${provider.id}">${provider.id === 'google' ? 'G' : 'M'}</span>${escapeHtml(translate('Continuar con {provider}', { provider: provider.label }))}</a>`
    : `<button class="social-button social-button-disabled" type="button" disabled aria-describedby="provider-setup-note"><span class="social-mark ${provider.id}">${provider.id === 'google' ? 'G' : 'M'}</span>${escapeHtml(translate('Continuar con {provider}', { provider: provider.label }))}<small>${escapeHtml(translate('No configurado'))}</small></button>`).join('')}</div>${providers.some(provider => !provider.enabled) ? `<p id="provider-setup-note" class="provider-setup-note">${escapeHtml(translate('Algunos proveedores de acceso todavía no están configurados.'))}</p>` : ''}</div>`;
}

function oauthConsentField(text, required = false) {
  return `<label class="oauth-consent"><input type="checkbox" name="privacyConsent" ${required ? 'required' : ''}><span>${escapeHtml(translate(text))} <a href="/politica-tratamiento.html" target="_blank" rel="noopener">${escapeHtml(translate('Leer política'))}</a>.</span></label>`;
}

function showSpanishFormValidation(form, message) {
  const invalidField = [...form.elements].find(field => field.willValidate && !field.validity.valid);
  if (!invalidField) return true;
  const validity = invalidField.validity;
  const label = invalidField.closest('label')?.innerText.split('\n')[0].trim() || translate('este campo');
  let text = translate('Revisa el campo «{field}».', { field: label });
  if (validity.valueMissing && invalidField.type === 'checkbox') {
    text = translate('Debes autorizar el tratamiento de tus datos para continuar.');
  } else if (validity.valueMissing) {
    text = translate('Completa el campo «{field}».', { field: label });
  } else if (validity.typeMismatch && invalidField.type === 'email') {
    text = translate('Escribe un correo electrónico válido.');
  } else if (validity.tooShort) {
    text = translate('Este campo debe tener al menos {count} caracteres.', { count: invalidField.minLength });
  } else if (validity.tooLong) {
    text = translate('Este campo no puede superar {count} caracteres.', { count: invalidField.maxLength });
  } else if (validity.rangeUnderflow) {
    text = translate('El valor debe ser igual o mayor que {min}.', { min: invalidField.min });
  } else if (validity.rangeOverflow) {
    text = translate('El valor debe ser igual o menor que {max}.', { max: invalidField.max });
  } else if (validity.stepMismatch) {
    text = translate('Ingresa un valor válido para este campo.');
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
      'error-callback': () => { showToast(translate('No se pudo cargar la verificación. Recarga la página para intentarlo de nuevo.'), true); }
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
  script.addEventListener('error', () => showToast(translate('No se pudo cargar Cloudflare Turnstile.'), true), { once: true });
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
  if (globalThis.__GESTOURANT_COOKIE_NOTICE_ACTIVE__) return;
  if (localStorage.getItem('gestourant_cookie_consent')) return;
  let notice = document.querySelector('#cookie-notice');
  if (notice) return;
  notice = document.createElement('aside');
  notice.id = 'cookie-notice';
  notice.className = 'cookie-notice';
  renderCookieNotice(notice);
  document.body.appendChild(notice);
}

function renderCookieNotice(notice) {
  notice.setAttribute('aria-label', translate('Preferencias de cookies'));
  notice.innerHTML = `<div><p class="eyebrow">${escapeHtml(translate('TU PRIVACIDAD'))}</p><strong>${escapeHtml(translate('Cookies y almacenamiento'))}</strong><p>${escapeHtml(translate('Usamos almacenamiento esencial para mantener tu sesión y preferencias, y protección anti-bots cuando está habilitada. Consulta nuestra política de datos y cookies.'))} <a href="/politica-tratamiento.html" target="_blank" rel="noopener">${escapeHtml(translate('política de datos y cookies'))}</a>.</p></div><div class="cookie-actions"><button type="button" class="outline" data-cookie-choice="necessary">${escapeHtml(translate('Solo necesarias'))}</button><button type="button" class="primary" data-cookie-choice="all">${escapeHtml(translate('Aceptar'))}</button></div>`;
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
  idleActivityReportWarningShown = false;
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

function clearSessionValidation() {
  if (sessionValidationPoll) window.clearInterval(sessionValidationPoll);
  sessionValidationPoll = null;
  sessionValidationInProgress = false;
}

function setupSessionValidation(session) {
  clearSessionValidation();
  const validate = async () => {
    if (sessionValidationInProgress || !currentSession || currentSession.token !== session.token) return;
    sessionValidationInProgress = true;
    try {
      const status = await services.auth.sessionStatus(session);
      if (currentSession?.token === session.token) handleSessionStatus(session, status);
    } catch (error) {
      if (error.status !== 401 || currentSession?.token !== session.token) return;
      authNotice = 'La sesión expiró o fue cerrada.';
      await logout(session, false, false);
    } finally {
      sessionValidationInProgress = false;
    }
  };
  sessionValidationPoll = window.setInterval(validate, 5_000);
}

function handleSessionStatus(session, status) {
  if (currentSession?.token !== session.token) return;
  if (!status.active) {
    authNotice = status.reason === 'SESSION_REPLACED'
      ? 'Esta sesión se cerró porque la cuenta se abrió en otro navegador.'
      : status.reason === 'INACTIVITY_TIMEOUT'
        ? 'La sesión se cerró por 5 minutos de inactividad.'
        : 'La sesión expiró o fue cerrada.';
    void logout(session, false, false);
    return;
  }
  if (!status.locked) return;
  idleLogoutDeadline = Date.now() + status.secondsUntilLogout * 1000;
  if (!idleLocked) showSessionLock();
  else updateIdleCountdown();
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
  const reportActivity = async () => {
    if (idleLocked || currentSession?.token !== session.token) return;
    try {
      const status = await services.auth.recordActivity(session);
      idleActivityReportWarningShown = false;
      handleSessionStatus(session, status);
    } catch (error) {
      if (currentSession?.token !== session.token) return;
      if (error.status === 423) {
        try {
          const status = await services.auth.sessionStatus(session);
          handleSessionStatus(session, status);
        } catch (statusError) {
          if (statusError.status === 401) {
            authNotice = 'La sesión expiró o fue cerrada.';
            await logout(session, false, false);
          } else if (!idleActivityReportWarningShown) {
            idleActivityReportWarningShown = true;
            showToast(translate('No se pudo consultar el estado de la sesión bloqueada.'), true);
          }
        }
      } else if (error.status === 401) {
        authNotice = 'La sesión expiró o fue cerrada.';
        await logout(session, false, false);
      } else if (!idleActivityReportWarningShown) {
        idleActivityReportWarningShown = true;
        showToast(translate('No se pudo sincronizar la actividad de la sesión con el servidor.'), true);
      }
    }
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
    if (idleLocked) return;
    if (event.type === 'mousemove') {
      const now = Date.now();
      if (now - lastMove < 1000) return;
      lastMove = now;
    }
    schedule();
    void reportActivity();
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
  const overlay = document.createElement('div');
  overlay.className = 'session-lock';
  overlay.id = 'session-lock';
  overlay.innerHTML = `<section class="session-lock-card" role="dialog" aria-modal="true" aria-labelledby="session-lock-title"><span class="lock-icon">◉</span><p class="eyebrow accent">${escapeHtml(translate('SESIÓN PAUSADA'))}</p><h2 id="session-lock-title">${escapeHtml(translate('Confirma que eres tú'))}</h2><p class="muted">${escapeHtml(translate('La pantalla se bloqueó tras 2 minutos y 30 segundos sin actividad. Verifica tu contraseña para seguir trabajando.'))}</p><p class="muted" role="status">${escapeHtml(translate('La sesión se cerrará en {countdown} si no la desbloqueas.', { countdown: '' }))}<strong id="idle-countdown" class="idle-countdown">02:30</strong></p><form id="unlock-form" novalidate><label>${escapeHtml(translate('Cuenta'))}<input name="identifier" value="${escapeHtml(currentSession.email)}" readonly autocomplete="username"></label><label>${escapeHtml(translate('Contraseña'))}<div class="password-wrap"><input name="password" type="password" required autocomplete="current-password" autofocus></div></label><div id="unlock-captcha" class="captcha-slot"></div><input type="hidden" name="captchaToken"><p id="unlock-error" class="form-message" role="alert"></p><button class="primary" type="submit">${escapeHtml(translate('Desbloquear sesión'))}</button></form><div class="unlock-social"><button type="button" class="text-button" id="unlock-logout">${escapeHtml(translate('Cerrar sesión'))}</button></div></section>`;
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
  if (authConfig.captchaEnabled && !captchaToken) { message.textContent = translate('Completa la verificación de seguridad.'); return; }
  submitButton.disabled = true;
  try {
    const session = currentSession;
    const status = await services.auth.unlock(session, form.get('password'), captchaToken);
    if (!idleLocked || !currentSession) return;
    if (!status.active || status.locked) {
      message.textContent = translate('No fue posible reanudar la sesión. Inténtalo de nuevo.');
      return;
    }
    document.querySelector('#session-lock')?.remove();
    setupIdleMonitoring(session);
    showToast(translate('Sesión desbloqueada.'));
  } catch (error) {
    if (idleLocked && currentSession) {
      if (error.status === 401) {
        authNotice = 'La sesión expiró o fue cerrada.';
        await logout(currentSession, false, false);
        return;
      }
      message.textContent = error.message;
      resetCaptcha('unlock-captcha');
    }
  } finally {
    if (submitButton.isConnected && idleLocked && currentSession) submitButton.disabled = false;
  }
}

function publicHomeView() {
  clearSessionValidation();
  currentSession = null;
  document.documentElement.lang = getLocale();
  app.innerHTML = `<main class="public-home">
    <header class="public-nav"><a href="#" class="public-brand" aria-label="${escapeHtml(translate('Gestourant, inicio'))}">${brandMark()}<span>Gestourant</span></a><nav aria-label="${escapeHtml(translate('Navegación de la página'))}"><a href="#funciones">${escapeHtml(translate('Funciones'))}</a><a href="#demo">${escapeHtml(translate('Explorar demo'))}</a></nav><div class="public-nav-actions"><button type="button" class="public-login" data-public-auth="login">${escapeHtml(translate('Iniciar sesión'))}</button><button type="button" class="public-signup" data-public-auth="register">${escapeHtml(translate('Crear cuenta'))} ${icon('arrow')}</button>${languagePicker()}</div></header>
    ${authNotice ? `<p class="public-notice" role="status">${escapeHtml(translate(authNotice))}</p>` : ''}
    <section class="public-hero"><div class="public-hero-copy"><p class="eyebrow">${escapeHtml(translate('EL SERVICIO, BAJO CONTROL'))}</p><h1>${escapeHtml(translate('Un restaurante que fluye,'))} <em>${escapeHtml(translate('mesa a mesa.'))}</em></h1><p class="public-lead">${escapeHtml(translate('Coordina sala, pedidos y menú desde un solo lugar. Menos vueltas entre el salón y la cocina; más atención para tus clientes.'))}</p><div class="public-hero-actions"><button type="button" class="public-signup" data-public-auth="register">${escapeHtml(translate('Conoce Gestourant'))} ${icon('arrow')}</button><a class="public-text-link" href="#demo">${escapeHtml(translate('Explorar demo interactiva'))} <span>↓</span></a></div><div class="public-trust"><span>✓ ${escapeHtml(translate('Pedidos por mesa'))}</span><span>✓ ${escapeHtml(translate('Cambios al instante'))}</span><span>✓ ${escapeHtml(translate('Control de inventario'))}</span></div></div><div class="public-hero-visual"><img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85" alt="${escapeHtml(translate('Platos servidos en un restaurante'))}" loading="eager"><div class="hero-photo-caption"><span class="live-dot"></span><span><strong>${escapeHtml(translate('El servicio conectado'))}</strong><small>${escapeHtml(translate('Sala, carta y pedidos en sincronía'))}</small></span></div><div class="hero-floating-card"><span>${icon('tables')}</span><div><strong>${escapeHtml(translate('La sala está en marcha'))}</strong><small>${escapeHtml(translate('Mesas y cuentas a la vista'))}</small></div></div></div></section>
    <section class="public-proof-bar" aria-label="${escapeHtml(translate('Funciones principales'))}"><span>${escapeHtml(translate('DISEÑADO PARA EL DÍA A DÍA'))}</span><strong>${escapeHtml(translate('Atiende con claridad'))}</strong><i></i><strong>${escapeHtml(translate('Organiza tu operación'))}</strong><i></i><strong>${escapeHtml(translate('Cuida cada pedido'))}</strong></section>
    <section id="funciones" class="public-features"><div class="public-section-heading"><p class="eyebrow">${escapeHtml(translate('UNA OPERACIÓN MÁS SIMPLE'))}</p><h2>${escapeHtml(translate('Todo el servicio, en su lugar.'))}</h2><p>${escapeHtml(translate('Herramientas prácticas para que el equipo sepa qué está pasando y qué sigue.'))}</p></div><div class="public-feature-grid"><article class="public-feature-card"><span class="public-feature-icon">${icon('tables')}</span><p class="eyebrow">${escapeHtml(translate('01 · SALÓN'))}</p><h3>${escapeHtml(translate('Un mapa vivo de mesas'))}</h3><p>${escapeHtml(translate('Consulta cuáles están libres o en servicio. Abre la cuenta desde la mesa y mantén el contexto mientras atiendes.'))}</p></article><article class="public-feature-card"><span class="public-feature-icon">${icon('orders')}</span><p class="eyebrow">${escapeHtml(translate('02 · PEDIDOS'))}</p><h3>${escapeHtml(translate('La cuenta al día'))}</h3><p>${escapeHtml(translate('Agrega productos, retira lo que cambió y deja indicaciones de ingredientes para que el equipo las confirme con cocina.'))}</p></article><article class="public-feature-card"><span class="public-feature-icon">${icon('products')}</span><p class="eyebrow">${escapeHtml(translate('03 · CARTA'))}</p><h3>${escapeHtml(translate('Menú e inventario conectados'))}</h3><p>${escapeHtml(translate('Presenta platos con fotos, precios y disponibilidad. El stock acompaña la operación para ayudar a evitar pedidos agotados.'))}</p></article></div></section>
    <section id="demo" class="public-demo-section"><div class="public-section-heading"><p class="eyebrow">${escapeHtml(translate('PRUÉBALO SIN RIESGO'))}</p><h2>${escapeHtml(translate('Explora un turno de ejemplo.'))}</h2><p>${escapeHtml(translate('Selecciona una mesa, simula un cambio y mira cómo se actualiza la cuenta. Esta demostración no guarda ni envía datos.'))}</p></div><div class="public-demo"><div class="demo-floor"><div class="demo-panel-heading"><span><small>${escapeHtml(translate('VISTA DE SALA'))}</small><strong>${escapeHtml(translate('Salón principal'))}</strong></span><span class="demo-tag"><i></i>${escapeHtml(translate('Demo interactiva'))}</span></div><div id="demo-table-list" class="demo-table-list"></div><div class="demo-floor-note">${icon('tables')}<span>${escapeHtml(translate('Prueba una mesa ocupada o abre una cuenta de muestra en una mesa libre.'))}</span></div></div><div id="demo-order-panel" class="demo-order-panel" aria-live="polite"></div></div><div class="demo-disclaimer">${escapeHtml(translate('Todo lo que hagas aquí es una simulación en tu navegador. No se conecta a cuentas, mesas ni inventario reales.'))}</div></section>
    <section class="public-cta"><div><p class="eyebrow">${escapeHtml(translate('LISTO PARA TU PRÓXIMO TURNO'))}</p><h2>${escapeHtml(translate('Haz que el servicio avance con más calma.'))}</h2><p>${escapeHtml(translate('Entra a tu espacio de trabajo o crea una cuenta para comenzar.'))}</p></div><div class="public-cta-actions"><button type="button" class="public-signup" data-public-auth="register">${escapeHtml(translate('Crear una cuenta'))} ${icon('arrow')}</button><button type="button" class="public-login" data-public-auth="login">${escapeHtml(translate('Ya tengo cuenta'))}</button></div></section>
    <footer class="public-footer"><a href="#" class="public-brand">${brandMark()}<span>Gestourant</span></a><span>${escapeHtml(translate('Herramientas para que cada servicio fluya mejor.'))}</span><a href="/politica-tratamiento.html" target="_blank" rel="noopener">${escapeHtml(translate('Privacidad y tratamiento de datos'))}</a></footer>
  </main>`;
  bindThemeControls();
  bindLanguagePicker(app);
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
  tableList.innerHTML = demoTables.map(table => `<button type="button" class="demo-table ${table.status === 'OCUPADA' ? 'is-busy' : 'is-free'} ${table.id === demoSelectedTableId ? 'selected' : ''}" data-demo-table="${table.id}" aria-pressed="${table.id === demoSelectedTableId}"><span class="demo-table-icon">${diningTableIcon()}</span><span><strong>${escapeHtml(translate('Mesa'))} ${table.id}</strong><small>${table.seats} ${escapeHtml(translate('Puestos'))}</small></span><span class="demo-table-state"><i></i>${escapeHtml(translate(table.status === 'LIBRE' ? 'Libre' : 'En servicio'))}</span></button>`).join('');
  const table = demoTables.find(item => item.id === demoSelectedTableId);
  if (!table) return;
  const items = demoOrders[table.id];
  const total = items.reduce((sum, item) => sum + item.price, 0);
  orderPanel.innerHTML = `<div class="demo-order-heading"><div><span class="demo-order-kicker">${escapeHtml(translate('CUENTA DE MUESTRA'))}</span><h3>${escapeHtml(translate('Mesa'))} ${table.id}</h3></div><span class="demo-order-status ${table.status === 'LIBRE' ? 'is-free' : 'is-busy'}"><i></i>${escapeHtml(translate(table.status === 'LIBRE' ? 'Disponible' : 'En servicio'))}</span></div>${table.status === 'LIBRE' ? `<div class="demo-empty-order"><span>${icon('orders')}</span><strong>${escapeHtml(translate('Lista para recibir'))}</strong><small>${escapeHtml(translate('Abre una cuenta de prueba y agrega algo del menú.'))}</small><button type="button" class="demo-open-button" data-demo-open>${escapeHtml(translate('Abrir cuenta de prueba'))} ${icon('arrow')}</button></div>` : `<div class="demo-order-lines">${items.map(item => `<article class="demo-order-line"><span class="demo-line-icon">${icon('products')}</span><span class="demo-line-name"><strong>${escapeHtml(translate(item.name))}</strong>${item.note ? `<small>${escapeHtml(translate('Indicación: {note}', { note: item.note }))}</small>` : `<small>${escapeHtml(translate('Preparado al momento'))}</small>`}</span><strong class="demo-line-price">$ ${item.price.toLocaleString(getLocale())}</strong><button type="button" class="demo-remove" data-demo-remove="${item.id}" aria-label="${escapeHtml(translate('Quitar {product}', { product: item.name }))}">×</button></article>`).join('') || `<p class="demo-no-items">${escapeHtml(translate('Aún no hay productos en la cuenta de prueba.'))}</p>`}</div>${items.length ? `<div class="demo-allergy-editor"><label for="demo-allergy-note">${escapeHtml(translate('Indicación de ingrediente'))} <small>${escapeHtml(translate('Ej. sin maní'))}</small></label><div><input id="demo-allergy-note" maxlength="90" placeholder="${escapeHtml(translate('Escribe una indicación'))}" value="${escapeHtml(items[0].note)}"><button type="button" data-demo-save-note>${escapeHtml(translate('Guardar'))}</button></div></div>` : ''}<div class="demo-total"><span>${escapeHtml(translate('Total de ejemplo'))}</span><strong>$ ${total.toLocaleString(getLocale())} COP</strong></div><div class="demo-add-area"><span>${escapeHtml(translate('Agregar a la cuenta'))}</span><div><button type="button" data-demo-add data-name="Limonada natural" data-price="7000">＋ ${escapeHtml(translate('Limonada'))} <strong>$ 7.000</strong></button><button type="button" data-demo-add data-name="Postre de la casa" data-price="9000">＋ ${escapeHtml(translate('Postre'))} <strong>$ 9.000</strong></button></div></div>`}<p class="demo-confirm-note">${escapeHtml(translate('Las indicaciones de alergias siempre deben confirmarse con cocina.'))}</p>`;
}

function loginView() {
  clearIdleMonitoring();
  clearSessionValidation();
  currentSession = null;
  document.querySelector('#session-lock')?.remove();
  app.innerHTML = `
    <main class="login-layout">
      <section class="brand-panel">
        <div class="brand">${brandMark()}Gestourant</div><button type="button" id="back-home" class="auth-home-link">← ${escapeHtml(translate('Página principal'))}</button>
        <div class="hero-copy"><p class="eyebrow">${escapeHtml(translate('OPERACIÓN INTELIGENTE'))}</p><h1>${escapeHtml(translate('Tu restaurante, en perfecto ritmo.'))}</h1><p>${escapeHtml(translate('Organiza tu sala, atiende con claridad y toma decisiones desde un solo lugar.'))}</p></div>
        <div class="login-proof"><span>✦</span><div><strong>${escapeHtml(translate('Una operación más simple'))}</strong><small>${escapeHtml(translate('Mesas, pedidos y equipo en armonía.'))}</small></div></div>
      </section>
      <section class="login-panel"><div class="login-theme">${themeSwitcher()}${languagePicker()}</div><form id="login-form" class="login-card" novalidate>
        <p class="eyebrow accent">${escapeHtml(translate('BIENVENIDO DE NUEVO'))}</p><h2>${escapeHtml(translate('Inicia sesión'))}</h2><p class="muted">${escapeHtml(translate('Tu espacio de trabajo te espera.'))}</p>
        ${authNotice ? `<p class="auth-notice" role="status">${escapeHtml(translate(authNotice))}</p>` : ''}
        <label>${escapeHtml(translate('Correo o usuario'))}<input id="identifier" name="identifier" autocomplete="username" placeholder="${escapeHtml(translate('ej. maria@restaurante.com'))}" required /></label>
        <label>${escapeHtml(translate('Contraseña'))}<div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="${escapeHtml(translate('Tu contraseña'))}" required /><button type="button" id="toggle-password" aria-label="${escapeHtml(translate('Mostrar contraseña'))}">◉</button></div></label>
        <div id="login-captcha" class="captcha-slot"></div>
        <label class="honeypot" aria-hidden="true">${escapeHtml(translate('No llenar'))}<input name="website" tabindex="-1" autocomplete="off" /></label>
        <input type="hidden" name="captchaToken" />
        <p id="login-error" class="form-message" role="alert"></p>
        <button id="login-button" class="primary" type="submit">${escapeHtml(translate('Iniciar sesión'))} <span>→</span></button>
        ${socialLoginOptions()}
        <p class="privacy-link">${escapeHtml(translate('Al continuar, consulta nuestra'))} <a href="/politica-tratamiento.html" target="_blank" rel="noopener">${escapeHtml(translate('política de datos personales'))}</a>.</p>
        <p class="demo-note">${escapeHtml(translate('¿Aún no tienes cuenta?'))} <button type="button" class="text-button" id="show-register">${escapeHtml(translate('Crear cuenta'))}</button></p>
      </form></section>
    </main>`;
  bindThemeControls();
  bindLanguagePicker(app);
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
  app.innerHTML = `<main class="login-layout"><section class="brand-panel"><div class="brand">${brandMark()}Gestourant</div><button type="button" id="back-home" class="auth-home-link">← ${escapeHtml(translate('Página principal'))}</button><div class="hero-copy"><p class="eyebrow">${escapeHtml(translate('EMPIEZA HOY'))}</p><h1>${escapeHtml(translate('La operación clara comienza aquí.'))}</h1><p>${escapeHtml(translate('Crea tu acceso y conoce el espacio de trabajo de Gestourant.'))}</p></div><div class="login-proof"><span>✦</span><div><strong>${escapeHtml(translate('Tu información, protegida'))}</strong><small>${escapeHtml(translate('Acceso seguro para cada miembro del equipo.'))}</small></div></div></section><section class="login-panel"><div class="login-theme">${themeSwitcher()}${languagePicker()}</div><form id="register-form" class="login-card" novalidate><p class="eyebrow accent">${escapeHtml(translate('NUEVA CUENTA'))}</p><h2>${escapeHtml(translate('Crear cuenta'))}</h2><p class="muted">${escapeHtml(translate('Completa tus datos para comenzar.'))}</p>${authNotice ? `<p class="auth-notice" role="status">${escapeHtml(translate(authNotice))}</p>` : ''}<label>${escapeHtml(translate('Nombre de usuario'))}<input name="username" autocomplete="username" placeholder="${escapeHtml(translate('ej. maria.lopez'))}" required minlength="3" /></label><label>${escapeHtml(translate('Correo electrónico'))}<input name="email" type="email" autocomplete="email" placeholder="${escapeHtml(translate('maria@restaurante.com'))}" required /></label><label>${escapeHtml(translate('Contraseña'))}<div class="password-wrap"><input id="register-password" name="password" type="password" autocomplete="new-password" placeholder="${escapeHtml(translate('Mínimo 10 caracteres y un número'))}" required minlength="10" /><button type="button" id="toggle-password" aria-label="${escapeHtml(translate('Mostrar contraseña'))}">◉</button></div></label>${oauthConsentField('Autorizo el tratamiento de mis datos para crear mi cuenta.', true)}<label class="honeypot" aria-hidden="true">${escapeHtml(translate('No llenar'))}<input name="website" tabindex="-1" autocomplete="off" /></label><input type="hidden" name="captchaToken" /><div id="register-captcha" class="captcha-slot"></div><p class="form-hint">${escapeHtml(translate('Los permisos administrativos los asigna el responsable del sistema.'))}</p><p id="register-error" class="form-message" role="alert"></p><button id="register-button" class="primary" type="submit">${escapeHtml(translate('Crear mi cuenta'))} <span>→</span></button>${socialLoginOptions()}<p class="privacy-link">${escapeHtml(translate('Al continuar, consulta nuestra'))} <a href="/politica-tratamiento.html" target="_blank" rel="noopener">${escapeHtml(translate('política de datos personales'))}</a>.</p><p class="demo-note">${escapeHtml(translate('¿Ya tienes cuenta?'))} <button type="button" class="text-button" id="show-login">${escapeHtml(translate('Inicia sesión'))}</button></p></form></section></main>`;
  bindThemeControls();
  bindLanguagePicker(app);
  const passwordInput = app.querySelector('#register-password');
  passwordInput.minLength = 12;
  passwordInput.maxLength = 72;
  passwordInput.setAttribute('aria-describedby', 'registration-password-policy');
  passwordInput.closest('label').insertAdjacentHTML(
    'afterend',
    `<p id="registration-password-policy" class="form-hint">${escapeHtml(translate('La contraseña debe tener al menos 12 caracteres e incluir una mayúscula, una minúscula, un número y un carácter especial.'))}</p>`,
  );
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
  app.innerHTML = `<main class="login-layout"><section class="brand-panel"><div class="brand">${brandMark()}Gestourant</div><button type="button" id="back-home" class="auth-home-link">← ${escapeHtml(translate('Página principal'))}</button><div class="hero-copy"><p class="eyebrow">${escapeHtml(translate('UN ÚLTIMO PASO'))}</p><h1>${escapeHtml(translate('Tu cuenta, con tu permiso.'))}</h1><p>${escapeHtml(translate('Tu proveedor de acceso confirmó tu identidad. Antes de crear tu cuenta de Gestourant, revisa y autoriza el tratamiento de tus datos.'))}</p></div><div class="login-proof"><span>✓</span><div><strong>${escapeHtml(translate('Tu decisión importa'))}</strong><small>${escapeHtml(translate('Solo crearemos tu cuenta si aceptas expresamente.'))}</small></div></div></section><section class="login-panel"><div class="login-theme">${themeSwitcher()}${languagePicker()}</div><form id="oauth-register-form" class="login-card" novalidate><p class="eyebrow accent">${escapeHtml(translate('CONFIRMA LA CREACIÓN'))}</p><h2>${escapeHtml(translate('Crear cuenta con tu proveedor'))}</h2><p class="muted">${escapeHtml(translate('Si ya tienes una cuenta de Gestourant vinculada, iniciarás sesión directamente y no verás este paso.'))}</p>${authNotice ? `<p class="auth-notice" role="status">${escapeHtml(translate(authNotice))}</p>` : ''}<input type="hidden" name="code" value="${escapeHtml(code)}">${oauthConsentField('He leído y autorizo el tratamiento de mis datos personales para crear mi cuenta de Gestourant.', true)}<p class="form-hint">${escapeHtml(translate('Si no deseas crearla, puedes volver al inicio de sesión. No guardaremos una cuenta.'))}</p><p id="oauth-register-error" class="form-message" role="alert"></p><button id="oauth-register-button" class="primary" type="submit">${escapeHtml(translate('Autorizar y crear cuenta'))} <span>→</span></button><p class="demo-note">${escapeHtml(translate('¿No quieres continuar?'))} <button type="button" class="text-button" id="cancel-oauth-register">${escapeHtml(translate('Volver al inicio de sesión'))}</button></p><p class="privacy-link">${escapeHtml(translate('Lee nuestra'))} <a href="/politica-tratamiento.html" target="_blank" rel="noopener">${escapeHtml(translate('política de datos personales'))}</a>.</p></form></section></main>`;
  bindThemeControls();
  bindLanguagePicker(app);
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
    message.textContent = translate('Debes autorizar el tratamiento para crear la cuenta.');
    return;
  }
  button.disabled = true;
  button.textContent = translate('Creando cuenta…');
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
      ? translate('No se pudo conectar con el servidor. Confirma que el backend esté activo.')
      : error.status === 401
        ? translate('El paso de registro expiró o ya se usó. Vuelve a iniciar con tu cuenta de Google o Microsoft.')
        : error.status === 409
          ? translate('Ya existe una cuenta de Gestourant con ese correo. Inicia sesión con ella; no la vinculamos automáticamente.')
          : error.message;
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = `${escapeHtml(translate('Autorizar y crear cuenta'))} <span>→</span>`;
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
  if (authConfig.captchaEnabled && !credentials.captchaToken) { message.textContent = translate('Completa la verificación de seguridad.'); return; }
  message.textContent = ''; button.disabled = true; button.textContent = translate('Ingresando…');
  try {
    const data = await services.auth.login(credentials);
    logger.info('Login succeeded', { username: data.username, role: data.role });
    authNotice = '';
    const previousSessionClosed = data.previousSessionClosed === true;
    data.previousSessionClosed = false;
    sessionStorage.setItem('gestourant_session', JSON.stringify(data));
    dashboardView(data);
    if (previousSessionClosed) {
      showToast(translate('La sesión que estaba abierta en otro navegador se cerró para proteger esta cuenta.'));
    }
  } catch (error) {
    message.textContent = error instanceof TypeError ? translate('No se pudo conectar con el servidor. Confirma que el backend esté activo.') : error.message;
    resetCaptcha('login-captcha');
  } finally { button.disabled = false; button.innerHTML = `${escapeHtml(translate('Iniciar sesión'))} <span>→</span>`; }
}

async function register(event) {
  event.preventDefault();
  const registerForm = event.currentTarget;
  const message = document.querySelector('#register-error');
  message.textContent = '';
  if (!showSpanishFormValidation(registerForm, message)) return;
  const form = new FormData(registerForm), button = document.querySelector('#register-button');
  const account = { username: form.get('username').trim(), email: form.get('email').trim(), password: form.get('password'), website: form.get('website'), captchaToken: form.get('captchaToken'), privacyConsent: form.get('privacyConsent') === 'on' };
  if (!isValidRegistrationPassword(account.password)) {
    message.textContent = translate('La contraseña debe tener al menos 12 caracteres e incluir una mayúscula, una minúscula, un número y un carácter especial.');
    return;
  }
  if (authConfig.captchaEnabled && !account.captchaToken) { message.textContent = translate('Completa la verificación de seguridad.'); return; }
  message.textContent = ''; button.disabled = true; button.textContent = translate('Creando cuenta…');
  try {
    const data = await services.auth.register(account);
    logger.info('Registration succeeded', { username: data.username, role: data.role });
    authNotice = '';
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) { message.textContent = error instanceof TypeError ? translate('No se pudo conectar con el servidor. Confirma que el backend esté activo.') : error.message; resetCaptcha('register-captcha'); }
  finally { button.disabled = false; button.innerHTML = `${escapeHtml(translate('Crear mi cuenta'))} <span>→</span>`; }
}

function dashboardView(session) {
  if (guestRequestBadgePoll) window.clearInterval(guestRequestBadgePoll);
  currentSession = session;
  const user = escapeHtml(session.username || 'Equipo');
  const role = session.role === 'ADMINISTRADOR' ? 'Administrador' : 'Empleado';
  app.innerHTML = `<main class="dashboard"><aside class="sidebar"><div class="brand">${brandMark()}Gestourant</div><div class="restaurant"><span class="avatar">${user.charAt(0).toUpperCase()}</span><div><strong>${escapeHtml(translate('Restaurante Central'))}</strong><small>${escapeHtml(translate(role))} · ${escapeHtml(translate('Turno activo'))}</small></div></div><nav aria-label="${escapeHtml(translate('Navegación principal'))}"><a data-view="overview">${icon('overview')}<span>${escapeHtml(translate('Resumen'))}</span></a><a class="active" data-view="tables">${icon('tables')}<span>${escapeHtml(translate('Mesas'))}</span></a><a data-view="orders">${icon('orders')}<span>${escapeHtml(translate('Pedidos'))}</span><b class="nav-pending-count" id="nav-pending-count" hidden>0</b></a><a data-view="kitchen">${icon('kitchen')}<span>${escapeHtml(translate('Cocina'))}</span></a><a data-view="products">${icon('products')}<span>${escapeHtml(translate('Menú e inventario'))}</span></a><a data-view="reports">${icon('reports')}<span>${escapeHtml(translate('Reportes'))}</span></a>${session.role === 'ADMINISTRADOR' ? `<a data-view="backups">${icon('reports')}<span>${escapeHtml(translate('Copias de seguridad'))}</span></a><a data-view="audit">${icon('reports')}<span>${escapeHtml(translate('Registro de auditoría'))}</span></a>` : ''}</nav><div class="sidebar-footer">${themeSwitcher()}${languagePicker()}<button id="logout" class="logout">↪ ${escapeHtml(translate('Cerrar sesión'))}</button></div></aside><section id="content" class="workspace"></section><aside id="detail" class="detail"><div class="detail-empty"><span>${icon('tables')}</span><h3>${escapeHtml(translate('Tu sala está lista'))}</h3><p>${escapeHtml(translate('Selecciona una mesa para ver la cuenta y comenzar el servicio.'))}</p></div></aside></main>`;
  bindThemeControls();
  bindLanguagePicker(app);
  document.querySelector('#logout').addEventListener('click', () => logout(session));
  document.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', () => {
    if (link.dataset.view === 'overview' && globalThis.__GESTOURANT_RETURN_TO_ANGULAR_DASHBOARD__) {
      stopViewPolling();
      globalThis.__GESTOURANT_RETURN_TO_ANGULAR_DASHBOARD__(session);
      return;
    }
    navigate(link.dataset.view, session);
  }));
  if (!globalThis.__GESTOURANT_AUTH_ACTIVE__) navigate('overview', session);
  updateGuestRequestBadge(session);
  guestRequestBadgePoll = window.setInterval(() => updateGuestRequestBadge(session), 5000);
  setupIdleMonitoring(session);
  setupSessionValidation(session);
  showCookieNotice();
  globalThis.__GESTOURANT_SESSION_READY__?.(session);
}

async function loadTables(session) {
  try {
    tables = await services.tables.list(session);
  } catch (error) { showToast(error.message, true); }
  renderTables();
}

async function navigate(view, session) {
  stopViewPolling();
  document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  document.querySelector('#detail')?.classList.remove('open');
  const content = document.querySelector('#content');
  document.querySelector('#detail').innerHTML = `<div class="detail-empty"><span>⌁</span><h3>${escapeHtml(translate('Selecciona una mesa'))}</h3><p>${escapeHtml(translate('Verás aquí el resumen de la atención.'))}</p></div>`;
  if (view === 'overview') { content.innerHTML = overviewView(session); await loadOverview(session); return; }
  if (view === 'tables') { content.innerHTML = tablesView(session); bindTableAdmin(session); await loadTables(session); tableMapPoll = window.setInterval(() => refreshTableMap(session), 5000); return; }
  if (view === 'products') {
    content.innerHTML = productsView(session);
    bindProductAdmin(session);
    bindProductViewControls(session);
    await loadProducts(session);
    return;
  }
  if (view === 'orders') { content.innerHTML = ordersView(); loadGuestRequests(session); guestRequestPoll = window.setInterval(() => loadGuestRequests(session), 5000); return; }
  if (view === 'kitchen') { content.innerHTML = kitchenView(); loadKitchenRequests(session); kitchenPoll = window.setInterval(() => loadKitchenRequests(session), 5000); return; }
  if (view === 'backups') {
    if (session.role !== 'ADMINISTRADOR') { showToast(translate('Solo el administrador puede gestionar copias de seguridad.'), true); return; }
    content.innerHTML = backupsView();
    await loadBackups(session);
    return;
  }
  if (view === 'audit') {
    if (session.role !== 'ADMINISTRADOR') {
      showToast(translate('Solo el administrador puede consultar los registros de auditoría.'), true);
      return;
    }
    content.innerHTML = auditLogsView();
    await loadAuditLogs(session);
    return;
  }
  content.innerHTML = reportsView(session); await loadReport(session);
}

function stopViewPolling() {
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
}

function overviewView(session) {
  const user = session.username || 'Equipo';
  return `<header class="overview-header"><div><p class="eyebrow">${escapeHtml(translate('CENTRO DE OPERACIÓN'))}</p><h1>${escapeHtml(translate('Hola, {user}', { user }))}</h1><p class="muted">${escapeHtml(translate('Este es el pulso de tu restaurante para comenzar la jornada.'))}</p></div><div class="header-actions"><span class="date">● ${escapeHtml(translate('Sistema listo'))}</span></div></header><section class="overview-grid"><article class="overview-card overview-primary"><span class="overview-icon">⌂</span><div><small>${escapeHtml(translate('Mesas ocupadas'))}</small><strong id="overview-busy">...</strong><p>${escapeHtml(translate('Controla el ritmo de la sala'))}</p></div><button class="overview-link" data-quick-view="tables">${escapeHtml(translate('Ver sala →'))}</button></article><article class="overview-card"><span class="overview-icon">◇</span><div><small>${escapeHtml(translate('Mesas disponibles'))}</small><strong id="overview-free">...</strong><p>${escapeHtml(translate('Listas para recibir clientes'))}</p></div><button class="overview-link" data-quick-view="tables">${escapeHtml(translate('Abrir mapa →'))}</button></article><article class="overview-card"><span class="overview-icon">✦</span><div><small>${escapeHtml(translate('Stock por revisar'))}</small><strong id="overview-low-stock">...</strong><p>${escapeHtml(translate('Productos con cinco unidades o menos'))}</p></div><button class="overview-link" data-quick-view="products">${escapeHtml(translate('Ver inventario →'))}</button></article></section><section class="overview-actions"><div><p class="eyebrow">${escapeHtml(translate('ACCESOS RÁPIDOS'))}</p><h2>${escapeHtml(translate('Continúa tu operación'))}</h2><p class="muted">${escapeHtml(translate('Elige el siguiente paso según el momento de tu servicio.'))}</p></div><div class="quick-actions"><button class="quick-action" data-quick-view="tables"><span>⌘</span><strong>${escapeHtml(translate('Gestionar mesas'))}</strong><small>${escapeHtml(translate('Abre mesas y revisa pedidos'))}</small></button><button class="quick-action" data-quick-view="orders"><span>▤</span><strong>${escapeHtml(translate('Revisar pedidos'))}</strong><small>${escapeHtml(translate('Consulta las cuentas abiertas'))}</small></button><button class="quick-action" data-quick-view="products"><span>◫</span><strong>${escapeHtml(translate('Ver inventario'))}</strong><small>${escapeHtml(translate('Consulta disponibilidad del menú'))}</small></button></div></section>`;
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
  const eligibleTables = tables.filter(table => table.status === 'LIBRE' && !table.joinedTableId);
  const adminTools = session.role === 'ADMINISTRADOR' ? `<details class="admin-tools table-tools"><summary><span><strong>${escapeHtml(translate('Configurar sala'))}</strong><small>${escapeHtml(translate('Agregar mesas o unir espacios'))}</small></span><span class="tools-plus">＋</span></summary><div class="table-tools-content"><form id="create-table-form" class="inline-form"><input name="tableNumber" type="number" min="1" placeholder="${escapeHtml(translate('N.º mesa'))}" required><input name="seats" type="number" min="1" placeholder="${escapeHtml(translate('Puestos'))}" required><button class="primary" type="submit">${escapeHtml(translate('＋ Agregar mesa'))}</button></form><form id="join-table-form" class="inline-form"><select name="firstTableId" required><option value="">${escapeHtml(translate('Primera mesa'))}</option>${eligibleTables.map(table => `<option value="${table.id}">${escapeHtml(translate('Mesa'))} ${table.tableNumber}</option>`).join('')}</select><select name="secondTableId" required><option value="">${escapeHtml(translate('Segunda mesa'))}</option>${eligibleTables.map(table => `<option value="${table.id}">${escapeHtml(translate('Mesa'))} ${table.tableNumber}</option>`).join('')}</select><button class="outline" type="submit">${escapeHtml(translate('Unir mesas'))}</button></form></div></details>` : '';
  return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(translate('SERVICIO · SALA PRINCIPAL'))}</p><h1>${escapeHtml(translate('Mapa de mesas'))}</h1><p class="muted">${escapeHtml(translate('Elige una mesa para abrir su cuenta y atender el pedido.'))}</p></div><div class="service-status"><span class="live-dot"></span>${escapeHtml(translate('Servicio en curso'))}</div></header>
    <section class="service-metrics"><article><span class="metric-icon occupied-icon">${icon('tables')}</span><div><small>${escapeHtml(translate('En servicio'))}</small><strong>${occupied}</strong></div></article><article><span class="metric-icon available-icon">${icon('tables')}</span><div><small>${escapeHtml(translate('Disponibles'))}</small><strong>${available}</strong></div></article><article><span class="metric-icon total-icon">${icon('overview')}</span><div><small>${escapeHtml(translate('Total de mesas'))}</small><strong>${tables.length}</strong></div></article></section>
    ${adminTools}<section class="floor-panel"><div class="floor-head"><div><p class="eyebrow">${escapeHtml(translate('PLANTA DEL RESTAURANTE'))}</p><h2>${escapeHtml(translate('Salón principal'))}</h2><p>${escapeHtml(translate('Elige una mesa; puedes moverla en el croquis y abrir su cuenta.'))}</p></div><div class="floor-tools">${session.role === 'ADMINISTRADOR' ? `<label class="floor-arrange-toggle"><input id="arrange-floor" type="checkbox"> ${escapeHtml(translate('Acomodar mesas'))}</label>` : ''}<div class="floor-legend"><span><i class="legend-dot free-dot"></i>${escapeHtml(translate('Disponible'))}</span><span><i class="legend-dot busy-dot"></i>${escapeHtml(translate('En servicio'))}</span></div></div></div><div class="floor-map-background"><div class="floor-zone floor-zone-kitchen">${escapeHtml(translate('COCINA'))}</div><div class="floor-zone floor-zone-entry">${escapeHtml(translate('ENTRADA'))}</div><div class="floor-zone floor-zone-window">${escapeHtml(translate('VENTANAL'))}</div><div id="table-grid" class="floor-map"></div></div><footer class="floor-footer"><span>${escapeHtml(translate('Las cuentas abiertas se guardan automáticamente.'))}</span><span>${escapeHtml(translate(available === 1 ? '{count} mesa lista para recibir clientes' : '{count} mesas listas para recibir clientes', { count: available }))}</span></footer></section>`;
}
function bindTableAdmin(session) {
  const createForm = document.querySelector('#create-table-form');
  const joinForm = document.querySelector('#join-table-form');
  createForm?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await services.tables.create(session, { tableNumber: Number(data.get('tableNumber')), seats: Number(data.get('seats')) }); showToast(translate('Mesa creada.')); navigate('tables', session); } catch (error) { showToast(error.message, true); } });
  joinForm?.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await services.tables.join(session, { firstTableId: Number(data.get('firstTableId')), secondTableId: Number(data.get('secondTableId')) }); showToast(translate('Mesas unidas.')); navigate('tables', session); } catch (error) { showToast(error.message, true); } });
}
function productsView(session) {
  const adminTools = session.role === 'ADMINISTRADOR' ? `<details class="admin-tools menu-admin-tools"><summary><span><strong id="product-form-title">${escapeHtml(translate('Administrar menú'))}</strong><small>${escapeHtml(translate('Crear o actualizar platos, bebidas y precios'))}</small></span><span class="tools-plus">＋</span></summary><form id="create-product-form" class="product-form"><label>${escapeHtml(translate('Nombre del producto'))}<input name="name" maxlength="120" placeholder="${escapeHtml(translate('Ej. Trucha a la plancha'))}" required></label><label>${escapeHtml(translate('Categoría'))}<select name="category"><option value="PLATO">${escapeHtml(translate('Plato'))}</option><option value="BEBIDA">${escapeHtml(translate('Bebida'))}</option><option value="OTRO">${escapeHtml(translate('Otro'))}</option></select></label><label class="form-wide">${escapeHtml(translate('Descripción'))}<textarea name="description" maxlength="500" placeholder="${escapeHtml(translate('Descripción e ingredientes principales'))}" required></textarea></label><label class="form-wide">${escapeHtml(translate('Foto del producto'))}<input name="imageUrl" type="url" maxlength="1000" placeholder="${escapeHtml(translate('https://… (opcional)'))}"><small>${escapeHtml(translate('Usa una imagen propia o de tu proveedor, con permiso de uso.'))}</small></label><label>${escapeHtml(translate('Precio (COP)'))}<input name="price" type="number" min="1" step="1" placeholder="28000" required></label><label>${escapeHtml(translate('Existencias'))}<input name="stock" type="number" min="0" step="1" placeholder="20" required></label><label class="product-active"><input name="active" type="checkbox" checked> ${escapeHtml(translate('Disponible para pedidos'))}</label><div class="product-form-actions"><button id="product-submit" class="primary" type="submit">${escapeHtml(translate('＋ Guardar producto'))}</button><button id="cancel-product-edit" class="outline hidden-field" type="button">${escapeHtml(translate('Cancelar'))}</button></div></form></details>` : '';
  const orderContext = activeOrder ? `<div class="active-order-banner"><span class="order-live-indicator"></span><div><strong>${escapeHtml(translate('Pedido en curso · Mesa {table}', { table: activeOrder.table.tableNumber }))}</strong><small>${escapeHtml(translate('Pedido #{id} · Los productos se agregarán a esta cuenta', { id: activeOrder.id }))}</small></div><button id="return-to-order" class="outline" type="button">${escapeHtml(translate('Ver cuenta'))} ${icon('arrow')}</button></div>` : `<div class="active-order-banner no-active-order"><div>${icon('tables')}<span><strong>${escapeHtml(translate('Para tomar un pedido'))}</strong><small>${escapeHtml(translate('Selecciona una mesa libre o en servicio.'))}</small></span></div><button id="choose-table" class="outline" type="button">${escapeHtml(translate('Elegir mesa'))} ${icon('arrow')}</button></div>`;
  return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(translate('CARTA · COCINA Y BAR'))}</p><h1>${escapeHtml(translate('Menú del restaurante'))}</h1><p class="muted">${escapeHtml(translate('Platos y bebidas disponibles durante el servicio.'))}</p></div><span class="menu-count">${escapeHtml(translate('{count} productos disponibles', { count: products.filter(product => product.active).length }))}</span></header>${orderContext}${adminTools}<section class="menu-section"><div class="menu-toolbar"><div><p class="eyebrow">${escapeHtml(translate('LA CARTA'))}</p><h2>${escapeHtml(translate('Elige algo delicioso'))}</h2></div><label class="menu-search"><span>⌕</span><input id="product-search" type="search" placeholder="${escapeHtml(translate('Buscar en el menú…'))}" aria-label="${escapeHtml(translate('Buscar productos'))}"></label></div><div class="catalog-filters menu-filters"><button class="filter-button active" data-category-filter="TODOS">${escapeHtml(translate('Todo el menú'))}</button><button class="filter-button" data-category-filter="PLATO">${escapeHtml(translate('Platos'))}</button><button class="filter-button" data-category-filter="BEBIDA">${escapeHtml(translate('Bebidas'))}</button><button class="filter-button" data-category-filter="OTRO">${escapeHtml(translate('Otros'))}</button></div><div id="product-list" class="product-list menu-grid"><p class="muted">${escapeHtml(translate('Cargando menú…'))}</p></div></section>`;
}
function bindProductViewControls(session) {
  document.querySelector('#return-to-order')?.addEventListener('click', () => navigate('tables', session).then(() => activeOrder?.table?.id && selectTable(activeOrder.table.id)));
  document.querySelector('#choose-table')?.addEventListener('click', () => navigate('tables', session));
}
function ordersView() { return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(translate('OPERACIÓN · PEDIDOS QR'))}</p><h1>${escapeHtml(translate('Solicitudes de clientes'))}</h1><p class="muted">${escapeHtml(translate('Revisa cada solicitud; solo al confirmarla pasa a la cuenta y se descuenta del inventario.'))}</p></div><div class="service-status"><span class="live-dot"></span>${escapeHtml(translate('Actualización automática'))}</div></header><section id="guest-request-queue" class="guest-request-queue"><p class="muted">${escapeHtml(translate('Cargando solicitudes…'))}</p></section>`; }
function kitchenView() { return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(translate('SERVICIO · PREPARACIÓN'))}</p><h1>${escapeHtml(translate('Comandas de cocina'))}</h1><p class="muted">${escapeHtml(translate('Pedidos confirmados por el equipo. Actualiza el estado para que el cliente sepa cómo va.'))}</p></div><div class="service-status"><span class="live-dot"></span>${escapeHtml(translate('Actualización automática'))}</div></header><section id="kitchen-request-queue" class="guest-request-queue"><p class="muted">${escapeHtml(translate('Cargando comandas…'))}</p></section>`; }
function reportsView(session) {
  const administrator = session.role === 'ADMINISTRADOR';
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(translate('CONTROL · CIERRE E HISTORIAL'))}</p><h1>${escapeHtml(translate('Reportes'))}</h1><p class="muted">${escapeHtml(translate(administrator ? 'Consulta y descarga el historial de facturas del restaurante. El empleado mostrado es quien abrió cada pedido.' : 'Consulta las facturas de los pedidos que abriste en la fecha seleccionada.'))}</p></div></header>
    <section class="report-filter-card"><div class="report-date-fields"><label for="report-from">${escapeHtml(translate(administrator ? 'Desde' : 'Fecha del turno'))}<input id="report-from" type="date" value="${today}" required></label>${administrator ? `<label for="report-to">${escapeHtml(translate('Hasta'))}<input id="report-to" type="date" value="${today}" required></label>` : ''}</div><div class="report-actions"><button id="report-search" class="outline" type="button">${escapeHtml(translate(administrator ? 'Consultar historial' : 'Consultar fecha'))}</button><button id="download-cash-close" class="primary report-download" type="button" disabled>${escapeHtml(translate('Descargar Excel (.xlsx)'))}</button></div></section>
    <p id="report-message" class="report-message" role="status">${escapeHtml(translate('Cargando reporte…'))}</p>
    <section class="metrics report-metrics"><article><span>${escapeHtml(translate('Facturas'))}</span><strong id="report-invoices">—</strong></article><article><span>${escapeHtml(translate('Efectivo'))}</span><strong id="report-cash">—</strong></article><article><span>${escapeHtml(translate('Pagos digitales'))}</span><strong id="report-digital">—</strong></article><article><span>${escapeHtml(translate('Total vendido'))}</span><strong id="report-total">—</strong></article></section>
    <section class="report-history-card"><div class="report-history-heading"><div><p class="eyebrow">${escapeHtml(translate('DETALLE'))}</p><h2>${escapeHtml(translate('Facturas del periodo'))}</h2></div><span id="report-period"></span></div><div id="report-history" class="report-table-wrap"><p class="muted">${escapeHtml(translate('Cargando facturas…'))}</p></div></section>`;
}

async function loadProducts(session) {
  try { products = await services.products.list(session); renderProducts(); } catch (error) { showToast(error.message, true); }
}

function bindProductAdmin(session) {
  const form = document.querySelector('#create-product-form');
  if (form) {
    const submitButton = document.querySelector('#product-submit');
    const cancelButton = document.querySelector('#cancel-product-edit');
    const resetForm = () => { form.reset(); form.dataset.editingId = ''; document.querySelector('#product-form-title').textContent = translate('Administrar menú'); submitButton.textContent = translate('＋ Guardar producto'); cancelButton.classList.add('hidden-field'); };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        const imageUrl = data.get('imageUrl').trim();
        if (imageUrl && !imageUrl.startsWith('https://')) throw new Error('La imagen debe tener una dirección segura que comience con https://');
        const product = { name: data.get('name').trim(), description: data.get('description').trim(), category: data.get('category'), imageUrl, price: Number(data.get('price')), stock: Number(data.get('stock')), active: data.get('active') === 'on' };
        const editingId = form.dataset.editingId;
        await services.products.save(session, product, editingId);
        showToast(translate(editingId ? 'Producto actualizado.' : 'Producto guardado en el menú.'));
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
    const matchesSearch = !search || `${product.name} ${translate(product.name)} ${product.description} ${translate(product.description || '')} ${product.category}`.toLocaleLowerCase(getLocale()).includes(search);
    return matchesCategory && matchesSearch && (isAdmin || product.active);
  });
  list.innerHTML = visibleProducts.length ? visibleProducts.map(product => `<article class="product-card ${!product.active ? 'inactive' : ''}" data-product-id="${product.id}">
    <div class="product-photo-wrap"><img class="product-photo" src="${escapeHtml(productPhoto(product))}" alt="${escapeHtml(translate(product.name))}" loading="lazy"><span class="product-category">${escapeHtml(translate(product.category || 'PLATO'))}</span>${!product.active ? `<span class="menu-unavailable">${escapeHtml(translate('Pausado'))}</span>` : ''}</div>
    <div class="product-card-body"><div class="product-card-title"><h3>${escapeHtml(translate(product.name))}</h3><strong>$ ${Number(product.price).toLocaleString(getLocale())}</strong></div>
      <p>${escapeHtml(product.description ? translate(product.description) : translate('Preparado al momento en nuestra cocina.'))}</p>
      <div class="product-card-footer"><span class="stock ${product.stock < 5 ? 'low' : ''}">${product.stock > 0 ? escapeHtml(translate('{count} disponibles', { count: product.stock })) : escapeHtml(translate('Agotado'))}</span><div class="product-actions">${product.active && product.stock ? (activeOrder ? `<button class="primary add-product" type="button">${escapeHtml(translate('＋ Agregar'))}</button>` : `<button class="outline select-table-for-product" type="button">${escapeHtml(translate('Elegir mesa'))}</button>`) : `<span class="unavailable">${escapeHtml(translate('No disponible'))}</span>`}${isAdmin ? `<button class="outline edit-product" type="button" aria-label="${escapeHtml(translate('Editar producto'))}">${escapeHtml(translate('Editar'))}</button><button class="danger delete-product" type="button" aria-label="${escapeHtml(translate('Eliminar producto'))}">${escapeHtml(translate('Eliminar'))}</button>` : ''}</div></div>
    </div></article>`).join('') : `<div class="menu-empty"><span>⌕</span><h3>${escapeHtml(translate('No encontramos productos'))}</h3><p>${escapeHtml(translate('Ajusta la búsqueda o elige otra categoría.'))}</p></div>`;
  list.querySelectorAll('.product-photo').forEach(image => image.addEventListener('error', () => {
    image.src = defaultFoodPhoto;
    image.classList.add('photo-fallback');
  }, { once: true }));
  list.querySelectorAll('.add-product').forEach(button => button.addEventListener('click', () => addProduct(Number(button.closest('[data-product-id]').dataset.productId))));
  list.querySelectorAll('.select-table-for-product').forEach(button => button.addEventListener('click', () => navigate('tables', session)));
  list.querySelectorAll('.edit-product').forEach(button => button.addEventListener('click', () => editProduct(Number(button.closest('[data-product-id]').dataset.productId))));
  list.querySelectorAll('.delete-product').forEach(button => button.addEventListener('click', () => deleteProduct(Number(button.closest('[data-product-id]').dataset.productId))));
}

function editProduct(id) { const product = products.find(item => item.id === id), form = document.querySelector('#create-product-form'); if (!product || !form) return; form.dataset.editingId = String(id); form.elements.name.value = product.name; form.elements.category.value = product.category || 'PLATO'; form.elements.description.value = product.description || ''; form.elements.imageUrl.value = product.imageUrl || ''; form.elements.price.value = product.price; form.elements.stock.value = product.stock; form.elements.active.checked = product.active; document.querySelector('#product-form-title').textContent = translate('Editar producto'); document.querySelector('#product-submit').textContent = translate('Guardar cambios'); document.querySelector('#cancel-product-edit').classList.remove('hidden-field'); form.closest('details').open = true; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function deleteProduct(id) { const product = products.find(item => item.id === id), session = JSON.parse(sessionStorage.getItem('gestourant_session')); if (!product || !window.confirm(translate('¿Eliminar {product} del menú?', { product: product.name }))) return; try { await services.products.remove(session, id); showToast(translate('Producto eliminado.')); navigate('products', session); } catch (error) { showToast(error.message, true); } }

function backupsView() {
  return `<header class="overview-header"><div><p class="eyebrow">${escapeHtml(translate('ADMINISTRACIÓN'))}</p><h1>${escapeHtml(translate('Copias de seguridad'))}</h1><p class="muted">${escapeHtml(translate('Crea respaldos completos de MySQL, descarga una copia o restaura un punto anterior.'))}</p></div><div class="header-actions"><button type="button" class="primary" id="create-backup">${escapeHtml(translate('Crear copia ahora'))}</button></div></header><section class="backup-warning"><strong>${escapeHtml(translate('Restaurar reemplaza los datos actuales de la base de datos.'))}</strong><span>${escapeHtml(translate('La operación requiere confirmación y solo está disponible para el administrador.'))}</span></section><section class="report-history-card"><div class="report-history-heading"><div><p class="eyebrow">${escapeHtml(translate('ALMACENAMIENTO SEGURO'))}</p><h2>${escapeHtml(translate('Historial de respaldos'))}</h2></div><span id="backup-count">${escapeHtml(translate('Cargando…'))}</span></div><p id="backup-message" class="report-message" aria-live="polite"></p><div id="backup-history" class="report-table-wrap"><p class="report-empty">${escapeHtml(translate('Cargando copias de seguridad…'))}</p></div></section>`;
}

function auditLogsView() {
  return `<header class="overview-header"><div><p class="eyebrow">${escapeHtml(translate('ADMINISTRACIÓN'))}</p><h1>${escapeHtml(translate('Registro de auditoría'))}</h1><p class="muted">${escapeHtml(translate('Consulta las acciones realizadas por los usuarios del sistema.'))}</p></div></header><section class="report-history-card"><div class="report-history-heading"><div><p class="eyebrow">${escapeHtml(translate('ADMINISTRACIÓN'))}</p><h2>${escapeHtml(translate('Registro de auditoría'))}</h2></div><span id="audit-count"></span></div><p id="audit-message" class="report-message" aria-live="polite"></p><button type="button" class="outline" id="audit-retry" hidden>${escapeHtml(translate('Reintentar'))}</button><div id="audit-history" class="report-table-wrap"><p class="report-empty">${escapeHtml(translate('Cargando registros de auditoría…'))}</p></div><div class="header-actions"><button type="button" class="outline" id="audit-previous">${escapeHtml(translate('Anterior'))}</button><span id="audit-page"></span><button type="button" class="outline" id="audit-next">${escapeHtml(translate('Siguiente'))}</button></div></section>`;
}

async function loadAuditLogs(session, page = 0) {
  auditCurrentPage = page;
  const list = document.querySelector('#audit-history');
  const message = document.querySelector('#audit-message');
  const count = document.querySelector('#audit-count');
  const pageLabel = document.querySelector('#audit-page');
  const previous = document.querySelector('#audit-previous');
  const next = document.querySelector('#audit-next');
  const retry = document.querySelector('#audit-retry');
  if (!list || !message || !count || !pageLabel || !previous || !next || !retry) return;
  message.textContent = '';
  message.classList.remove('is-error');
  count.textContent = '';
  pageLabel.textContent = '';
  list.innerHTML = `<p class="report-empty">${escapeHtml(translate('Cargando registros de auditoría…'))}</p>`;
  previous.disabled = true;
  next.disabled = true;
  retry.hidden = true;
  retry.onclick = () => { void loadAuditLogs(session, auditCurrentPage); };
  try {
    const result = await services.audit.list(session, page, 50);
    if (!list.isConnected) return;
    if (!Array.isArray(result?.content)
      || !Number.isInteger(result.number)
      || !Number.isInteger(result.totalPages)
      || !Number.isInteger(result.totalElements)) {
      throw new TypeError('La respuesta del historial de auditoría no tiene el formato esperado.');
    }
    const entries = result.content;
    const totalPages = result.totalPages;
    count.textContent = translate('{count} registros', { count: result.totalElements });
    pageLabel.textContent = translate('Página {current} de {total}', {
      current: totalPages ? result.number + 1 : 0,
      total: totalPages,
    });
    list.innerHTML = entries.length ? `<table class="report-table"><thead><tr><th>${escapeHtml(translate('Fecha y hora'))}</th><th>${escapeHtml(translate('Usuario'))}</th><th>${escapeHtml(translate('Acción'))}</th><th>${escapeHtml(translate('Recurso'))}</th><th>${escapeHtml(translate('Detalles'))}</th><th>${escapeHtml(translate('Dirección IP'))}</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${escapeHtml(new Date(entry.createdAt).toLocaleString(getLocale()))}</td><td>${escapeHtml(entry.username || '—')}</td><td>${escapeHtml(entry.action || '—')}</td><td>${escapeHtml(entry.resource || '—')}</td><td>${escapeHtml(entry.details || '—')}</td><td>${escapeHtml(entry.ipAddress || '—')}</td></tr>`).join('')}</tbody></table>` : `<p class="report-empty">${escapeHtml(translate('No hay registros de auditoría para mostrar.'))}</p>`;
    previous.disabled = result.number <= 0;
    next.disabled = result.number + 1 >= totalPages;
    previous.onclick = () => { if (result.number > 0) void loadAuditLogs(session, result.number - 1); };
    next.onclick = () => { if (result.number + 1 < totalPages) void loadAuditLogs(session, result.number + 1); };
  } catch (error) {
    if (!list.isConnected) return;
    list.innerHTML = '';
    message.textContent = `${translate('No se pudieron cargar los registros de auditoría.')} ${error instanceof Error ? error.message : String(error)}`;
    message.classList.add('is-error');
    retry.hidden = false;
  }
}

async function loadBackups(session) {
  const list = document.querySelector('#backup-history');
  const message = document.querySelector('#backup-message');
  const count = document.querySelector('#backup-count');
  const createButton = document.querySelector('#create-backup');
  if (!list || !message || !createButton) return;

  const render = backups => {
    count.textContent = translate(backups.length === 1 ? '{count} copia' : '{count} copias', { count: backups.length });
    list.innerHTML = backups.length ? `<table class="report-table"><thead><tr><th>${escapeHtml(translate('Archivo'))}</th><th>${escapeHtml(translate('Fecha y hora (UTC)'))}</th><th>${escapeHtml(translate('Tamaño'))}</th><th>${escapeHtml(translate('Acciones'))}</th></tr></thead><tbody>${backups.map(backup => `<tr><td>${escapeHtml(backup.fileName)}</td><td>${new Date(backup.createdAt).toLocaleString(getLocale(), { timeZone: 'UTC' })}</td><td>${formatBackupSize(backup.sizeBytes)}</td><td><div class="backup-actions"><button type="button" class="outline backup-download" data-backup-id="${escapeHtml(backup.id)}">${escapeHtml(translate('Descargar'))}</button><button type="button" class="outline backup-restore" data-backup-id="${escapeHtml(backup.id)}">${escapeHtml(translate('Restaurar'))}</button></div></td></tr>`).join('')}</tbody></table>` : `<p class="report-empty">${escapeHtml(translate('Todavía no hay copias. Crea la primera para que aparezca aquí.'))}</p>`;
    list.querySelectorAll('.backup-download').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await services.backups.download(session, button.dataset.backupId);
        showToast(translate('Descarga del respaldo iniciada.'));
      } catch (error) {
        showToast(translate('No se pudo descargar el respaldo: {detail}', { detail: error.message }), true);
      } finally {
        button.disabled = false;
      }
    }));
    list.querySelectorAll('.backup-restore').forEach(button => button.addEventListener('click', async () => {
      const accepted = window.confirm(translate('Esta acción reemplazará la base de datos actual. Se recomienda descargar un respaldo reciente antes de continuar.'));
      if (!accepted || window.prompt(translate('Escribe RESTAURAR para confirmar:')) !== 'RESTAURAR') return;
      button.disabled = true;
      try {
        const result = await services.backups.restore(session, button.dataset.backupId);
        showToast(translate('La base se restauró. Respaldo de seguridad: {fileName}.', { fileName: result.safetyBackupFileName }));
        message.textContent = translate('Restauración completada. Se creó el respaldo de seguridad {fileName}.', { fileName: result.safetyBackupFileName });
        await refresh();
      } catch (error) {
        showToast(translate('No se pudo restaurar la base de datos: {detail}', { detail: error.message }), true);
      } finally {
        button.disabled = false;
      }
    }));
  };
  const refresh = async () => {
    message.textContent = translate('Consultando el almacenamiento seguro…');
    message.classList.remove('is-error');
    try {
      render(await services.backups.list(session));
      message.textContent = '';
    } catch (error) {
      list.innerHTML = `<p class="report-empty">${escapeHtml(translate('No se pudo cargar el historial: {detail}', { detail: error.message }))}</p>`;
      count.textContent = translate('No disponible');
      message.textContent = translate('Verifica que el almacenamiento S3 y sus credenciales estén configurados.');
      message.classList.add('is-error');
    }
  };
  createButton.onclick = async () => {
    createButton.disabled = true;
    createButton.textContent = translate('Creando copia…');
    message.textContent = translate('Generando el respaldo de MySQL y guardándolo de forma segura…');
    message.classList.remove('is-error');
    try {
      const backup = await services.backups.create(session);
      showToast(translate('Copia creada: {fileName}', { fileName: backup.fileName }));
      await refresh();
    } catch (error) {
      message.textContent = translate('No se pudo crear la copia: {detail}', { detail: error.message });
      message.classList.add('is-error');
      showToast(message.textContent, true);
    } finally {
      createButton.disabled = false;
      createButton.textContent = translate('Crear copia ahora');
    }
  };
  await refresh();
}

function formatBackupSize(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toLocaleString(getLocale(), { maximumFractionDigits: 1 })} ${units[unit]}`;
}

async function loadReport(session) {
  const administrator = session.role === 'ADMINISTRADOR';
  const fromInput = document.querySelector('#report-from');
  const toInput = administrator ? document.querySelector('#report-to') : fromInput;
  const searchButton = document.querySelector('#report-search');
  const downloadButton = document.querySelector('#download-cash-close');
  let currentReport = null;
  let reportRequest = 0;

  const clearResults = () => {
    ['#report-invoices', '#report-cash', '#report-digital', '#report-total'].forEach(selector => {
      document.querySelector(selector).textContent = '—';
    });
    document.querySelector('#report-period').textContent = '';
    document.querySelector('#report-history').innerHTML = `<p class="report-empty">${escapeHtml(translate('Consulta un periodo para ver las facturas.'))}</p>`;
  };

  const showReport = async () => {
    const requestId = ++reportRequest;
    const from = fromInput.value;
    const to = toInput.value;
    const message = document.querySelector('#report-message');
    if (!from || !to || to < from) {
      currentReport = null;
      searchButton.disabled = false;
      downloadButton.disabled = true;
      clearResults();
      message.textContent = translate('Verifica las fechas: la fecha final debe ser igual o posterior a la inicial.');
      message.classList.add('is-error');
      return;
    }

    searchButton.disabled = true;
    downloadButton.disabled = true;
    message.textContent = translate('Consultando facturas…');
    message.classList.remove('is-error');
    try {
      const report = await services.reports.getHistory(session, from, to, administrator);
      if (requestId !== reportRequest) return;
      currentReport = report;
      document.querySelector('#report-invoices').textContent = currentReport.facturas;
      document.querySelector('#report-cash').textContent = `$ ${Number(currentReport.efectivo).toLocaleString(getLocale())}`;
      document.querySelector('#report-digital').textContent = `$ ${Number(currentReport.digital).toLocaleString(getLocale())}`;
      document.querySelector('#report-total').textContent = `$ ${Number(currentReport.total).toLocaleString(getLocale())}`;
      document.querySelector('#report-period').textContent = from === to ? from : `${from} — ${to}`;
      const invoices = currentReport.invoices || [];
      const rows = invoices.map(invoice => `<tr><td>${escapeHtml(invoice.invoiceNumber)}</td><td>${escapeHtml(String(invoice.issuedAt).replace('T', ' '))}</td><td>${escapeHtml(translate('Mesa {table}', { table: invoice.tableNumber }))}</td><td>${escapeHtml(translate(invoice.paymentMethod === 'EFECTIVO' ? 'Efectivo' : 'Digital'))}</td><td>$ ${Number(invoice.total).toLocaleString(getLocale())}</td>${administrator ? `<td>${escapeHtml(invoice.employee)}</td>` : ''}</tr>`).join('');
      document.querySelector('#report-history').innerHTML = invoices.length
        ? `<table class="report-table"><thead><tr><th>${escapeHtml(translate('Factura'))}</th><th>${escapeHtml(translate('Fecha y hora'))}</th><th>${escapeHtml(translate('Mesa'))}</th><th>${escapeHtml(translate('Pago'))}</th><th>${escapeHtml(translate('Total'))}</th>${administrator ? `<th>${escapeHtml(translate('Pedido abierto por'))}</th>` : ''}</tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="report-empty">${escapeHtml(translate('No hay facturas para el periodo seleccionado.'))}</p>`;
      message.textContent = translate(invoices.length === 1 ? '{count} factura encontrada.' : '{count} facturas encontradas.', { count: invoices.length });
      downloadButton.disabled = false;
    } catch (error) {
      if (requestId !== reportRequest) return;
      currentReport = null;
      clearResults();
      message.textContent = translate('No se pudo consultar el historial: {detail}', { detail: error.message });
      message.classList.add('is-error');
    } finally {
      if (requestId === reportRequest) searchButton.disabled = false;
    }
  };

  searchButton.addEventListener('click', showReport);
  [fromInput, ...(administrator ? [toInput] : [])].forEach(input => input.addEventListener('change', () => {
    reportRequest += 1;
    searchButton.disabled = false;
    currentReport = null;
    downloadButton.disabled = true;
    clearResults();
    const message = document.querySelector('#report-message');
    message.textContent = translate('Consulta las fechas seleccionadas para cargar el reporte.');
    message.classList.remove('is-error');
  }));
  downloadButton.addEventListener('click', () => {
    if (!currentReport) return;
    try {
      downloadCashCloseXlsx(currentReport, administrator);
      showToast(translate('Historial de facturas descargado en Excel.'));
    } catch (error) {
      showToast(translate('No se pudo descargar el reporte: {detail}', { detail: error.message }), true);
    }
  });
  await showReport();
}

async function logout(session, inactivity = false, notifyServer = true) {
  const sessionToClose = session || currentSession;
  if (!sessionToClose) return;
  clearIdleMonitoring();
  clearSessionValidation();
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
  globalThis.__GESTOURANT_PUBLIC_HOME__?.(authNotice);
  if (!notifyServer) return;
  try {
    await services.auth.logout(sessionToClose);
    logger.info('Logout completed', { username: sessionToClose.username });
  } catch (error) {
    logger.warn('Server logout could not be recorded', { message: error.message });
    if (!inactivity) showToast(translate('La sesión local se cerró, pero no se pudo registrar el cierre en el servidor.'), true);
  }
}

function renderTables() {
  const grid = document.querySelector('#table-grid');
  if (!grid) return;
  const arranging = document.querySelector('#arrange-floor')?.checked || false;
  grid.innerHTML = tables.length ? tables.map((table, index) => {
    const status = table.billRequested ? 'Pide la cuenta' : table.status === 'LIBRE' ? 'Disponible' : 'En servicio';
    const accessibleStatus = table.status === 'LIBRE' ? translate('disponible') : translate('En servicio');
    const billRequest = table.billRequested ? `, ${translate('pidió la cuenta')}` : '';
    return `<div class="floor-table-wrap" style="left:${Number(table.floorX ?? (15 + (index % 4) * 22))}%;top:${Number(table.floorY ?? (18 + (Math.floor(index / 4) % 4) * 22))}%">
    <button type="button" class="floor-table-button ${table.status === 'OCUPADA' ? 'busy' : ''} ${table.billRequested ? 'bill-requested' : ''}" data-id="${table.id}" aria-label="${escapeHtml(translate('Mesa'))} ${table.tableNumber}, ${escapeHtml(accessibleStatus)}, ${table.seats} ${escapeHtml(translate('Puestos'))}${escapeHtml(billRequest)}">
      <span class="table-graphic">${diningTableIcon()}</span><span class="table-card-number">${String(table.tableNumber).padStart(2, '0')}</span>
      <span class="table-card-info"><strong>${escapeHtml(translate('Mesa'))} ${table.tableNumber}</strong><small>${table.seats} ${escapeHtml(translate('Puestos'))}${table.joinedTableId ? ` · ${escapeHtml(translate('Salón unido'))}` : ''}</small></span>
      <span class="table-card-status"><i></i>${escapeHtml(translate(status))}</span></button>
    <button type="button" class="floor-qr-button" data-qr-id="${table.id}" aria-label="${escapeHtml(translate('Ver QR de Mesa {table}', { table: table.tableNumber }))}">QR</button></div>`;
  }).join('') : `<div class="menu-empty"><span>＋</span><h3>${escapeHtml(translate('Aún no hay mesas'))}</h3><p>${escapeHtml(translate('Configura la sala para comenzar a recibir pedidos.'))}</p></div>`;
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
    showToast(translate(arrangeToggle.checked ? 'Arrastra una mesa para cambiar su ubicación.' : 'Ubicación del croquis guardada.'));
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
      showToast(translate('Ubicación de mesa guardada.'));
    } catch (error) {
      showToast(translate('No se pudo guardar la ubicación: {detail}', { detail: error.message }), true);
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
  activeQrTable = table;
  const renderId = ++activeQrRenderId;
  const url = new URL('/', window.location.origin);
  url.searchParams.set('mesa', table.qrToken);
  const localOnly = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  try {
    const image = await QRCode.toDataURL(url.toString(), { width: 360, margin: 2, color: { dark: '#153f35', light: '#ffffff' } });
    if (activeQrRenderId !== renderId || activeQrTable !== table) return;
    document.querySelector('#table-qr-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'table-qr-overlay';
    overlay.className = 'table-qr-overlay';
    overlay.innerHTML = `<section class="table-qr-card" role="dialog" aria-modal="true" aria-labelledby="table-qr-title"><button type="button" class="table-qr-close" aria-label="${escapeHtml(translate('Cerrar'))}">×</button>${languagePicker()}<p class="eyebrow">${escapeHtml(translate('MENÚ DIGITAL'))}</p><h2 id="table-qr-title">${escapeHtml(translate('Mesa'))} ${table.tableNumber}</h2><img src="${image}" alt="${escapeHtml(translate('Código QR para que los clientes de la Mesa {table} abran el menú', { table: table.tableNumber }))}"><p>${escapeHtml(translate('Escanea para ver la cuenta, explorar la carta y enviar pedidos al equipo.'))}</p>${localOnly ? `<p class="table-qr-local-note">${escapeHtml(translate('Este QR usa la dirección local de este computador. Para probarlo aquí, mantén Gestourant abierto. Para escanearlo con un celular, abre Gestourant desde la dirección IP local del computador y genera el QR de nuevo.'))}</p>` : ''}<a class="table-qr-url" href="${escapeHtml(url.toString())}" target="_blank" rel="noopener">${escapeHtml(translate('Probar enlace: {url}', { url: url.toString() }))}</a><div class="table-qr-actions"><button type="button" class="outline" data-print-qr>${escapeHtml(translate('Imprimir código'))}</button><button type="button" class="primary" data-close-qr>${escapeHtml(translate('Listo'))}</button></div></section>`;
    document.body.appendChild(overlay);
    bindLanguagePicker(overlay);
    const close = () => {
      if (activeQrTable === table) {
        activeQrTable = null;
        activeQrRenderId += 1;
      }
      overlay.remove();
    };
    overlay.querySelector('.table-qr-close').addEventListener('click', close);
    overlay.querySelector('[data-close-qr]').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('[data-print-qr]').addEventListener('click', () => window.print());
  } catch (error) {
    if (activeQrRenderId === renderId && activeQrTable === table) {
      showToast(translate('No se pudo generar el código QR: {detail}', { detail: error.message }), true);
    }
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
    queue.innerHTML = requests.length ? requests.map(request => `<article class="staff-request-card" data-request-id="${request.id}"><div class="staff-request-header"><div><span class="staff-request-table">${escapeHtml(translate('MESA {table}', { table: request.tableNumber }))}</span><h2>${escapeHtml(translate('Solicitud #{id}', { id: request.id }))}</h2></div><time>${new Date(request.createdAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}</time></div><div class="staff-request-items">${request.items.map(item => `<div><span><strong>${item.quantity} × ${escapeHtml(translate(item.name))}</strong>${item.removedIngredients ? `<small>⚠ ${escapeHtml(translate('Sin'))} ${escapeHtml(item.removedIngredients)}</small>` : ''}</span><strong>$ ${Number(item.subtotal).toLocaleString(getLocale())}</strong></div>`).join('')}</div><div class="staff-request-footer"><strong>${escapeHtml(translate('Total estimado · $ {amount} COP', { amount: Number(request.total).toLocaleString(getLocale()) }))}</strong><div><button class="outline reject-guest-request" type="button">${escapeHtml(translate('Rechazar'))}</button><button class="primary approve-guest-request" type="button">${escapeHtml(translate('Confirmar y enviar a cocina'))}</button></div></div></article>`).join('') : `<div class="staff-request-empty"><span>✓</span><h2>${escapeHtml(translate('Todo al día'))}</h2><p>${escapeHtml(translate('No hay solicitudes pendientes. Las nuevas solicitudes aparecerán aquí automáticamente.'))}</p></div>`;
    queue.querySelectorAll('.approve-guest-request').forEach(button => button.addEventListener('click', () => resolveGuestRequest(button, session, 'approve')));
    queue.querySelectorAll('.reject-guest-request').forEach(button => button.addEventListener('click', () => resolveGuestRequest(button, session, 'reject')));
  } catch (error) {
    queue.innerHTML = `<div class="staff-request-error"><strong>${escapeHtml(translate('No pudimos cargar las solicitudes.'))}</strong><p>${escapeHtml(error.message)}</p><button class="outline" type="button" id="retry-guest-requests">${escapeHtml(translate('Intentar de nuevo'))}</button></div>`;
    queue.querySelector('#retry-guest-requests').addEventListener('click', () => loadGuestRequests(session));
  }
}

async function updateGuestRequestBadge(session) {
  const badge = document.querySelector('#nav-pending-count');
  try {
    const requests = await services.guest.listStaffRequests(session);
    globalThis.__GESTOURANT_PENDING_REQUEST_COUNT_CHANGED__?.(requests.length);
    if (!badge) return;
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
      return `<article class="staff-request-card kitchen-ticket ${preparing ? 'is-preparing' : ''}" data-kitchen-request-id="${request.id}"><div class="staff-request-header"><div><span class="staff-request-table">${escapeHtml(translate('MESA {table}', { table: request.tableNumber }))} · ${escapeHtml(translate('COMANDA #{id}', { id: request.id }))}</span><h2>${escapeHtml(translate(preparing ? 'En preparación' : 'Nueva comanda'))}</h2></div><time>${new Date(request.createdAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}</time></div><div class="staff-request-items">${request.items.map(item => `<div><span><strong>${item.quantity} × ${escapeHtml(translate(item.name))}</strong>${item.removedIngredients ? `<small class="kitchen-modification">⚠ ${escapeHtml(translate('PREPARAR SIN: {ingredients} · CONFIRMAR CON COCINA', { ingredients: item.removedIngredients }))}</small>` : ''}</span></div>`).join('')}</div><div class="staff-request-footer"><strong>${escapeHtml(translate(preparing ? 'La preparación está en curso' : 'Confirmado · agregado a la cuenta'))}</strong><div><button type="button" class="primary advance-kitchen-request">${escapeHtml(translate(preparing ? 'Marcar listo para servir' : 'Iniciar preparación'))}</button></div></div></article>`;
    }).join('') : `<div class="staff-request-empty"><span>✓</span><h2>${escapeHtml(translate('Cocina al día'))}</h2><p>${escapeHtml(translate('Las solicitudes aparecerán aquí después de que el equipo las confirme.'))}</p></div>`;
    queue.querySelectorAll('.advance-kitchen-request').forEach(button => button.addEventListener('click', () => advanceKitchenRequest(button, session)));
  } catch (error) {
    queue.innerHTML = `<div class="staff-request-error"><strong>${escapeHtml(translate('No pudimos cargar las comandas.'))}</strong><p>${escapeHtml(error.message)}</p><button class="outline" type="button" id="retry-kitchen-requests">${escapeHtml(translate('Intentar de nuevo'))}</button></div>`;
    queue.querySelector('#retry-kitchen-requests').addEventListener('click', () => loadKitchenRequests(session));
  }
}

async function advanceKitchenRequest(button, session) {
  const card = button.closest('[data-kitchen-request-id]');
  button.disabled = true;
  try {
    await services.kitchen.advanceRequest(session, card.dataset.kitchenRequestId);
    showToast(translate('Estado de cocina actualizado.'));
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
    showToast(translate(action === 'approve' ? 'Pedido confirmado, agregado a la cuenta y enviado a cocina.' : 'Solicitud rechazada.'));
    await loadGuestRequests(session);
    if (action === 'approve') await loadTables(session);
  } catch (error) {
    showToast(error.message, true);
    card.querySelectorAll('button').forEach(control => { control.disabled = false; });
  }
}

function renderTableDetail(table, session) {
  const detail = document.querySelector('#detail');
  if (!detail) return;
  const adminActions = session.role === 'ADMINISTRADOR' ? `<div class="detail-actions"><button id="edit-table" class="outline">${escapeHtml(translate('Editar mesa'))}</button><button id="delete-table" class="danger">${escapeHtml(translate('Eliminar'))}</button>${table.joinedTableId ? `<button id="unjoin-table" class="outline full">${escapeHtml(translate('Separar mesas'))}</button>` : ''}</div>` : '';
  detail.classList.add('open');
  detail.innerHTML = `<div class="detail-content" data-table-id="${table.id}"><div class="detail-topline"><span class="table-number">${String(table.tableNumber).padStart(2, '0')}</span><button id="close-table-detail" class="icon-button" type="button" aria-label="${escapeHtml(translate('Cerrar detalle'))}">${icon('close')}</button></div><span class="service-pill ${table.status === 'OCUPADA' ? 'is-busy' : 'is-free'}"><i></i>${escapeHtml(translate(table.status === 'LIBRE' ? 'Disponible' : 'En servicio'))}</span><h2>${escapeHtml(translate('Mesa'))} ${table.tableNumber}</h2><p class="muted">${escapeHtml(translate('Aforo: {seats} · Salón principal', { seats: table.seats }))}${table.joinedTableId ? ` · ${escapeHtml(translate('Mesa unida'))}` : ''}</p><button id="show-table-qr" class="outline table-detail-qr" type="button">▦ ${escapeHtml(translate('Mostrar QR de menú'))}</button>${table.billRequested ? `<p class="bill-request-alert">${escapeHtml(translate('El cliente está solicitando la cuenta.'))}</p>` : ''}<div class="detail-separator"></div><div class="detail-row"><span>${escapeHtml(translate('Estado de mesa'))}</span><strong>${escapeHtml(translate(table.status === 'LIBRE' ? 'Lista para recibir' : 'Cuenta abierta'))}</strong></div><div id="order-detail"></div>${table.status === 'LIBRE' ? `<button id="table-action" class="primary"><span>${escapeHtml(translate('Abrir cuenta'))}</span>${icon('arrow')}</button><p class="table-action-hint">${escapeHtml(translate('Empieza el servicio y registra el primer pedido.'))}</p>` : `<div class="order-loading"><span class="loading-dot"></span> ${escapeHtml(translate('Cargando cuenta abierta…'))}</div>`}${adminActions}</div>`;
  document.querySelector('#close-table-detail').addEventListener('click', () => { detail.classList.remove('open'); document.querySelectorAll('.floor-table-button').forEach(card => card.classList.remove('selected')); activeOrder = null; });
  document.querySelector('#show-table-qr').addEventListener('click', () => showTableQr(table));
  document.querySelector('#table-action')?.addEventListener('click', () => openTable(table.id, session));
  if (session.role === 'ADMINISTRADOR') { document.querySelector('#edit-table').addEventListener('click', () => editTable(table, session)); document.querySelector('#delete-table').addEventListener('click', () => deleteTable(table, session)); document.querySelector('#unjoin-table')?.addEventListener('click', () => unjoinTable(table, session)); }
}

async function selectTable(id) {
  const table = tables.find(item => item.id === id), detail = document.querySelector('#detail');
  if (!table || !detail) return;
  activeOrder = null;
  document.querySelectorAll('.floor-table-button').forEach(card => card.classList.toggle('selected', Number(card.dataset.id) === id));
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  renderTableDetail(table, session);
  if (table.status === 'OCUPADA') await loadOpenOrder(table.id, session);
}

async function editTable(table, session) { const tableNumber = Number(window.prompt(translate('Número de mesa:'), table.tableNumber)); const seats = Number(window.prompt(translate('Cantidad de puestos:'), table.seats)); if (!tableNumber || !seats) return; try { await services.tables.update(session, table.id, { tableNumber, seats }); showToast(translate('Mesa actualizada.')); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
async function deleteTable(table, session) { if (!window.confirm(translate('¿Eliminar la Mesa {table}?', { table: table.tableNumber }))) return; try { await services.tables.remove(session, table.id); showToast(translate('Mesa eliminada.')); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
async function unjoinTable(table, session) { if (!table.joinedTableId) return; try { await services.tables.unjoin(session, { firstTableId: table.id, secondTableId: table.joinedTableId }); showToast(translate('Mesas separadas.')); navigate('tables', session); } catch (error) { showToast(error.message, true); } }

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
    showToast(translate('El pedido sí se guardó, pero no se pudo actualizar el menú: {detail}', { detail: error.message }), true);
    return false;
  }
}

async function addProduct(productId) {
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  if (!activeOrder) { showToast(translate('Selecciona una mesa ocupada o abre una mesa antes de agregar productos.'), true); return; }
  try {
    const updatedOrder = await services.orders.addProduct(session, activeOrder.id, productId);
    if (await refreshOrderDetail(updatedOrder, session)) showToast(translate('Producto agregado al pedido y guardado.'));
  } catch (error) { showToast(error.message, true); }
}

async function removeOrderItem(itemId) {
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  if (!activeOrder) return;
  try {
    const updatedOrder = await services.orders.removeItem(session, activeOrder.id, itemId);
    if (await refreshOrderDetail(updatedOrder, session)) showToast(translate('Producto retirado; inventario actualizado.'));
  } catch (error) { showToast(error.message, true); }
}

async function saveItemModification(itemId, ingredients) {
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  if (!activeOrder) return;
  try {
    const updatedOrder = await services.orders.updateItem(session, activeOrder.id, itemId, ingredients);
    if (await refreshOrderDetail(updatedOrder, session)) showToast(translate(ingredients ? 'Indicación guardada y enviada al pedido.' : 'Indicación eliminada del pedido.'));
  } catch (error) { showToast(error.message, true); }
}

function renderOrderDetail(order, session) {
  const target = document.querySelector('#order-detail');
  if (!target) return;
  const availableProducts = products.filter(isAvailableForOrder);
  target.innerHTML = `<div class="order-summary"><strong>${escapeHtml(translate('Pedido #{id}', { id: order.id }))}</strong><span>$ ${Number(order.total).toLocaleString(getLocale())} COP</span></div>
    <p class="order-live-status">${escapeHtml(translate('Cambios guardados al instante'))}</p>
    <div class="order-items">${(order.items || []).map(item => `<article class="order-item" data-item-id="${item.id}">
      <div class="order-item-heading"><img class="order-item-photo" src="${escapeHtml(productPhoto(item.product))}" alt="" loading="lazy"><span><strong>${escapeHtml(translate(item.product.name))} × ${item.quantity}</strong><small>${escapeHtml(translate(item.product.category || 'PLATO'))}</small></span><strong>$ ${Number(item.subtotal).toLocaleString(getLocale())}</strong></div>
      ${item.removedIngredients ? `<p class="removed-ingredients">${escapeHtml(translate('Sin'))}: ${escapeHtml(item.removedIngredients)}</p>` : ''}
      <label class="allergy-label">${escapeHtml(translate('Ingrediente a retirar (por alergia o preferencia)'))}
        <input class="removed-ingredients-input" type="text" maxlength="500" value="${escapeHtml(item.removedIngredients || '')}" placeholder="${escapeHtml(translate('Ej. maní, queso, cilantro'))}">
      </label>
      <div class="order-item-actions"><button type="button" class="outline save-modification">${escapeHtml(translate('Guardar indicación'))}</button><button type="button" class="danger remove-order-item">${escapeHtml(translate('Quitar producto'))}</button></div>
    </article>`).join('') || `<small>${escapeHtml(translate('Aún no hay productos. Agrégalos desde el menú.'))}</small>`}</div>
    <p class="allergy-warning"><strong>${escapeHtml(translate('Atención alergias:'))}</strong> ${escapeHtml(translate('confirma la solicitud con cocina. Esta indicación no garantiza ausencia de contaminación cruzada.'))}</p>
    <section class="order-menu"><h3>${escapeHtml(translate('Agregar al pedido'))}</h3>${availableProducts.length ? availableProducts.map(product => `<div class="order-menu-product"><img src="${escapeHtml(productPhoto(product))}" alt="" loading="lazy"><div><strong>${escapeHtml(translate(product.name))}</strong><small>${escapeHtml(translate('{count} disponibles · $ {price} COP', { count: product.stock, price: Number(product.price).toLocaleString(getLocale()) }))}</small></div><button type="button" class="outline add-order-product" data-product-id="${product.id}" aria-label="${escapeHtml(translate('＋ Agregar'))} ${escapeHtml(translate(product.name))}">＋</button></div>`).join('') : `<small>${escapeHtml(translate('No hay productos disponibles en el menú.'))}</small>`}</section>
    <label class="payment-method-label">${escapeHtml(translate('Pago recibido en caja'))}<select id="payment-method"><option value="EFECTIVO">${escapeHtml(translate('Efectivo'))}</option><option value="DIGITAL">${escapeHtml(translate('Digital · Nequi, Bancolombia o tarjeta'))}</option></select></label>
    <button id="close-order" class="outline full" ${order.items?.length ? '' : 'disabled'}>${escapeHtml(translate('Registrar pago y cerrar cuenta'))}</button>`;
  target.querySelectorAll('.save-modification').forEach(button => button.addEventListener('click', () => {
    const row = button.closest('[data-item-id]');
    saveItemModification(Number(row.dataset.itemId), row.querySelector('.removed-ingredients-input').value.trim());
  }));
  target.querySelectorAll('.remove-order-item').forEach(button => button.addEventListener('click', () => removeOrderItem(Number(button.closest('[data-item-id]').dataset.itemId))));
  target.querySelectorAll('.add-order-product').forEach(button => button.addEventListener('click', () => addProduct(Number(button.dataset.productId))));
  target.querySelectorAll('img').forEach(image => image.addEventListener('error', () => { image.src = defaultFoodPhoto; }, { once: true }));
  target.querySelector('#close-order').addEventListener('click', () => closeOrder(order.id, session, target.querySelector('#payment-method').value));
}
async function closeOrder(orderId, session, paymentMethod) { try { const invoice = await services.orders.close(session, orderId, paymentMethod); activeOrder = null; showToast(translate('Factura {invoiceNumber} creada.', { invoiceNumber: invoice.invoiceNumber })); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
let toastDismissTimer;
function showToast(message, error = false) { let toast = document.querySelector('#toast'); if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.setAttribute('role', 'alert'); toast.setAttribute('aria-live', 'assertive'); document.body.appendChild(toast); } window.clearTimeout(toastDismissTimer); toast.textContent = message; toast.className = error ? 'toast error' : 'toast'; toastDismissTimer = window.setTimeout(() => toast.remove(), 3500); }


window.addEventListener('gestourant:locale-change', () => {
  updateDocumentLocale();
  const cookieNotice = document.querySelector('#cookie-notice');
  if (cookieNotice) renderCookieNotice(cookieNotice);
  if (app.querySelector('.public-home')) {
    const scrollTop = window.scrollY;
    publicHomeView();
    window.scrollTo(0, scrollTop);
  }
  const authForm = app.querySelector('.login-layout form');
  if (authForm) {
    const formId = authForm.id;
    const values = [...authForm.elements]
      .filter(field => field.name && field.name !== 'captchaToken')
      .map(field => ({ name: field.name, value: field.type === 'checkbox' ? field.checked : field.value, type: field.type }));
    const focusedName = document.activeElement?.form === authForm ? document.activeElement.name : '';
    const selection = focusedName && typeof document.activeElement.selectionStart === 'number'
      ? [document.activeElement.selectionStart, document.activeElement.selectionEnd]
      : null;
    const oauthCode = authForm.elements.code?.value;
    if (formId === 'login-form') loginView();
    else if (formId === 'register-form') registerView();
    else if (formId === 'oauth-register-form') oauthRegistrationView(oauthCode);
    const updatedForm = app.querySelector(`#${formId}`);
    values.forEach(({ name, value, type }) => {
      const field = updatedForm?.elements.namedItem(name);
      if (!field) return;
      if (type === 'checkbox') field.checked = value;
      else field.value = value;
    });
    const focusedField = focusedName ? updatedForm?.elements.namedItem(focusedName) : null;
    focusedField?.focus({ preventScroll: true });
    if (selection && focusedField?.setSelectionRange) focusedField.setSelectionRange(...selection);
  }
  const content = document.querySelector('#content');
  if (currentSession) {
    const restaurantName = document.querySelector('.restaurant > div > strong');
    if (restaurantName) restaurantName.textContent = translate('Restaurante Central');
    const roleLabel = document.querySelector('.restaurant > div > small');
    if (roleLabel) roleLabel.textContent = `${translate(currentSession.role === 'ADMINISTRADOR' ? 'Administrador' : 'Empleado')} · ${translate('Turno activo')}`;
    const viewLabels = {
      overview: 'Resumen',
      tables: 'Mesas',
      orders: 'Pedidos',
      kitchen: 'Cocina',
      products: 'Menú e inventario',
      reports: 'Reportes',
      backups: 'Copias de seguridad',
      audit: 'Registro de auditoría',
    };
    document.querySelectorAll('.sidebar nav [data-view]').forEach(link => {
      const label = link.querySelector('span');
      if (label && viewLabels[link.dataset.view]) label.textContent = translate(viewLabels[link.dataset.view]);
    });
    const nav = document.querySelector('.sidebar nav');
    if (nav) nav.setAttribute('aria-label', translate('Navegación principal'));
    const logoutButton = document.querySelector('#logout');
    if (logoutButton) logoutButton.innerHTML = `↪ ${escapeHtml(translate('Cerrar sesión'))}`;
    document.querySelectorAll('.theme-button').forEach(button => {
      const theme = themeOptions.find(option => option.id === button.dataset.theme);
      if (!theme) return;
      button.title = translate('Tema {theme}', { theme: translate(theme.label) });
      button.querySelector('small').textContent = translate(theme.label);
    });
    if (content?.querySelector('#report-from')) {
      const from = content.querySelector('#report-from').value;
      const to = content.querySelector('#report-to')?.value;
      content.innerHTML = reportsView(currentSession);
      content.querySelector('#report-from').value = from;
      if (to) content.querySelector('#report-to').value = to;
      void loadReport(currentSession);
    } else if (content?.querySelector('#backup-history')) {
      content.innerHTML = backupsView();
      void loadBackups(currentSession);
    } else if (content?.querySelector('#audit-history')) {
      content.innerHTML = auditLogsView();
      void loadAuditLogs(currentSession, auditCurrentPage);
    }
    if (content?.querySelector('#overview-busy')) {
      content.innerHTML = overviewView(currentSession);
      void loadOverview(currentSession);
    }
    const emptyDetail = document.querySelector('#detail .detail-empty');
    if (emptyDetail) {
      emptyDetail.innerHTML = `<span>${icon('tables')}</span><h3>${escapeHtml(translate('Selecciona una mesa'))}</h3><p>${escapeHtml(translate('Verás aquí el resumen de la atención.'))}</p>`;
    }
  }
  if (currentSession && content?.querySelector('#product-list')) {
    const search = document.querySelector('#product-search')?.value ?? '';
    const previousForm = document.querySelector('#create-product-form');
    const formState = previousForm ? {
      editingId: previousForm.dataset.editingId,
      open: previousForm.closest('details').open,
      name: previousForm.elements.name.value,
      category: previousForm.elements.category.value,
      description: previousForm.elements.description.value,
      imageUrl: previousForm.elements.imageUrl.value,
      price: previousForm.elements.price.value,
      stock: previousForm.elements.stock.value,
      active: previousForm.elements.active.checked,
    } : null;
    content.innerHTML = productsView(currentSession);
    bindProductAdmin(currentSession);
    bindProductViewControls(currentSession);
    const searchInput = document.querySelector('#product-search');
    if (searchInput) searchInput.value = search;
    if (formState) {
      const form = document.querySelector('#create-product-form');
      form.closest('details').open = formState.open;
      form.dataset.editingId = formState.editingId;
      form.elements.name.value = formState.name;
      form.elements.category.value = formState.category;
      form.elements.description.value = formState.description;
      form.elements.imageUrl.value = formState.imageUrl;
      form.elements.price.value = formState.price;
      form.elements.stock.value = formState.stock;
      form.elements.active.checked = formState.active;
      if (formState.editingId) {
        document.querySelector('#product-form-title').textContent = translate('Editar producto');
        document.querySelector('#product-submit').textContent = translate('Guardar cambios');
        document.querySelector('#cancel-product-edit').classList.remove('hidden-field');
      }
    }
    renderProducts();
  }
  if (currentSession && content?.querySelector('#table-grid')) {
    const arrangeTables = document.querySelector('#arrange-floor')?.checked ?? false;
    const tableToolsOpen = content.querySelector('.table-tools')?.open ?? false;
    content.innerHTML = tablesView(currentSession);
    content.querySelector('.table-tools')?.toggleAttribute('open', tableToolsOpen);
    bindTableAdmin(currentSession);
    const arrangeToggle = document.querySelector('#arrange-floor');
    if (arrangeToggle) arrangeToggle.checked = arrangeTables;
    renderTables();
  }
  if (currentSession && document.querySelector('#guest-request-queue')) void loadGuestRequests(currentSession);
  if (currentSession && document.querySelector('#kitchen-request-queue')) void loadKitchenRequests(currentSession);
  const detailPanel = document.querySelector('#detail');
  const tableDetail = detailPanel?.querySelector('.detail-content');
  const table = tableDetail && tables.find(item => item.id === Number(tableDetail.dataset.tableId));
  if (detailPanel?.classList.contains('open') && table && currentSession) {
    const orderDetail = document.querySelector('#order-detail');
    const notes = new Map([...orderDetail.querySelectorAll('[data-item-id]')].map(row => [row.dataset.itemId, row.querySelector('.removed-ingredients-input')?.value ?? '']));
    const payment = orderDetail.querySelector('#payment-method')?.value;
    renderTableDetail(table, currentSession);
    if (activeOrder) renderOrderDetail(activeOrder, currentSession);
    document.querySelectorAll('#order-detail [data-item-id]').forEach(row => {
      const input = row.querySelector('.removed-ingredients-input');
      if (input && notes.has(row.dataset.itemId)) input.value = notes.get(row.dataset.itemId);
    });
    if (payment) document.querySelector('#order-detail #payment-method').value = payment;
  }
  if (activeQrTable && document.querySelector('#table-qr-overlay')) void showTableQr(activeQrTable);
});

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

  globalThis.__GESTOURANT_AUTH_CONFIG_CHANGED__?.(authConfig);
  globalThis.__GESTOURANT_NOTICE_CHANGED__?.(authNotice);
  const stored = sessionStorage.getItem('gestourant_session');
  if (stored) dashboardView(JSON.parse(stored));
  else if (oauthRegistrationCode && !globalThis.__GESTOURANT_AUTH_ACTIVE__) oauthRegistrationView(oauthRegistrationCode);
  else if ((oauthCode || oauthError) && !globalThis.__GESTOURANT_AUTH_ACTIVE__) loginView();
  else if (!globalThis.__GESTOURANT_AUTH_ACTIVE__) publicHomeView();
}

export function startGestourantApp(applicationServices, applicationLogger, apiBaseUrl = '') {
  updateDocumentLocale();
  services = applicationServices;
  logger = applicationLogger;
  apiBase = apiBaseUrl;
  globalThis.__GESTOURANT_AUTH__ = services.auth;
  globalThis.__GESTOURANT_TABLES__ = {
    list: session => services.tables.list(session),
    create: (session, table) => services.tables.create(session, table),
    join: (session, tableIds) => services.tables.join(session, tableIds),
    updatePosition: (session, id, position) => services.tables.updatePosition(session, id, position)
  };
  globalThis.__GESTOURANT_REQUESTS__ = {
    listOrders: session => services.guest.listStaffRequests(session),
    approve: (session, id) => services.guest.approveStaffRequest(session, id),
    reject: (session, id) => services.guest.rejectStaffRequest(session, id),
    listKitchen: session => services.kitchen.listRequests(session),
    advanceKitchen: (session, id) => services.kitchen.advanceRequest(session, id)
  };
  globalThis.__GESTOURANT_PRODUCTS__ = {
    list: session => services.products.list(session),
    save: (session, product, id) => services.products.save(session, product, id),
    remove: (session, id) => services.products.remove(session, id)
  };
  globalThis.__GESTOURANT_REPORTS__ = {
    getHistory: (session, from, to, administrator) => services.reports.getHistory(session, from, to, administrator)
  };
  globalThis.__GESTOURANT_DOWNLOAD_REPORT__ = async (report, includeEmployee) => downloadCashCloseXlsx(report, includeEmployee);
  globalThis.__GESTOURANT_BACKUPS__ = {
    list: session => services.backups.list(session),
    create: session => services.backups.create(session),
    download: (session, id) => services.backups.download(session, id),
    restore: (session, id) => services.backups.restore(session, id)
  };
  globalThis.__GESTOURANT_AUDIT__ = {
    list: (session, page, size) => services.audit.list(session, page, size)
  };
  globalThis.__GESTOURANT_PRODUCT_PHOTO__ = product => productPhoto(product);
  globalThis.__GESTOURANT_ADD_ORDER_PRODUCT__ = async productId => {
    if (!currentSession || !activeOrder) throw new Error('Abre una cuenta antes de agregar productos.');
    const updatedOrder = await services.orders.addProduct(currentSession, activeOrder.id, productId);
    if (!await refreshOrderDetail(updatedOrder, currentSession)) {
      throw new Error('No se pudo actualizar el detalle del pedido.');
    }
    showToast(translate('Producto agregado al pedido y guardado.'));
  };
  globalThis.__GESTOURANT_GET_ACTIVE_ORDER__ = async () => activeOrder
    ? { id: activeOrder.id, tableNumber: activeOrder.table.tableNumber }
    : null;
  globalThis.__GESTOURANT_SHOW_TABLE_QR__ = table => showTableQr(table);
  globalThis.__GESTOURANT_OPEN_TABLE_DETAIL__ = async tableId => {
    if (!currentSession) throw new Error('No hay una sesión activa para abrir el detalle de la mesa.');
    await navigate('tables', currentSession);
    if (!tables.some(table => table.id === tableId)) throw new Error('La mesa seleccionada ya no está disponible.');
    await selectTable(tableId);
  };
  globalThis.__GESTOURANT_LOAD_DASHBOARD_OVERVIEW__ = async session => {
    const [loadedTables, loadedProducts] = await Promise.all([
      services.tables.list(session),
      services.products.list(session)
    ]);
    tables = loadedTables;
    products = loadedProducts;
    return {
      occupiedTables: tables.filter(table => table.status === 'OCUPADA').length,
      availableTables: tables.filter(table => table.status === 'LIBRE').length,
      lowStockProducts: products.filter(product => product.active && product.stock <= 5).length
    };
  };
  globalThis.__GESTOURANT_OPEN_LEGACY_VIEW__ = view => {
    if (!currentSession) throw new Error('No hay una sesión activa para abrir esta sección.');
    return navigate(view, currentSession);
  };
  globalThis.__GESTOURANT_LOGOUT__ = () => logout(currentSession);
  globalThis.__GESTOURANT_AUTH_INITIALIZED__ = initializeApplication();
  globalThis.__GESTOURANT_COMPLETE_AUTH__ = session => {
    const previousSessionClosed = session.previousSessionClosed === true;
    session.previousSessionClosed = false;
    sessionStorage.setItem('gestourant_session', JSON.stringify(session));
    dashboardView(session);
    if (previousSessionClosed) {
      showToast(translate('La sesión que estaba abierta en otro navegador se cerró para proteger esta cuenta.'));
    }
  };
  const applicationReady = globalThis.__GESTOURANT_AUTH_INITIALIZED__;
  globalThis.__GESTOURANT_OPEN_AUTH__ = async mode => {
    await applicationReady;
    authNotice = '';
    if (mode === 'register') registerView();
    else loginView();
    window.scrollTo(0, 0);
  };
}
