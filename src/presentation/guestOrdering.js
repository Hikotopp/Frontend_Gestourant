import '../guest-ordering.css';
import '../guest-brand.css';
import './guest-menu-download.css';
import { calculateCartTotal } from '../domain/product';
import { brandMark } from './brandMark';
import { downloadMenuXlsx, printMenuPdf } from './menuDownload';
import { fallbackProductPhoto, productPhoto } from './productPhoto';
import { bindLanguagePicker, getLocale, languagePicker, translate, translateBackendMessage } from '../shared/locale.js';

const money = value => `$ ${Number(value || 0).toLocaleString(getLocale())} COP`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const requestStatusLabel = status => {
  const label = ({
    PENDIENTE: 'Pendiente de confirmar',
    EN_COCINA: 'Confirmada · en cocina',
    PREPARANDO: 'En preparación',
    LISTO: 'Lista para servir',
    RECHAZADA: 'No aceptada'
  })[status] || status;
  return translate(label);
};

export async function guestOrderingView(token, services) {
  const app = document.querySelector('#app');
  const state = { token, guestSessionToken: null, data: null, requests: [], cart: new Map(), filter: 'TODOS', search: '', loading: true, message: '', sending: false, retryable: true };
  let refreshInterval = null;
  document.documentElement.lang = getLocale();
  app.innerHTML = `<main class="guest-shell"><div class="guest-loading"><span class="guest-spinner"></span><p>${escapeHtml(translate('Preparando la carta de tu mesa…'))}</p></div></main>`;

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
      state.retryable = true;
      const [data, requests] = await Promise.all([
        services.guest.getTable(token),
        services.guest.listRequests(token, state.guestSessionToken)
      ]);
      state.data = data;
      state.requests = requests;
      state.message = '';
    } catch (error) {
      state.retryable = !(error.status >= 400 && error.status < 500);
      state.message = error instanceof TypeError
        ? 'No se pudo conectar con el restaurante. Comprueba la conexión e inténtalo de nuevo.'
        : error.sourceMessage || error.message;
      if (!state.retryable && refreshInterval) {
        window.clearInterval(refreshInterval);
        refreshInterval = null;
      }
    } finally {
      state.loading = false;
      render();
      if (state.retryable && !refreshInterval) refreshInterval = window.setInterval(refresh, 5000);
    }
  }

  function render() {
    if (!state.data) {
      app.innerHTML = `<main class="guest-shell"><div class="guest-error"><div class="guest-logo">${brandMark()}</div>${languagePicker()}<p class="guest-eyebrow">${escapeHtml(translate('GESTOURANT · MENÚ DIGITAL'))}</p><h1>${escapeHtml(translate(state.loading ? 'Cargando tu mesa…' : 'No pudimos abrir esta mesa'))}</h1><p>${escapeHtml(state.message ? translateBackendMessage(state.message) : translate('Estamos preparando el servicio.'))}</p><button type="button" class="guest-primary" data-action="retry">${escapeHtml(translate('Intentar de nuevo'))}</button><small>${escapeHtml(translate('Si el problema continúa, solicita ayuda a un empleado.'))}</small></div></main>`;
      bindLanguagePicker(app);
      app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.product)));
      return;
    }
    const { data } = state;
    const cartItems = [...state.cart.values()].filter(item => item.quantity > 0);
    const selectedProductCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = calculateCartTotal(cartItems);
    const filteredProducts = data.menu.filter(product =>
      (state.filter === 'TODOS' || product.category === state.filter)
      && `${product.name} ${translate(product.name)} ${product.description} ${translate(product.description || '')} ${product.category}`.toLocaleLowerCase(getLocale()).includes(state.search.toLocaleLowerCase(getLocale()))
    );
    const requestsMarkup = state.requests.length
      ? `<div class="guest-request-list">${state.requests.map(request => `<article class="guest-request-card"><div class="guest-request-title"><span>${escapeHtml(translate('Solicitud #{id}', { id: request.id }))}</span><b class="request-${request.status.toLowerCase()}">${escapeHtml(requestStatusLabel(request.status))}</b></div><div class="guest-request-lines">${request.items.map(item => `<span>${item.quantity} × ${escapeHtml(translate(item.name))}${item.removedIngredients ? ` <small>· ${escapeHtml(translate('Sin'))} ${escapeHtml(item.removedIngredients)}</small>` : ''}</span>`).join('')}</div><strong>${money(request.total)}</strong></article>`).join('')}</div>`
      : `<article class="guest-no-account"><span>◷</span><div><strong>${escapeHtml(translate('Aún no has enviado pedidos desde este dispositivo'))}</strong><small>${escapeHtml(translate('Cuando envíes una solicitud, su estado aparecerá aquí.'))}</small></div></article>`;

    app.innerHTML = `<main class="guest-shell">
      <header class="guest-header"><a class="guest-brand" href="/" aria-label="Gestourant">${brandMark()}<span>Gestourant<small>${escapeHtml(translate('MENÚ DIGITAL'))}</small></span></a><span class="guest-table-chip"><i></i>${escapeHtml(translate('Mesa'))} ${data.tableNumber}</span>${languagePicker()}</header>
      <section class="guest-welcome"><div><p class="guest-eyebrow">${escapeHtml(translate('BIENVENIDO A LA MESA {table}', { table: data.tableNumber }))}</p><h1>${escapeHtml(translate('Algo delicioso'))}<br><em>${escapeHtml(translate('te espera.'))}</em></h1><p>${escapeHtml(translate('Explora nuestra carta y envía tu selección. El equipo confirmará cada solicitud antes de enviarla a cocina.'))}</p></div><div class="guest-welcome-art" aria-hidden="true"><span>✳</span><div class="guest-plate"></div><i></i></div></section>
      ${state.message ? `<div class="guest-inline-error" role="alert">${escapeHtml(translateBackendMessage(state.message))} <button data-action="retry">${escapeHtml(translate('Reintentar'))}</button></div>` : ''}
      <section class="guest-account" aria-labelledby="guest-account-title"><div class="guest-section-heading"><div><p class="guest-eyebrow">${escapeHtml(translate('PRIVADO EN ESTE DISPOSITIVO'))}</p><h2 id="guest-account-title">${escapeHtml(translate('Mis pedidos'))}</h2></div><button type="button" class="guest-refresh" data-action="refresh" aria-label="${escapeHtml(translate('Actualizar mis pedidos'))}">↻</button></div>
        <p class="guest-privacy-note">${escapeHtml(translate('Aquí solo aparecen las solicitudes enviadas desde esta pestaña. Para consultar la cuenta compartida de la mesa, pide ayuda al equipo.'))}</p>
        ${requestsMarkup}
      </section>
      <section class="guest-menu"><div class="guest-section-heading guest-menu-heading"><div><p class="guest-eyebrow">${escapeHtml(translate('RECIÉN HECHO PARA TI'))}</p><h2>${escapeHtml(translate('La carta'))}</h2></div><div class="guest-menu-heading-actions"><div class="guest-menu-downloads" aria-label="${escapeHtml(translate('Descargar carta'))}"><button type="button" class="guest-menu-download" data-action="download-menu-pdf"><span aria-hidden="true">↓</span>PDF</button><button type="button" class="guest-menu-download" data-action="download-menu-xlsx"><span aria-hidden="true">↓</span>Excel</button></div><span class="guest-menu-count">${escapeHtml(translate(filteredProducts.length === 1 ? '{count} opción' : '{count} opciones', { count: filteredProducts.length }))}</span></div></div>
        <label class="guest-search"><span>⌕</span><input type="search" data-search placeholder="${escapeHtml(translate('Buscar un plato, bebida…'))}" value="${escapeHtml(state.search)}"></label>
        <div class="guest-filters" role="group" aria-label="${escapeHtml(translate('Filtrar carta'))}">${[['TODOS','Todo'],['PLATO','Platos'],['BEBIDA','Bebidas'],['OTRO','Otros']].map(([id,label]) => `<button type="button" data-filter="${id}" class="${state.filter === id ? 'active' : ''}">${escapeHtml(translate(label))}</button>` ).join('')}</div>
        <div class="guest-product-grid">${filteredProducts.length ? filteredProducts.map(product => {
          const count = state.cart.get(product.id)?.quantity || 0;
          const name = translate(product.name);
          const description = product.description ? translate(product.description) : '';
          return `<article class="guest-product-card"><img class="guest-product-image" src="${escapeHtml(productPhoto(product))}" data-fallback-src="${product.imageUrl ? escapeHtml(fallbackProductPhoto(product)) : ''}" data-category="${escapeHtml(product.category)}" alt="" loading="lazy"><div class="guest-product-body"><span class="guest-category">${escapeHtml(translate(product.category))}</span><h3>${escapeHtml(name)}</h3><p>${escapeHtml(description)}</p><div class="guest-product-bottom"><strong>${money(product.price)}</strong>${count ? `<div class="guest-quantity"><button type="button" data-action="minus" data-product="${product.id}" aria-label="${escapeHtml(translate('Quitar uno'))}">−</button><span>${count}</span><button type="button" data-action="plus" data-product="${product.id}" aria-label="${escapeHtml(translate('Agregar uno'))}">＋</button></div>` : `<button type="button" class="guest-add" data-action="plus" data-product="${product.id}" aria-label="${escapeHtml(translate('Agregar {product}', { product: name }))}">＋</button>`}</div>${count ? `<label class="guest-allergy">${escapeHtml(translate('Indicación o ingrediente a retirar'))}<input data-note="${product.id}" maxlength="500" placeholder="${escapeHtml(translate('Ej. sin maní (se confirmará con cocina)'))}" value="${escapeHtml(state.cart.get(product.id)?.removedIngredients || '')}"></label>` : ''}</div></article>`;
        }).join('') : `<div class="guest-empty-menu"><span>⌕</span><strong>${escapeHtml(translate('No encontramos opciones'))}</strong><p>${escapeHtml(translate('Prueba otra búsqueda o categoría.'))}</p></div>`}</div>
      </section>
      ${cartItems.length ? `<aside class="guest-cart"><div><span>${escapeHtml(translate(selectedProductCount === 1 ? '{count} producto seleccionado' : '{count} productos seleccionados', { count: selectedProductCount }))}</span><strong>${money(cartTotal)}</strong></div><button type="button" class="guest-primary" data-action="send" ${state.sending ? 'disabled' : ''}>${escapeHtml(translate(state.sending ? 'Enviando…' : 'Enviar solicitud al equipo →'))}</button><small>${escapeHtml(translate('Tu pedido no se carga a la cuenta hasta que el empleado lo confirme.'))}</small></aside>` : ''}
      <footer class="guest-footer"><span>${brandMark()} <strong>Gestourant</strong></span><small>${escapeHtml(translate('Servicio atento, a tu ritmo.'))}</small><small>${escapeHtml(translate('¿Necesitas ayuda? Llama a un empleado.'))}</small></footer>
    </main>`;

    bindLanguagePicker(app);
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
      category.textContent = translate(image.dataset.category || 'PLATO');
      placeholder.append(icon, category);
      image.replaceWith(placeholder);
    }));
  }

  async function handleAction(action, productId) {
    if (action === 'retry' || action === 'refresh') return refresh();
    if (action === 'download-menu-pdf') {
      try {
        printMenuPdf(state.data.menu, state.data.tableNumber);
      } catch (error) {
        state.message = error.sourceMessage || error.message;
        render();
      }
      return;
    }
    if (action === 'download-menu-xlsx') {
      try {
        downloadMenuXlsx(state.data.menu, state.data.tableNumber);
      } catch (error) {
        state.message = error.sourceMessage || error.message;
        render();
      }
      return;
    }
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
        await services.guest.createRequest(token, state.guestSessionToken, {
          items: [...state.cart.values()].map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            removedIngredients: item.removedIngredients
          }))
        });
        state.cart.clear();
        state.message = '';
        await refresh();
      } catch (error) {
        state.message = error.sourceMessage || error.message;
      } finally {
        state.sending = false;
        render();
      }
      return;
    }
  }

  window.addEventListener('gestourant:locale-change', render);
  try {
    state.guestSessionToken = getGuestSessionToken();
  } catch (error) {
    state.loading = false;
    state.message = error.message;
  }
  if (state.guestSessionToken) {
    await refresh();
  } else {
    render();
  }
}
