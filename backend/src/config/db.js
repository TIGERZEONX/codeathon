import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;
let memoryStore = null;

export const connectDB = async () => {
  if (isConnected) return mongoose.connection;

  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    });
    isConnected = true;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    logger.warn(`MongoDB not reachable at ${env.MONGO_URI}. Falling back to In-Memory Repository Store.`);
    isConnected = false;
    return null;
  }
};

export const getDbStatus = () => ({
  isConnected,
  uri: env.MONGO_URI,
  mode: isConnected ? 'mongodb' : 'in-memory-fallback',
});
