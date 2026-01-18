import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardsService } from '../cards/cards.service';
import { LobbiesService } from '../lobbies/lobbies.service';
import { GameStateService, PlayerState } from './game-state.service';
import { GameStatus } from '@prisma/client';

const HAND_SIZE = 7;

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cardsService: CardsService,
    private readonly lobbiesService: LobbiesService,
    private readonly gameState: GameStateService,
  ) {}

  async initializeGameState(code: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: { code: code.toUpperCase() },
      include: {
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
      throw new NotFoundException('Game not found');
    }

    const state = this.gameState.getOrCreateGame(
      game.id,
      game.code,
      game.hostId,
      game.pointsToWin,
    );

    state.status = game.status;

    for (const gp of game.players) {
      const playerState: PlayerState = {
        id: gp.user.id,
        username: gp.user.username,
        score: gp.score,
        hand: Array.isArray(gp.hand) ? (gp.hand as string[]) : [],
        isReady: gp.isReady,
        isActive: gp.isActive,
        hasSubmitted: false,
      };
      state.players.set(gp.user.id, playerState);
    }
  }

  async startGame(code: string, userId: string): Promise<any> {
    const check = await this.lobbiesService.canStartGame(code, userId);
    if (!check.canStart) {
      throw new BadRequestException(check.reason);
    }

    await this.initializeGameState(code);

    const game = await this.prisma.game.update({
      where: { code: code.toUpperCase() },
      data: { status: GameStatus.PICKING },
      include: {
        players: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    this.gameState.updateStatus(code, GameStatus.PICKING);

    const state = this.gameState.getGame(code);
    if (state) {
      state.czarOrder = game.players.map((p) => p.userId);
      state.currentCzarIndex = -1;
    }

    for (const player of game.players) {
      const initialHand = await this.cardsService.dealInitialHand([], HAND_SIZE);
      const handIds = initialHand.map((c) => c.id);

      await this.prisma.gamePlayer.update({
        where: { id: player.id },
        data: { hand: handIds },
      });

      this.gameState.updatePlayerHand(code, player.userId, handIds);
    }

    return this.startNewRound(code);
  }

  async startNewRound(code: string): Promise<any> {
    const state = this.gameState.getGame(code);
    if (!state) {
      throw new NotFoundException('Game not found');
    }

    const czarId = this.gameState.getNextCzar(code);
    if (!czarId) {
      throw new BadRequestException('No available czar');
    }

    const blackCard = await this.cardsService.getRandomBlackCard(state.usedBlackCardIds);
    if (!blackCard) {
      throw new BadRequestException('No black cards available');
    }

    const roundNumber = state.currentRound ? state.currentRound.number + 1 : 1;

    const round = await this.prisma.round.create({
      data: {
        gameId: state.id,
        roundNumber,
        blackCardId: blackCard.id,
        czarId,
      },
    });

    await this.prisma.game.update({
      where: { id: state.id },
      data: {
        currentRound: roundNumber,
        status: GameStatus.PICKING,
      },
    });

    this.gameState.updateStatus(code, GameStatus.PICKING);
    this.gameState.initializeRound(
      code,
      roundNumber,
      { id: blackCard.id, text: blackCard.text, pick: blackCard.pick },
      czarId,
    );

    for (const [playerId, player] of state.players) {
      if (player.isActive && playerId !== czarId) {
        const cardsNeeded = HAND_SIZE - player.hand.length;
        if (cardsNeeded > 0) {
          const newCards = await this.cardsService.drawCards(
            [...player.hand, ...state.usedWhiteCardIds],
            cardsNeeded,
          );
          const newHandIds = [...player.hand, ...newCards.map((c) => c.id)];

          await this.prisma.gamePlayer.updateMany({
            where: { gameId: state.id, userId: playerId },
            data: { hand: newHandIds },
          });

          this.gameState.updatePlayerHand(code, playerId, newHandIds);
        }
      }
    }

    return {
      roundNumber,
      blackCard: { id: blackCard.id, text: blackCard.text, pick: blackCard.pick },
      czarId,
    };
  }

  async submitCards(code: string, playerId: string, cardIds: string[]): Promise<any> {
    const state = this.gameState.getGame(code);
    if (!state) {
      throw new NotFoundException('Game not found');
    }

    if (state.status !== GameStatus.PICKING) {
      throw new BadRequestException('Not in picking phase');
    }

    if (!state.currentRound) {
      throw new BadRequestException('No active round');
    }

    if (state.currentRound.czarId === playerId) {
      throw new ForbiddenException('Czar cannot submit cards');
    }

    const player = state.players.get(playerId);
    if (!player) {
      throw new NotFoundException('Player not in game');
    }

    if (player.hasSubmitted) {
      throw new BadRequestException('Already submitted cards');
    }

    const requiredPick = state.currentRound.blackCard?.pick || 1;
    if (cardIds.length !== requiredPick) {
      throw new BadRequestException(`Must submit exactly ${requiredPick} card(s)`);
    }

    for (const cardId of cardIds) {
      if (!player.hand.includes(cardId)) {
        throw new BadRequestException('Card not in your hand');
      }
    }

    const round = await this.prisma.round.findFirst({
      where: {
        gameId: state.id,
        roundNumber: state.currentRound.number,
      },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    const gamePlayer = await this.prisma.gamePlayer.findFirst({
      where: { gameId: state.id, userId: playerId },
    });

    if (!gamePlayer) {
      throw new NotFoundException('Game player not found');
    }

    const submission = await this.prisma.roundSubmission.create({
      data: {
        roundId: round.id,
        gamePlayerId: gamePlayer.id,
        userId: playerId,
        cards: {
          create: cardIds.map((cardId, index) => ({
            cardId,
            order: index,
          })),
        },
      },
      include: {
        cards: {
          include: { card: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    const cards = submission.cards.map((c) => ({ id: c.card.id, text: c.card.text }));

    this.gameState.addSubmission(code, {
      id: submission.id,
      playerId,
      cardIds,
      cards,
    });

    const newHand = player.hand.filter((id) => !cardIds.includes(id));
    await this.prisma.gamePlayer.update({
      where: { id: gamePlayer.id },
      data: { hand: newHand },
    });

    const allSubmitted = this.gameState.allPlayersSubmitted(code);

    if (allSubmitted) {
      await this.prisma.game.update({
        where: { id: state.id },
        data: { status: GameStatus.JUDGING },
      });
      this.gameState.updateStatus(code, GameStatus.JUDGING);
    }

    return {
      submitted: true,
      allSubmitted,
    };
  }

  async judgeWinner(code: string, czarId: string, submissionId: string): Promise<any> {
    const state = this.gameState.getGame(code);
    if (!state) {
      throw new NotFoundException('Game not found');
    }

    if (state.status !== GameStatus.JUDGING) {
      throw new BadRequestException('Not in judging phase');
    }

    if (!state.currentRound) {
      throw new BadRequestException('No active round');
    }

    if (state.currentRound.czarId !== czarId) {
      throw new ForbiddenException('Only the czar can judge');
    }

    const submission = state.currentRound.submissions.find((s) => s.id === submissionId);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const winnerId = submission.playerId;
    this.gameState.setRoundWinner(code, winnerId);

    const round = await this.prisma.round.findFirst({
      where: {
        gameId: state.id,
        roundNumber: state.currentRound.number,
      },
    });

    if (round) {
      await this.prisma.round.update({
        where: { id: round.id },
        data: { winnerId },
      });
    }

    await this.prisma.gamePlayer.updateMany({
      where: { gameId: state.id, userId: winnerId },
      data: { score: { increment: 1 } },
    });

    await this.prisma.game.update({
      where: { id: state.id },
      data: { status: GameStatus.ROUND_END },
    });
    this.gameState.updateStatus(code, GameStatus.ROUND_END);

    const gameEnd = this.gameState.checkGameEnd(code);

    if (gameEnd.isEnded) {
      await this.prisma.game.update({
        where: { id: state.id },
        data: { status: GameStatus.GAME_END },
      });
      this.gameState.updateStatus(code, GameStatus.GAME_END);
    }

    const winner = state.players.get(winnerId);

    return {
      winnerId,
      winnerUsername: winner?.username,
      winningSubmission: submission,
      gameEnded: gameEnd.isEnded,
      finalWinnerId: gameEnd.winnerId,
    };
  }

  async nextRound(code: string, userId: string): Promise<any> {
    const state = this.gameState.getGame(code);
    if (!state) {
      throw new NotFoundException('Game not found');
    }

    if (state.status !== GameStatus.ROUND_END) {
      throw new BadRequestException('Not in round end phase');
    }

    if (state.hostId !== userId) {
      throw new ForbiddenException('Only host can advance to next round');
    }

    const gameEnd = this.gameState.checkGameEnd(code);
    if (gameEnd.isEnded) {
      throw new BadRequestException('Game has ended');
    }

    return this.startNewRound(code);
  }

  getGameState(code: string, playerId?: string): any {
    return this.gameState.getPublicGameState(code, playerId);
  }

  async getPlayerHand(code: string, playerId: string): Promise<any[]> {
    const state = this.gameState.getGame(code);
    if (!state) {
      throw new NotFoundException('Game not found');
    }

    const player = state.players.get(playerId);
    if (!player) {
      throw new NotFoundException('Player not in game');
    }

    const cards = await this.cardsService.getCardsByIds(player.hand);
    return cards;
  }

  async reconnectPlayer(code: string, playerId: string): Promise<void> {
    await this.initializeGameState(code);
    this.gameState.setPlayerActive(code, playerId, true);

    await this.prisma.gamePlayer.updateMany({
      where: {
        game: { code: code.toUpperCase() },
        userId: playerId,
      },
      data: { isActive: true },
    });
  }

  async disconnectPlayer(code: string, playerId: string): Promise<void> {
    this.gameState.setPlayerActive(code, playerId, false);

    await this.prisma.gamePlayer.updateMany({
      where: {
        game: { code: code.toUpperCase() },
        userId: playerId,
      },
      data: { isActive: false },
    });
  }
}
