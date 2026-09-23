import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { AplicarSugestoesDto } from './dto/aplicar-sugestoes.dto';
import { SugestoesQueryDto } from './dto/sugestoes-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class FilterBudgetQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  ano?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(
    @Query() query: FilterBudgetQuery,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.findAll(user.id, query.mes, query.ano);
  }

  // Antes de ':id', senão 'sugestoes' cai no ParseUUIDPipe.
  @Get('sugestoes')
  sugestoes(@Query() query: SugestoesQueryDto, @CurrentUser() user: User) {
    return this.budgetsService.sugestoes(user.id, query.mes, query.ano, user.timezone);
  }

  @Post('aplicar-sugestoes')
  aplicarSugestoes(@Body() dto: AplicarSugestoesDto, @CurrentUser() user: User) {
    return this.budgetsService.aplicarSugestoes(user.id, dto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.findOne(id, user.id);
  }

  @Post()
  create(
    @Body() dto: CreateBudgetDto,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.budgetsService.remove(id, user.id);
  }
}
