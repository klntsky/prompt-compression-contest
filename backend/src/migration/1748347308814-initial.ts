import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1748347308814 implements MigrationInterface {
    name = 'Initial1748347308814'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test" ("id" SERIAL NOT NULL, "model" character varying(255) NOT NULL, "payload" text NOT NULL, CONSTRAINT "PK_5417af0062cf987495b611b59c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "test_result" ("attempt_id" integer NOT NULL, "test_id" integer NOT NULL, "is_valid" boolean, "compressed_prompt" text, "compression_ratio" double precision, CONSTRAINT "PK_c3de5e04649cbc837e21095e237" PRIMARY KEY ("attempt_id", "test_id"))`);
        await queryRunner.query(`CREATE TABLE "attempt" ("id" SERIAL NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "compressing_prompt" text NOT NULL, "model" character varying(255) NOT NULL, "login" character varying(255) NOT NULL, CONSTRAINT "PK_5f822b29b3128d1c65d3d6c193d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("login" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_a62473490b3e4578fd683235c5e" PRIMARY KEY ("login"))`);
        await queryRunner.query(`ALTER TABLE "test_result" ADD CONSTRAINT "FK_3e70defdd20a54b314c6ef47955" FOREIGN KEY ("attempt_id") REFERENCES "attempt"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "test_result" ADD CONSTRAINT "FK_079bc888154f2fb164ab0426760" FOREIGN KEY ("test_id") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attempt" ADD CONSTRAINT "FK_918f929c9d305757721b0ad12b8" FOREIGN KEY ("login") REFERENCES "user"("login") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attempt" DROP CONSTRAINT "FK_918f929c9d305757721b0ad12b8"`);
        await queryRunner.query(`ALTER TABLE "test_result" DROP CONSTRAINT "FK_079bc888154f2fb164ab0426760"`);
        await queryRunner.query(`ALTER TABLE "test_result" DROP CONSTRAINT "FK_3e70defdd20a54b314c6ef47955"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "attempt"`);
        await queryRunner.query(`DROP TABLE "test_result"`);
        await queryRunner.query(`DROP TABLE "test"`);
    }

}
