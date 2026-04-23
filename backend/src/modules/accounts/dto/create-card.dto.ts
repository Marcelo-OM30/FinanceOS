import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  MinLength,
  MaxLength as MaxLen,
  Matches,
} from 'class-validator';

export class CreateCardDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @MaxLength(255)
  nome: string;

  @IsString()
  @MinLength(13)
  @MaxLength(19)
  @Matches(/^\d+$/, { message: 'numero deve conter apenas dígitos' })
  numero: string;

  @IsIn(['débito', 'crédito', 'pré-pago'])
  tipo: string;

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
  @IsDateString()
  dataAbertura?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;
}
