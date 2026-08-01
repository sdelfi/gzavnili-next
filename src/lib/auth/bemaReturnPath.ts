const BEMA_RETURN_PATH_KEY = 'bema.returnPath';

export function rememberBemaReturnPath(path: string): void {
  if (!isSafeBemaReturnPath(path)) return;
  try {
    window.sessionStorage.setItem(BEMA_RETURN_PATH_KEY, path);
  } catch {
    // Storage may be unavailable in a locked-down browser; auth redirect must still work.
  }
}

export function takeBemaReturnPath(): string | null {
  try {
    const path = window.sessionStorage.getItem(BEMA_RETURN_PATH_KEY);
    window.sessionStorage.removeItem(BEMA_RETURN_PATH_KEY);
    return path && isSafeBemaReturnPath(path) ? path : null;
  } catch {
    return null;
  }
}

function isSafeBemaReturnPath(path: string): boolean {
  return path.startsWith('/bema/') && !path.startsWith('/bema/login');
}
