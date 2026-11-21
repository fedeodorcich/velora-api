import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProPurchases1792213843421 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE billing_pro_purchases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount numeric(12,2) NOT NULL CHECK (amount > 0), currency varchar(3) NOT NULL DEFAULT 'ARS',
      preference_id varchar(128), checkout_url text, status varchar(32) NOT NULL DEFAULT 'pending',
      granted_until timestamptz, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX "IDX_pro_purchases_user" ON billing_pro_purchases (user_id, created_at);`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE billing_pro_purchases');
  }
}
