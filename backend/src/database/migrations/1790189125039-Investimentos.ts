import { MigrationInterface, QueryRunner } from 'typeorm';

export class Investimentos1790189125039 implements MigrationInterface {
    name = 'Investimentos1790189125039';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "ticker" character varying(20) NOT NULL, "nome" character varying(255) NOT NULL, "tipo" character varying(20) NOT NULL, "moeda" character varying(3) NOT NULL DEFAULT 'BRL', "fonteCotacao" character varying(20) NOT NULL DEFAULT 'manual', "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9b709bd296948e6500b38d17b4" ON "assets" ("userId", "ticker") `);
        await queryRunner.query(`CREATE TABLE "asset_quotes" ("assetId" uuid NOT NULL, "data" date NOT NULL, "preco" numeric(15,6) NOT NULL, CONSTRAINT "PK_26eea73f3418d7b008fafa370a5" PRIMARY KEY ("assetId", "data"))`);
        await queryRunner.query(`CREATE TABLE "investment_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accountId" uuid NOT NULL, "assetId" uuid NOT NULL, "tipo" character varying(20) NOT NULL, "quantidade" numeric(18,8) NOT NULL, "precoUnitario" numeric(15,6) NOT NULL, "taxas" numeric(15,2) NOT NULL DEFAULT '0', "data" date NOT NULL, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f1f10cd2594cd595d676d7e136" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f34912a3d35a427c98f256b072" ON "investment_transactions" ("userId", "assetId", "data") `);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_d8cf9bdec7d2fad0852aec349c1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_quotes" ADD CONSTRAINT "FK_111624bbf0a7fa138ed9e17fe9b" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "investment_transactions" ADD CONSTRAINT "FK_142fd445d4e585467c319211e38" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "investment_transactions" ADD CONSTRAINT "FK_79dd277600dee0b3e3fea2314e0" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "investment_transactions" ADD CONSTRAINT "FK_a193fb3f13836f7b800aa5a970d" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "investment_transactions" DROP CONSTRAINT "FK_a193fb3f13836f7b800aa5a970d"`);
        await queryRunner.query(`ALTER TABLE "investment_transactions" DROP CONSTRAINT "FK_79dd277600dee0b3e3fea2314e0"`);
        await queryRunner.query(`ALTER TABLE "investment_transactions" DROP CONSTRAINT "FK_142fd445d4e585467c319211e38"`);
        await queryRunner.query(`ALTER TABLE "asset_quotes" DROP CONSTRAINT "FK_111624bbf0a7fa138ed9e17fe9b"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_d8cf9bdec7d2fad0852aec349c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f34912a3d35a427c98f256b072"`);
        await queryRunner.query(`DROP TABLE "investment_transactions"`);
        await queryRunner.query(`DROP TABLE "asset_quotes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b709bd296948e6500b38d17b4"`);
        await queryRunner.query(`DROP TABLE "assets"`);
    }
}
