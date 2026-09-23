import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrcamentoRollover1790187639098 implements MigrationInterface {
    name = 'OrcamentoRollover1790187639098';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // gastoAtual era gravado e nunca lido: o gasto é recalculado a cada leitura.
        await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN "gastoAtual"`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD "rollover" character varying(20) NOT NULL DEFAULT 'nenhum'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN "rollover"`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD "gastoAtual" numeric(15,2) NOT NULL DEFAULT '0'`);
    }
}
