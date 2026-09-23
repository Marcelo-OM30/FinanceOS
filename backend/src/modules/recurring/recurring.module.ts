import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringRule } from './entities/recurring-rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { RecurringService } from './recurring.service';
import { RecurringController } from './recurring.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringRule, Transaction, Account])],
  providers: [RecurringService],
  controllers: [RecurringController],
})
export class RecurringModule {}
