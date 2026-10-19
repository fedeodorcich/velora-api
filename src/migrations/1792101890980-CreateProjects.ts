import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjects1792101890980 implements MigrationInterface {
    name = 'CreateProjects1792101890980'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('planificado', 'en_progreso', 'pausado', 'finalizado', 'cancelado')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "client_id" uuid NOT NULL, "quote_id" uuid, "number" integer NOT NULL, "name" character varying(200) NOT NULL, "status" "public"."projects_status_enum" NOT NULL DEFAULT 'planificado', "currency" character varying(3) NOT NULL DEFAULT 'USD', "budget" numeric(12,2) NOT NULL DEFAULT '0', "progress" integer NOT NULL DEFAULT '0', "start_date" date, "due_date" date, "description" text, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_projects_quote" ON "projects"  ("quote_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_projects_user_number" ON "projects"  ("user_id", "number") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_client" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_quote" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_quote"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_client"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_user"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_projects_user_number"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_projects_quote"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    }

}
