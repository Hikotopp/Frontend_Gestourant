const jsonRequest = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

export function createHttpGestourantGateway(apiPort) {
  if (!apiPort || typeof apiPort.request !== 'function') {
    throw new TypeError('An API adapter with a request function is required.');
  }

  const api = apiPort;
  return {
    auth: {
      getConfig: () => api.request('/api/auth/config', null),
      exchangeOAuthCode: code => api.request('/api/auth/oauth/exchange', null, jsonRequest('POST', { code })),
      registerOAuthAccount: account => api.request('/api/auth/oauth/register', null, jsonRequest('POST', account)),
      login: credentials => api.request('/api/auth/login', null, jsonRequest('POST', credentials)),
      register: account => api.request('/api/auth/register', null, jsonRequest('POST', account)),
      logout: session => api.request('/api/auth/logout', session, { method: 'POST' })
    },
    tables: {
      list: session => api.request('/api/tables', session),
      create: (session, table) => api.request('/api/tables', session, jsonRequest('POST', table)),
      update: (session, id, table) => api.request(`/api/tables/${id}`, session, jsonRequest('PUT', table)),
      remove: (session, id) => api.request(`/api/tables/${id}`, session, { method: 'DELETE' }),
      join: (session, tableIds) => api.request('/api/tables/join', session, jsonRequest('POST', tableIds)),
      unjoin: (session, tableIds) => api.request('/api/tables/join', session, jsonRequest('DELETE', tableIds)),
      updatePosition: (session, id, position) => api.request(`/api/tables/${id}/position`, session, jsonRequest('PATCH', position)),
      openOrder: (session, id) => api.request(`/api/tables/${id}/orders`, session, { method: 'POST' }),
      getOpenOrder: (session, id) => api.request(`/api/tables/${id}/orders/open`, session)
    },
    products: {
      list: session => api.request('/api/products', session),
      save: (session, product, id) => api.request(
        id ? `/api/products/${id}` : '/api/products',
        session,
        jsonRequest(id ? 'PUT' : 'POST', product)
      ),
      remove: (session, id) => api.request(`/api/products/${id}`, session, { method: 'DELETE' })
    },
    orders: {
      addProduct: (session, id, productId) => api.request(
        `/api/orders/${id}/items`,
        session,
        jsonRequest('POST', { productId, quantity: 1 })
      ),
      removeItem: (session, orderId, itemId) => api.request(
        `/api/orders/${orderId}/items/${itemId}`,
        session,
        { method: 'DELETE' }
      ),
      updateItem: (session, orderId, itemId, ingredients) => api.request(
        `/api/orders/${orderId}/items/${itemId}`,
        session,
        jsonRequest('PATCH', { removedIngredients: ingredients })
      ),
      close: (session, id, paymentMethod) => api.request(
        `/api/orders/${id}/close`,
        session,
        jsonRequest('POST', { paymentMethod })
      )
    },
    guest: {
      getTable: token => api.request(`/api/guest/${encodeURIComponent(token)}`, null),
      listRequests: (token, guestSessionToken) => api.request(
        `/api/guest/${encodeURIComponent(token)}/requests`,
        null,
        { headers: { 'X-Guest-Session': guestSessionToken } }
      ),
      createRequest: (token, guestSessionToken, body) => api.request(
        `/api/guest/${encodeURIComponent(token)}/requests`,
        null,
        { ...jsonRequest('POST', body), headers: { 'X-Guest-Session': guestSessionToken, 'Content-Type': 'application/json' } }
      ),
      listStaffRequests: session => api.request('/api/guest-requests', session),
      approveStaffRequest: (session, id) => api.request(`/api/guest-requests/${id}/approve`, session, { method: 'POST' }),
      rejectStaffRequest: (session, id) => api.request(`/api/guest-requests/${id}/reject`, session, { method: 'POST' })
    },
    kitchen: {
      listRequests: session => api.request('/api/kitchen/requests', session),
      advanceRequest: (session, id) => api.request(`/api/kitchen/requests/${id}/advance`, session, { method: 'PATCH' })
    },
    reports: {
      getCashClose: session => api.request('/api/reports/cash-close', session),
      getHistory: (session, from, to, administrator) => {
        const query = new URLSearchParams({ from, to });
        return api.request(
          `/api/reports/history${administrator ? '/all' : ''}?${query}`,
          session
        );
      }
    }
  };
}
