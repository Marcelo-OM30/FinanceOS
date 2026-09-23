import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstallmentPurchase } from './entities/installment-purchase.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InstallmentPurchase, Transaction, Account])],
  providers: [InstallmentsService],
  controllers: [InstallmentsController],
})
export class InstallmentsModule {}
