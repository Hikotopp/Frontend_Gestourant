import './style.css';

const app = document.querySelector('#app');
const apiBase = import.meta.env.VITE_API_URL || '';
const tables = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `Mesa ${index + 1}`, seats: index % 3 === 0 ? 4 : 2, status: index === 1 || index === 7 ? 'Ocupada' : 'Disponible' }));

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function loginView() {
  app.innerHTML = `
    <main class="login-layout">
      <section class="brand-panel">
        <div class="brand"><span class="brand-mark">G</span>Gestourant</div>
        <div class="hero-copy"><p class="eyebrow">OPERACIÓN INTELIGENTE</p><h1>Tu restaurante, en perfecto ritmo.</h1><p>Organiza tu sala, atiende con claridad y toma decisiones desde un solo lugar.</p></div>
        <div class="feature"><span>✦</span><div><strong>Todo bajo control</strong><small>Mesas, pedidos y tu operación diaria.</small></div></div>
      </section>
      <section class="login-panel"><form id="login-form" class="login-card">
        <p class="eyebrow accent">BIENVENIDO</p><h2>Inicia sesión</h2><p class="muted">Ingresa a tu espacio de trabajo.</p>
        <label>Correo o usuario<input id="identifier" name="identifier" autocomplete="username" placeholder="ej. maria@restaurante.com" required /></label>
        <label>Contraseña<div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required /><button type="button" id="toggle-password" aria-label="Mostrar contraseña">◉</button></div></label>
        <p id="login-error" class="form-message" role="alert"></p>
        <button id="login-button" class="primary" type="submit">Entrar a Gestourant <span>→</span></button>
        <p class="demo-note">¿Aún no tienes cuenta? <button type="button" class="text-button" id="show-register">Crear cuenta</button></p>
      </form></section>
    </main>`;
  document.querySelector('#toggle-password').addEventListener('click', () => {
    const field = document.querySelector('#password'); field.type = field.type === 'password' ? 'text' : 'password';
  });
  document.querySelector('#login-form').addEventListener('submit', authenticate);
  document.querySelector('#show-register').addEventListener('click', registerView);
}

function registerView() {
  app.innerHTML = `<main class="login-layout"><section class="brand-panel"><div class="brand"><span class="brand-mark">G</span>Gestourant</div><div class="hero-copy"><p class="eyebrow">EMPIEZA HOY</p><h1>La operación clara comienza aquí.</h1><p>Crea tu acceso y conoce el espacio de trabajo de Gestourant.</p></div><div class="feature"><span>✦</span><div><strong>Tu información, protegida</strong><small>Acceso personal para cada miembro del equipo.</small></div></div></section><section class="login-panel"><form id="register-form" class="login-card"><p class="eyebrow accent">NUEVA CUENTA</p><h2>Crear cuenta</h2><p class="muted">Completa tus datos para comenzar.</p><label>Nombre de usuario<input name="username" autocomplete="username" placeholder="ej. maria.lopez" required minlength="3" /></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" placeholder="maria@restaurante.com" required /></label><label>Contraseña<div class="password-wrap"><input id="register-password" name="password" type="password" autocomplete="new-password" placeholder="Mínimo 10 caracteres y un número" required minlength="10" /><button type="button" id="toggle-password" aria-label="Mostrar contraseña">◉</button></div></label><p id="register-error" class="form-message" role="alert"></p><button id="register-button" class="primary" type="submit">Crear mi cuenta <span>→</span></button><p class="demo-note">¿Ya tienes cuenta? <button type="button" class="text-button" id="show-login">Iniciar sesión</button></p></form></section></main>`;
  document.querySelector('#toggle-password').addEventListener('click', () => { const field = document.querySelector('#register-password'); field.type = field.type === 'password' ? 'text' : 'password'; });
  document.querySelector('#show-login').addEventListener('click', loginView);
  document.querySelector('#register-form').addEventListener('submit', register);
}

