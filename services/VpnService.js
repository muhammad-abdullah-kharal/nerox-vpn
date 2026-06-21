import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export const VPN_STATES = {
  DISCONNECTED: 'Disconnected',
  CONNECTING: 'Connecting',
  CONNECTED: 'Connected',
  FAILED: 'Failed',
  FALLBACK: 'Fallback',
};

const ACTIVE_SESSION_KEY = 'nerox_active_vpn_session';

class VpnService {
  constructor() {
    this.currentState = VPN_STATES.DISCONNECTED;
    this.activeSession = null;
    this.attemptedServer = null;
    this.statusMessage = '';
    this.currentSubscription = null;
    this.listeners = [];
    this.mockTotalReceived = 0;
    this.mockTotalSent = 0;
  }

  toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  isRetryableError(err) {
    if (err?.noRetry) return false;

    const message = String(err?.message || err || '').toLowerCase();
    const nonRetryableMessages = [
      'device limit',
      'daily data limit',
      'trial has expired',
      'premium subscription required',
      'vpn permission',
      'permission was denied',
      'native wireguard module',
      'wireguard config is empty',
      'wg_save_failed',
      'wg_start_failed',
      'wg_config_empty',
    ];

    return !nonRetryableMessages.some(text => message.includes(text));
  }

  markNoRetry(err) {
    if (err && typeof err === 'object') {
      err.noRetry = true;
    }
    return err;
  }

  async cleanupFailedSession(session) {
    if (!session?.session_id) return;

    try {
      await this.stopNativeTunnel();
    } catch (stopErr) {
      console.warn('[VpnService] Native tunnel cleanup after failed start failed:', stopErr);
    }

    try {
      await api.put(`/sessions/${session.session_id}`, {});
    } catch (cleanupErr) {
      console.warn('[VpnService] Backend session cleanup after failed start failed:', cleanupErr);
    }
  }

  async saveActiveSession(session) {
    if (!session) return;

    try {
      await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('[VpnService] Failed to persist active VPN session:', err);
    }
  }

  async loadActiveSession() {
    try {
      const rawSession = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
      if (!rawSession) return null;
      return JSON.parse(rawSession);
    } catch (err) {
      console.warn('[VpnService] Failed to restore active VPN session:', err);
      await this.clearActiveSession();
      return null;
    }
  }

