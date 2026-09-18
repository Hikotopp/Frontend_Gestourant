import './style.css';
import { createHttpApiAdapter } from './infrastructure/httpApiAdapter';
import { logger } from './infrastructure/logger';

const app = document.querySelector('#app');
const apiBase = import.meta.env.VITE_API_URL || '';
const api = createHttpApiAdapter(apiBase);
let tables = [];
let products = [];
let activeOrder = null;
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

function loginView() {
  app.innerHTML = `
    <main class="login-layout">
      <section class="brand-panel">
        <div class="brand"><span class="brand-mark">G</span>Gestourant</div>
        <div class="hero-copy"><p class="eyebrow">OPERACIÓN INTELIGENTE</p><h1>Tu restaurante, en perfecto ritmo.</h1><p>Organiza tu sala, atiende con claridad y toma decisiones desde un solo lugar.</p></div>
        <div class="feature"><span>✦</span><div><strong>Todo bajo control</strong><small>Mesas, pedidos y tu operación diaria.</small></div></div>
      </section>
      <section class="login-panel"><div class="login-theme">${themeSwitcher()}</div><form id="login-form" class="login-card">
        <p class="eyebrow accent">BIENVENIDO</p><h2>Inicia sesión</h2><p class="muted">Ingresa a tu espacio de trabajo.</p>
        <label>Correo o usuario<input id="identifier" name="identifier" autocomplete="username" placeholder="ej. maria@restaurante.com" required /></label>
        <label>Contraseña<div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required /><button type="button" id="toggle-password" aria-label="Mostrar contraseña">◉</button></div></label>
        <p id="login-error" class="form-message" role="alert"></p>
        <button id="login-button" class="primary" type="submit">Entrar a Gestourant <span>→</span></button>
        <p class="demo-note">¿Aún no tienes cuenta? <button type="button" class="text-button" id="show-register">Crear cuenta</button></p>
      </form></section>
    </main>`;
  bindThemeControls();
  document.querySelector('#toggle-password').addEventListener('click', () => {
    const field = document.querySelector('#password'); field.type = field.type === 'password' ? 'text' : 'password';
  });
  document.querySelector('#login-form').addEventListener('submit', authenticate);
  document.querySelector('#show-register').addEventListener('click', registerView);
}

function registerView() {
  app.innerHTML = `<main class="login-layout"><section class="brand-panel"><div class="brand"><span class="brand-mark">G</span>Gestourant</div><div class="hero-copy"><p class="eyebrow">EMPIEZA HOY</p><h1>La operación clara comienza aquí.</h1><p>Crea tu acceso y conoce el espacio de trabajo de Gestourant.</p></div><div class="feature"><span>✦</span><div><strong>Tu información, protegida</strong><small>Acceso personal para cada miembro del equipo.</small></div></div></section><section class="login-panel"><form id="register-form" class="login-card"><p class="eyebrow accent">NUEVA CUENTA</p><h2>Crear cuenta</h2><p class="muted">Completa tus datos para comenzar.</p><label>Nombre de usuario<input name="username" autocomplete="username" placeholder="ej. maria.lopez" required minlength="3" /></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" placeholder="maria@restaurante.com" required /></label><label>Tipo de cuenta<select id="register-role" name="role"><option value="EMPLEADO">Empleado</option><option value="ADMINISTRADOR">Administrador</option></select></label><label id="admin-code-wrap" class="hidden-field">Código de administrador<input name="adminCode" type="password" placeholder="Código entregado por el responsable" /></label><label>Contraseña<div class="password-wrap"><input id="register-password" name="password" type="password" autocomplete="new-password" placeholder="Mínimo 10 caracteres y un número" required minlength="10" /><button type="button" id="toggle-password" aria-label="Mostrar contraseña">◉</button></div></label><p class="form-hint">El primer usuario registrado obtiene el rol administrador. Las cuentas administrativas posteriores requieren autorización.</p><p id="register-error" class="form-message" role="alert"></p><button id="register-button" class="primary" type="submit">Crear mi cuenta <span>→</span></button><p class="demo-note">¿Ya tienes cuenta? <button type="button" class="text-button" id="show-login">Iniciar sesión</button></p></form></section></main>`;
  document.querySelector('#toggle-password').addEventListener('click', () => { const field = document.querySelector('#register-password'); field.type = field.type === 'password' ? 'text' : 'password'; });
  document.querySelector('#show-login').addEventListener('click', loginView);
  document.querySelector('#register-role').addEventListener('change', event => document.querySelector('#admin-code-wrap').classList.toggle('hidden-field', event.target.value !== 'ADMINISTRADOR'));
  document.querySelector('#register-form').addEventListener('submit', register);
}

