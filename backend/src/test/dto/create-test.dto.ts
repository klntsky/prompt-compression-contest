import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTestDto {
  @IsString()
  @IsOptional() // Model might be optional for a generic test
  model?: string;

  @IsString()
  @IsNotEmpty()
  payload!: string; // The actual test content/task - Added definite assignment
}
