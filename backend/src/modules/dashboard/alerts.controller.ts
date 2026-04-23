import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class FilterAlertQuery {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  lido?: boolean;

  @IsOptional()
  tipo?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(
    @Query() query: FilterAlertQuery,
    @CurrentUser() user: User,
  ) {
    return this.alertsService.findAll(user.id, query.lido, query.tipo);
  }

  @Patch(':id/mark-as-read')
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.alertsService.markAsRead(id, user.id);
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllAsRead(@CurrentUser() user: User) {
    return this.alertsService.markAllAsRead(user.id);
  }
}
