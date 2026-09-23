import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContaDestinoTransferencia1790180067152 implements MigrationInterface {
    name = 'AddContaDestinoTransferencia1790180067152';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "contaDestinoId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_f16a8d3254ef36246289fe699e" ON "transactions" ("contaDestinoId") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_f16a8d3254ef36246289fe699e6" FOREIGN KEY ("contaDestinoId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_f16a8d3254ef36246289fe699e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f16a8d3254ef36246289fe699e"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "contaDestinoId"`);
    }
}
