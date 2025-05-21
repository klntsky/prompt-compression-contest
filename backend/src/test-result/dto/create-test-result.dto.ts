import {
  IsInt,
  IsBoolean,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateTestResultDto {
  @IsInt()
  attemptId!: number;

  @IsInt()
  testId!: number;

  @IsBoolean()
  @IsOptional()
  is_valid?: boolean;

  @IsString()
  @IsOptional()
  compressed_prompt?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1) // Assuming compression_ratio is between 0 and 1
  compression_ratio?: number;
}
