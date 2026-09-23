import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsDateString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

export class CreateInstallmentDto {
  @IsString()
  @MaxLength(240) // sobra espaço para o " (12/12)" na descrição de cada parcela
  descricao: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.02)
  valorTotal: number;

  @IsInt()
  @Min(2)
  @Max(120)
  numeroParcelas: number;

  @IsDateString()
  dataCompra: string;

  // No cartão, o vencimento vem da fatura em que cada parcela cai.
  @ValidateIf((o) => !o.cardId)
  @IsDateString()
  primeiroVencimento?: string;

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
