import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1785203201044 implements MigrationInterface {
    name = 'InitSchema1785203201044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "budgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "categoryId" uuid NOT NULL, "limiteMensal" numeric(15,2) NOT NULL, "gastoAtual" numeric(15,2) NOT NULL DEFAULT '0', "mes" integer NOT NULL, "ano" integer NOT NULL, "alertaPercentual" integer NOT NULL DEFAULT '80', "ativo" boolean NOT NULL DEFAULT true, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9dd944c11de82c4eaf718a1ecd" ON "budgets" ("userId", "mes", "ano") `);
        await queryRunner.query(`CREATE TABLE "goal_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalId" uuid NOT NULL, "valorAdicionado" numeric(15,2) NOT NULL, "percentualProgresso" numeric(5,2), "dataRegistro" date NOT NULL DEFAULT ('now'::text)::date, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_063570ca3418e9fc676a412e647" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "goals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "categoryId" uuid, "nome" character varying(255) NOT NULL, "descricao" text, "valorAlvo" numeric(15,2) NOT NULL, "valorAtual" numeric(15,2) NOT NULL DEFAULT '0', "dataInicio" date NOT NULL, "dataFim" date NOT NULL, "prioridade" character varying(20) NOT NULL DEFAULT 'media', "status" character varying(20) NOT NULL DEFAULT 'ativa', "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_26e17b251afab35580dff769223" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "nome" character varying(100) NOT NULL, "descricao" text, "icone" character varying(50), "cor" character varying(7), "tipo" character varying(20) NOT NULL, "categoriaPaiId" uuid, "customizada" boolean NOT NULL DEFAULT false, "ativo" boolean NOT NULL DEFAULT true, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_292984763eb9058d9e04683174" ON "categories" ("userId", "nome") `);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accountId" uuid NOT NULL, "cardId" uuid, "categoryId" uuid, "tipo" character varying(20) NOT NULL, "descricao" character varying(255) NOT NULL, "valor" numeric(15,2) NOT NULL, "data" date NOT NULL, "dataCompetencia" date, "recurso" character varying(50) NOT NULL DEFAULT 'manual', "recorrencia" character varying(20), "recorrenciaGrupoId" uuid, "proximoVencimento" date, "tags" text NOT NULL DEFAULT ARRAY[]::varchar[], "numeroNota" character varying(50), "referenciaExterna" character varying(255), "reconciliada" boolean NOT NULL DEFAULT false, "confirmada" boolean NOT NULL DEFAULT true, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_26d8aec71ae9efbe468043cd2b" ON "transactions" ("accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86e965e74f9cc66149cf6c90f6" ON "transactions" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bd1d48334c67017d00e5d722df" ON "transactions" ("userId", "data") `);
        await queryRunner.query(`CREATE TABLE "cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accountId" uuid NOT NULL, "nome" character varying(255) NOT NULL, "numeroCriptografado" character varying(255) NOT NULL, "ultimosDigitos" character varying(4), "tipo" character varying(20) NOT NULL, "bandeira" character varying(50), "limite" numeric(15,2), "limiteUtilizado" numeric(15,2) NOT NULL DEFAULT '0', "vencimentoFatura" integer, "dataFechamentoFatura" integer, "ativo" boolean NOT NULL DEFAULT true, "dataAbertura" date, "dataVencimento" date, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5f3269634705fdff4a9935860fc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "nome" character varying(255) NOT NULL, "tipo" character varying(50) NOT NULL, "banco" character varying(100), "agencia" character varying(10), "numeroConta" character varying(20), "saldoInicial" numeric(15,2) NOT NULL DEFAULT '0', "saldoAtual" numeric(15,2) NOT NULL DEFAULT '0', "moeda" character varying(3) NOT NULL DEFAULT 'BRL', "ativo" boolean NOT NULL DEFAULT true, "cor" character varying(20), "dataAbertura" date, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1f7345d204bf9ff469fa21426c" ON "accounts" ("userId", "numeroConta") `);
        await queryRunner.query(`CREATE INDEX "IDX_3aa23c0a6d107393e8b40e3e2a" ON "accounts" ("userId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "nome" character varying(255) NOT NULL, "avatarUrl" character varying(255), "telefone" character varying(20), "documento" character varying(20), "dataNascimento" date, "moedaPadrao" character varying(3) NOT NULL DEFAULT 'BRL', "timezone" character varying(50) NOT NULL DEFAULT 'America/Sao_Paulo', "preferenciaTema" character varying(20) NOT NULL DEFAULT 'light', "ativo" boolean NOT NULL DEFAULT true, "emailVerificado" boolean NOT NULL DEFAULT false, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), "ultimoLogin" TIMESTAMP, "dataExclusao" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tipo" character varying(50) NOT NULL, "mensagem" text NOT NULL, "descricao" text, "entidadeTipo" character varying(50), "entidadeId" uuid, "severidade" character varying(20) NOT NULL DEFAULT 'info', "lido" boolean NOT NULL DEFAULT false, "dataLeitura" TIMESTAMP, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f2678f7b11e5128abbbc451190" ON "alerts" ("userId") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "acao" character varying(50) NOT NULL, "entidadeTipo" character varying(50), "entidadeId" uuid, "valoresAnteriores" jsonb, "valoresNovos" jsonb, "enderecoIp" character varying(45), "userAgent" text, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97b1d43c3837d5e0bab002ab21" ON "audit_logs" ("userId", "dataCriacao") `);
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_27e688ddf1ff3893b43065899f9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_3ece6e1292b7a86ba82145775a7" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goal_progress" ADD CONSTRAINT "FK_3072decc9875065b432dc00214b" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goals" ADD CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "goals" ADD CONSTRAINT "FK_59749dbe0f070d8bf1de526a49e" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_abc9667781098fb37981b6ee0ca" FOREIGN KEY ("categoriaPaiId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_d1dac70b33bf7a903782df5b637" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_86e965e74f9cc66149cf6c90f64" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cards" ADD CONSTRAINT "FK_7b7230897ecdeb7d6b0576d907b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cards" ADD CONSTRAINT "FK_feb35b86695f9af40d2c1ef1ba6" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_3aa23c0a6d107393e8b40e3e2a6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_f2678f7b11e5128abbbc4511906" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_f2678f7b11e5128abbbc4511906"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_3aa23c0a6d107393e8b40e3e2a6"`);
        await queryRunner.query(`ALTER TABLE "cards" DROP CONSTRAINT "FK_feb35b86695f9af40d2c1ef1ba6"`);
        await queryRunner.query(`ALTER TABLE "cards" DROP CONSTRAINT "FK_7b7230897ecdeb7d6b0576d907b"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_86e965e74f9cc66149cf6c90f64"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_d1dac70b33bf7a903782df5b637"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_26d8aec71ae9efbe468043cd2b9"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_abc9667781098fb37981b6ee0ca"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741"`);
        await queryRunner.query(`ALTER TABLE "goals" DROP CONSTRAINT "FK_59749dbe0f070d8bf1de526a49e"`);
        await queryRunner.query(`ALTER TABLE "goals" DROP CONSTRAINT "FK_57dd8a3fc26eb760d076bf8840e"`);
        await queryRunner.query(`ALTER TABLE "goal_progress" DROP CONSTRAINT "FK_3072decc9875065b432dc00214b"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_3ece6e1292b7a86ba82145775a7"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_27e688ddf1ff3893b43065899f9"`);
        await queryRunner.query(`DROP INDEX "IDX_97b1d43c3837d5e0bab002ab21"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "IDX_f2678f7b11e5128abbbc451190"`);
        await queryRunner.query(`DROP TABLE "alerts"`);
        await queryRunner.query(`DROP INDEX "IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "IDX_3aa23c0a6d107393e8b40e3e2a"`);
        await queryRunner.query(`DROP INDEX "IDX_1f7345d204bf9ff469fa21426c"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TABLE "cards"`);
        await queryRunner.query(`DROP INDEX "IDX_bd1d48334c67017d00e5d722df"`);
        await queryRunner.query(`DROP INDEX "IDX_86e965e74f9cc66149cf6c90f6"`);
        await queryRunner.query(`DROP INDEX "IDX_26d8aec71ae9efbe468043cd2b"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP INDEX "IDX_292984763eb9058d9e04683174"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TABLE "goals"`);
        await queryRunner.query(`DROP TABLE "goal_progress"`);
        await queryRunner.query(`DROP INDEX "IDX_9dd944c11de82c4eaf718a1ecd"`);
        await queryRunner.query(`DROP TABLE "budgets"`);
    }

}
