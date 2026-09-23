import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Card } from './entities/card.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { CardsController } from './cards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Account, Card, Transaction])],
  providers: [AccountsService],
  controllers: [AccountsController, CardsController],
  exports: [AccountsService],
})
export class AccountsModule {}
