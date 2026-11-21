import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';

let ioInstance = null;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    // Authenticate socket connection
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) {
        socket.user = decoded;
      }
    }
    next();
  });

  ioInstance.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`, { user: socket.user?.email });

    // Join contest room
    socket.on('join:contest', ({ contestId }) => {
      if (contestId) {
        socket.join(`contest:${contestId}`);
      }
    });

    // Join student attempt room
    socket.on('join:attempt', ({ attemptId }) => {
      if (attemptId) {
        socket.join(`attempt:${attemptId}`);
      }
    });

    // Join admin contest monitor room
    socket.on('join:admin:contest', ({ contestId }) => {
      if (contestId) {
        socket.join(`admin:contest:${contestId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

export const getSocketServer = () => ioInstance;
