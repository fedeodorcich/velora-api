import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddLifetimeAdFree1795723201000 implements MigrationInterface {
 async up(q:QueryRunner):Promise<void>{
 await q.query('ALTER TABLE "users" ADD "ad_free_since" timestamptz, ADD "ad_free_payment_ref" varchar(128)');
 await q.query('CREATE UNIQUE INDEX "users_ad_free_payment_unique" ON "users" ("ad_free_payment_ref")');
 }
 async down(q:QueryRunner):Promise<void>{
 await q.query('DROP INDEX "users_ad_free_payment_unique"');
 await q.query('ALTER TABLE "users" DROP COLUMN "ad_free_since", DROP COLUMN "ad_free_payment_ref"');
 }
}
