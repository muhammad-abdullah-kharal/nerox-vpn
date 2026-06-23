"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = require("../controllers/AuthController");
const VpnController_1 = require("../controllers/VpnController");
const PaymentController_1 = require("../controllers/PaymentController");
const UserController_1 = require("../controllers/UserController");
const SupportController_1 = require("../controllers/SupportController");
const FaqController_1 = require("../controllers/FaqController");
const SettingsController_1 = require("../controllers/SettingsController");
const ReferralController_1 = require("../controllers/ReferralController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Auth Routes
router.post('/auth/register', AuthController_1.AuthController.register);
router.post('/auth/login', AuthController_1.AuthController.login);
router.post('/auth/social', AuthController_1.AuthController.socialLogin);
router.post('/auth/send-otp', AuthController_1.AuthController.sendOtp);
router.post('/auth/verify-otp', AuthController_1.AuthController.verifyOtp);
router.post('/auth/reset-password', auth_1.authenticateToken, AuthController_1.AuthController.resetPassword);
// User Routes
router.get('/user/profile', auth_1.authenticateToken, UserController_1.UserController.getProfile);
router.post('/user/profile/update', auth_1.authenticateToken, UserController_1.UserController.updateProfile);
router.get('/user/usage', auth_1.authenticateToken, UserController_1.UserController.getUsageStats);
router.post('/user/avatar', auth_1.authenticateToken, UserController_1.UserController.uploadAvatar);
// VPN Routes
router.get('/servers', auth_1.authenticateToken, VpnController_1.VpnController.getServers);
router.get('/servers/optimal', auth_1.authenticateToken, VpnController_1.VpnController.getOptimalServers);
router.post('/sessions', auth_1.authenticateToken, VpnController_1.VpnController.startSession);
router.put('/sessions/:sessionId', auth_1.authenticateToken, VpnController_1.VpnController.endSession);
router.get('/sessions/last-report', auth_1.authenticateToken, VpnController_1.VpnController.getLastSessionReport);
router.post('/sessions/report', auth_1.authenticateToken, VpnController_1.VpnController.reportTraffic);
// Payment Routes
router.get('/payments/plans', PaymentController_1.PaymentController.getPlans);
router.get('/payments/custom-price', PaymentController_1.PaymentController.calculateCustomPrice);
router.post('/payments/verify', auth_1.authenticateToken, PaymentController_1.PaymentController.verifyPurchase);
router.post('/payments/mock-purchase', auth_1.authenticateToken, PaymentController_1.PaymentController.mockPurchase);
router.post('/payments/initialize', auth_1.authenticateToken, PaymentController_1.PaymentController.initializePayment);
router.post('/payments/webhook', PaymentController_1.PaymentController.handleWebhook);
// Support Routes
router.post('/support/feedback', auth_1.authenticateToken, SupportController_1.SupportController.submitFeedback);
router.get('/support/feedback', auth_1.authenticateToken, SupportController_1.SupportController.getFeedbackHistory);
router.post('/support/feedback/:id/respond', auth_1.authenticateToken, SupportController_1.SupportController.respondToFeedback);
// FAQ Routes
router.get('/faq/categories', FaqController_1.FaqController.getCategories);
router.get('/faq/categories/:categoryId', FaqController_1.FaqController.getFaqsByCategory);
router.get('/faq/search', FaqController_1.FaqController.searchFaqs);
// Settings Routes
router.get('/settings/split-tunneling', auth_1.authenticateToken, SettingsController_1.SettingsController.getSplitTunnelingConfig);
router.post('/settings/split-tunneling', auth_1.authenticateToken, SettingsController_1.SettingsController.setSplitTunnelingConfig);
router.get('/settings/protocol', auth_1.authenticateToken, SettingsController_1.SettingsController.getPreferredProtocol);
router.post('/settings/protocol', auth_1.authenticateToken, SettingsController_1.SettingsController.setPreferredProtocol);
router.get('/settings/kill-switch', auth_1.authenticateToken, SettingsController_1.SettingsController.getKillSwitchConfig);
router.post('/settings/kill-switch', auth_1.authenticateToken, SettingsController_1.SettingsController.setKillSwitchConfig);
// VPN Speed Test
router.post('/vpn/speed-test', auth_1.authenticateToken, VpnController_1.VpnController.runSpeedTest);
// Referral Routes
router.get('/referral', auth_1.authenticateToken, ReferralController_1.ReferralController.getCode);
router.post('/referral/apply', auth_1.authenticateToken, ReferralController_1.ReferralController.applyCode);
exports.default = router;