async function authenticate(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget), button = document.querySelector('#login-button'), message = document.querySelector('#login-error');
  const credentials = { identifier: form.get('identifier').trim(), password: form.get('password') };
  message.textContent = ''; button.disabled = true; button.textContent = 'Ingresando…';
  try {
    const data = await api.request('/api/auth/login', null, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    logger.info('Login succeeded', { username: data.username, role: data.role });
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) {
    message.textContent = error instanceof TypeError ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.' : error.message;
  } finally { button.disabled = false; button.innerHTML = 'Entrar a Gestourant <span>→</span>'; }
}

async function register(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget), button = document.querySelector('#register-button'), message = document.querySelector('#register-error');
  const account = { username: form.get('username').trim(), email: form.get('email').trim(), password: form.get('password'), role: form.get('role'), adminCode: form.get('adminCode') };
  if (!/\d/.test(account.password)) { message.textContent = 'La contraseña debe incluir al menos un número.'; return; }
  message.textContent = ''; button.disabled = true; button.textContent = 'Creando cuenta…';
  try {
    const data = await api.request('/api/auth/register', null, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) });
    logger.info('Registration succeeded', { username: data.username, role: data.role });
    sessionStorage.setItem('gestourant_session', JSON.stringify(data)); dashboardView(data);
  } catch (error) { message.textContent = error instanceof TypeError ? 'No se pudo conectar con el servidor. Confirma que el backend esté activo.' : error.message; }
  finally { button.disabled = false; button.innerHTML = 'Crear mi cuenta <span>→</span>'; }
}

function apiRequest(path, session, options = {}) {
  return api.request(path, session, options);
}

function dashboardView(session) {
  const user = escapeHtml(session.username || 'Equipo');
  const role = session.role === 'ADMINISTRADOR' ? 'Administrador' : 'Empleado';
  app.innerHTML = `<main class="dashboard"><aside class="sidebar"><div class="brand"><span class="brand-mark">G</span>Gestourant</div><div class="restaurant"><span class="avatar">${user.charAt(0).toUpperCase()}</span><div><strong>Restaurante Central</strong><small>${role}</small></div></div><nav><a class="active" data-view="tables">⌘ <span>Mesas</span></a><a data-view="orders">▤ <span>Pedidos</span></a><a data-view="products">◫ <span>Inventario</span></a><a data-view="reports">◌ <span>Reportes</span></a></nav><div class="sidebar-footer">${themeSwitcher()}<button id="logout" class="logout">↪ Cerrar sesión</button></div></aside><section id="content" class="workspace"></section><aside id="detail" class="detail"><div class="detail-empty"><span>⌁</span><h3>Selecciona una mesa</h3><p>Verás aquí el resumen de la atención.</p></div></aside></main>`;
  bindThemeControls();
  document.querySelector('nav').insertAdjacentHTML('afterbegin', '<a class="active" data-view="overview">⌂ <span>Resumen</span></a>');
  document.querySelector('[data-view="tables"]').classList.remove('active');
  document.querySelector('#logout').addEventListener('click', () => logout(session));
  document.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', () => navigate(link.dataset.view, session)));
  navigate('overview', session);
}

