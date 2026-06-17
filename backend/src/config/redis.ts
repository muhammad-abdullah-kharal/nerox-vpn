import dotenv from 'dotenv';
dotenv.config();

// In-memory mock for Redis to allow the server to run without installing Redis locally
const memoryCache = new Map<string, string>();

const redisClient = {
  isOpen: true,
  connect: async () => {},
  on: (event: string, cb: any) => {},
  setEx: async (key: string, seconds: number, value: string) => {
    memoryCache.set(key, value);
    setTimeout(() => memoryCache.delete(key), seconds * 1000);
  },
  get: async (key: string) => {
    return memoryCache.get(key) || null;
  },
  del: async (key: string) => {
    memoryCache.delete(key);
  }
};

export const connectRedis = async () => {
  console.log('Connected to Mock Redis (In-Memory)');
};

export default redisClient as any;
