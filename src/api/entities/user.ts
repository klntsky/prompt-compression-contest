import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { Attempt } from './attempt.js';

@Entity('user')
export class User {
  @PrimaryColumn({ length: 255 })
  login!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  password!: string;

  @Column({ type: 'boolean', default: false })
  isAdmin!: boolean;

  @OneToMany('Attempt', (attempt: Attempt) => attempt.user)
  attempts!: Attempt[];
}
