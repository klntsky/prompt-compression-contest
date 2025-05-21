import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { TestResult } from '../test-result/test-result.entity';
import { Expose, Exclude } from 'class-transformer';

@Entity({ name: 'test' })
export class Test {
  @Expose()
  @PrimaryGeneratedColumn()
  id!: number;

  @Expose()
  @Column({ type: 'varchar', length: 255, nullable: true })
  model?: string;

  @Expose()
  @Column({ type: 'text', nullable: true })
  payload?: string;

  @Exclude()
  @OneToMany(() => TestResult, (testResult) => testResult.test)
  testResults!: TestResult[];
}
