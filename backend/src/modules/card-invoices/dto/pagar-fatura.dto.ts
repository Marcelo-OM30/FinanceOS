import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Sem `valor`: pagamento parcial é proibido, paga-se sempre o total.
export class PagarFaturaDto {
  @IsUUID()
  accountId: string;

  // Padrão: hoje.
  @IsOptional()
  @IsDateString()
  data?: string;
}
