import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { AssetQuote } from './entities/asset-quote.entity';
import { InvestmentTransaction } from './entities/investment-transaction.entity';
import { InvestmentsService } from './investments.service';
import { AssetsController, InvestmentsController } from './investments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetQuote, InvestmentTransaction])],
  providers: [InvestmentsService],
  controllers: [InvestmentsController, AssetsController],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
