import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsDateString,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MaxLength(255)
  nome: string;

  @IsIn(['corrente', 'poupança', 'investimento', 'carteira', 'outro'])
  tipo: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  banco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  agencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroConta?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saldoInicial?: number;

  @IsOptional()
  @IsIn(['BRL', 'USD', 'EUR'])
  moeda?: string;

  @IsOptional()
  @IsDateString()
  dataAbertura?: string;
}
