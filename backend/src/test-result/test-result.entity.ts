import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Attempt } from '../attempt/attempt.entity';
import { Test } from '../test/test.entity';
import { Expose, Exclude } from 'class-transformer';

@Entity({ name: 'test_result' })
export class TestResult {
  @Expose()
  @PrimaryColumn({ type: 'integer', name: 'attempt_id' })
  attemptId!: number;

  @Expose()
  @PrimaryColumn({ type: 'integer', name: 'test_id' })
  testId!: number;

  @Expose()
  @Column({ type: 'boolean', nullable: true })
  is_valid?: boolean;

  @Expose()
  @Column({ type: 'text', nullable: true })
  compressed_prompt?: string;

  @Expose()
  @Column({ type: 'float', nullable: true })
  compression_ratio?: number;

  @Exclude()
  @ManyToOne(() => Attempt, (attempt) => attempt.testResults, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'attempt_id', referencedColumnName: 'id' })
  attempt!: Attempt;

  @Exclude()
  @ManyToOne(() => Test, (test) => test.testResults, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'test_id', referencedColumnName: 'id' })
  test!: Test;
}
