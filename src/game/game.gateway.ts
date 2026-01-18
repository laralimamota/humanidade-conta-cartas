import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GameService } from './game.service';
import { LobbiesService } from '../lobbies/lobbies.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import {
  CreateLobbyDto,
  JoinLobbyDto,
  LeaveLobbyDto,
  SetReadyDto,
  StartGameDto,
  PickCardsDto,
  JudgePickDto,
} from './dto';

interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
  currentGame?: string;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private readonly gameService: GameService,
    private readonly lobbiesService: LobbiesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'default-secret'),
      });

      client.user = payload;

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.log(`Client ${client.id} connected as ${payload.username}`);
      client.emit('connected', { message: 'Connected to game server', userId: payload.sub });
    } catch (error) {
      this.logger.warn(`Client ${client.id} failed authentication: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      const userSocketSet = this.userSockets.get(client.user.sub);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(client.user.sub);

          if (client.currentGame) {
            await this.gameService.disconnectPlayer(client.currentGame, client.user.sub);
            this.broadcastToGame(client.currentGame, 'lobby:player_disconnected', {
              playerId: client.user.sub,
              username: client.user.username,
            });
          }
        }
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('lobby:create')
  async handleCreateLobby(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: CreateLobbyDto,
  ) {
    try {
      const lobby = await this.lobbiesService.createLobby(client.user.sub, dto);
      client.currentGame = lobby.code;
      client.join(lobby.code);
      return { event: 'lobby:created', data: lobby };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('lobby:join')
  async handleJoinLobby(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: JoinLobbyDto,
  ) {
    try {
      const lobby = await this.lobbiesService.joinLobby(dto.code, client.user.sub);
      client.currentGame = lobby.code;
      client.join(lobby.code);

      this.broadcastToGame(lobby.code, 'lobby:updated', lobby, client.id);

      return { event: 'lobby:joined', data: lobby };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('lobby:leave')
  async handleLeaveLobby(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: LeaveLobbyDto,
  ) {
    try {
      const result = await this.lobbiesService.leaveLobby(dto.code, client.user.sub);
      client.leave(dto.code);
      client.currentGame = undefined;

      this.broadcastToGame(dto.code, 'lobby:updated', result);

      return { event: 'lobby:left', data: { code: dto.code } };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('lobby:ready')
  async handleSetReady(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SetReadyDto,
  ) {
    try {
      const lobby = await this.lobbiesService.setReady(dto.code, client.user.sub, dto.isReady);

      this.broadcastToGame(dto.code, 'lobby:updated', lobby);

      return { event: 'lobby:ready_set', data: { isReady: dto.isReady } };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('lobby:start')
  async handleStartGame(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: StartGameDto,
  ) {
    try {
      const roundInfo = await this.gameService.startGame(dto.code, client.user.sub);
      const gameState = this.gameService.getGameState(dto.code);

      this.broadcastToGame(dto.code, 'game:started', {
        ...roundInfo,
        gameState,
      });

      const state = this.gameService.getGameState(dto.code);
      for (const player of state.players) {
        const hand = await this.gameService.getPlayerHand(dto.code, player.id);
        this.emitToUser(player.id, 'game:hand', { hand });
      }

      return { event: 'game:started', data: roundInfo };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('game:pick_cards')
  async handlePickCards(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: PickCardsDto,
  ) {
    try {
      const result = await this.gameService.submitCards(
        dto.gameCode,
        client.user.sub,
        dto.cardIds,
      );

      if (result.allSubmitted) {
        const gameState = this.gameService.getGameState(dto.gameCode);
        this.broadcastToGame(dto.gameCode, 'game:all_submitted', {
          submissions: gameState.currentRound?.submissions,
        });
      } else {
        this.broadcastToGame(dto.gameCode, 'game:card_submitted', {
          playerId: client.user.sub,
        });
      }

      return { event: 'game:cards_picked', data: result };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('game:judge_pick')
  async handleJudgePick(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: JudgePickDto,
  ) {
    try {
      const result = await this.gameService.judgeWinner(
        dto.gameCode,
        client.user.sub,
        dto.submissionId,
      );

      this.broadcastToGame(dto.gameCode, 'game:round_winner', result);

      if (result.gameEnded) {
        const gameState = this.gameService.getGameState(dto.gameCode);
        this.broadcastToGame(dto.gameCode, 'game:ended', {
          winnerId: result.finalWinnerId,
          finalScores: gameState.players,
        });
      }

      return { event: 'game:winner_picked', data: result };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('game:next_round')
  async handleNextRound(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: { gameCode: string },
  ) {
    try {
      const roundInfo = await this.gameService.nextRound(dto.gameCode, client.user.sub);

      this.broadcastToGame(dto.gameCode, 'game:new_round', roundInfo);

      const state = this.gameService.getGameState(dto.gameCode);
      for (const player of state.players) {
        if (player.isActive) {
          const hand = await this.gameService.getPlayerHand(dto.gameCode, player.id);
          this.emitToUser(player.id, 'game:hand', { hand });
        }
      }

      return { event: 'game:round_started', data: roundInfo };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('game:get_state')
  async handleGetState(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: { gameCode: string },
  ) {
    try {
      const gameState = this.gameService.getGameState(dto.gameCode, client.user.sub);
      return { event: 'game:state', data: gameState };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('game:get_hand')
  async handleGetHand(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: { gameCode: string },
  ) {
    try {
      const hand = await this.gameService.getPlayerHand(dto.gameCode, client.user.sub);
      return { event: 'game:hand', data: { hand } };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('game:reconnect')
  async handleReconnect(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: { gameCode: string },
  ) {
    try {
      await this.gameService.reconnectPlayer(dto.gameCode, client.user.sub);
      client.currentGame = dto.gameCode;
      client.join(dto.gameCode);

      const gameState = this.gameService.getGameState(dto.gameCode, client.user.sub);
      const hand = await this.gameService.getPlayerHand(dto.gameCode, client.user.sub);

      this.broadcastToGame(dto.gameCode, 'lobby:player_reconnected', {
        playerId: client.user.sub,
        username: client.user.username,
      }, client.id);

      return {
        event: 'game:reconnected',
        data: { gameState, hand },
      };
    } catch (error) {
      return { event: 'error', data: { message: error.message } };
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const token = client.handshake.auth?.token;
    if (token) {
      return token;
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private broadcastToGame(gameCode: string, event: string, data: any, excludeClientId?: string) {
    if (excludeClientId) {
      this.server.to(gameCode).except(excludeClientId).emit(event, data);
    } else {
      this.server.to(gameCode).emit(event, data);
    }
  }

  private emitToUser(userId: string, event: string, data: any) {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      for (const socketId of userSocketSet) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
