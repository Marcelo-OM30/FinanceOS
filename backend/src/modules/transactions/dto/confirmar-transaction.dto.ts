import { IsNumber, IsOptional, Min } from 'class-validator';

export class ConfirmarTransactionDto {
  // Valor real, se diferente do previsto. Omitido: confirma com o previsto.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor?: number;
}
