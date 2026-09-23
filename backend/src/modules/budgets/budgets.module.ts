import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Budget, Transaction, Category])],
  providers: [BudgetsService],
  controllers: [BudgetsController],
  exports: [BudgetsService],
})
export class BudgetsModule {}
