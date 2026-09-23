import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateRecurringDto {
  @IsIn(['receita', 'despesa'])
  tipo: 'receita' | 'despesa';

  @IsString()
  @MaxLength(255)
  descricao: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorEstimado: number;

  @IsOptional()
  @IsBoolean()
  valorVariavel?: boolean;

  @IsIn(['semanal', 'mensal', 'anual'])
  frequencia: 'semanal' | 'mensal' | 'anual';

  // Padrão: o dia de dataInicio.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diaDoMes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  mesDoAno?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaDaSemana?: number;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  // No cartão, a conta é a do cartão.
  @ValidateIf((o) => !o.cardId)
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  cardId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
