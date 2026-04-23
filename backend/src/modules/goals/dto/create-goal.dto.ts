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

export class CreateGoalDto {
  @IsString()
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valorAlvo: number;

  @IsDateString()
  dataInicio: string;

  @IsDateString()
  dataFim: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['baixa', 'media', 'alta'])
  prioridade?: 'baixa' | 'media' | 'alta';
}
