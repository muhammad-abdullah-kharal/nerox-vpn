import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { PayWithFlutterwave } from 'flutterwave-react-native';
import api from '../services/api';
import VpnService from '../services/VpnService';

const { width } = Dimensions.get('window');

const PLANS = [
  {
    id: 'f6aacebb-8ec9-4805-bf78-e93ce61f8a16', // 1 Month
    label: '1 MONTH',
    sub: 'Link up to 1 Device',
    price: '$9.99',
    period: '/ month',
    highlight: true,
  },
  {
    id: 'e48b3f64-67b8-438b-983c-3b6c87da71f6', // 1 Year
    label: '1 YEAR',
    sub: 'Link up to 4 Device',
    price: '$79.99',
    period: '/ year',
    highlight: false,
  },
  {
    id: 'free-plan-id', // Free Plan identifier (handled locally)
    label: 'FREE PLAN',
    sub: 'Basic Servers, Ads Included',
    price: '$0.00',
    period: ' / 7 days',
    highlight: false,
  },
];

const FEATURES = [
  {
    icon: require('../assets/globe.png'),
    title: 'No Ads',
    sub: 'Enjoy surfing without annoying ads',
  },
  {
    icon: require('../assets/crown.png'),
    title: 'Fast',
    sub: 'Increase connection speed',
  },
  {
    icon: require('../assets/globe.png'),
    title: 'All Servers',
    sub: 'Access all server worldwide',
  },
];

