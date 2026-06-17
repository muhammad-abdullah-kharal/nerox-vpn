"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralController = void 0;
const ReferralService_1 = require("../services/ReferralService");
class ReferralController {
    static async getCode(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId)
                return res.status(401).json({ error: 'Unauthorized' });
            const code = await ReferralService_1.ReferralService.ensureReferralCode(userId);
            const stats = await ReferralService_1.ReferralService.getReferralStats(userId);
            res.json({ code, ...stats });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async applyCode(req, res) {
        try {
            const userId = req.user?.userId;
            const { code } = req.body;
            if (!userId || !code)
                return res.status(400).json({ error: 'Code is required' });
            const result = await ReferralService_1.ReferralService.applyReferral(userId, code);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.ReferralController = ReferralController;
