import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardType } from '@prisma/client';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllBlackCards() {
    return this.prisma.card.findMany({
      where: { type: CardType.BLACK },
    });
  }

  async getAllWhiteCards() {
    return this.prisma.card.findMany({
      where: { type: CardType.WHITE },
    });
  }

  async getRandomBlackCard(excludeIds: string[] = []) {
    const cards = await this.prisma.card.findMany({
      where: {
        type: CardType.BLACK,
        id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      },
    });

    if (cards.length === 0) {
      return null;
    }

    return cards[Math.floor(Math.random() * cards.length)];
  }

  async getRandomWhiteCards(count: number, excludeIds: string[] = []) {
    const cards = await this.prisma.card.findMany({
      where: {
        type: CardType.WHITE,
        id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      },
    });

    const shuffled = cards.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async getCardsByIds(ids: string[]) {
    return this.prisma.card.findMany({
      where: { id: { in: ids } },
    });
  }

  async getCardById(id: string) {
    return this.prisma.card.findUnique({
      where: { id },
    });
  }

  async dealInitialHand(excludeIds: string[] = [], handSize: number = 7) {
    return this.getRandomWhiteCards(handSize, excludeIds);
  }

  async drawCards(currentHand: string[], count: number = 1) {
    return this.getRandomWhiteCards(count, currentHand);
  }
}
