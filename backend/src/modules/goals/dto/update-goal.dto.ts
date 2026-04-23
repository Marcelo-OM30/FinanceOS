import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorAlvo?: number;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['baixa', 'media', 'alta'])
  prioridade?: 'baixa' | 'media' | 'alta';

  @IsOptional()
  @IsIn(['ativa', 'pausada', 'concluída', 'não_atingida'])
  status?: string;
}
