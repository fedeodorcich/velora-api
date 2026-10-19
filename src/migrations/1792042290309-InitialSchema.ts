import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1792042290309 implements MigrationInterface {
  name = 'InitialSchema1792042290309';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Necesario para uuid_generate_v4(); TypeORM lo crea al sincronizar, pero las
    // migraciones deben declararlo explícitamente.
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(
      `CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "name" character varying(120) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."clients_status_enum" AS ENUM('lead', 'activo', 'inactivo')`,
    );

    await queryRunner.query(
      `CREATE TABLE "clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying(160) NOT NULL,
        "email" character varying(255) NOT NULL,
        "phone" character varying(50),
        "company" character varying(160),
        "notes" text,
        "status" "public"."clients_status_enum" NOT NULL DEFAULT 'lead',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clients" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "clients"
        ADD CONSTRAINT "FK_clients_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP CONSTRAINT "FK_clients_user"`);
    await queryRunner.query(`DROP TABLE "clients"`);
    await queryRunner.query(`DROP TYPE "public"."clients_status_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
  }
}
