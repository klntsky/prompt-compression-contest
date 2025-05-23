import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { TestResult } from "./test-result";

@Entity({ name: "test" })
export class Test {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, nullable: false })
  model!: string;

  @Column({ type: "text", nullable: false })
  payload!: string;

  @OneToMany(() => TestResult, (testResult) => testResult.test)
  testResults!: TestResult[];
}
