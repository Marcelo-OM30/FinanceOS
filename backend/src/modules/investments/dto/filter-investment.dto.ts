import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class FilterInvestmentTransactionDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

export class BuscaAtivoDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;
}
