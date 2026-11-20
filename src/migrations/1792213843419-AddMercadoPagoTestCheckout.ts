import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMercadoPagoTestCheckout1792213843419 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD "mp_test_checkout_url" text');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "mp_test_checkout_url"');
  }
}
