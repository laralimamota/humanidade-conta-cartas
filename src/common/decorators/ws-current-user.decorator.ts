import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { JwtPayload } from './current-user.decorator';

export const WsCurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | string => {
    const client = ctx.switchToWs().getClient<Socket>();
    const user = (client as any).user as JwtPayload;

    return data ? user[data] : user;
  },
);
