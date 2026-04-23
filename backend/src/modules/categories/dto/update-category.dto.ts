import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'cor deve ser um hex válido (#RRGGBB)' })
  cor?: string;

  @IsOptional()
  @IsIn(['receita', 'despesa', 'ambos'])
  tipo?: 'receita' | 'despesa' | 'ambos';

  @IsOptional()
  @IsUUID()
  categoriaPaiId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
