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
  Matches,
} from 'class-validator';

export class CreateCardDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @MaxLength(255)
  nome: string;

  // Só os 4 últimos: para controlar fatura o número completo não serve para
  // nada e seria o dado mais sensível do banco.
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'ultimosDigitos deve ter exatamente 4 dígitos' })
  ultimosDigitos?: string;

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
