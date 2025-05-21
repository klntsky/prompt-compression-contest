import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { Attempt } from '../attempt/attempt.entity';
import { Expose, Exclude } from 'class-transformer';

// It's good practice to define roles as an enum if they are fixed
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('user_account')
export class UserAccount {
  @Expose()
  @PrimaryColumn({ length: 255 })
  username!: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
  email!: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: false })
  password!: string;

  @Expose() // Expose roles so they can be checked, or included in JWT
  @Column({
    type: 'simple-array', // Stores array as comma-separated string or other simple format
    default: [UserRole.USER], // Default role for new users
  })
  roles!: UserRole[];

  @Exclude() // Exclude attempts by default
  @OneToMany(() => Attempt, (attempt) => attempt.userAccount)
  attempts!: Attempt[];
}
