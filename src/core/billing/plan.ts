export const FREE_ACTIVE_CLIENT_LIMIT = 5;

export function proAccessUntil(
  manual: Date | null | undefined,
  automatic: Date | null | undefined,
): Date | null {
  if (!manual) {
    return automatic ?? null;
  }
  return automatic && automatic > manual ? automatic : manual;
}

export function hasProAccess(
  proUntil: Date | null | undefined,
  mpProUntil?: Date | null,
): boolean {
  const until = proAccessUntil(proUntil, mpProUntil);
  return until !== null && until.getTime() > Date.now();
}
