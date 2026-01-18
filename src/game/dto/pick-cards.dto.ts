import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class PickCardsDto {
  @IsString()
  gameCode: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  cardIds: string[];
}
