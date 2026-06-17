import api from './api';

class UserService {
  async getProfile() {
    return await api.get('/user/profile');
  }

  async updateProfile(updates) {
    return await api.post('/user/profile/update', updates);
  }

  async logout() {
    await api.setAuthToken(null);
  }

  async getUsageStats() {
    return await api.get('/user/usage');
  }

  async getReferralData() {
    return await api.get('/referral');
  }

  async applyReferral(code) {
    return await api.post('/referral/apply', { code });
  }

  async uploadAvatar(base64, fileName, type) {
    return await api.post('/user/avatar', { base64, fileName, type });
  }
}

export default new UserService();
