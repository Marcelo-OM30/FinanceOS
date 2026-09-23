import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardInvoice } from './entities/card-invoice.entity';
import { Account } from '../accounts/entities/account.entity';
import { CardInvoicesService } from './card-invoices.service';
import { CardInvoicesController } from './card-invoices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CardInvoice, Account])],
  providers: [CardInvoicesService],
  controllers: [CardInvoicesController],
})
export class CardInvoicesModule {}
