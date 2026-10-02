export const IDLE_LOCK_AFTER_MS = 2 * 60 * 1000;
export const IDLE_LOCKED_COUNTDOWN_MS = 3 * 60 * 1000;
export const IDLE_LOGOUT_AFTER_MS = IDLE_LOCK_AFTER_MS + IDLE_LOCKED_COUNTDOWN_MS;

export function formatIdleCountdown(deadline, now = Date.now()) {
  const remainingSeconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
