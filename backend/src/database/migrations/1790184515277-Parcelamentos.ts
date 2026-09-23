import { MigrationInterface, QueryRunner } from 'typeorm';

export class Parcelamentos1790184515277 implements MigrationInterface {
    name = 'Parcelamentos1790184515277';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "installment_purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accountId" uuid NOT NULL, "cardId" uuid, "categoryId" uuid, "descricao" character varying(255) NOT NULL, "valorTotal" numeric(15,2) NOT NULL, "numeroParcelas" integer NOT NULL, "valorParcela" numeric(15,2) NOT NULL, "dataCompra" date NOT NULL, "primeiroVencimento" date NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'ativa', "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ad203c7f0576b6a1761683d858e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8aefe4ad49cfb9902481efc634" ON "installment_purchases" ("userId", "status") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "installmentPurchaseId" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "numeroParcela" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_81ba5759c7cf3e833d0085f27a" ON "transactions" ("installmentPurchaseId") `);
        await queryRunner.query(`ALTER TABLE "installment_purchases" ADD CONSTRAINT "FK_a23cbd30bc8660a2deb63de8a58" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "installment_purchases" ADD CONSTRAINT "FK_a128c98254948bb217a6f1c0078" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "installment_purchases" ADD CONSTRAINT "FK_0d896a28a632f5b4dc48a6cc6bd" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_81ba5759c7cf3e833d0085f27a3" FOREIGN KEY ("installmentPurchaseId") REFERENCES "installment_purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_81ba5759c7cf3e833d0085f27a3"`);
        await queryRunner.query(`ALTER TABLE "installment_purchases" DROP CONSTRAINT "FK_0d896a28a632f5b4dc48a6cc6bd"`);
        await queryRunner.query(`ALTER TABLE "installment_purchases" DROP CONSTRAINT "FK_a128c98254948bb217a6f1c0078"`);
        await queryRunner.query(`ALTER TABLE "installment_purchases" DROP CONSTRAINT "FK_a23cbd30bc8660a2deb63de8a58"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81ba5759c7cf3e833d0085f27a"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "numeroParcela"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "installmentPurchaseId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8aefe4ad49cfb9902481efc634"`);
        await queryRunner.query(`DROP TABLE "installment_purchases"`);
    }
}
