import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  Switch,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import VpnService from '../services/VpnService';
import UserService from '../services/UserService';

export default function Account({navigation}) {
  const [deviceName, setDeviceName] = useState('');
  const [user, setUser] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [protocol, setProtocol] = useState('Auto');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [referralStats, setReferralStats] = useState({ code: '', total_referrals: 0 });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [planState, setPlanState] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const name = await DeviceInfo.getDeviceName();
      const model = DeviceInfo.getModel();
      const brand = await DeviceInfo.getBrand();
      const deviceDisplayName = (brand && model) 
        ? (model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`)
        : (model || name || 'Current Device');
      setDeviceName(deviceDisplayName);

      const profile = await UserService.getProfile();
      setUser(profile);
      setNewName(profile.display_name || profile.username);

      const usage = await UserService.getUsageStats();
      setUsageStats(usage);

      const refData = await UserService.getReferralData();
      setReferralStats(refData);

      const pref = await VpnService.getPreferredProtocol();
      setProtocol(pref);

      const pState = await VpnService.getUserPlanState();
      setPlanState(pState);

    } catch (err) {
      console.error('Account Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Nerox VPN! Use my referral code ${referralStats.code} to get extra premium days. Download now: https://neroxvpn.app`,
      });
    } catch (error) {
      Alert.alert(error.message);
    }
  };

  const handleRedeemCode = async () => {
    if (!redeemCode) return Alert.alert('Error', 'Please enter a referral code');

    try {
      setRedeeming(true);
      const result = await UserService.applyReferral(redeemCode);
      Alert.alert('Success!', result.message);
      setRedeemCode('');
      fetchData(); 
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to redeem code');
    } finally {
      setRedeeming(false);
    }
  };

  const handlePickImage = async () => {
    const options = { mediaType: 'photo', includeBase64: true, quality: 0.8 };
    launchImageLibrary(options, async (response) => {
      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        try {
          setUploadingAvatar(true);
          const result = await UserService.uploadAvatar(asset.base64, asset.fileName, asset.type);
          setUser({ ...user, avatar_url: result.avatarUrl });
          Alert.alert('Success', 'Profile picture updated!');
        } catch (error) {
          Alert.alert('Error', 'Failed to upload image');
        } finally {
          setUploadingAvatar(false);
        }
      }
    });
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      return Alert.alert('Error', 'Name cannot be empty');
    }
    try {
      setLoading(true);
      await UserService.updateProfile({ display_name: newName });
      setUser({ ...user, display_name: newName });
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysLeft = () => {
    if (!planState) return '--';
    const dateVal = planState.subscription_end_date || planState.trial_ends_at;
    if (!dateVal) return '--';
    
    const end = new Date(dateVal);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : '0';
  };

  const formatData = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(1) + ' MB';
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await UserService.logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        },
      ]
    );
  };

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.customHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backTouch}>
          <Icon name="chevron-left" size={32} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitleText}>Account</Text>
        <Pressable onPress={handleLogout} style={styles.backTouch}>
          <Icon name="logout" size={24} color="#FF4B4B" />
        </Pressable>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6B8F04" />
          </View>
        ) : (
          <View style={styles.content}>
            {/* Profile Section */}
            <View style={styles.profileSection}>
              <View style={styles.avatarFrame}>
                <View style={styles.avatarInner}>
                  {uploadingAvatar ? (
                    <ActivityIndicator color="#6B8F04" />
                  ) : user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.letterAvatar, { backgroundColor: '#F57C00' }]}>
                      <Text style={styles.letterText}>
                        {(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable onPress={handlePickImage} style={styles.cameraCircle}>
                  <Icon name="camera" size={16} color="#000" />
                </Pressable>
                <Pressable onPress={() => setIsEditing(true)} style={styles.settingsCircle}>
                   <Icon name="pencil" size={16} color="#000" />
                </Pressable>
              </View>

              {isEditing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15 }}>
                  <TextInput
                    style={styles.nameInput}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                    placeholder="Enter your name"
                    placeholderTextColor="#888"
                  />
                  <Pressable onPress={handleUpdateName} style={{ marginLeft: 10 }}>
                    <Icon name="check-circle" size={28} color="#6B8F04" />
                  </Pressable>
                  <Pressable onPress={() => { setIsEditing(false); setNewName(user?.display_name || user?.username || ''); }} style={{ marginLeft: 10 }}>
                    <Icon name="close-circle" size={28} color="#FF4B4B" />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.displayName}>{user?.display_name || user?.username || 'User'}</Text>
              )}
              
              <Text style={styles.displayEmail}>{user?.email || 'email@example.com'}</Text>
            </View>

            {/* Plan Card */}
            <View style={styles.premiumCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 10 }}>
                   <View style={styles.row}>
                     <Icon name="crown" size={24} color={planState?.is_premium ? '#6B8F04' : '#888'} />
                     <Text style={styles.premiumTitle} numberOfLines={1} ellipsizeMode="tail">
                       {planState?.is_premium ? 'Premium PRO Plan' : 'Free Plan'}
                     </Text>
                     {planState?.is_premium && (
                       <View style={styles.proSmallBadge}>
                         <Text style={styles.proSmallText}>PRO</Text>
                       </View>
                     )}
                   </View>
                   <Text style={styles.premiumSub}>
                     {planState?.is_premium ? 'Unlimited PRO Access' : 'Limited Free Access'}
                   </Text>
                </View>
                <View style={styles.daysBox}>
                  <Text style={styles.daysNum}>{calculateDaysLeft()}</Text>
                  <Text style={styles.daysTxt}>Days Left</Text>
                </View>
              </View>

              {!planState?.is_premium && (
                <Pressable 
                  onPress={() => navigation.navigate('Subscription')} 
                  style={styles.upgradeBtn}
                >
                  <Text style={styles.upgradeBtnText}>UPGRADE NOW</Text>
                </Pressable>
              )}

              <View style={styles.cardDivider} />

              <View style={styles.infoList}>
                <View style={styles.infoItem}>
                  <View style={styles.iconBox}>
                    <Icon name="badge-account-horizontal" size={20} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>User ID</Text>
                    <Text style={styles.infoValue}>{user?.user_id?.substring(0, 18)}...</Text>
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.iconBox}>
                    <Icon name="crown" size={20} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>Device ({user?.devices?.length || 1}/{user?.max_devices || 5})</Text>
                    <Text style={styles.infoValue}>{deviceName}</Text>
                  </View>
                </View>

                <View style={styles.infoItem}>
                  <View style={styles.iconBox}>
                    <Icon name="arrow-up-circle-outline" size={22} color="#fff" />
                  </View>
                  <View style={styles.usageRow}>
                    <View>
                      <Text style={styles.infoLabel}>Lifetime Usage</Text>
                      <Text style={styles.infoValue}>UP: {formatData(usageStats?.total_upload)}</Text>
                    </View>
                    <Text style={[styles.infoValue, { marginTop: 18 }]}>DOWN: {formatData(usageStats?.total_download)}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <Pressable style={styles.infoItem}>
                  <View style={styles.iconBox}>
                    <Icon name="crown" size={22} color="#6B8F04" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>VPN Protocol</Text>
                    <Text style={[styles.infoValue, { color: '#6B8F04' }]}>{protocol}</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#888" />
                </Pressable>
              </View>
            </View>

            {/* Refer & Earn Section */}
            <View style={styles.referCard}>
               <View style={styles.referHeader}>
                  <View style={styles.referIcon} />
                  <View style={{ flex: 1, marginLeft: 15 }}>
                     <Text style={styles.referLabel}>Refer & Earn Free Days</Text>
                     <Text style={styles.referValue}>{referralStats?.code || 'NX-FEEE7A'}</Text>
                  </View>
                  <Pressable onPress={handleShare} style={styles.inviteButton}>
                     <Text style={styles.inviteButtonText}>INVITE</Text>
                  </Pressable>
               </View>
               <Text style={styles.referNote}>0 users referred. Each success gives you +3 days!</Text>

               <View style={styles.redeemContainer}>
                  <TextInput
                    style={styles.redeemInput}
                    placeholder="Enter friend's code"
                    placeholderTextColor="#555"
                    value={redeemCode}
                    onChangeText={setRedeemCode}
                  />
                  <Pressable onPress={handleRedeemCode} style={styles.redeemButton}>
                     <Text style={styles.redeemButtonText}>REDEEM</Text>
                  </Pressable>
               </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#02091D' },
  customHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 15, 
    paddingTop: 45, 
    paddingBottom: 15 
  },
  backTouch: { padding: 5 },
  headerTitleText: { color: '#fff', fontSize: 22, fontWeight: '400' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  center: { marginTop: 100, alignItems: 'center' },
  profileSection: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  avatarFrame: { position: 'relative', width: 130, height: 130 },
  avatarInner: { 
    width: 130, 
    height: 130, 
    borderRadius: 65, 
    borderWidth: 2, 
    borderColor: '#171B2E', 
    overflow: 'hidden',
    backgroundColor: '#0A1227',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarImg: { width: '100%', height: '100%' },
  letterAvatar: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  letterText: { color: '#fff', fontSize: 60, fontWeight: 'bold' },
  cameraCircle: { 
    position: 'absolute', 
    right: 5, 
    top: 5, 
    backgroundColor: '#6B8F04', 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#02091D'
  },
  settingsCircle: { 
    position: 'absolute', 
    right: 5, 
    bottom: 5, 
    backgroundColor: '#6B8F04', 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#02091D'
  },
  nameInput: { 
    color: '#fff', 
    fontSize: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#6B8F04',
    paddingVertical: 4,
    minWidth: 150,
    textAlign: 'center'
  },
  displayName: { color: '#fff', fontSize: 24, fontWeight: '400', marginTop: 15 },
  displayEmail: { color: '#888', fontSize: 16, marginTop: 4 },
  premiumCard: { 
    backgroundColor: '#11172D', 
    borderRadius: 30, 
    padding: 24, 
    marginTop: 10 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  premiumTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginLeft: 8, flexShrink: 1 },
  proSmallBadge: { backgroundColor: '#6B8F04', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  proSmallText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  premiumSub: { color: '#888', fontSize: 13, marginTop: 4 },
  daysBox: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    width: 75, 
    height: 75, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  daysNum: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  daysTxt: { color: '#888', fontSize: 10, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 20 },
  infoList: { },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  iconBox: { width: 40, height: 40, justifyContent: 'center' },
  infoLabel: { color: '#888', fontSize: 13 },
  infoValue: { color: '#fff', fontSize: 16, marginTop: 2 },
  usageRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  referCard: { 
    backgroundColor: '#11172D', 
    borderRadius: 30, 
    padding: 24, 
    marginTop: 20 
  },
  referHeader: { flexDirection: 'row', alignItems: 'center' },
  referIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#6B8F04' },
  referLabel: { color: '#888', fontSize: 13 },
  referValue: { color: '#6B8F04', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  inviteButton: { backgroundColor: '#6B8F04', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  inviteButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  referNote: { color: '#888', fontSize: 12, marginTop: 15, marginBottom: 20 },
  redeemContainer: { flexDirection: 'row', alignItems: 'center' },
  redeemInput: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 15, 
    height: 50, 
    paddingHorizontal: 15, 
    color: '#fff', 
    marginRight: 10 
  },
  redeemButton: { backgroundColor: 'rgba(255,255,255,0.08)', height: 50, paddingHorizontal: 20, borderRadius: 15, justifyContent: 'center' },
  redeemButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  upgradeBtn: { 
    backgroundColor: '#6B8F04', 
    marginTop: 20, 
    height: 44, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  upgradeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});
