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
  Matches,
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
  @Matches(/^\d{4}$/, { message: 'ultimosDigitos deve ter exatamente 4 dígitos' })
  ultimosDigitos?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;
}
