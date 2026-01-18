import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { LobbiesService } from './lobbies.service';
import { CreateLobbyDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@Controller('lobbies')
@UseGuards(JwtAuthGuard)
export class LobbiesController {
  constructor(private readonly lobbiesService: LobbiesService) {}

  @Post()
  createLobby(@CurrentUser() user: JwtPayload, @Body() dto: CreateLobbyDto) {
    return this.lobbiesService.createLobby(user.sub, dto);
  }

  @Get(':code')
  getLobby(@Param('code') code: string) {
    return this.lobbiesService.getLobbyByCode(code);
  }

  @Get(':code/can-start')
  canStartGame(@Param('code') code: string, @CurrentUser() user: JwtPayload) {
    return this.lobbiesService.canStartGame(code, user.sub);
  }
}