async function loadTables(session) {
  try {
    tables = await apiRequest('/api/tables', session);
  } catch (error) { showToast(error.message, true); }
  renderTables();
}

async function navigate(view, session) {
  document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  const content = document.querySelector('#content');
  document.querySelector('#detail').innerHTML = '<div class="detail-empty"><span>⌁</span><h3>Selecciona una mesa</h3><p>Verás aquí el resumen de la atención.</p></div>';
  if (view === 'overview') { content.innerHTML = overviewView(session); await loadOverview(session); return; }
  if (view === 'tables') { content.innerHTML = tablesView(session); bindTableAdmin(session); await loadTables(session); return; }
  if (view === 'products') { content.innerHTML = productsView(session); bindProductAdmin(session); await loadProducts(session); return; }
  if (view === 'orders') { content.innerHTML = ordersView(); return; }
  content.innerHTML = reportsView(); await loadReport(session);
}

function overviewView(session) {
  const user = escapeHtml(session.username || 'Equipo');
  return `<header class="overview-header"><div><p class="eyebrow">CENTRO DE OPERACIÓN</p><h1>Hola, ${user}</h1><p class="muted">Este es el pulso de tu restaurante para comenzar la jornada.</p></div><div class="header-actions"><span class="date">● Sistema listo</span></div></header><section class="overview-grid"><article class="overview-card overview-primary"><span class="overview-icon">⌂</span><div><small>Mesas ocupadas</small><strong id="overview-busy">...</strong><p>Controla el ritmo de la sala</p></div><button class="overview-link" data-quick-view="tables">Ver sala →</button></article><article class="overview-card"><span class="overview-icon">◇</span><div><small>Mesas disponibles</small><strong id="overview-free">...</strong><p>Listas para recibir clientes</p></div><button class="overview-link" data-quick-view="tables">Abrir mapa →</button></article><article class="overview-card"><span class="overview-icon">✦</span><div><small>Stock por revisar</small><strong id="overview-low-stock">...</strong><p>Productos con cinco unidades o menos</p></div><button class="overview-link" data-quick-view="products">Ver inventario →</button></article></section><section class="overview-actions"><div><p class="eyebrow">ACCESOS RÁPIDOS</p><h2>Continúa tu operación</h2><p class="muted">Elige el siguiente paso según el momento de tu servicio.</p></div><div class="quick-actions"><button class="quick-action" data-quick-view="tables"><span>⌘</span><strong>Gestionar mesas</strong><small>Abre mesas y revisa pedidos</small></button><button class="quick-action" data-quick-view="orders"><span>▤</span><strong>Revisar pedidos</strong><small>Consulta las cuentas abiertas</small></button><button class="quick-action" data-quick-view="products"><span>◫</span><strong>Ver inventario</strong><small>Consulta disponibilidad del menú</small></button></div></section>`;
}

