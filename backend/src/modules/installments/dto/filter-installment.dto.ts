import { IsIn, IsOptional } from 'class-validator';

export class FilterInstallmentDto {
  @IsOptional()
  @IsIn(['ativa', 'quitada', 'cancelada'])
  status?: 'ativa' | 'quitada' | 'cancelada';
}
