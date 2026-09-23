import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class SugestoesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  ano: number;
}
