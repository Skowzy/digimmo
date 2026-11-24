import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordChangedAt1795523827564 implements MigrationInterface {
  name = 'PasswordChangedAt1795523827564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "password_changed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "password_changed_at"`,
    );
  }
}
