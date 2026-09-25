import './guest-ordering.css';
import './guest-brand.css';
import { createHttpApiAdapter } from './infrastructure/httpApiAdapter';
import { brandMark } from './brandMark';
import { fallbackProductPhoto, productPhoto } from './productPhoto';

const apiBase = import.meta.env.VITE_API_URL || '';
const api = createHttpApiAdapter(apiBase);
const money = value => `$ ${Number(value || 0).toLocaleString('es-CO')} COP`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const requestStatusLabel = status => ({
  PENDIENTE: 'Pendiente de confirmar',
  EN_COCINA: 'Confirmada · en cocina',
  PREPARANDO: 'En preparación',
  LISTO: 'Lista para servir',
  RECHAZADA: 'No aceptada'
})[status] || status;

export async function guestOrderingView(token) {
  const app = document.querySelector('#app');
  const state = { token, guestSessionToken: null, data: null, requests: [], cart: new Map(), filter: 'TODOS', search: '', loading: true, message: '', sending: false };
  app.innerHTML = '<main class="guest-shell"><div class="guest-loading"><span class="guest-spinner"></span><p>Preparando la carta de tu mesa…</p></div></main>';

  function getGuestSessionToken() {
    const key = `gestourant_guest_session_${token}`;
    const existing = sessionStorage.getItem(key);
    if (existing && /^[a-f\d]{64}$/i.test(existing)) return existing;
    if (!window.crypto?.getRandomValues) {
      throw new Error('Este navegador no permite proteger tus pedidos. Actualízalo e inténtalo de nuevo.');
    }
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    const sessionToken = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(key, sessionToken);
    return sessionToken;
  }

  async function refresh() {
    try {
      const tablePath = `/api/guest/${encodeURIComponent(token)}`;
      const [data, requests] = await Promise.all([
        api.request(tablePath, null),
        api.request(`${tablePath}/requests`, null, {
          headers: { 'X-Guest-Session': state.guestSessionToken }
        })
      ]);
      state.data = data;
      state.requests = requests;
      state.message = '';
    } catch (error) {
      state.message = error instanceof TypeError
        ? 'No se pudo conectar con el restaurante. Comprueba la conexión e inténtalo de nuevo.'
        : error.message;
    } finally {
      state.loading = false;
      render();
    }
  }

  function render() {
    if (!state.data) {
      app.innerHTML = `<main class="guest-shell"><div class="guest-error"><div class="guest-logo">${brandMark()}</div><p class="guest-eyebrow">GESTOURANT · MENÚ DIGITAL</p><h1>${state.loading ? 'Cargando tu mesa…' : 'No pudimos abrir esta mesa'}</h1><p>${escapeHtml(state.message || 'Estamos preparando el servicio.')}</p><button type="button" class="guest-primary" data-action="retry">Intentar de nuevo</button><small>Si el problema continúa, solicita ayuda a un empleado.</small></div></main>`;
      return;
    }
    const { data } = state;
    const cartItems = [...state.cart.values()].filter(item => item.quantity > 0);
    const cartTotal = cartItems.reduce((total, item) => total + (Number(item.product.price) * item.quantity), 0);
    const filteredProducts = data.menu.filter(product =>
      (state.filter === 'TODOS' || product.category === state.filter)
      && `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(state.search.toLowerCase())
    );

    app.innerHTML = `<main class="guest-shell">
      <header class="guest-header"><a class="guest-brand" href="/" aria-label="Gestourant">${brandMark()}<span>Gestourant<small>MENÚ DIGITAL</small></span></a><span class="guest-table-chip"><i></i>Mesa ${data.tableNumber}</span></header>
      <section class="guest-welcome"><div><p class="guest-eyebrow">BIENVENIDO A LA MESA ${data.tableNumber}</p><h1>Algo delicioso<br><em>te espera.</em></h1><p>Explora nuestra carta y envía tu selección. El equipo confirmará cada solicitud antes de enviarla a cocina.</p></div><div class="guest-welcome-art" aria-hidden="true"><span>✳</span><div class="guest-plate"></div><i></i></div></section>
      ${state.message ? `<div class="guest-inline-error" role="alert">${escapeHtml(state.message)} <button data-action="retry">Actualizar</button></div>` : ''}
      <section class="guest-account" aria-labelledby="guest-account-title"><div class="guest-section-heading"><div><p class="guest-eyebrow">PRIVADO EN ESTE DISPOSITIVO</p><h2 id="guest-account-title">Mis pedidos</h2></div><button type="button" class="guest-refresh" data-action="refresh" aria-label="Actualizar mis pedidos">↻</button></div>
        <p class="guest-privacy-note">Aquí solo aparecen las solicitudes enviadas desde esta pestaña. Para consultar la cuenta compartida de la mesa, pide ayuda al equipo.</p>
        ${state.requests.length ? `<div class="guest-request-list">${state.requests.map(request => `<article class="guest-request-card"><div class="guest-request-title"><span>Solicitud #${request.id}</span><b class="request-${request.status.toLowerCase()}">${escapeHtml(requestStatusLabel(request.status))}</b></div><div class="guest-request-lines">${request.items.map(item => `<span>${item.quantity} × ${escapeHtml(item.name)}${item.removedIngredients ? ` <small>· Sin ${escapeHtml(item.removedIngredients)}</small>` : ''}</span>`).join('')}</div><strong>${money(request.total)}</strong></article>`).join('')}</div>` : '<article class="guest-no-account"><span>◷</span><div><strong>Aún no has enviado pedidos desde este dispositivo</strong><small>Cuando envíes una solicitud, su estado aparecerá aquí.</small></div></article>'}
      </section>
      <section class="guest-menu"><div class="guest-section-heading"><div><p class="guest-eyebrow">RECIÉN HECHO PARA TI</p><h2>La carta</h2></div><span class="guest-menu-count">${filteredProducts.length} opciones</span></div>
        <label class="guest-search"><span>⌕</span><input type="search" data-search placeholder="Buscar un plato, bebida…" value="${escapeHtml(state.search)}"></label>
        <div class="guest-filters" role="group" aria-label="Filtrar carta">${[['TODOS','Todo'],['PLATO','Platos'],['BEBIDA','Bebidas'],['OTRO','Otros']].map(([id,label]) => `<button type="button" data-filter="${id}" class="${state.filter === id ? 'active' : ''}">${label}</button>`).join('')}</div>
        <div class="guest-product-grid">${filteredProducts.length ? filteredProducts.map(product => {
          const count = state.cart.get(product.id)?.quantity || 0;
          return `<article class="guest-product-card"><img class="guest-product-image" src="${escapeHtml(productPhoto(product))}" data-fallback-src="${product.imageUrl ? escapeHtml(fallbackProductPhoto(product)) : ''}" data-category="${escapeHtml(product.category)}" alt="" loading="lazy"><div class="guest-product-body"><span class="guest-category">${escapeHtml(product.category)}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p><div class="guest-product-bottom"><strong>${money(product.price)}</strong>${count ? `<div class="guest-quantity"><button type="button" data-action="minus" data-product="${product.id}" aria-label="Quitar uno">−</button><span>${count}</span><button type="button" data-action="plus" data-product="${product.id}" aria-label="Agregar uno">＋</button></div>` : `<button type="button" class="guest-add" data-action="plus" data-product="${product.id}" aria-label="Agregar ${escapeHtml(product.name)}">＋</button>`}</div>${count ? `<label class="guest-allergy">Indicación o ingrediente a retirar<input data-note="${product.id}" maxlength="500" placeholder="Ej. sin maní (se confirmará con cocina)" value="${escapeHtml(state.cart.get(product.id)?.removedIngredients || '')}"></label>` : ''}</div></article>`;
        }).join('') : '<div class="guest-empty-menu"><span>⌕</span><strong>No encontramos opciones</strong><p>Prueba otra búsqueda o categoría.</p></div>'}</div>
      </section>
      ${cartItems.length ? `<aside class="guest-cart"><div><span>${cartItems.reduce((sum, item) => sum + item.quantity, 0)} productos seleccionados</span><strong>${money(cartTotal)}</strong></div><button type="button" class="guest-primary" data-action="send" ${state.sending ? 'disabled' : ''}>${state.sending ? 'Enviando…' : 'Enviar solicitud al equipo →'}</button><small>Tu pedido no se carga a la cuenta hasta que el empleado lo confirme.</small></aside>` : ''}
      <footer class="guest-footer"><span>${brandMark()} <strong>Gestourant</strong></span><small>Servicio atento, a tu ritmo.</small><small>¿Necesitas ayuda? Llama a un empleado.</small></footer>
    </main>`;

    app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.product)));
    app.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; render(); }));
    app.querySelector('[data-search]')?.addEventListener('input', event => {
      const position = event.target.selectionStart;
      state.search = event.target.value;
      render();
      const input = app.querySelector('[data-search]');
      input.focus();
      input.setSelectionRange(position, position);
    });
    app.querySelectorAll('[data-note]').forEach(input => input.addEventListener('input', () => {
      const cartItem = state.cart.get(Number(input.dataset.note));
      if (cartItem) cartItem.removedIngredients = input.value;
    }));
    app.querySelectorAll('.guest-product-image').forEach(image => image.addEventListener('error', () => {
      if (image.dataset.fallbackSrc) {
        image.src = image.dataset.fallbackSrc;
        image.dataset.fallbackSrc = '';
        return;
      }
      const placeholder = document.createElement('div');
      placeholder.className = 'guest-product-placeholder';
      const icon = document.createElement('span');
      icon.textContent = image.dataset.category === 'BEBIDA' ? '◉' : '✳';
      const category = document.createElement('small');
      category.textContent = image.dataset.category || 'PLATO';
      placeholder.append(icon, category);
      image.replaceWith(placeholder);
    }));
  }

  async function handleAction(action, productId) {
    if (action === 'retry' || action === 'refresh') return refresh();
    if (action === 'plus' || action === 'minus') {
      const product = state.data.menu.find(item => item.id === Number(productId));
      if (!product) return;
      const current = state.cart.get(product.id) || { product, quantity: 0, removedIngredients: '' };
      current.quantity = Math.max(0, Math.min(product.stock, current.quantity + (action === 'plus' ? 1 : -1)));
      if (current.quantity) state.cart.set(product.id, current);
      else state.cart.delete(product.id);
      return render();
    }
    if (action === 'send') {
      if (!state.cart.size || state.sending) return;
      state.sending = true;
      render();
      try {
        await api.request(`/api/guest/${encodeURIComponent(token)}/requests`, null, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Guest-Session': state.guestSessionToken },
          body: JSON.stringify({ items: [...state.cart.values()].map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            removedIngredients: item.removedIngredients
          })) })
        });
        state.cart.clear();
        state.message = '';
        await refresh();
      } catch (error) {
        state.message = error.message;
      } finally {
        state.sending = false;
        render();
      }
      return;
    }
  }

  try {
    state.guestSessionToken = getGuestSessionToken();
  } catch (error) {
    state.loading = false;
    state.message = error.message;
  }
  if (state.guestSessionToken) {
    await refresh();
    window.setInterval(refresh, 5000);
  } else {
    render();
  }
}
