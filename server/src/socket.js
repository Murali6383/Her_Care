
import { Server } from 'socket.io';
import { config } from './config.js';
import { userFromToken } from './middleware/auth.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || '');
      const user = await userFromToken(token);

      if (!user) {
        return next(new Error('unauthorized'));
      }

      socket.data.userId = String(user.id ?? user._id);
      next();
    } catch (error) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}
