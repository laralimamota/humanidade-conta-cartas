import { Injectable, Logger } from '@nestjs/common';
import { GameStatus } from '@prisma/client';

export interface PlayerState {
  id: string;
  username: string;
  score: number;
  hand: string[];
  isReady: boolean;
  isActive: boolean;
  hasSubmitted: boolean;
}

export interface SubmissionState {
  id: string;
  playerId: string;
  cardIds: string[];
  cards?: Array<{ id: string; text: string }>;
}

export interface RoundState {
  number: number;
  blackCard: { id: string; text: string; pick: number } | null;
  czarId: string;
  submissions: SubmissionState[];
  winnerId: string | null;
}

export interface GameState {
  id: string;
  code: string;
  status: GameStatus;
  hostId: string;
  pointsToWin: number;
  players: Map<string, PlayerState>;
  currentRound: RoundState | null;
  usedBlackCardIds: string[];
  usedWhiteCardIds: string[];
  czarOrder: string[];
  currentCzarIndex: number;
}

@Injectable()
export class GameStateService {
  private readonly logger = new Logger(GameStateService.name);
  private games: Map<string, GameState> = new Map();

  createGame(
    id: string,
    code: string,
    hostId: string,
    pointsToWin: number,
  ): GameState {
    const state: GameState = {
      id,
      code: code.toUpperCase(),
      status: GameStatus.WAITING,
      hostId,
      pointsToWin,
      players: new Map(),
      currentRound: null,
      usedBlackCardIds: [],
      usedWhiteCardIds: [],
      czarOrder: [],
      currentCzarIndex: 0,
    };

    this.games.set(code.toUpperCase(), state);
    this.logger.log(`Game created: ${code}`);
    return state;
  }

  getGame(code: string): GameState | undefined {
    return this.games.get(code.toUpperCase());
  }

  getOrCreateGame(
    id: string,
    code: string,
    hostId: string,
    pointsToWin: number,
  ): GameState {
    const existing = this.getGame(code);
    if (existing) {
      return existing;
    }
    return this.createGame(id, code, hostId, pointsToWin);
  }

  deleteGame(code: string): void {
    this.games.delete(code.toUpperCase());
    this.logger.log(`Game deleted: ${code}`);
  }

  addPlayer(code: string, player: PlayerState): void {
    const game = this.getGame(code);
    if (game) {
      game.players.set(player.id, player);
      this.logger.log(`Player ${player.username} joined game ${code}`);
    }
  }

  removePlayer(code: string, playerId: string): void {
    const game = this.getGame(code);
    if (game) {
      const player = game.players.get(playerId);
      if (player) {
        game.players.delete(playerId);
        this.logger.log(`Player ${player.username} left game ${code}`);
      }
    }
  }

  setPlayerActive(code: string, playerId: string, isActive: boolean): void {
    const game = this.getGame(code);
    if (game) {
      const player = game.players.get(playerId);
      if (player) {
        player.isActive = isActive;
      }
    }
  }

  setPlayerReady(code: string, playerId: string, isReady: boolean): void {
    const game = this.getGame(code);
    if (game) {
      const player = game.players.get(playerId);
      if (player) {
        player.isReady = isReady;
      }
    }
  }

  updateStatus(code: string, status: GameStatus): void {
    const game = this.getGame(code);
    if (game) {
      game.status = status;
      this.logger.log(`Game ${code} status changed to ${status}`);
    }
  }

  initializeRound(
    code: string,
    roundNumber: number,
    blackCard: { id: string; text: string; pick: number },
    czarId: string,
  ): void {
    const game = this.getGame(code);
    if (game) {
      game.currentRound = {
        number: roundNumber,
        blackCard,
        czarId,
        submissions: [],
        winnerId: null,
      };
      game.usedBlackCardIds.push(blackCard.id);

      game.players.forEach((player) => {
        player.hasSubmitted = player.id === czarId;
      });

      this.logger.log(`Round ${roundNumber} initialized for game ${code}`);
    }
  }

