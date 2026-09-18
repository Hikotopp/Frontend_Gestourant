const isDevelopment = import.meta.env.DEV;

function write(level, message, context = {}) {
  const payload = { scope: 'gestourant.frontend', message, ...context };
  if (level === 'error') console.error(payload);
  else if (isDevelopment) console.info(payload);
}

export const logger = {
  info: (message, context) => write('info', message, context),
  error: (message, context) => write('error', message, context)
};
