import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateQuotes1792045166355 implements MigrationInterface {
    name = 'CreateQuotes1792045166355'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."quotes_status_enum" AS ENUM('borrador', 'enviado', 'aceptado', 'rechazado')`);
        await queryRunner.query(`CREATE TABLE "quotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "client_id" uuid NOT NULL, "number" integer NOT NULL, "title" character varying(200) NOT NULL, "status" "public"."quotes_status_enum" NOT NULL DEFAULT 'borrador', "currency" character varying(3) NOT NULL DEFAULT 'USD', "issue_date" date NOT NULL, "valid_until" date, "tax_rate" numeric(5,2) NOT NULL DEFAULT '0', "subtotal" numeric(12,2) NOT NULL DEFAULT '0', "tax_amount" numeric(12,2) NOT NULL DEFAULT '0', "total" numeric(12,2) NOT NULL DEFAULT '0', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_99a0e8bcbcd8719d3a41f23c263" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_quotes_user_number" ON "quotes"  ("user_id", "number") `);
        await queryRunner.query(`CREATE TABLE "quote_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quote_id" uuid NOT NULL, "description" character varying(200) NOT NULL, "quantity" numeric(12,2) NOT NULL, "unit_price" numeric(12,2) NOT NULL, "position" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_135ad3f02b5abcf65fb5cb20ad2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "quotes" ADD CONSTRAINT "FK_quotes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quotes" ADD CONSTRAINT "FK_quotes_client" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quote_items" ADD CONSTRAINT "FK_quote_items_quote" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quote_items" DROP CONSTRAINT "FK_quote_items_quote"`);
        await queryRunner.query(`ALTER TABLE "quotes" DROP CONSTRAINT "FK_quotes_client"`);
        await queryRunner.query(`ALTER TABLE "quotes" DROP CONSTRAINT "FK_quotes_user"`);
        await queryRunner.query(`DROP TABLE "quote_items"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_quotes_user_number"`);
        await queryRunner.query(`DROP TABLE "quotes"`);
        await queryRunner.query(`DROP TYPE "public"."quotes_status_enum"`);
    }

}
