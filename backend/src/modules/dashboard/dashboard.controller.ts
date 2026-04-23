import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class EvolutionQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  meses?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: User) {
    return this.dashboardService.getSummary(user.id);
  }

  @Get('chart-categories')
  getChartCategories(@CurrentUser() user: User) {
    return this.dashboardService.getChartCategories(user.id);
  }

  @Get('chart-evolution')
  getChartEvolution(
    @Query() query: EvolutionQuery,
    @CurrentUser() user: User,
  ) {
    return this.dashboardService.getChartEvolution(user.id, query.meses ?? 6);
  }

  @Get('projection')
  getProjection(@CurrentUser() user: User) {
    return this.dashboardService.getProjection(user.id);
  }
}
