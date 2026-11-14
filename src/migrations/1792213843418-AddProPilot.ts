import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProPilot1792213843418 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "pro_until" timestamptz,
      ADD "quote_logo" text,
      ADD "pro_requested_at" timestamptz
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "pro_requested_at",
      DROP COLUMN "quote_logo",
      DROP COLUMN "pro_until"
    `);
  }
}
