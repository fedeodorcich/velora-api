import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingWebhooks1792213843420 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD mp_pro_until timestamptz, ADD mp_subscription_status varchar(32);
      CREATE TABLE billing_webhook_jobs (
        id varchar(120) PRIMARY KEY,
        topic varchar(48) NOT NULL,
        resource_id varchar(64) NOT NULL,
        pending boolean NOT NULL DEFAULT true,
        attempts integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL
      );
      CREATE INDEX "IDX_billing_webhook_jobs_due" ON billing_webhook_jobs (pending, next_attempt_at);
      CREATE TABLE billing_subscription_payments (
        id varchar(64) PRIMARY KEY,
        user_id uuid NOT NULL,
        subscription_id varchar(64) NOT NULL,
        status varchar(32) NOT NULL,
        valid_until timestamptz,
        CONSTRAINT "FK_subscription_payments_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX "IDX_subscription_payments_user" ON billing_subscription_payments (user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE billing_subscription_payments;
      DROP TABLE billing_webhook_jobs;
      ALTER TABLE users DROP COLUMN mp_subscription_status, DROP COLUMN mp_pro_until;
    `);
  }
}
