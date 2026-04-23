import { IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

export class AddProgressDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorAdicionado: number;

  @IsOptional()
  @IsDateString()
  dataRegistro?: string;
}
