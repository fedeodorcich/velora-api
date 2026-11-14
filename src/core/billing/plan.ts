export const FREE_ACTIVE_CLIENT_LIMIT = 5;

export function hasProAccess(proUntil: Date | null): boolean {
  return proUntil !== null && proUntil.getTime() > Date.now();
}
