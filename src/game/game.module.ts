import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameStateService } from './game-state.service';
import { CardsModule } from '../cards/cards.module';
import { LobbiesModule } from '../lobbies/lobbies.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CardsModule, LobbiesModule, AuthModule],
  providers: [GameGateway, GameService, GameStateService],
  exports: [GameService, GameStateService],
})
export class GameModule {}