export default function Subscription({ navigation }) {
  const [selectedPlan, setSelectedPlan] = useState('f6aacebb-8ec9-4805-bf78-e93ce61f8a16');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [planState, setPlanState] = useState(null);

  useEffect(() => {
    VpnService.getUserPlanState().then(state => {
      setPlanState(state);
      // Auto-select their active plan if they have one
      if (state?.active_plan_id) {
        setSelectedPlan(state.active_plan_id);
      } else if (state?.is_trial) {
        setSelectedPlan('free-plan-id');
      }
    });
  }, []);

  const getCtaText = () => {
    if (planState?.is_premium) {
      if (selectedPlan === 'free-plan-id') return 'Already Premium';
      if (selectedPlan === planState.active_plan_id) return 'Current Plan';
      return 'Switch Plan';
    }
    
    if (selectedPlan === 'free-plan-id') {
      return planState?.is_trial ? 'Current Plan' : 'Free Plan Expired';
    }
    
    return 'Upgrade to Premium Now';
  };

  const isButtonDisabled = loading || 
    selectedPlan === 'free-plan-id' || 
    (planState?.is_premium && selectedPlan === planState.active_plan_id);

  const handleUpgrade = async () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;

    if (isButtonDisabled) {
      return; 
    }

    try {
      setLoading(true);
      // Initialize payment with backend
      const res = await api.post('/payments/initialize', { planId: plan.id });
      
      if (!res.success) throw new Error(res.error || 'Failed to initialize payment');
      
      // Show Flutterwave modal
      setPaymentData(res.data);
    } catch (err) {
      Alert.alert('Purchase Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnRedirect = async (data) => {
    // Dismiss modal
    setPaymentData(null);
    
    if (data.status === 'successful') {
      Alert.alert(
        '🚀 Upgrade Successful!',
        `Your payment is processing. You will be upgraded shortly!`,
        [{ text: 'Start Exploring', onPress: () => navigation.navigate('MainScreen') }]
      );
    } else {
      Alert.alert('Payment Failed', 'Your payment was not completed.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Back Button */}
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>{'<'}</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Crown Icon */}
        <View style={styles.crownWrap}>
          <View style={styles.crownCircle}>
            <Image source={require('../assets/crown.png')} style={styles.crownImg} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Upgrade to Premium Now</Text>
        <Text style={styles.subtitle}>Access all servers worldwide, fast and powerful</Text>

        {/* World Map Graphic */}
        <ImageBackground
          source={require('../assets/Map2.png')}
          style={styles.mapContainer}
          imageStyle={styles.mapImage}
          resizeMode="contain"
        >
          {/* Glowing dots on the map */}
          {[
            { top: '30%', left: '15%' },
            { top: '20%', left: '42%' },
            { top: '35%', left: '60%' },
            { top: '25%', left: '75%' },
            { top: '55%', left: '30%' },
            { top: '50%', left: '70%' },
          ].map((pos, i) => (
            <View key={i} style={[styles.mapDot, pos]} />
          ))}
        </ImageBackground>

        {/* Plan Cards */}
        <View style={styles.planRow}>
          {PLANS.map(plan => {
            const isSelected = selectedPlan === plan.id;
            return (
              <Pressable
                key={plan.id}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardHighlight,
                ]}
                onPress={() => setSelectedPlan(plan.id)}
              >
                <Text style={[styles.planLabel, isSelected && styles.planLabelHighlight]}>
                  {plan.label}
                </Text>
                <Text style={[styles.planSub, isSelected && styles.planSubHighlight]}>
                  {plan.sub}
                </Text>
                <Text style={[styles.planPrice, isSelected && styles.planPriceHighlight]}>
                  {plan.price}
                </Text>
                <Text style={[styles.planPeriod, isSelected && styles.planPeriodHighlight]}>
                  {plan.period}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Feature List */}
        <View style={styles.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Image source={f.icon} style={styles.featureIcon} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom padding for the fixed button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CTA Button */}
      <View style={styles.footer}>
        <Pressable 
          style={[styles.ctaBtn, isButtonDisabled && { opacity: 0.7 }]} 
          onPress={handleUpgrade} 
          disabled={isButtonDisabled}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              {getCtaText()}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Flutterwave Native Checkout */}
      {paymentData && (
        <PayWithFlutterwave
          onRedirect={handleOnRedirect}
          options={{
            tx_ref: paymentData.txRef,
            authorization: paymentData.publicKey,
            customer: { email: paymentData.customerEmail },
            amount: paymentData.amount,
            currency: paymentData.currency,
            payment_options: paymentData.paymentOptions,
            customizations: {
              title: paymentData.planName,
              description: 'Nerox VPN Premium Subscription',
              logo: 'https://neroxvpn.com/logo.png',
            },
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  scroll: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 16,
    paddingBottom: 30,
    alignItems: 'center',
  },

  /* Back */
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 20,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#161B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  /* Crown */
  crownWrap: {
    marginTop: 10,
    marginBottom: 16,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#1E2540',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crownImg: {
    width: 32,
    height: 32,
    tintColor: '#7AB200',
  },

  /* Title */
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8890A8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },

  /* World Map */
  mapContainer: {
    width: '100%',
    height: 180,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapImage: {
    resizeMode: 'contain',
  },
  mapDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7AB200',
    shadowColor: '#7AB200',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },

  /* Plan Cards */
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 28,
    gap: 8,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#161B35',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  planCardHighlight: {
    borderColor: '#7AB200',
    backgroundColor: '#161B35',
  },
  planCardSelected: {
    borderColor: '#7AB200',
  },
  planLabel: {
    color: '#8890A8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  planLabelHighlight: {
    color: '#fff',
  },
  planSub: {
    color: '#555E7A',
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 10,
  },
  planSubHighlight: {
    color: '#8890A8',
  },
  planPrice: {
    color: '#8890A8',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  planPriceHighlight: {
    color: '#7AB200',
    fontSize: 20,
  },
  planPeriod: {
    color: '#555E7A',
    fontSize: 10,
  },
  planPeriodHighlight: {
    color: '#8890A8',
  },

  /* Features */
  featureList: {
    width: '100%',
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B35',
    borderRadius: 16,
    padding: 16,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0E1428',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureIcon: {
    width: 22,
    height: 22,
    tintColor: '#7AB200',
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  featureSub: {
    color: '#8890A8',
    fontSize: 12,
  },

  /* Footer CTA */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 16,
    backgroundColor: '#0A0E27',
  },
  ctaBtn: {
    backgroundColor: '#7AB200',
    borderRadius: 16,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7AB200',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
