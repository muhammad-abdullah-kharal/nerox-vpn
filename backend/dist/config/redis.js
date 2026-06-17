"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// In-memory mock for Redis to allow the server to run without installing Redis locally
const memoryCache = new Map();
const redisClient = {
    isOpen: true,
    connect: async () => { },
    on: (event, cb) => { },
    setEx: async (key, seconds, value) => {
        memoryCache.set(key, value);
        setTimeout(() => memoryCache.delete(key), seconds * 1000);
    },
    get: async (key) => {
        return memoryCache.get(key) || null;
    },
    del: async (key) => {
        memoryCache.delete(key);
    }
};
const connectRedis = async () => {
    console.log('Connected to Mock Redis (In-Memory)');
};
exports.connectRedis = connectRedis;
exports.default = redisClient;