  addSubmission(code: string, submission: SubmissionState): void {
    const game = this.getGame(code);
    if (game && game.currentRound) {
      game.currentRound.submissions.push(submission);

      const player = game.players.get(submission.playerId);
      if (player) {
        player.hasSubmitted = true;
        player.hand = player.hand.filter((id) => !submission.cardIds.includes(id));
        game.usedWhiteCardIds.push(...submission.cardIds);
      }

      this.logger.log(`Submission added from player ${submission.playerId} in game ${code}`);
    }
  }

  setRoundWinner(code: string, winnerId: string): void {
    const game = this.getGame(code);
    if (game && game.currentRound) {
      game.currentRound.winnerId = winnerId;

      const winner = game.players.get(winnerId);
      if (winner) {
        winner.score += 1;
      }

      this.logger.log(`Round winner set to ${winnerId} in game ${code}`);
    }
  }

  getNextCzar(code: string): string | null {
    const game = this.getGame(code);
    if (!game) return null;

    const activePlayers = Array.from(game.players.values()).filter((p) => p.isActive);
    if (activePlayers.length === 0) return null;

    if (game.czarOrder.length === 0) {
      game.czarOrder = activePlayers.map((p) => p.id);
    }

    game.currentCzarIndex = (game.currentCzarIndex + 1) % game.czarOrder.length;

    while (!game.players.get(game.czarOrder[game.currentCzarIndex])?.isActive) {
      game.currentCzarIndex = (game.currentCzarIndex + 1) % game.czarOrder.length;
    }

    return game.czarOrder[game.currentCzarIndex];
  }

  allPlayersSubmitted(code: string): boolean {
    const game = this.getGame(code);
    if (!game || !game.currentRound) return false;

    const activePlayers = Array.from(game.players.values()).filter(
      (p) => p.isActive && p.id !== game.currentRound?.czarId,
    );

    return activePlayers.every((p) => p.hasSubmitted);
  }

  checkGameEnd(code: string): { isEnded: boolean; winnerId?: string } {
    const game = this.getGame(code);
    if (!game) return { isEnded: false };

    for (const [playerId, player] of game.players) {
      if (player.score >= game.pointsToWin) {
        return { isEnded: true, winnerId: playerId };
      }
    }

    return { isEnded: false };
  }

  updatePlayerHand(code: string, playerId: string, hand: string[]): void {
    const game = this.getGame(code);
    if (game) {
      const player = game.players.get(playerId);
      if (player) {
        player.hand = hand;
      }
    }
  }

  getPublicGameState(code: string, forPlayerId?: string): any {
    const game = this.getGame(code);
    if (!game) return null;

    const players = Array.from(game.players.values()).map((p) => ({
      id: p.id,
      username: p.username,
      score: p.score,
      isReady: p.isReady,
      isActive: p.isActive,
      hasSubmitted: p.hasSubmitted,
      handCount: p.hand.length,
    }));

    let currentRound: any = null;
    if (game.currentRound) {
      currentRound = {
        number: game.currentRound.number,
        blackCard: game.currentRound.blackCard,
        czarId: game.currentRound.czarId,
        submissionCount: game.currentRound.submissions.length,
        winnerId: game.currentRound.winnerId,
      };

      if (game.status === GameStatus.JUDGING || game.status === GameStatus.ROUND_END) {
        currentRound.submissions = game.currentRound.submissions.map((s) => ({
          id: s.id,
          cards: s.cards,
          playerId: game.status === GameStatus.ROUND_END ? s.playerId : undefined,
        }));
      }
    }

    const response: any = {
      id: game.id,
      code: game.code,
      status: game.status,
      hostId: game.hostId,
      pointsToWin: game.pointsToWin,
      players,
      currentRound,
    };

    if (forPlayerId) {
      const player = game.players.get(forPlayerId);
      if (player) {
        response.myHand = player.hand;
      }
    }

    return response;
  }
}
