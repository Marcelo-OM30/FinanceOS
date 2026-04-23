import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsIn(['débito', 'crédito', 'pré-pago'])
  tipo?: string;

  @IsOptional()
  @IsIn(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro'])
  bandeira?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  limite?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  vencimentoFatura?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  dataFechamentoFatura?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;
}
