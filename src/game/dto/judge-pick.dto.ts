import { IsString } from 'class-validator';

export class JudgePickDto {
  @IsString()
  gameCode: string;

  @IsString()
  submissionId: string;
}
