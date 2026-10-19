import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientCuilCuit1792100000000 implements MigrationInterface {
  name = 'AddClientCuilCuit1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" ADD "cuil_cuit" character varying(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "cuil_cuit"`);
  }
}
