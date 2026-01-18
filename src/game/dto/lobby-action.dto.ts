import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class CreateLobbyDto {
  @IsInt()
  @IsOptional()
  @Min(3)
  @Max(20)
  pointsToWin?: number;
}

export class JoinLobbyDto {
  @IsString()
  code: string;
}

export class LeaveLobbyDto {
  @IsString()
  code: string;
}

export class SetReadyDto {
  @IsString()
  code: string;

  @IsBoolean()
  isReady: boolean;
}

export class StartGameDto {
  @IsString()
  code: string;
}
