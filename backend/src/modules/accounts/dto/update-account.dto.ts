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

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsIn(['corrente', 'poupanca', 'investimento', 'carteira', 'outro'])
  tipo?: string;

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
  @IsIn(['BRL', 'USD', 'EUR'])
  moeda?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDateString()
  dataAbertura?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cor?: string;
}
