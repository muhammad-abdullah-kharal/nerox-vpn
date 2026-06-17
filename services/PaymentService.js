import { Platform } from 'react-native';
import * as IAP from 'react-native-iap';
import api from './api';

class PaymentService {
  constructor() {
    this.isInitialized = false;
    this.plans = [];
  }

  async init() {
    try {
      if (this.isInitialized) return true;
      await IAP.initConnection();
      if (Platform.OS === 'android') {
        await IAP.flushFailedPurchasesCachedAsPendingAndroid();
      }
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('IAP Initialization Error:', err);
      return false;
    }
  }

  async getPlans() {
    return await api.get('/payments/plans');
  }

  async getCustomPrice(duration, devices) {
    return await api.get(`/payments/custom-price?duration=${duration}&devices=${devices}`);
  }

  async fetchStoreProducts(planData) {
    try {
      const productIds = Platform.select({
        ios: planData.map(p => p.apple_product_id).filter(Boolean),
        android: planData.map(p => p.google_product_id).filter(Boolean),
      });

      if (!productIds || productIds.length === 0) return [];
      const products = await IAP.getSubscriptions({ skus: productIds });
      return products;
    } catch (err) {
      console.error('Error fetching Products:', err);
      return [];
    }
  }

  async purchasePlan(plan) {
    try {
      const sku = Platform.OS === 'ios' ? plan.apple_product_id : plan.google_product_id;
      if (!sku) throw new Error('Product ID not configured for this plan');

      let purchase;
      if (Platform.OS === 'android') {
        const subscriptions = await IAP.getSubscriptions({ skus: [sku] });
        const product = subscriptions.find(s => s.productId === sku);
        if (!product || !product.subscriptionOfferDetails) {
          throw new Error('Subscription offer details not found for this product');
        }
        const offerToken = product.subscriptionOfferDetails[0]?.offerToken;
        purchase = await IAP.requestSubscription({
          sku,
          subscriptionOffers: [{ sku, offerToken }]
        });
      } else {
        purchase = await IAP.requestSubscription({ sku });
      }

      const purchaseToken = Platform.OS === 'android' ? purchase.purchaseToken : purchase.transactionReceipt;
      
      const response = await api.post('/payments/verify', {
        platform: Platform.OS,
        productId: sku,
        purchaseToken: purchaseToken
      });

      if (!response.success) throw new Error(response.message || 'Verification failed');
      await IAP.finishTransaction({ purchase, isConsumable: false });
      return response;
    } catch (err) {
      console.error('Purchase Flow Error:', err);
      throw err;
    }
  }

  async mockPurchasePlan(plan, customDuration = null, customDevices = null, customRegion = null) {
    try {
      // Uses the dedicated mock-purchase endpoint — no store tokens needed.
      const response = await api.post('/payments/mock-purchase', {
        planId: plan.plan_id,
        customDuration,
        customDevices,
        customRegion
      });
      return response;
    } catch (err) {
      console.error('Mock Purchase Error:', err);
      throw err;
    }
  }

  async close() {
    if (this.isInitialized) {
      await IAP.endConnection();
      this.isInitialized = false;
    }
  }
}

export default new PaymentService();
