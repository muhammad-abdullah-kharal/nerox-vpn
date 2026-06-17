"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
class SubscriptionService {
    /**
     * Calculate custom plan price based on user configuration
     * Base Price: $4.99
     * Per Device: +$1.00
     * Duration: Scale monthly price with discount
     */
    static calculateCustomPrice(durationMonths, maxDevices) {
        const baseMonthlyPrice = 4.99;
        const deviceAddition = (maxDevices - 1) * 1.00;
        let monthlyRate = baseMonthlyPrice + deviceAddition;
        // Apply duration discounts
        if (durationMonths >= 12) {
            monthlyRate *= 0.75; // 25% off for yearly
        }
        else if (durationMonths >= 6) {
            monthlyRate *= 0.90; // 10% off for 6 months
        }
        const totalPrice = monthlyRate * durationMonths;
        return {
            totalPrice: parseFloat(totalPrice.toFixed(2)),
            monthlyPrice: parseFloat(monthlyRate.toFixed(2)),
            currency: 'USD'
        };
    }
}
exports.SubscriptionService = SubscriptionService;