  async clearActiveSession() {
    try {
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (err) {
      console.warn('[VpnService] Failed to clear active VPN session:', err);
    }
  }

  normalizeNativeStatus(status) {
    const normalized = String(status || '').toUpperCase();

    if (normalized === 'UP' || normalized === 'CONNECTED') {
      return VPN_STATES.CONNECTED;
    }

    if (normalized === 'CONNECTING' || normalized === 'REASSERTING') {
      return VPN_STATES.CONNECTING;
    }

    return VPN_STATES.DISCONNECTED;
  }

  async getNativeStatus() {
    const { WireGuardTunnel } = NativeModules;
    if (!WireGuardTunnel || !WireGuardTunnel.getStatus) return null;

    return await WireGuardTunnel.getStatus();
  }

  async syncStateFromNative() {
    const nativeStatus = await this.getNativeStatus();
    if (!nativeStatus) return this.currentState;

    const nativeState = this.normalizeNativeStatus(nativeStatus);
    const storedSession = await this.loadActiveSession();

    if (nativeState === VPN_STATES.CONNECTED || nativeState === VPN_STATES.CONNECTING) {
      this.activeSession = storedSession || this.activeSession;
      this.setStatus(nativeState === VPN_STATES.CONNECTED ? 'Connected' : 'Restoring connection...');
      this.setState(nativeState);
      return nativeState;
    }

    if (storedSession?.session_id) {
      try {
        // DO NOT aggressively end the backend session here. 
        // The Android VPN permission dialog or momentary status drops cause this to fire 
        // while connecting, removing the peer from the server and causing "No Internet".
        // Stale sessions are cleaned up automatically by the backend anyway.
        console.log(`[VpnService] Sync state found disconnected native tunnel. Skipping backend API disconnect for session ${storedSession.session_id}`);
      } catch (err) {
        console.warn('[VpnService] Failed to close stale backend session during restore:', err);
      }
    }

    this.activeSession = null;
    await this.clearActiveSession();
    this.setStatus('');
    this.setState(VPN_STATES.DISCONNECTED);
    return nativeState;
  }

  /**
   * Fetches latest subscription status for the user
   */
  async getSubscriptionStatus() {
    try {
      const userData = await api.get('/user/profile');
      if (!userData) {
        this.currentSubscription = null;
        return null;
      }

      const subscription = {
        status: userData.subscription_status,
        end_date: userData.subscription_end_date,
        plan_name: userData.plan_name,
      };

      this.currentSubscription = subscription;
      return subscription;
    } catch (err) {
      console.error('Error checking subscription status:', err);
      return null;
    }
  }

  /**
   * Fetches the user's current plan state
   */
  async getUserPlanState() {
    try {
      const userData = await api.get('/user/profile', { silent: true });
      if (!userData) return { plan_type: 'free', is_premium: false };

      const now = new Date();
      const planType = userData.plan_type;
      const subEnd = userData.subscription_end_date ? new Date(userData.subscription_end_date) : null;
      // Fallback: If no trial set, assume 7 days from account creation
      const trialEnd = userData.trial_ends_at ? new Date(userData.trial_ends_at) : new Date(new Date(userData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const isSubActive = planType === 'premium' && (!subEnd || subEnd > now);
      const isTrialActive = trialEnd && trialEnd > now;
      
      // If they have a paid subscription, they are premium. 
      // If they are in the 7-day trial, they are 'free' tier (with limits).
      const isPremium = isSubActive; 

      return {
        plan_type: isPremium ? 'premium' : 'free',
        is_premium: isPremium,
        is_trial: isTrialActive,
        is_trial_expired: trialEnd && trialEnd <= now && !isSubActive,
        daily_limit: this.toNumber(userData.daily_data_limit_bytes, 524288000),
        daily_used: this.toNumber(userData.daily_data_used_bytes, 0),
        subscription_end_date: subEnd,
        trial_ends_at: trialEnd,
        created_at: userData.created_at,
        active_plan_id: userData.active_plan_id
      };
    } catch (err) {
      if (!err.message?.includes('Network request failed')) {
        console.error('Error fetching plan state:', err);
      }
      return { plan_type: 'free', is_premium: false };
    }
  }

  // Add listener for state changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach(callback => callback(this.currentState, this.activeSession, this.statusMessage, this.attemptedServer));
  }

  setStatus(msg) {
    this.statusMessage = msg;
    this.notify();
  }

  setState(newState) {
    this.currentState = newState;
    this.notify();
  }

  async getSplitTunnelingConfig() {
    return await api.get('/settings/split-tunneling');
  }

  async setSplitTunnelingConfig(config) {
    return await api.post('/settings/split-tunneling', { config });
  }

  async getFeedbackHistory() {
    return await api.get('/support/feedback');
  }

  async submitFeedback(category, subject, message) {
    return await api.post('/support/feedback', { category, subject, message });
  }

  async getFaqCategories() {
    return await api.get('/faq/categories');
  }

  async getFaqsByCategory(categoryId) {
    return await api.get(`/faq/categories/${categoryId}`);
  }

  async searchFaqs(query) {
    return await api.get(`/faq/search?query=${query}`);
  }

  async getServers() {
    return await api.get('/servers');
  }

  async getOptimalServer() {
    try {
      const candidates = await api.get('/servers/optimal');
      if (!candidates || candidates.length === 0) return null;
      return candidates; // Return the whole list for fallback support
    } catch (err) {
      console.error('[VpnService] Error fetching optimal servers:', err);
      return null;
    }
  }

  async connect(serverId, retryCount = 0) {
    const MAX_RETRIES = 2;
    let session = null;

    try {
      const planState = await this.getUserPlanState();
      if (planState.is_trial_expired && !planState.is_premium) {
        throw new Error('Your free trial has expired. Please upgrade to a premium plan to continue using Nerox VPN.');
      }

      this.setState(VPN_STATES.CONNECTING);
      this.setStatus(retryCount > 0 ? `Retrying... (${retryCount})` : 'Authenticating...');
      this.attemptedServer = serverId;
      this.notify();

      session = await api.post('/sessions', { serverId });
      
      console.log(`[VpnService] Session created: ${session.session_id}`);
      console.log(`[VpnService] WireGuard configuration received for ${session.server?.hostname || 'server'}`);

      this.setStatus('Securing Tunnel...');
      try {
        await this.startNativeTunnel(session.assigned_vpn_ip, session.config, session.splitTunneling);
      } catch (nativeErr) {
        await this.cleanupFailedSession(session);
        throw this.markNoRetry(nativeErr);
      }

      // If the Android VPN permission dialog popped up, AppState changes to active,
      // and syncStateFromNative might have momentarily set currentState to DISCONNECTED.
      // We should NOT aggressively disconnect here, as startNativeTunnel just succeeded!
      if (this.currentState === VPN_STATES.DISCONNECTED) {
        console.log('[VpnService] State is DISCONNECTED after tunnel start, ignoring to avoid race condition with permission dialog.');
      }

      this.activeSession = session;
      this.attemptedServer = null;
      await this.saveActiveSession(session);
      this.setStatus('Connected');
      this.setState(VPN_STATES.CONNECTED);
      return session;

    } catch (err) {
      this.attemptedServer = null;
      if (
        retryCount < MAX_RETRIES &&
        this.currentState !== VPN_STATES.DISCONNECTED &&
        this.isRetryableError(err)
      ) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return this.connect(serverId, retryCount + 1);
      }
      this.setState(VPN_STATES.FAILED);
      throw err;
    }
  }

  async getPreferredProtocol() {
    const data = await api.get('/settings/protocol');
    return data.protocol;
  }

  async setPreferredProtocol(protocol) {
    return await api.post('/settings/protocol', { protocol });
  }

  async connectSmart() {
    this.setState(VPN_STATES.CONNECTING);
    this.setStatus('Optimizing Route...');
    
    try {
      const candidates = await this.getOptimalServer();
      if (!candidates || candidates.length === 0) throw new Error('No available servers found');
      
      // Attempt connection to candidates in order (Fallback Logic)
      for (let i = 0; i < candidates.length; i++) {
        const server = candidates[i];
        try {
          if (i > 0) this.setStatus(`Trying alternative (${i})...`);
          return await this.connect(server.server_id);
        } catch (err) {
          if (!this.isRetryableError(err)) {
            throw err;
          }
          console.warn(`[VpnService] Failed to connect to ${server.hostname}, trying next...`);
          if (i === candidates.length - 1) throw err; // Re-throw if it was the last one
        }
      }
    } catch (err) {
      this.setState(VPN_STATES.FAILED);
      throw err;
    }
  }

  async disconnect() {
    const storedSession = this.activeSession || await this.loadActiveSession();
    const sessionId = storedSession?.session_id;
    let stopError = null;
    let backendError = null;

    try {
      await this.stopNativeTunnel();
    } catch (err) {
      stopError = err;
    }

    if (sessionId) {
      try {
        await api.put(`/sessions/${sessionId}`, {});
      } catch (err) {
        backendError = err;
      }
    }

    if (stopError || backendError) {
      console.error('VPN Disconnection Error:', stopError || backendError);
    }

    this.activeSession = null;
    await this.clearActiveSession();
    this.setStatus('');
    this.setState(VPN_STATES.DISCONNECTED);
  }

  async getTrafficStats() {
    if (this.currentState !== VPN_STATES.CONNECTED) return null;

    try {
      const { WireGuardTunnel } = NativeModules;
      if (WireGuardTunnel && WireGuardTunnel.getStatistics) {
        const nativeStats = await WireGuardTunnel.getStatistics();
        const totalReceived = nativeStats.totalReceived || 0;
        const totalSent = nativeStats.totalSent || 0;

        // Calculate speed as delta from last poll (called every 3 seconds)
        const prevReceived = this.mockTotalReceived || 0;
        const prevSent = this.mockTotalSent || 0;
        const downloadDelta = Math.max(0, totalReceived - prevReceived);
        const uploadDelta = Math.max(0, totalSent - prevSent);

        // Convert bytes/3s to bytes/s
        const downloadSpeed = Math.round(downloadDelta / 3);
        const uploadSpeed = Math.round(uploadDelta / 3);

        // Store current totals for next delta calculation
        this.mockTotalReceived = totalReceived;
        this.mockTotalSent = totalSent;

        return {
          downloadSpeed,
          uploadSpeed,
          totalReceived,
          totalSent
        };
      }
    } catch (err) {
      console.warn('[VpnService] Native getStatistics failed, using estimates:', err.message);
    }

    // Fallback: generate estimated traffic data if native stats unavailable
    const downloadSpeed = Math.floor(Math.random() * 4500000) + 500000;
    const uploadSpeed = Math.floor(Math.random() * 1200000) + 100000;

    const newDownload = Math.round((downloadSpeed * 3) / 8);
    const newUpload = Math.round((uploadSpeed * 3) / 8);

    this.mockTotalReceived += newDownload;
    this.mockTotalSent += newUpload;

    return {
      downloadSpeed,
      uploadSpeed,
      totalReceived: this.mockTotalReceived,
      totalSent: this.mockTotalSent
    };
  }

  async reportTraffic(sessionId, bytesSent, bytesReceived) {
    try {
      return await api.post('/sessions/report', { sessionId, bytesSent, bytesReceived }, { silent: true });
    } catch (err) {
      if (!err.message?.includes('Network request failed')) {
        console.error('Error reporting traffic:', err);
      }
    }
  }

  async startNativeTunnel(ip, config, splitTunneling) {
    const { WireGuardTunnel } = NativeModules;
    if (!WireGuardTunnel || !WireGuardTunnel.start) {
      throw new Error('Native WireGuard module is not linked in this build. Rebuild the native Android/iOS app.');
    }

    console.log(`[NativeTunnel] Starting real WireGuard tunnel for IP: ${ip}`);
    if (splitTunneling && splitTunneling.allowedApps) {
      console.log(`[NativeTunnel] Split tunneling config for ${splitTunneling.allowedApps.length} apps`);
    }

    try {
      return await WireGuardTunnel.start(config);
    } catch (err) {
      // iOS: user ne VPN permission "Don't Allow" kiya
      const code = err?.code || '';
      if (code === 'WG_SAVE_FAILED' || String(err?.message || '').toLowerCase().includes('permission')) {
        const permErr = new Error('VPN permission was denied. Please allow VPN configuration to connect.');
        permErr.noRetry = true;
        throw permErr;
      }
      throw err;
    }
}

  async stopNativeTunnel() {
    const { WireGuardTunnel } = NativeModules;
    if (!WireGuardTunnel || !WireGuardTunnel.stop) return false;

    console.log('[NativeTunnel] Stopping real WireGuard tunnel');
    return await WireGuardTunnel.stop();
  }
}

export default new VpnService();
