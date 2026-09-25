const isDevelopment = import.meta.env.DEV;

function write(level, message, context = {}) {
  const payload = { scope: 'gestourant.frontend', message, ...context };
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else if (isDevelopment) console.info(payload);
}

export const logger = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context)
};
