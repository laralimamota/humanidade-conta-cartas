import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateLobbyDto {
  @IsInt()
  @IsOptional()
  @Min(3)
  @Max(20)
  pointsToWin?: number = 7;
}
