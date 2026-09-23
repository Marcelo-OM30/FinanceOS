import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @Matches(/^[A-Za-z0-9.\-]{1,20}$/, { message: 'ticker inválido' })
  ticker: string;

  @IsString()
  @MaxLength(255)
  nome: string;

  @IsIn(['acao', 'fii', 'etf', 'bdr', 'tesouro', 'cripto', 'renda_fixa'])
  tipo: 'acao' | 'fii' | 'etf' | 'bdr' | 'tesouro' | 'cripto' | 'renda_fixa';

  @IsOptional()
  @IsIn(['brapi', 'manual'])
  fonteCotacao?: 'brapi' | 'manual';
}
