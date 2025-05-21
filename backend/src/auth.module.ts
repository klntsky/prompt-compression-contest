import { Module } from '@nestjs/common';
import { UserAccountModule } from './user-account/user-account.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth/auth.service';
import { LocalStrategy } from './auth/local.strategy';
import { JwtStrategy } from './auth/jwt.strategy';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [
    UserAccountModule,
    PassportModule, // Default strategy can be specified e.g., PassportModule.register({ defaultStrategy: 'jwt' })
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'YOUR_DEFAULT_VERY_SECRET_KEY_32_CHARS_LONG',
        ), // IMPORTANT: Use env var
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '3600s'),
        }, // e.g., '60s', '1h', '7d'
      }),
      inject: [ConfigService],
    }),
    ConfigModule, // To ensure ConfigService is available if not global in AppModule
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy], // Added JwtStrategy
  controllers: [AuthController], // Added AuthController
  exports: [AuthService], // Added AuthService, so other modules (if any) could use it.
})
export class AuthModule {}