async function authenticate(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget), button = document.querySelector('#login-button'), message = document.querySelector('#login-error');
  const credentials = { identifier: form.get('identifier').trim(), password: form.get('password') };
  message.textContent = ''; button.disabled = true; button.textContent = 'Ingresando…';
  try {
    const response = await fetch(`${apiBase}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'No fue posible iniciar sesión. Verifica tus datos.');
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) {
    message.textContent = error instanceof TypeError ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.' : error.message;
  } finally { button.disabled = false; button.innerHTML = 'Entrar a Gestourant <span>→</span>'; }
}

async function register(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget), button = document.querySelector('#register-button'), message = document.querySelector('#register-error');
  const account = { username: form.get('username').trim(), email: form.get('email').trim(), password: form.get('password') };
  if (!/\d/.test(account.password)) { message.textContent = 'La contraseña debe incluir al menos un número.'; return; }
  message.textContent = ''; button.disabled = true; button.textContent = 'Creando cuenta…';
  try {
    const response = await fetch(`${apiBase}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'No fue posible crear la cuenta. Revisa los datos e inténtalo de nuevo.');
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) { message.textContent = error instanceof TypeError ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.' : error.message; }
  finally { button.disabled = false; button.innerHTML = 'Crear mi cuenta <span>→</span>'; }
}

function dashboardView(session) {
  const user = escapeHtml(session.username || 'Equipo');
  app.innerHTML = `<main class="dashboard"><aside class="sidebar"><div class="brand"><span class="brand-mark">G</span>Gestourant</div><div class="restaurant"><span class="avatar">${user.charAt(0).toUpperCase()}</span><div><strong>Restaurante Central</strong><small>Operación activa</small></div></div><nav><a class="active">⌘ <span>Mesas</span></a><a>▤ <span>Pedidos</span></a><a>◫ <span>Inventario</span></a><a>◌ <span>Reportes</span></a></nav><button id="logout" class="logout">↪ Cerrar sesión</button></aside><section class="workspace"><header><div><p class="eyebrow">SALA PRINCIPAL</p><h1>Buenas tardes, ${user}</h1><p class="muted">Así está tu operación en este momento.</p></div><div class="header-actions"><span class="date">● En vivo</span><button class="outline">＋ Nueva venta</button></div></header><section class="metrics"><article><span>Mesas activas</span><strong>02 <em>/ 12</em></strong><small class="up">↗ Sala al 17% de ocupación</small></article><article><span>Ventas del día</span><strong>$ 428.000</strong><small>Actualizado ahora</small></article><article><span>Ticket promedio</span><strong>$ 54.500</strong><small class="up">↗ 8% frente a ayer</small></article></section><section class="room"><div class="room-head"><div><h2>Mesas</h2><p>Selecciona una mesa para comenzar a atender.</p></div><div class="legend"><i></i> Disponible <i class="occupied"></i> Ocupada</div></div><div id="table-grid" class="table-grid"></div></section></section><aside id="detail" class="detail"><div class="detail-empty"><span>⌁</span><h3>Selecciona una mesa</h3><p>Verás aquí el resumen de la atención.</p></div></aside></main>`;
  document.querySelector('#logout').addEventListener('click', () => logout(session));
  renderTables();
}

async function logout(session) {
  try {
    await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
  } finally {
    sessionStorage.removeItem('gestourant_session');
    loginView();
  }
}

function renderTables() {
  const grid = document.querySelector('#table-grid');
  grid.innerHTML = tables.map(table => `<button class="table-card ${table.status === 'Ocupada' ? 'busy' : ''}" data-id="${table.id}"><span class="table-icon">♜</span><span><strong>${table.name}</strong><small>${table.seats} puestos</small></span><b>${table.status}</b><span>›</span></button>`).join('');
  grid.querySelectorAll('button').forEach(button => button.addEventListener('click', () => selectTable(Number(button.dataset.id))));
}

function selectTable(id) {
  const table = tables.find(item => item.id === id), detail = document.querySelector('#detail');
  document.querySelectorAll('.table-card').forEach(card => card.classList.toggle('selected', Number(card.dataset.id) === id));
  detail.innerHTML = `<div class="detail-content"><span class="table-number">${String(id).padStart(2, '0')}</span><p class="eyebrow accent">${table.status}</p><h2>${table.name}</h2><p class="muted">${table.seats} puestos · Sala principal</p><hr/><div class="detail-row"><span>Estado</span><strong>${table.status}</strong></div><div class="detail-row"><span>Inicio</span><strong>${table.status === 'Ocupada' ? '12:40 p. m.' : 'Sin atención'}</strong></div><button class="primary">${table.status === 'Disponible' ? 'Abrir mesa' : 'Ver pedido'} <span>→</span></button></div>`;
}

const stored = sessionStorage.getItem('gestourant_session');
stored ? dashboardView(JSON.parse(stored)) : loginView();
