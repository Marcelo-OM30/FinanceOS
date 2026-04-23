import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { AlertsService } from './alerts.service';
import { DashboardService } from './dashboard.service';
import { AlertsController } from './alerts.controller';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Transaction, Account])],
  providers: [AlertsService, DashboardService],
  controllers: [AlertsController, DashboardController],
  exports: [AlertsService],
})
export class DashboardModule {}
