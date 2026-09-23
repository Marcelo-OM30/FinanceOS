import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_quotes')
export class AssetQuote {
  @PrimaryColumn('uuid')
  assetId!: string;

  @PrimaryColumn('date')
  data!: string;

  @Column('decimal', { precision: 15, scale: 6 })
  preco!: number;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  asset!: Asset;
}
