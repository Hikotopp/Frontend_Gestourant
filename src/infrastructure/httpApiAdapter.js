import { logger } from './logger';

function safeLogPath(path) {
  return path.replace(/^\/api\/guest\/[^/]+/, '/api/guest/:token');
}

export function createHttpApiAdapter(baseUrl = '') {
  if (import.meta.env.PROD && baseUrl && new URL(baseUrl, window.location.origin).protocol !== 'https:') {
    throw new Error('La API de Gestourant debe usar HTTPS en producción.');
  }

  return {
    async request(path, session, options = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { ...(options.headers || {}), ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        logger.error('API request failed', { path: safeLogPath(path), status: response.status });
        const message = response.status === 401
          ? 'El usuario o la contraseña son incorrectos.'
          : data.message || 'No fue posible completar la operación.';
        throw Object.assign(new Error(message), { status: response.status });
      }
      logger.info('API request completed', { path: safeLogPath(path), status: response.status });
      return data;
    }
  };
}
