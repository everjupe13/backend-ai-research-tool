import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResearchReports1779310678755 implements MigrationInterface {
    name = 'AddResearchReports1779310678755'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."research_reports_status_enum" AS ENUM('pending', 'processing', 'done', 'failed')`);
        await queryRunner.query(`CREATE TABLE "research_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "topic" character varying NOT NULL, "status" "public"."research_reports_status_enum" NOT NULL DEFAULT 'pending', "summary" text, "sources" jsonb, "error_message" text, CONSTRAINT "PK_38ec3abcb7ea0961441d6b46ced" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "research_reports" ADD CONSTRAINT "FK_6f20643a4ca664cae7c3ae78191" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "research_reports" DROP CONSTRAINT "FK_6f20643a4ca664cae7c3ae78191"`);
        await queryRunner.query(`DROP TABLE "research_reports"`);
        await queryRunner.query(`DROP TYPE "public"."research_reports_status_enum"`);
    }

}
