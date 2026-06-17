import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { VpnController } from '../controllers/VpnController';
import { PaymentController } from '../controllers/PaymentController';
import { UserController } from '../controllers/UserController';
import { SupportController } from '../controllers/SupportController';
import { FaqController } from '../controllers/FaqController';
import { SettingsController } from '../controllers/SettingsController';
import { ReferralController } from '../controllers/ReferralController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Auth Routes
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.post('/auth/send-otp', AuthController.sendOtp);
router.post('/auth/verify-otp', AuthController.verifyOtp);
router.post('/auth/reset-password', authenticateToken, AuthController.resetPassword);

// User Routes
router.get('/user/profile', authenticateToken, UserController.getProfile);
router.post('/user/profile/update', authenticateToken, UserController.updateProfile);
router.get('/user/usage', authenticateToken, UserController.getUsageStats);
router.post('/user/avatar', authenticateToken, UserController.uploadAvatar);

// VPN Routes
router.get('/servers', authenticateToken, VpnController.getServers);
router.get('/servers/optimal', authenticateToken, VpnController.getOptimalServers);
router.post('/sessions', authenticateToken, VpnController.startSession);
router.put('/sessions/:sessionId', authenticateToken, VpnController.endSession);
router.get('/sessions/last-report', authenticateToken, VpnController.getLastSessionReport);
router.post('/sessions/report', authenticateToken, VpnController.reportTraffic);

// Payment Routes
router.get('/payments/plans', PaymentController.getPlans);
router.get('/payments/custom-price', PaymentController.calculateCustomPrice);
router.post('/payments/verify', authenticateToken, PaymentController.verifyPurchase);
router.post('/payments/mock-purchase', authenticateToken, PaymentController.mockPurchase);
router.post('/payments/initialize', authenticateToken, PaymentController.initializePayment);
router.post('/payments/webhook', PaymentController.handleWebhook);

// Support Routes
router.post('/support/feedback', authenticateToken, SupportController.submitFeedback);
router.get('/support/feedback', authenticateToken, SupportController.getFeedbackHistory);
router.post('/support/feedback/:id/respond', authenticateToken, SupportController.respondToFeedback);

// FAQ Routes
router.get('/faq/categories', FaqController.getCategories);
router.get('/faq/categories/:categoryId', FaqController.getFaqsByCategory);
router.get('/faq/search', FaqController.searchFaqs);

// Settings Routes
router.get('/settings/split-tunneling', authenticateToken, SettingsController.getSplitTunnelingConfig);
router.post('/settings/split-tunneling', authenticateToken, SettingsController.setSplitTunnelingConfig);
router.get('/settings/protocol', authenticateToken, SettingsController.getPreferredProtocol);
router.post('/settings/protocol', authenticateToken, SettingsController.setPreferredProtocol);
router.get('/settings/kill-switch', authenticateToken, SettingsController.getKillSwitchConfig);
router.post('/settings/kill-switch', authenticateToken, SettingsController.setKillSwitchConfig);

// VPN Speed Test
router.post('/vpn/speed-test', authenticateToken, VpnController.runSpeedTest);

// Referral Routes
router.get('/referral', authenticateToken, ReferralController.getCode);
router.post('/referral/apply', authenticateToken, ReferralController.applyCode);

export default router;
