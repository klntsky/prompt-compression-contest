import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Attempt } from './attempt.js';
import { Test } from './test.js';

@Entity({ name: 'test_result' })
export class TestResult {
  @PrimaryColumn({ type: 'integer', name: 'attempt_id' })
  attemptId!: number;

  @PrimaryColumn({ type: 'integer', name: 'test_id' })
  testId!: number;

  @Column({ name: 'is_valid', type: 'boolean', nullable: true, default: null })
  isValid?: boolean;

  @Column({ name: 'compressed_prompt', type: 'text', nullable: true })
  compressedPrompt?: string;

  @Column({ name: 'compression_ratio', type: 'float', nullable: true })
  compressionRatio?: number;

  @Column({ name: 'is_failed', type: 'boolean', nullable: true, default: null })
  isFailed?: boolean;

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
