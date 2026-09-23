import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CardInvoicesService } from './card-invoices.service';
import { PagarFaturaDto } from './dto/pagar-fatura.dto';
import { FilterFaturaDto } from './dto/filter-fatura.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

// Faturas nascem sozinhas, quando a primeira compra cai nelas; não há POST.
@UseGuards(JwtAuthGuard)
@Controller('card-invoices')
export class CardInvoicesController {
  constructor(private readonly cardInvoicesService: CardInvoicesService) {}

  @Get()
  findAll(@Query() filters: FilterFaturaDto, @CurrentUser() user: User) {
    return this.cardInvoicesService.findAll(user.id, filters, user.timezone);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.cardInvoicesService.findOne(id, user.id, user.timezone);
  }

  @Post(':id/pagar')
  pagar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagarFaturaDto,
    @CurrentUser() user: User,
  ) {
    return this.cardInvoicesService.pagar(id, user.id, dto, user.timezone);
  }

  @Post(':id/desfazer-pagamento')
  desfazerPagamento(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.cardInvoicesService.desfazerPagamento(id, user.id, user.timezone);
  }
}
