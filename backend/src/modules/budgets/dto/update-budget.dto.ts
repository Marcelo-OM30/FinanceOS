import {
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  limiteMensal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertaPercentual?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
