export function paidMonthUntil(approvedAt: string): Date {
  const approved = new Date(approvedAt);
  if (!Number.isFinite(approved.getTime())) {
    throw new Error('El pago no tiene una fecha válida.');
  }
  const until = new Date(approved);
  until.setUTCDate(1);
  until.setUTCMonth(until.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(until.getUTCFullYear(), until.getUTCMonth() + 1, 0),
  ).getUTCDate();
  until.setUTCDate(Math.min(approved.getUTCDate(), lastDay));
  return until;
}
