import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { UserAccount } from "./user-account.entity";
import { TestResult } from "./test-result.entity";
import { Expose, Exclude } from "class-transformer";

@Entity({ name: "attempt" })
export class Attempt {
  @Expose()
  @PrimaryGeneratedColumn()
  id!: number;

  @Expose()
  @CreateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  timestamp!: Date;

  @Expose()
  @Column({ type: "text", nullable: true })
  compressing_prompt?: string;

  @Expose()
  @Column({ type: "varchar", length: 255, nullable: true })
  model?: string;

  @Expose()
  @Column({ type: "varchar", length: 255, name: "username", nullable: false })
  username!: string;

  @Exclude()
  @ManyToOne(() => UserAccount, (userAccount) => userAccount.attempts, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "username", referencedColumnName: "username" })
  userAccount!: UserAccount;

  @Exclude()
  @OneToMany(() => TestResult, (testResult) => testResult.attempt)
  testResults!: TestResult[];
}