async function loadOverview(session) {
  document.querySelectorAll('[data-quick-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.quickView, session)));
  try {
    const [loadedTables, loadedProducts] = await Promise.all([apiRequest('/api/tables', session), apiRequest('/api/products', session)]);
    tables = loadedTables;
    products = loadedProducts;
    document.querySelector('#overview-busy').textContent = tables.filter(table => table.status === 'OCUPADA').length;
    document.querySelector('#overview-free').textContent = tables.filter(table => table.status === 'LIBRE').length;
    document.querySelector('#overview-low-stock').textContent = products.filter(product => product.active && product.stock <= 5).length;
  } catch (error) { showToast(error.message, true); }
}

function tablesView(session) { const adminTools = session.role === 'ADMINISTRADOR' ? `<section class="admin-tools"><div><h2>Configurar sala</h2><p>Crea, edita, elimina o une mesas. Estas acciones solo están disponibles para administradores.</p></div><form id="create-table-form" class="inline-form"><input name="tableNumber" type="number" min="1" placeholder="N.º mesa" required><input name="seats" type="number" min="1" placeholder="Puestos" required><button class="primary" type="submit">＋ Crear mesa</button></form><form id="join-table-form" class="inline-form"><select name="firstTableId" required><option value="">Primera mesa</option>${tables.filter(table => table.status === 'LIBRE' && !table.joinedTableId).map(table => `<option value="${table.id}">Mesa ${table.tableNumber}</option>`).join('')}</select><select name="secondTableId" required><option value="">Segunda mesa</option>${tables.filter(table => table.status === 'LIBRE' && !table.joinedTableId).map(table => `<option value="${table.id}">Mesa ${table.tableNumber}</option>`).join('')}</select><button class="outline" type="submit">Unir mesas</button></form></section>` : ''; return `<header><div><p class="eyebrow">SALA PRINCIPAL</p><h1>Mesas</h1><p class="muted">Selecciona una mesa para comenzar a atender.</p></div><div class="header-actions"><span class="date">● En vivo</span></div></header>${adminTools}<section class="metrics"><article><span>Mesas activas</span><strong>${tables.filter(table => table.status === 'OCUPADA').length} <em>/ ${tables.length}</em></strong><small>Estado en tiempo real</small></article><article><span>Disponibles</span><strong>${tables.filter(table => table.status === 'LIBRE').length}</strong><small>Listas para recibir clientes</small></article><article><span>Atención</span><strong>Hoy</strong><small>Gestiona pedidos desde cada mesa</small></article></section><section class="room"><div class="room-head"><div><h2>Mapa de sala</h2><p>Abre una mesa para registrar su pedido.</p></div><div class="legend"><i></i> Disponible <i class="occupied"></i> Ocupada</div></div><div id="table-grid" class="table-grid"></div></section>`; }
function bindTableAdmin(session) {
  const createForm = document.querySelector('#create-table-form');
  const joinForm = document.querySelector('#join-table-form');
  if (!createForm || !joinForm) return;
  createForm.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await apiRequest('/api/tables', session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableNumber: Number(data.get('tableNumber')), seats: Number(data.get('seats')) }) }); showToast('Mesa creada.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } });
  joinForm.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await apiRequest('/api/tables/join', session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstTableId: Number(data.get('firstTableId')), secondTableId: Number(data.get('secondTableId')) }) }); showToast('Mesas unidas.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } });
}
function productsView(session) { const adminTools = session.role === 'ADMINISTRADOR' ? `<section class="admin-tools"><div><p class="eyebrow accent">CATÁLOGO DEL MENÚ</p><h2 id="product-form-title">Agregar producto</h2><p>Registra platos, bebidas y cualquier producto que vendas.</p></div><form id="create-product-form" class="product-form"><label>Nombre<input name="name" maxlength="120" placeholder="Ej. Bandeja paisa" required></label><label>Categoría<select name="category"><option value="PLATO">Plato</option><option value="BEBIDA">Bebida</option><option value="OTRO">Otro</option></select></label><label>Descripción<textarea name="description" maxlength="500" placeholder="Ingredientes y detalles del producto" required></textarea></label><label>Precio (COP)<input name="price" type="number" min="1" step="1" placeholder="28000" required></label><label>Cantidad disponible<input name="stock" type="number" min="0" step="1" placeholder="20" required></label><label class="product-active"><input name="active" type="checkbox" checked> Disponible para pedidos</label><div class="product-form-actions"><button id="product-submit" class="primary" type="submit">＋ Guardar producto</button><button id="cancel-product-edit" class="outline hidden-field" type="button">Cancelar edición</button></div></form></section>` : ''; return `<header><div><p class="eyebrow">CATÁLOGO</p><h1>Productos y bebidas</h1><p class="muted">Gestiona tu menú en tiempo real y consulta existencias.</p></div></header>${adminTools}<section class="room"><div class="room-head"><div><h2>Menú disponible</h2><p>Platos, bebidas y otros productos registrados.</p></div><div class="catalog-filters"><button class="filter-button active" data-category-filter="TODOS">Todos</button><button class="filter-button" data-category-filter="PLATO">Platos</button><button class="filter-button" data-category-filter="BEBIDA">Bebidas</button><button class="filter-button" data-category-filter="OTRO">Otros</button></div></div><div id="product-list" class="product-list"><p class="muted">Cargando productos...</p></div></section>`; }
function ordersView() { return `<header><div><p class="eyebrow">OPERACIÓN</p><h1>Pedidos</h1><p class="muted">Los pedidos abiertos aparecen al seleccionar una mesa.</p></div></header><section class="room empty-state"><span>▤</span><h2>Selecciona una mesa ocupada</h2><p>Desde el detalle puedes ver productos, agregar consumos y cerrar la cuenta.</p></section>`; }
function reportsView() { return `<header><div><p class="eyebrow">CONTROL</p><h1>Reportes</h1><p class="muted">Resumen de caja del día.</p></div></header><section class="metrics report-metrics"><article><span>Facturas</span><strong id="report-invoices">...</strong></article><article><span>Efectivo</span><strong id="report-cash">...</strong></article><article><span>Total vendido</span><strong id="report-total">...</strong></article></section>`; }

