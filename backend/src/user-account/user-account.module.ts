import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAccount } from './user-account.entity';
import { UserAccountController } from './user-account.controller';
import { UserAccountService } from './user-account.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserAccount])],
  controllers: [UserAccountController],
  providers: [UserAccountService],
  exports: [UserAccountService],
})
export class UserAccountModule {}
