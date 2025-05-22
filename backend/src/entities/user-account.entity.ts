import { Entity, PrimaryColumn, Column, OneToMany } from "typeorm";
import { Attempt } from "../entities/attempt.entity";
import { Expose, Exclude } from "class-transformer";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

@Entity("user_account")
export class UserAccount {
  @Expose()
  @PrimaryColumn({ length: 255 })
  username!: string;

  @Exclude()
  @Column({ type: "varchar", length: 255, unique: true, nullable: false })
  email!: string;

  @Exclude()
  @Column({ type: "varchar", length: 255, nullable: false })
  password!: string;

  @Expose()
  @Column({
    type: "simple-array",
    default: [UserRole.USER],
  })
  roles!: UserRole[];

  @Exclude()
  @OneToMany(() => Attempt, (attempt) => attempt.userAccount)
  attempts!: Attempt[];
}
