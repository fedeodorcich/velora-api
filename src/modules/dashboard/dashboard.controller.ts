import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: { id: string }): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary(user.id);
  }
}
