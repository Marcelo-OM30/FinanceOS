import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  nome: string;

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

  @IsIn(['receita', 'despesa', 'ambos'])
  tipo: 'receita' | 'despesa' | 'ambos';

  @IsOptional()
  @IsUUID()
  categoriaPaiId?: string;
}
