import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexTransacoesConfirmadas1790183234807 implements MigrationInterface {
    name = 'IndexTransacoesConfirmadas1790183234807';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_de2136bcd48ec25adf613f0a88" ON "transactions" ("userId", "confirmada", "data") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_de2136bcd48ec25adf613f0a88"`);
    }
}
