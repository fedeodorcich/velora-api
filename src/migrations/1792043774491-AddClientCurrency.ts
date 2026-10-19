import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientCurrency1792043774491 implements MigrationInterface {
  name = 'AddClientCurrency1792043774491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD "currency" character varying(3) NOT NULL DEFAULT 'USD'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "currency"`);
  }
}
