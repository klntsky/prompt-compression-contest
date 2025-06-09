import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Attempt } from './attempt.js';
import { Test } from './test.js';

export enum TestResultStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  VALID = 'valid',
}

@Entity({ name: 'test_result' })
export class TestResult {
  @PrimaryColumn({ type: 'integer', name: 'attempt_id' })
  attemptId!: number;

  @PrimaryColumn({ type: 'integer', name: 'test_id' })
  testId!: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TestResultStatus,
    default: TestResultStatus.PENDING,
  })
  status!: TestResultStatus;

  @Column({
    name: 'compressed_prompt',
    type: 'text',
    nullable: true,
    default: null,
  })
  compressedPrompt?: string;

  @Column({
    name: 'compression_ratio',
    type: 'float',
    nullable: true,
    default: null,
  })
  compressionRatio?: number;

  @Column({
    name: 'request_json',
    type: 'text',
    nullable: true,
    default: null,
  })
  requestJson?: string;

  @UpdateDateColumn({
    name: 'last_modified',
    type: 'timestamp with time zone',
  })
  lastModified!: Date;

  @ManyToOne('Attempt', (attempt: Attempt) => attempt.testResults, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'attempt_id', referencedColumnName: 'id' })
  attempt!: Attempt;

  @ManyToOne(() => Test, test => test.testResults, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'test_id', referencedColumnName: 'id' })
  test!: Test;
}
