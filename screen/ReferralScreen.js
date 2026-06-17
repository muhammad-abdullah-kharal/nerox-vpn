import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Alert,
  Share,
  Clipboard,
  ActivityIndicator
} from 'react-native';
import UserService from '../services/UserService';

export default function ReferralScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [referralStats, setReferralStats] = useState({ count: 0, rewards: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const profile = await UserService.getProfile();
      if (!profile) return;

      setUser(profile);
      setReferralCode(profile.referral_code || '');

      // Fetch stats from backend
      const stats = await UserService.getReferralData();
      setReferralStats({ 
        count: stats.referral_count || 0, 
        rewards: (stats.referral_count || 0) * 7 
      });
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onShare = async () => {
    try {
      const result = await Share.share({
        message: `Hey! Use my referral code ${referralCode} to get 3 days of FREE Premium VPN on Nerox! Download now: https://neroxvpn.com`,
      });
    } catch (error) {
      Alert.alert(error.message);
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(referralCode);
    Alert.alert('Success', 'Code copied to clipboard!');
  };

  const handleApplyReferral = async () => {
    if (!inputCode.trim()) return;
    try {
      setSubmitting(true);
      await UserService.applyReferral(inputCode.trim());

      Alert.alert('Success!', 'Referral reward applied! Enjoy your 3 days of Premium.');
      setInputCode('');
      fetchReferralData(); // Refresh stats
    } catch (error) {
      Alert.alert('Error', error.message || 'Invalid or expired referral code.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6B8F04" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/Left.png')} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>Invite & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Image source={require('../assets/Logo.png')} style={styles.heroImage} />
        
        <Text style={styles.title}>Refer a Friend, Get Premium!</Text>
        <Text style={styles.subtitle}>
          Invite your friends to Nerox VPN. You'll get <Text style={styles.bold}>7 Days Free Premium</Text> for each friend who joins, and they'll get <Text style={styles.bold}>3 Days</Text> as a welcome gift!
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{referralStats.count}</Text>
            <Text style={styles.statLabel}>Friends Referred</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{referralStats.rewards}</Text>
            <Text style={styles.statLabel}>Days Earned</Text>
          </View>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <Pressable onPress={copyToClipboard} style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>COPY</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={onShare} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>SHARE LINK</Text>
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Have a referral code?</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter friend's code"
              placeholderTextColor="#555"
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="characters"
            />
            <Pressable 
              onPress={handleApplyReferral} 
              style={[styles.applyBtn, submitting && styles.disabledBtn]}
              disabled={submitting}
            >
              <Text style={styles.applyBtnText}>{submitting ? '...' : 'CLAIM'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00091F' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 50,
    paddingBottom: 20
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 18, height: 18 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  content: { padding: 25, alignItems: 'center' },
  heroImage: { width: 100, height: 100, marginBottom: 20, borderRadius: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: '#A1A1AC', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  bold: { color: '#6B8F04', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 30 },
  statCard: { flex: 0.48, backgroundColor: '#171B2E', padding: 15, borderRadius: 16, alignItems: 'center' },
  statValue: { color: '#6B8F04', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#fff', fontSize: 12, marginTop: 5 },
  codeCard: { 
    width: '100%', 
    backgroundColor: '#0A1227', 
    borderWidth: 1, 
    borderColor: '#171B2E', 
    padding: 20, 
    borderRadius: 20,
    marginBottom: 20
  },
  codeLabel: { color: '#A1A1AC', fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  copyBtn: { backgroundColor: 'rgba(107, 143, 4, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  copyBtnText: { color: '#6B8F04', fontSize: 12, fontWeight: '700' },
  shareBtn: { 
    width: '100%', 
    backgroundColor: '#6B8F04', 
    paddingVertical: 15, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: '#6B8F04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { width: '100%', height: 1, backgroundColor: '#171B2E', marginVertical: 35 },
  inputSection: { width: '100%' },
  inputLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 15 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { 
    flex: 0.75, 
    backgroundColor: '#171B2E', 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    color: '#fff',
    fontSize: 14
  },
  applyBtn: { flex: 0.22, backgroundColor: '#222', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 }
});
