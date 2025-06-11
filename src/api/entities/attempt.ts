import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.js';
import { TestResult } from './test-result.js';

@Entity({ name: 'attempt' })
export class Attempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp!: Date;

  @Column({ name: 'compressing_prompt', type: 'text', nullable: false })
  compressingPrompt!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  model!: string;

  @Column({ type: 'varchar', length: 255, name: 'login', nullable: false })
  login!: string;

  @Column({
    name: 'average_compression_ratio',
    type: 'float',
    nullable: true,
    default: null,
  })
  averageCompressionRatio?: number;

  @ManyToOne(() => User, user => user.attempts, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'login', referencedColumnName: 'login' })
  user!: User;

  @OneToMany('TestResult', (testResult: TestResult) => testResult.attempt)
  testResults!: TestResult[];
}
