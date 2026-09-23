import { IsString, IsOptional, IsUUID, MaxLength, ValidateIf } from 'class-validator';

// Só o que não muda valores: renegociar (valor, parcelas, vencimento) é
// cancelar e recadastrar.
export class UpdateInstallmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  descricao?: string;

  // null tira a categoria.
  @IsOptional()
  @ValidateIf((o) => o.categoryId !== null)
  @IsUUID()
  categoryId?: string | null;
}
