import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class CotacaoDto {
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  preco: number;

  // Padrão: hoje.
  @IsOptional()
  @IsDateString()
  data?: string;
}
