import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddContactRequests1792213843422 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `CREATE TABLE contact_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL, email varchar(254) NOT NULL, subject varchar(30) NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX "IDX_contact_requests_email_date" ON contact_requests(email,created_at)`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE contact_requests');
  }
}
