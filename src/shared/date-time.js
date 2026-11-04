export const COLOMBIA_TIME_ZONE = 'America/Bogota';

function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00-05:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return new Date(value);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(`${value}-05:00`);
  }
  return new Date(value);
}

function formattingLocale(locale) {
  return locale === 'es-419' ? 'es-CO' : locale;
}

export function formatColombiaDate(value, locale, format = 'medium') {
  const date = parseDate(value);
  if (!Number.isFinite(date.getTime())) return '';
  const options = format === 'time'
    ? { timeStyle: 'short', timeZone: COLOMBIA_TIME_ZONE }
    : { dateStyle: 'medium', timeStyle: 'short', timeZone: COLOMBIA_TIME_ZONE };
  return new Intl.DateTimeFormat(formattingLocale(locale), options).format(date);
}

export function todayInBogota(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
