import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Unique,
} from 'typeorm';
import { TestResult } from './test-result.js';

@Entity({ name: 'test' })
@Unique(['model', 'payload'])
export class Test {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  model!: string;

  @Column({ type: 'text', nullable: false })
  payload!: string;

  @OneToMany(() => TestResult, testResult => testResult.test)
  testResults!: TestResult[];
}
