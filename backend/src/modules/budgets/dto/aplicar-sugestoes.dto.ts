import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class ItemSugestaoDto {
  @IsUUID()
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  limiteMensal: number;

  @IsOptional()
  @IsIn(['nenhum', 'acumula', 'ajustado'])
  rollover?: 'nenhum' | 'acumula' | 'ajustado';
}

export class AplicarSugestoesDto {
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @IsInt()
  @Min(2000)
  ano: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemSugestaoDto)
  itens: ItemSugestaoDto[];
}
