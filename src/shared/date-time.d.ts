export declare const COLOMBIA_TIME_ZONE: 'America/Bogota';

export declare function formatColombiaDate(
  value: string | number | Date,
  locale: string,
  format?: 'medium' | 'time',
): string;

export declare function todayInBogota(now?: Date): string;
