import { MigrationInterface, QueryRunner } from 'typeorm';

export class FaturasDeCartao1790186278957 implements MigrationInterface {
    name = 'FaturasDeCartao1790186278957';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "card_invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "cardId" uuid NOT NULL, "mes" integer NOT NULL, "ano" integer NOT NULL, "dataFechamento" date NOT NULL, "dataVencimento" date NOT NULL, "valorTotal" numeric(15,2) NOT NULL DEFAULT '0', "status" character varying(20) NOT NULL DEFAULT 'aberta', "pagamentoTransactionId" uuid, "dataCriacao" TIMESTAMP NOT NULL DEFAULT now(), "dataAtualizacao" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a36b35826dfd4c552e23eb7f80" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_92bbda39f7ab22bc841809c8d9" ON "card_invoices" ("cardId", "mes", "ano") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "cardInvoiceId" uuid`);
        await queryRunner.query(`ALTER TABLE "cards" ALTER COLUMN "numeroCriptografado" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_87a846d113e1ef1e755f59bf78" ON "transactions" ("cardInvoiceId") `);
        await queryRunner.query(`ALTER TABLE "card_invoices" ADD CONSTRAINT "FK_ced6ed9eed104ef4cb8f7fc93a3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_invoices" ADD CONSTRAINT "FK_be705f2b3a5c07fd5dedb87e1f7" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_invoices" ADD CONSTRAINT "FK_4a5f02317e72ce68603ce09a825" FOREIGN KEY ("pagamentoTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_87a846d113e1ef1e755f59bf786" FOREIGN KEY ("cardInvoiceId") REFERENCES "card_invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Backfill do §3.4 da spec: a partir daqui compra com cardId não mexe no
        // saldo. As que já existem debitaram a conta quando foram criadas e não
        // pertencem a fatura nenhuma; mantê-las com cardId deixaria o saldo
        // errado na próxima edição ou exclusão. Viram lançamentos comuns da
        // conta — que é exatamente como sempre se comportaram.
        await queryRunner.query(`UPDATE "transactions" SET "cardId" = NULL WHERE "cardId" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // O vínculo das compras antigas com o cartão (UPDATE acima) não volta.
        // numeroCriptografado continua aceitando nulo: cartões novos não têm.
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_87a846d113e1ef1e755f59bf786"`);
        await queryRunner.query(`ALTER TABLE "card_invoices" DROP CONSTRAINT "FK_4a5f02317e72ce68603ce09a825"`);
        await queryRunner.query(`ALTER TABLE "card_invoices" DROP CONSTRAINT "FK_be705f2b3a5c07fd5dedb87e1f7"`);
        await queryRunner.query(`ALTER TABLE "card_invoices" DROP CONSTRAINT "FK_ced6ed9eed104ef4cb8f7fc93a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87a846d113e1ef1e755f59bf78"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "cardInvoiceId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92bbda39f7ab22bc841809c8d9"`);
        await queryRunner.query(`DROP TABLE "card_invoices"`);
    }
}