async function loadProducts(session) {
  try { products = await apiRequest('/api/products', session); renderProducts(); } catch (error) { showToast(error.message, true); }
}

function bindProductAdmin(session) {
  const form = document.querySelector('#create-product-form');
  if (!form) return;
  const submitButton = document.querySelector('#product-submit');
  const cancelButton = document.querySelector('#cancel-product-edit');
  const resetForm = () => { form.reset(); form.dataset.editingId = ''; document.querySelector('#product-form-title').textContent = 'Agregar producto'; submitButton.textContent = '＋ Guardar producto'; cancelButton.classList.add('hidden-field'); };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const product = { name: data.get('name').trim(), description: data.get('description').trim(), category: data.get('category'), price: Number(data.get('price')), stock: Number(data.get('stock')), active: data.get('active') === 'on' };
      const editingId = form.dataset.editingId;
      await apiRequest(editingId ? `/api/products/${editingId}` : '/api/products', session, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) });
      showToast(editingId ? 'Producto actualizado.' : 'Producto guardado en el menú.');
      navigate('products', session);
    } catch (error) { showToast(error.message, true); }
  });
  cancelButton.addEventListener('click', resetForm);
  document.querySelectorAll('[data-category-filter]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-category-filter]').forEach(item => item.classList.toggle('active', item === button)); renderProducts(button.dataset.categoryFilter); }));
}

function renderProducts(categoryFilter = 'TODOS') {
  const list = document.querySelector('#product-list');
  const visibleProducts = categoryFilter === 'TODOS' ? products : products.filter(product => product.category === categoryFilter);
  list.innerHTML = visibleProducts.length ? visibleProducts.map(product => `<article class="product-row ${!product.active ? 'inactive' : ''}" data-product-id="${product.id}"><div class="product-info"><span class="product-category">${escapeHtml(product.category || 'PLATO')}</span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description || 'Sin descripción')}</small><small>${product.active ? 'Disponible' : 'Inactivo'}</small></div><strong>$ ${Number(product.price).toLocaleString('es-CO')} COP</strong><span class="stock ${product.stock < 5 ? 'low' : ''}">${product.stock} disponibles</span><div class="product-actions">${product.active && product.stock ? '<button class="primary add-product" type="button">Agregar</button>' : '<span class="unavailable">No disponible</span>'}${sessionStorage.getItem('gestourant_session') && JSON.parse(sessionStorage.getItem('gestourant_session')).role === 'ADMINISTRADOR' ? '<button class="outline edit-product" type="button">Editar</button><button class="danger delete-product" type="button">Eliminar</button>' : ''}</div></article>`).join('') : '<p class="muted">No hay productos en esta categoría.</p>';
  list.querySelectorAll('.add-product').forEach(button => button.addEventListener('click', () => addProduct(Number(button.closest('[data-product-id]').dataset.productId))));
  list.querySelectorAll('.edit-product').forEach(button => button.addEventListener('click', () => editProduct(Number(button.closest('[data-product-id]').dataset.productId))));
  list.querySelectorAll('.delete-product').forEach(button => button.addEventListener('click', () => deleteProduct(Number(button.closest('[data-product-id]').dataset.productId))));
}

