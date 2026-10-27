
import { io } from 'socket.io-client';

const SOCKET_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000'
).replace(/\/+$/, '');

export const createSocket = (token) =>
  io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
  });
