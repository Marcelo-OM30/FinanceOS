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
  ValidateIf,
} from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['receita', 'despesa', 'transferência'])
  tipo: 'receita' | 'despesa' | 'transferência';

  @IsString()
  @MaxLength(255)
  descricao: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor: number;

  @IsDateString()
  data: string;

  @IsUUID()
  accountId: string;

  // Obrigatória em transferência; nos outros tipos o service recusa.
  @ValidateIf((o) => o.tipo === 'transferência')
  @IsUUID()
  contaDestinoId?: string;

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
  @IsIn(['manual', 'importado', 'bancário'])
  recurso?: 'manual' | 'importado' | 'bancário';

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
}