function editProduct(id) { const product = products.find(item => item.id === id), form = document.querySelector('#create-product-form'); if (!product || !form) return; form.dataset.editingId = String(id); form.elements.name.value = product.name; form.elements.category.value = product.category || 'PLATO'; form.elements.description.value = product.description || ''; form.elements.price.value = product.price; form.elements.stock.value = product.stock; form.elements.active.checked = product.active; document.querySelector('#product-form-title').textContent = 'Editar producto'; document.querySelector('#product-submit').textContent = 'Guardar cambios'; document.querySelector('#cancel-product-edit').classList.remove('hidden-field'); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function deleteProduct(id) { const product = products.find(item => item.id === id), session = JSON.parse(sessionStorage.getItem('gestourant_session')); if (!product || !window.confirm(`¿Eliminar ${product.name} del menú?`)) return; try { await apiRequest(`/api/products/${id}`, session, { method: 'DELETE' }); showToast('Producto eliminado.'); navigate('products', session); } catch (error) { showToast(error.message, true); } }

async function loadReport(session) {
  try { const report = await apiRequest('/api/reports/cash-close', session); document.querySelector('#report-invoices').textContent = report.facturas; document.querySelector('#report-cash').textContent = `$ ${Number(report.efectivo).toLocaleString('es-CO')}`; document.querySelector('#report-total').textContent = `$ ${Number(report.total).toLocaleString('es-CO')}`; } catch (error) { showToast(error.message, true); }
}

async function logout(session) {
  try {
    await api.request('/api/auth/logout', session, { method: 'POST' });
    logger.info('Logout completed', { username: session.username });
  } finally {
    sessionStorage.removeItem('gestourant_session');
    loginView();
  }
}

function renderTables() {
  const grid = document.querySelector('#table-grid');
  if (!grid) return;
  grid.innerHTML = tables.length ? tables.map(table => `<button class="table-card ${table.status === 'OCUPADA' ? 'busy' : ''}" data-id="${table.id}"><span class="table-icon">♜</span><span><strong>Mesa ${table.tableNumber}</strong><small>${table.seats} puestos</small></span><b>${table.status === 'LIBRE' ? 'Disponible' : 'Ocupada'}</b><span>›</span></button>`).join('') : '<p class="muted">No hay mesas configuradas.</p>';
  grid.querySelectorAll('button').forEach(button => button.addEventListener('click', () => selectTable(Number(button.dataset.id))));
}

async function selectTable(id) {
  const table = tables.find(item => item.id === id), detail = document.querySelector('#detail');
  document.querySelectorAll('.table-card').forEach(card => card.classList.toggle('selected', Number(card.dataset.id) === id));
  const session = JSON.parse(sessionStorage.getItem('gestourant_session'));
  const adminActions = session.role === 'ADMINISTRADOR' ? `<div class="detail-actions"><button id="edit-table" class="outline">Editar mesa</button><button id="delete-table" class="danger">Eliminar</button>${table.joinedTableId ? '<button id="unjoin-table" class="outline full">Separar mesas</button>' : ''}</div>` : '';
  detail.innerHTML = `<div class="detail-content"><span class="table-number">${String(table.tableNumber).padStart(2, '0')}</span><p class="eyebrow accent">${table.status === 'LIBRE' ? 'DISPONIBLE' : 'OCUPADA'}</p><h2>Mesa ${table.tableNumber}</h2><p class="muted">${table.seats} puestos · Sala principal${table.joinedTableId ? ' · Unida a otra mesa' : ''}</p><hr/><div class="detail-row"><span>Estado</span><strong>${table.status === 'LIBRE' ? 'Disponible' : 'Ocupada'}</strong></div><div id="order-detail"></div><button id="table-action" class="primary">${table.status === 'LIBRE' ? 'Abrir mesa' : 'Cargar pedido'} <span>→</span></button>${adminActions}</div>`;
  document.querySelector('#table-action').addEventListener('click', () => table.status === 'LIBRE' ? openTable(table.id, session) : loadOpenOrder(table.id, session));
  if (session.role === 'ADMINISTRADOR') { document.querySelector('#edit-table').addEventListener('click', () => editTable(table, session)); document.querySelector('#delete-table').addEventListener('click', () => deleteTable(table, session)); document.querySelector('#unjoin-table')?.addEventListener('click', () => unjoinTable(table, session)); }
}

async function editTable(table, session) { const tableNumber = Number(window.prompt('Número de mesa:', table.tableNumber)); const seats = Number(window.prompt('Cantidad de puestos:', table.seats)); if (!tableNumber || !seats) return; try { await apiRequest(`/api/tables/${table.id}`, session, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableNumber, seats }) }); showToast('Mesa actualizada.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
async function deleteTable(table, session) { if (!window.confirm(`¿Eliminar la Mesa ${table.tableNumber}?`)) return; try { await apiRequest(`/api/tables/${table.id}`, session, { method: 'DELETE' }); showToast('Mesa eliminada.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
async function unjoinTable(table, session) { if (!table.joinedTableId) return; try { await apiRequest('/api/tables/join', session, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstTableId: table.id, secondTableId: table.joinedTableId }) }); showToast('Mesas separadas.'); navigate('tables', session); } catch (error) { showToast(error.message, true); } }

async function openTable(tableId, session) { try { activeOrder = await apiRequest(`/api/tables/${tableId}/orders`, session, { method: 'POST' }); await loadTables(session); await selectTable(tableId); loadOpenOrder(tableId, session); } catch (error) { showToast(error.message, true); } }
async function loadOpenOrder(tableId, session) { try { activeOrder = await apiRequest(`/api/tables/${tableId}/orders/open`, session); renderOrderDetail(activeOrder, session); } catch (error) { showToast(error.message, true); } }
async function addProduct(productId) { const session = JSON.parse(sessionStorage.getItem('gestourant_session')); if (!activeOrder) { showToast('Abre una mesa antes de agregar productos.', true); return; } try { activeOrder = await apiRequest(`/api/orders/${activeOrder.id}/items`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, quantity: 1 }) }); renderOrderDetail(activeOrder, session); showToast('Producto agregado al pedido.'); } catch (error) { showToast(error.message, true); } }
function renderOrderDetail(order, session) { const target = document.querySelector('#order-detail'); if (!target) return; target.innerHTML = `<div class="order-summary"><strong>Pedido #${order.id}</strong><span>$ ${Number(order.total).toLocaleString('es-CO')}</span></div><p class="muted">Agrega productos desde Inventario o usa la caja del pedido.</p><div class="order-items">${(order.items || []).map(item => `<div>${escapeHtml(item.product.name)} × ${item.quantity}<strong>$ ${Number(item.subtotal).toLocaleString('es-CO')}</strong></div>`).join('') || '<small>Aún no hay productos.</small>'}</div><button id="close-order" class="outline full">Cerrar cuenta</button>`; document.querySelector('#close-order').addEventListener('click', () => closeOrder(order.id, session)); }
async function closeOrder(orderId, session) { try { const invoice = await apiRequest(`/api/orders/${orderId}/close`, session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod: 'EFECTIVO' }) }); showToast(`Factura ${invoice.invoiceNumber} creada.`); navigate('tables', session); } catch (error) { showToast(error.message, true); } }
function showToast(message, error = false) { let toast = document.querySelector('#toast'); if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); } toast.textContent = message; toast.className = error ? 'toast error' : 'toast'; setTimeout(() => toast.remove(), 3500); }

const stored = sessionStorage.getItem('gestourant_session');
stored ? dashboardView(JSON.parse(stored)) : loginView();
