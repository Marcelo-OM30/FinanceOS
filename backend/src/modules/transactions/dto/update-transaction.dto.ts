import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
  IsUUID,
  IsBoolean,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(['receita', 'despesa', 'transferência'])
  tipo?: 'receita' | 'despesa' | 'transferência';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor?: number;

  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  cardId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  dataCompetencia?: string;

  @IsOptional()
  @IsIn(['única', 'semanal', 'mensal', 'anual'])
  recorrencia?: 'única' | 'semanal' | 'mensal' | 'anual';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroNota?: string;

  @IsOptional()
  @IsBoolean()
  confirmada?: boolean;

  @IsOptional()
  @IsBoolean()
  reconciliada?: boolean;
}
