import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentTransactionDto } from './dto/create-investment-transaction.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CotacaoDto } from './dto/cotacao.dto';
import { BuscaAtivoDto, FilterInvestmentTransactionDto } from './dto/filter-investment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get('positions')
  carteira(@CurrentUser() user: User) {
    return this.investmentsService.carteira(user.id);
  }

  @Get('transactions')
  listar(@Query() filters: FilterInvestmentTransactionDto, @CurrentUser() user: User) {
    return this.investmentsService.listarMovimentos(user.id, filters);
  }

  @Post('transactions')
  registrar(@Body() dto: CreateInvestmentTransactionDto, @CurrentUser() user: User) {
    return this.investmentsService.registrarMovimento(user.id, dto);
  }

  @Delete('transactions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.investmentsService.excluirMovimento(id, user.id);
  }

  // Busca agora, sem esperar a rodada de 6 em 6 horas.
  @Post('cotacoes/atualizar')
  atualizarCotacoes() {
    return this.investmentsService.atualizarCotacoes();
  }
}

@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get()
  buscar(@Query() query: BuscaAtivoDto, @CurrentUser() user: User) {
    return this.investmentsService.buscarAtivos(user.id, query.q);
  }

  @Post()
  criar(@Body() dto: CreateAssetDto, @CurrentUser() user: User) {
    return this.investmentsService.criarAtivo(user.id, dto);
  }

  @Post(':id/cotacoes')
  cotacao(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CotacaoDto, @CurrentUser() user: User) {
    return this.investmentsService.informarCotacao(user.id, id, dto, user.timezone);
  }
}
