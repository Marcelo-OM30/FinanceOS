import {
  IsBoolean,
  IsDateString,
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

// Tipo, frequência, conta e cartão não mudam: para isso, crie outra regra.
export class UpdateRecurringDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorEstimado?: number;

  @IsOptional()
  @IsBoolean()
  valorVariavel?: boolean;

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

  // null = sem fim.
  @IsOptional()
  @ValidateIf((o) => o.dataFim !== null)
  @IsDateString()
  dataFim?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.categoryId !== null)
  @IsUUID()
  categoryId?: string | null;

  // false pausa: some a previsão futura, fica o que já aconteceu.
  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
