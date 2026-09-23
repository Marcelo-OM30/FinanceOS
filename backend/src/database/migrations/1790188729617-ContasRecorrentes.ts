import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContasRecorrentes1790188729617 implements MigrationInterface {
    name = 'ContasRecorrentes1790188729617';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // recorrenciaGrupoId e proximoVencimento nunca foram preenchidas: a
        // geração de ocorrências passa a vir de recurring_rules.
        await queryRunner.query(`CREATE TABLE "recurring_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accountId" uuid NOT NULL, "cardId" uuid, "categoryId" uuid, "descricao" character varying(255) NOT NULL, "tipo" character varying(20) NOT NULL, "valorEstimado" numeric(15,2) NOT NULL, "valorVariavel" boolean NOT NULL DEFAULT false, "frequencia" character varying(20) NOT NULL, "diaDoMes" integer, "mesDoAno" integer, "diaDaSemana" integer, "dataInicio" date NOT NULL, "dataFim" date, "ativa" boolean NOT NULL DEFAULT true, "datasPuladas" text NOT NULL DEFAULT '', "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_22942a1b99033aea3a8bc8f9e8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_388f3aeef35c2780701a38902b" ON "recurring_rules" ("userId", "ativa") `);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "recorrenciaGrupoId"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "proximoVencimento"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "recurringRuleId" uuid`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_79df3bb5bede8dd33636f12c7f" ON "transactions" ("recurringRuleId", "dataCompetencia") `);
        await queryRunner.query(`ALTER TABLE "recurring_rules" ADD CONSTRAINT "FK_71df27ebc5aca170edbc2e84b4b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" ADD CONSTRAINT "FK_09eb547dec35cfb2b8959b931d6" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" ADD CONSTRAINT "FK_750aad9f44e47466e519c5561e3" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" ADD CONSTRAINT "FK_58453c7044d0b990f1a23d88be9" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_8a45cd832ede8ad4dc4769dbb3b" FOREIGN KEY ("recurringRuleId") REFERENCES "recurring_rules"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_8a45cd832ede8ad4dc4769dbb3b"`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" DROP CONSTRAINT "FK_58453c7044d0b990f1a23d88be9"`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" DROP CONSTRAINT "FK_750aad9f44e47466e519c5561e3"`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" DROP CONSTRAINT "FK_09eb547dec35cfb2b8959b931d6"`);
        await queryRunner.query(`ALTER TABLE "recurring_rules" DROP CONSTRAINT "FK_71df27ebc5aca170edbc2e84b4b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79df3bb5bede8dd33636f12c7f"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "recurringRuleId"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "proximoVencimento" date`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "recorrenciaGrupoId" uuid`);
        await queryRunner.query(`DROP INDEX "public"."IDX_388f3aeef35c2780701a38902b"`);
        await queryRunner.query(`DROP TABLE "recurring_rules"`);
    }
}
