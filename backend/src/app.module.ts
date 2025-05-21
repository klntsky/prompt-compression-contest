import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserAccount } from './user-account/user-account.entity';
import { Attempt } from './attempt/attempt.entity';
import { Test } from './test/test.entity';
import { TestResult } from './test-result/test-result.entity';
import { UserAccountModule } from './user-account/user-account.module';
import { AttemptModule } from './attempt/attempt.module';
import { TestModule } from './test/test.module';
import { TestResultModule } from './test-result/test-result.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { ModelsModule } from './models/models.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const dbType = configService.get<string>('DB_TYPE');
        if (!dbType) throw new Error('DB_TYPE is not set');

        const host = configService.get<string>('DB_HOST');
        if (!host) throw new Error('DB_HOST is not set');

        const port = configService.get<number>('DB_PORT');
        if (port === undefined) throw new Error('DB_PORT is not set');

        const username = configService.get<string>('DB_USERNAME');
        if (!username) throw new Error('DB_USERNAME is not set');

        const password = configService.get<string>('DB_PASSWORD');
        if (password === undefined) throw new Error('DB_PASSWORD is not set');

        const database = configService.get<string>('DB_DATABASE');
        if (!database) throw new Error('DB_DATABASE is not set');

        return {
          type: dbType as TypeOrmModuleOptions['type'],
          host,
          port,
          username,
          password,
          database,
          entities: [UserAccount, Attempt, Test, TestResult],
          synchronize:
            configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
        } as TypeOrmModuleOptions;
      },
    }),
    UserAccountModule,
    AttemptModule,
    TestModule,
    TestResultModule,
    EvaluationModule,
    ModelsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
