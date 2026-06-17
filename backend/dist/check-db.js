"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./config/db"));
async function checkConnection() {
    try {
        const res = await db_1.default.query('SELECT NOW()');
        console.log('✅ Database connection successful:', res.rows[0].now);
        const dbRes = await db_1.default.query("SELECT datname FROM pg_database WHERE datname = 'nerox_vpn'");
        if (dbRes.rows.length > 0) {
            console.log('✅ Database "nerox_vpn" exists.');
        }
        else {
            console.log('❌ Database "nerox_vpn" NOT found.');
        }
        process.exit(0);
    }
    catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }
}
checkConnection();
