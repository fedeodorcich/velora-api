import type { DashboardSummaryDto } from '../../dashboard/dto/dashboard-summary.dto.js';

export interface SeedCredentialsDto {
  email: string;
  password: string;
}

export interface SeedCountsDto {
  clients: number;
  quotes: number;
  projects: number;
  payments: number;
}

export interface SeedResultDto {
  user: SeedCredentialsDto;
  counts: SeedCountsDto;
  dashboard: DashboardSummaryDto;
}

export interface SeedDeleteResultDto {
  removed: boolean;
}
