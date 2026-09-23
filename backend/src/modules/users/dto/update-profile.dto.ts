import { IsOptional, IsString, IsIn, MaxLength, IsTimeZone } from 'class-validator';

/**
 * Restringe o que o próprio usuário pode alterar no seu perfil. Sem este DTO o
 * controller recebia Partial<User>, que o ValidationPipe não filtra (não é uma
 * classe com decorators), abrindo espaço para gravar campos como passwordHash,
 * emailVerificado ou ativo direto pelo corpo da requisição.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  moedaPadrao?: string;

  // Fuso IANA (ex.: America/Sao_Paulo). Usado em todo cálculo de "hoje" e de mês.
  @IsOptional()
  @IsTimeZone()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsIn(['light', 'dark'])
  preferenciaTema?: string;
}
