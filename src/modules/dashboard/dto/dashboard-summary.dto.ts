/** Resumen financiero del usuario agrupado por moneda (no se mezclan divisas). */
export interface DashboardFinancialSummaryDto {
  currency: string;
  /** Cobrado durante el mes en curso. */
  collectedThisMonth: number;
  /** Total pendiente de cobro (incluye lo vencido). */
  pendingTotal: number;
  /** Parte del pendiente cuya fecha de vencimiento ya pasó. */
  overdueTotal: number;
  /** Cantidad de cobros vencidos. */
  overdueCount: number;
}

export interface DashboardSummaryDto {
  metrics: {
    activeProjectsCount: number;
    pendingQuotesCount: number;
    totalClientsCount: number;
  };
  /** Un elemento por moneda con movimiento; vacío si todavía no hay cobros. */
  financials: DashboardFinancialSummaryDto[];
  upcomingPayments: Array<{
    id: string;
    number: number;
    concept: string;
    amount: number;
    currency: string;
    dueDate: string;
    status: 'pendiente' | 'pagado';
    isOverdue: boolean;
    projectName: string;
    clientName: string;
  }>;
  recentProjects: Array<{
    id: string;
    code: string;
    name: string;
    clientName: string;
    status: string;
    budget: number;
    collectedAmount: number;
    currency: string;
  }>;
}
