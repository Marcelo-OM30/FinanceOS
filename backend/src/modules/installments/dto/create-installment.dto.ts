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

  @IsDateString()
  primeiroVencimento: string;

  @IsUUID()
  accountId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
