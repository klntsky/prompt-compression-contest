import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAttemptDto {
  @IsString()
  @IsNotEmpty()
  compressing_prompt!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  // username will be taken from the authenticated user (req.user)
  // So, it's removed from the DTO that the client sends.
}
