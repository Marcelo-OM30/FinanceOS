import {
  IsUUID,
  IsNumber,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateBudgetDto {
  @IsUUID()
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  limiteMensal: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @IsInt()
  @Min(2000)
  ano: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertaPercentual?: number;
}
