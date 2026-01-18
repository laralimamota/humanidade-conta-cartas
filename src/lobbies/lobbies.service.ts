import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameStatus } from '@prisma/client';
import { CreateLobbyDto } from './dto';

@Injectable()
export class LobbiesService {
  constructor(private readonly prisma: PrismaService) {}

  async createLobby(hostId: string, dto: CreateLobbyDto) {
    const code = this.generateLobbyCode();

    const game = await this.prisma.game.create({
      data: {
        code,
        hostId,
        pointsToWin: dto.pointsToWin ?? 7,
        status: GameStatus.WAITING,
        players: {
          create: {
            userId: hostId,
            isReady: true,
          },
        },
      },
      include: {
        host: {
          select: { id: true, username: true },
        },
        players: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    return this.formatLobbyResponse(game);
  }

  async getLobbyByCode(code: string) {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        host: {
          select: { id: true, username: true },
        },
        players: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Lobby not found');
    }

    return this.formatLobbyResponse(game);
  }

  async joinLobby(code: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Lobby not found');
    }

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Game has already started');
    }

    const existingPlayer = game.players.find((p) => p.userId === userId);
    if (existingPlayer) {
      if (!existingPlayer.isActive) {
        await this.prisma.gamePlayer.update({
          where: { id: existingPlayer.id },
          data: { isActive: true },
        });
      }
      return this.getLobbyByCode(code);
    }

    if (game.players.length >= 10) {
      throw new BadRequestException('Lobby is full (max 10 players)');
    }

    await this.prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId,
        isReady: false,
      },
    });

    return this.getLobbyByCode(code);
  }

  async leaveLobby(code: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Lobby not found');
    }

    const player = game.players.find((p) => p.userId === userId);
    if (!player) {
      throw new BadRequestException('You are not in this lobby');
    }

    if (game.status !== GameStatus.WAITING) {
      await this.prisma.gamePlayer.update({
        where: { id: player.id },
        data: { isActive: false },
      });
    } else {
      await this.prisma.gamePlayer.delete({
        where: { id: player.id },
      });

      const remainingPlayers = game.players.filter((p) => p.userId !== userId);

      if (remainingPlayers.length === 0) {
        await this.prisma.game.delete({
          where: { id: game.id },
        });
        return { message: 'Lobby deleted' };
      }

      if (game.hostId === userId && remainingPlayers.length > 0) {
        await this.prisma.game.update({
          where: { id: game.id },
          data: { hostId: remainingPlayers[0].userId },
        });
      }
    }

    return this.getLobbyByCode(code).catch(() => ({ message: 'Left lobby' }));
  }

  async setReady(code: string, userId: string, isReady: boolean) {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Lobby not found');
    }

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Game has already started');
    }

    const player = game.players.find((p) => p.userId === userId);
    if (!player) {
      throw new BadRequestException('You are not in this lobby');
    }

    await this.prisma.gamePlayer.update({
      where: { id: player.id },
      data: { isReady },
    });

    return this.getLobbyByCode(code);
  }

  async canStartGame(code: string, userId: string): Promise<{ canStart: boolean; reason?: string }> {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: true,
      },
    });

    if (!game) {
      throw new NotFoundException('Lobby not found');
    }

    if (game.hostId !== userId) {
      return { canStart: false, reason: 'Only the host can start the game' };
    }

    if (game.status !== GameStatus.WAITING) {
      return { canStart: false, reason: 'Game has already started' };
    }

    const activePlayers = game.players.filter((p) => p.isActive);

    if (activePlayers.length < 3) {
      return { canStart: false, reason: 'Need at least 3 players to start' };
    }

    const allReady = activePlayers.every((p) => p.isReady);
    if (!allReady) {
      return { canStart: false, reason: 'Not all players are ready' };
    }

    return { canStart: true };
  }

  async getGameIdByCode(code: string): Promise<string> {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true },
    });

    if (!game) {
      throw new NotFoundException('Lobby not found');
    }

    return game.id;
  }

  private generateLobbyCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private formatLobbyResponse(game: any) {
    return {
      id: game.id,
      code: game.code,
      status: game.status,
      pointsToWin: game.pointsToWin,
      host: game.host,
      players: game.players.map((p: any) => ({
        id: p.user.id,
        username: p.user.username,
        isReady: p.isReady,
        isActive: p.isActive,
        score: p.score,
      })),
      createdAt: game.createdAt,
    };
  }
}
