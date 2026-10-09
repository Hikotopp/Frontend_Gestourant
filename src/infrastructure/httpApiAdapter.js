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
          ? (path === '/api/auth/login' ? 'El usuario o la contraseña son incorrectos.' : 'Tu sesión expiró o fue cerrada. Inicia sesión de nuevo.')
          : response.status === 409 && path === '/api/auth/login'
            ? 'Esta cuenta ya tiene una sesión abierta en otro navegador. Cierra esa sesión o espera a que expire.'
          : data.message || 'No fue posible completar la operación.';
        throw Object.assign(new Error(message), { status: response.status });
      }
      logger.info('API request completed', { path: safeLogPath(path), status: response.status });
      return data;
    },
    async download(path, session) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {}
      });
      if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch { /* The response may not contain JSON. */ }
        logger.error('API download failed', { path: safeLogPath(path), status: response.status });
        throw Object.assign(new Error(data.message || 'No fue posible descargar el archivo.'), { status: response.status });
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      const fileName = encodedName ? decodeURIComponent(encodedName) : plainName || 'respaldo.sql';
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }
  };
}
