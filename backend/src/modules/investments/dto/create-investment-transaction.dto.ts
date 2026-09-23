import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const TIPOS_ATIVO = ['acao', 'fii', 'etf', 'bdr', 'tesouro', 'cripto', 'renda_fixa'] as const;

export class CreateInvestmentTransactionDto {
  // Conta de tipo 'investimento': o caixa da corretora.
  @IsUUID()
  accountId: string;

  @IsIn(['compra', 'venda', 'dividendo', 'jcp', 'rendimento', 'taxa'])
  tipo: 'compra' | 'venda' | 'dividendo' | 'jcp' | 'rendimento' | 'taxa';

  // Um ativo existente, ou um ticker — que é criado se ainda não existir.
  @ValidateIf((o) => !o.ticker)
  @IsUUID()
  assetId?: string;

  @ValidateIf((o) => !o.assetId)
  @Matches(/^[A-Za-z0-9.\-]{1,20}$/, { message: 'ticker inválido' })
  ticker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeAtivo?: string;

  @IsOptional()
  @IsIn(TIPOS_ATIVO)
  tipoAtivo?: (typeof TIPOS_ATIVO)[number];

  @IsOptional()
  @IsIn(['brapi', 'manual'])
  fonteCotacao?: 'brapi' | 'manual';

  // Compra e venda. Em provento e taxa, omitir.
  @ValidateIf((o) => o.tipo === 'compra' || o.tipo === 'venda')
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  quantidade?: number;

  // Compra e venda: preço por unidade. Provento e taxa: o valor.
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  precoUnitario: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxas?: number;

  @IsDateString()
  data: string;
}
