import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddGoogleIdentity1795723200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "google_sub" varchar(255)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "users_google_sub_unique" ON "users" ("google_sub")',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "users_google_sub_unique"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "google_sub"');
  }
}
