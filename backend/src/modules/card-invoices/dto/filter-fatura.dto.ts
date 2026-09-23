import { IsOptional, IsUUID } from 'class-validator';

export class FilterFaturaDto {
  @IsOptional()
  @IsUUID()
  cardId?: string;
}
