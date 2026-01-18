import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async getGameHistory(userId: string) {
    const games = await this.prisma.gamePlayer.findMany({
      where: { userId },
      include: {
        game: {
          select: {
            id: true,
            code: true,
            status: true,
            createdAt: true,
            currentRound: true,
          },
        },
      },
      orderBy: {
        game: {
          createdAt: 'desc',
        },
      },
      take: 20,
    });

    return games.map((gp) => ({
      gameId: gp.game.id,
      code: gp.game.code,
      status: gp.game.status,
      score: gp.score,
      rounds: gp.game.currentRound,
      playedAt: gp.game.createdAt,
    }));
  }
}
