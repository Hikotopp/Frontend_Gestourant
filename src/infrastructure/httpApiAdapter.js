import { logger } from './logger';

export function createHttpApiAdapter(baseUrl = '') {
  return {
    async request(path, session, options = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { ...(options.headers || {}), ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        logger.error('API request failed', { path, status: response.status });
        const message = response.status === 401
          ? 'El usuario o la contraseña son incorrectos.'
          : data.message || 'No fue posible completar la operación.';
        throw new Error(message);
      }
      logger.info('API request completed', { path, status: response.status });
      return data;
    }
  };
}
