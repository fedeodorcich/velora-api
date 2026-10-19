import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePayments1792213843417 implements MigrationInterface {
    name = 'CreatePayments1792213843417'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('pendiente', 'pagado')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "project_id" uuid NOT NULL, "number" integer NOT NULL, "concept" character varying(200) NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL, "due_date" date NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pendiente', "paid_at" TIMESTAMP WITH TIME ZONE, "method" character varying(40), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payments_user_number" ON "payments"  ("user_id", "number") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_project"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_user"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_payments_user_number"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    }

}
