import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1795523048914 implements MigrationInterface {
  name = 'Init1795523048914';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'user', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, CONSTRAINT "UQ_0309de62e0cb0960ebb2cb65c95" UNIQUE ("token_hash"), CONSTRAINT "PK_8515e60a2cc41584fa4784f52ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad88301fdc79593dd222268a8b" ON "password_reset" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "furniture_item" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "category" character varying NOT NULL, "name" character varying(60) NOT NULL, "width_cm" integer NOT NULL, "depth_cm" integer NOT NULL, "symbol" character varying NOT NULL, CONSTRAINT "PK_0581fcb302c227133eebdb04c5c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "project" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(80) NOT NULL, "terrain_polygon" jsonb NOT NULL, "street_edge" integer NOT NULL, "setback_street_cm" integer NOT NULL, "setback_sides_cm" integer NOT NULL, "max_footprint_pct" numeric(5,2) NOT NULL, "min_areas_m2" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "owner_id" uuid NOT NULL, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d40afe32d1d771bea7a5f46818" ON "project" ("owner_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset" ADD CONSTRAINT "FK_ad88301fdc79593dd222268a8b6" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_d40afe32d1d771bea7a5f468185" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_d40afe32d1d771bea7a5f468185"`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset" DROP CONSTRAINT "FK_ad88301fdc79593dd222268a8b6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d40afe32d1d771bea7a5f46818"`,
    );
    await queryRunner.query(`DROP TABLE "project"`);
    await queryRunner.query(`DROP TABLE "furniture_item"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad88301fdc79593dd222268a8b"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
