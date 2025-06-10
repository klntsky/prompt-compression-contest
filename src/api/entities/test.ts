import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Unique,
} from 'typeorm';
import { TestResult, TestResultStatus } from './test-result.js';

@Entity({ name: 'test' })
@Unique(['model', 'payload'])
export class Test {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  model!: string;

  @Column({ type: 'text', nullable: false })
  payload!: string;

  @Column({
    name: 'is_active',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  isActive!: boolean;

  @Column({
    name: 'uncompressed_status',
    type: 'enum',
    enum: TestResultStatus,
    nullable: true,
    default: null,
  })
  uncompressedStatus?: TestResultStatus;

  @Column({
    name: 'uncompressed_request_json',
    type: 'text',
    nullable: true,
    default: null,
  })
  uncompressedRequestJson?: string;

  @Column({
    name: 'uncompressed_prompt_tokens',
    type: 'integer',
    nullable: true,
    default: null,
  })
  uncompressedPromptTokens?: number;

  @OneToMany('TestResult', (testResult: TestResult) => testResult.test)
  testResults!: TestResult[];
}
