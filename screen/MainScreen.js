// Refreshed imports for hook stability
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ImageBackground,
  Pressable,
  Animated,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AppState,
  Dimensions,
  ScrollView,
  TouchableHighlight,
  InteractionManager,
  Share
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VpnService, { VPN_STATES } from '../services/VpnService';
import UserService from '../services/UserService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


export default function MainScreen({navigation, route}) {
  const [showMenu, setshowMenu] = React.useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [planState, setPlanState] = useState(null);
  const [vpnState, setVpnState] = useState(VPN_STATES.DISCONNECTED);
  const [activeSession, setActiveSession] = useState(null);
  const [connectingTime, setConnectingTime] = useState(0);
  const [selectedServer, setSelectedServer] = useState(null);
  const [trafficInterval, setTrafficInterval] = useState(null);
  const [downloadSpeed, setDownloadSpeed] = useState('0 KB/s');
  const [uploadSpeed, setUploadSpeed] = useState('0 KB/s');
  const [dataUsed, setDataUsed] = useState('0 B');
  const [user, setUser] = useState(null);
  const startTimeRef = useRef(null);
  const lastTapRef = useRef(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [downloadHistory, setDownloadHistory] = useState(new Array(12).fill(0));
  const [uploadHistory, setUploadHistory] = useState(new Array(12).fill(0));
  const [totalDataAtStart, setTotalDataAtStart] = useState({ sent: 0, received: 0 });
  const [showAd, setShowAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);

  const offsetValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(null);

  const fetchUserStats = useCallback(async () => {
    try {
      const profile = await UserService.getProfile();
      if (profile) {
        setUser(profile);
      }
    } catch (err) {
      console.error('[MainScreen] Error fetching user data:', err);
    }
  }, []);

  const handleShareApp = useCallback(async () => {
    try {
      const refCode = user?.referral_code || '';
      const message = refCode 
        ? `Join me on Nerox VPN! Use my referral code ${refCode} to get extra premium days. Download now: https://neroxvpn.app`
        : `Join me on Nerox VPN! High-speed, secure, and unlimited. Download now: https://neroxvpn.app`;
      
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Share Error', error.message);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchUserStats();
      VpnService.getUserPlanState().then(state => {
        setIsPremium(state.is_premium);
        setPlanState(state);
      });
    }, [fetchUserStats])
  );

  // 1. Initial Data Fetch & Auto-Connect
  useEffect(() => {
    let isMounted = true;
    
    const initializeApp = async () => {
      try {
        // Fetch plan state and retry once if it fails to ensure accuracy
        let state = await VpnService.getUserPlanState();
        if (!state || !state.plan_type) {
           await new Promise(r => setTimeout(r, 1000));
           state = await VpnService.getUserPlanState();
        }

        if (!isMounted) return;
        
        console.log('[MainScreen] Initial Plan State:', state);
        setIsPremium(state.is_premium);
        setIsTrial(state.is_trial);
        setPlanState(state);

        const restoredVpnState = await VpnService.syncStateFromNative();
        if (!isMounted) return;

        setVpnState(VpnService.currentState);
        setActiveSession(VpnService.activeSession);
        setStatusMessage(VpnService.statusMessage);

        if (
          restoredVpnState === VPN_STATES.CONNECTED ||
          restoredVpnState === VPN_STATES.CONNECTING
        ) {
          return;
        }

        const autoStart = await AsyncStorage.getItem('setting_auto_connect');
        if (autoStart === 'true' && state.is_premium) {
          console.log('[MainScreen] UI Ready, Auto-Connect triggered.');
          setTimeout(() => {
            if (isMounted) handleConnect(true);
          }, 800);
        }
      } catch (err) {
        console.error('[MainScreen] Initialization failed:', err);
      }
    };

    initializeApp();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        VpnService.syncStateFromNative().catch(err => {
          console.error('[MainScreen] VPN state sync failed:', err);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  // 2. Subscribe to VPN Service
  const checkPremiumStatus = useCallback(async () => {
    const state = await VpnService.getUserPlanState();
    setIsPremium(state.is_premium);
    setPlanState(state);
  }, []);

  useEffect(() => {
    checkPremiumStatus();
  }, [checkPremiumStatus]);

  useEffect(() => {
    const unsubscribe = VpnService.subscribe((state, session, msg, attemptedId) => {
      setVpnState(prev => prev !== state ? state : prev);
      setActiveSession(prev => JSON.stringify(prev) !== JSON.stringify(session) ? session : prev);
      setStatusMessage(prev => prev !== msg ? msg : prev);

      // If we are currently trying a server (fallback), and it's different from current selection
      if (attemptedId && selectedServer?.server_id !== attemptedId) {
        // Just show the ID or placeholder if we don't have the full object yet
        // The service logic handles the actual connection
      }
    });
    return () => unsubscribe();
  }, [selectedServer]);

  // 3. Handle Server Selection from List
  useEffect(() => {
    if (route.params?.selectedServer) {
      setSelectedServer(route.params.selectedServer);
    }
  }, [route.params?.selectedServer]);


  // 4. Connection Timer & Pulse Animation Logic
  useEffect(() => {
    let interval;
    
    if (vpnState === VPN_STATES.CONNECTED) {
      // Record exactly when we connected if not already set
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setConnectingTime(elapsed);
      }, 1000);
      
      if (pulseAnim.current) {
        pulseAnim.current.stop();
        pulseValue.setValue(1);
      }
    } else if (vpnState === VPN_STATES.CONNECTING || vpnState === VPN_STATES.FALLBACK) {
      startTimeRef.current = null; // Reset for next connection
      setConnectingTime(0);
      
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseValue, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      );
      pulseAnim.current.start();
    } else {
      clearInterval(interval);
      startTimeRef.current = null;
      if (pulseAnim.current) {
        pulseAnim.current.stop();
        pulseValue.setValue(1);
      }
      if (vpnState === VPN_STATES.DISCONNECTED) {
        setConnectingTime(0);
      }
    }
    return () => {
      clearInterval(interval);
      if (pulseAnim.current) pulseAnim.current.stop();
    };
  }, [vpnState]);


  const totalDataRef = useRef({ sent: 0, received: 0 });

  // 5. Traffic Reporting Loop
  const updateTraffic = useCallback(async () => {
    if (vpnState !== VPN_STATES.CONNECTED || !activeSession) return;

    try {
      const stats = await VpnService.getTrafficStats();
      if (!stats) return;

      const downloadDelta = Math.max(0, stats.totalReceived - totalDataRef.current.received);
      const uploadDelta = Math.max(0, stats.totalSent - totalDataRef.current.sent);

      console.log(`[Traffic] Reporting: Sent=${uploadDelta}, Received=${downloadDelta} for Session=${activeSession.session_id}`);
      
      // Always report to database to keep session alive
      await VpnService.reportTraffic(
        activeSession.session_id,
        Math.round(uploadDelta),
        Math.round(downloadDelta)
      );

      // Update local reference for next delta
      totalDataRef.current = { sent: stats.totalSent, received: stats.totalReceived };
      
      setDownloadSpeed(`${(stats.downloadSpeed / 1024).toFixed(1)} KB/s`);
      setUploadSpeed(`${(stats.uploadSpeed / 1024).toFixed(1)} KB/s`);
      setDataUsed(formatData(stats.totalReceived + stats.totalSent));

      // Update Chart History
      setDownloadHistory(prev => [...prev.slice(1), stats.downloadSpeed / 1024]);
      setUploadHistory(prev => [...prev.slice(1), stats.uploadSpeed / 1024]);

      // DATA CAP ENFORCEMENT (Only check API if free user)
      if (!isPremium) {
        const updatedPlan = await VpnService.getUserPlanState();
        if (updatedPlan) {
          setPlanState(updatedPlan);
          setIsPremium(updatedPlan.is_premium);
          
          const limitBytes = 524288000; // 500MB
          if (!updatedPlan.is_premium && !updatedPlan.is_trial && (updatedPlan.daily_used || 0) >= limitBytes) {
            console.warn('[DataCap] Limit hit during session. Terminating.');
            VpnService.disconnect();
            Alert.alert(
              'Data Limit Reached', 
              'You have consumed your 500MB daily limit. Upgrade to Premium for unlimited data!',
              [{ text: 'Upgrade Now', onPress: () => navigation.navigate('Subscription') }, { text: 'Close' }]
            );
          }
        }
      }
    } catch (err) {
      console.error('[Traffic] Update failed:', err);
    }
  }, [vpnState, activeSession, isPremium, navigation]);

  useEffect(() => {
    let interval;
    if (vpnState === VPN_STATES.CONNECTED && activeSession) {
      // Initialize start baseline
      VpnService.getTrafficStats().then(stats => {
        if (stats) {
          setTotalDataAtStart({ sent: stats.totalSent, received: stats.totalReceived });
          // Reset the delta ref so we don't start with negative deltas on new sessions
          totalDataRef.current = { sent: stats.totalSent, received: stats.totalReceived };
        }
      });

      interval = setInterval(updateTraffic, 3000); // Sync every 3 seconds
      setTrafficInterval(interval);
    } else {
      if (trafficInterval) clearInterval(trafficInterval);
      setTrafficInterval(null);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [vpnState, activeSession, updateTraffic]);


  const formatTime = timeInSeconds => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${
      seconds < 10 ? '0' : ''
    }${seconds}`;
  };

  const formatData = (bytes) => {
    const safeBytes = Number(bytes);
    if (!Number.isFinite(safeBytes) || safeBytes <= 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(
      sizes.length - 1,
      Math.floor(Math.log(safeBytes) / Math.log(k)),
    );
    return parseFloat((safeBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const openModal = () => {
    // Priority Queuing: Ensure the UI is idle before showing alert to prevent "Late Popup"
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        Alert.alert(
          'Disconnect VPN?',
          'Your internet traffic will no longer be encrypted and your IP will be visible.',
          [
            {
              text: 'Keep Protected',
              onPress: () => console.log('[UI] Cancel Pressed'),
              style: 'cancel',
            },
            {
              text: 'Disconnect Now',
              onPress: () => {
                console.log('[UI] Disconnect Confirmed');
                // Use setTimeout to allow the Alert to close fully before navigating
                setTimeout(() => confirmDisconnect(), 100);
              },
              style: 'destructive',
            },
          ],
          { cancelable: true }
        );
      }, 50);
    });
  };

  const isConnectingRef = useRef(false);

  const handleConnect = async (isAuto = false) => {
    // Ensure isAuto is a boolean (prevents event objects from being treated as true)
    const autoFlag = isAuto === true; 
    
    if (isConnectingRef.current || vpnState === VPN_STATES.CONNECTED) {
      console.log(`[MainScreen] handleConnect: BLOCKED (isConnecting: ${isConnectingRef.current}, state: ${vpnState})`);
      return;
    }
    
    try {
      isConnectingRef.current = true;
      console.log(`[MainScreen] handleConnect: INITIATED (Source: ${autoFlag ? 'Auto-Connect' : 'User Tap'})`);

      const profile = await UserService.getProfile();
      if (!profile) {
        Alert.alert('Auth Required', 'Please login to connect.');
        navigation.navigate('Login');
        return;
      }

      // 1. Check Access (Use cached state if available, or fetch)
      if (!isPremium) {
        const state = await VpnService.getUserPlanState();
        if (!state.is_premium) {
          if (state.is_trial_expired) {
            Alert.alert(
              'Free Plan Expired',
              'Your Free Plan period has ended. Upgrade to Premium to continue using Nerox!',
              [{ text: 'Upgrade Now', onPress: () => navigation.navigate('Subscription') }, { text: 'Later' }]
            );
            return;
          }
          // If it's just 'free' and not 'expired trial', we let them connect (to restricted servers)
        }
      }

      // 2. Initiate Connection logic
      setStatusMessage('Optimizing Route...');
      setVpnState(VPN_STATES.CONNECTING);
      
      // 1. Plan Verification
      const plan = await VpnService.getUserPlanState();
      
      setPlanState(plan);
      setIsPremium(plan.is_premium);
      setIsTrial(plan.is_trial);

      // NO ADS for Premium OR Trial users
      // 1. Show Ad ONLY for Free users (Hide for Premium or Trial)
      const isFreeUser = !plan.is_premium && !plan.is_trial && plan.plan_type?.toLowerCase() !== 'premium';
      
      if (isFreeUser) {
        setShowAd(true);
        setAdCountdown(5);
        let timer = setInterval(() => {
          setAdCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        // Wait for ad before connecting
        await new Promise(resolve => setTimeout(resolve, 5500));
        setShowAd(false);
      }

      try {
        if (!selectedServer) {
          await VpnService.connectSmart();
        } else {
          await VpnService.connect(selectedServer.server_id);
        }
      } catch (connErr) {
        if (connErr.message.includes('No available')) {
          setStatusMessage('Refreshing connection points...');
        }
        throw connErr; // Re-throw to be caught by the outer catch
      }

      // Connection Success
      const notifyEnabled = await AsyncStorage.getItem('setting_notifications');
      if (notifyEnabled !== 'false') {
        Alert.alert('Connected', `Successfully secured your connection to ${selectedServer?.location || 'Smart Location'}`);
      }

    } catch (err) {
      const notifyEnabled = await AsyncStorage.getItem('setting_notifications');
      if (notifyEnabled !== 'false') {
        Alert.alert('Connection Failed', err.message);
      }
      console.error('[ConnectionError]', err.message);
    } finally {
      isConnectingRef.current = false;
    }
  };

  const confirmDisconnect = () => {
    console.log('[UI] confirmDisconnect: LIGHTNING INITIATED');
    
    // 1. INSTANT UI RESET (High Priority)
    setVpnState(VPN_STATES.DISCONNECTED);
    isConnectingRef.current = false;
    setShowAd(false);
    
    if (trafficInterval) {
      clearInterval(trafficInterval);
      setTrafficInterval(null);
    }

    // 2. IMMEDIATE FEEDBACK POPUP
    Alert.alert(
      'Disconnected',
      'Your connection has been closed safely.',
      [{ text: 'OK', onPress: () => navigation.navigate('ConnectionReport') }]
    );

    // 3. BACKGROUND CLEANUP (Don't wait)
    VpnService.disconnect()
      .then(() => VpnService.getUserPlanState())
      .then(state => setPlanState(state))
      .catch(err => console.error('[VpnService] Background cleanup failed:', err));
  };

  const dailyUsedBytes = Number(planState?.daily_used);
  const dailyLimitBytes = Number(planState?.daily_limit);
  const safeDailyUsed = Number.isFinite(dailyUsedBytes) && dailyUsedBytes > 0 ? dailyUsedBytes : 0;
  const safeDailyLimit = Number.isFinite(dailyLimitBytes) && dailyLimitBytes > 0 ? dailyLimitBytes : 524288000;
  const dailyUsagePercent = Math.min(100, (safeDailyUsed / safeDailyLimit) * 100);
  const dailyLimitLabel = isPremium ? 'Unlimited' : formatData(safeDailyLimit);


  return (
    <View style={styles.container}>
      {/* Side Menu Drawer Implementation (Animated) */}
      <View style={styles.sideMenu}>
        <View style={styles.menuHeader}>
          <Pressable onPress={() => {
            Animated.parallel([
              Animated.timing(scaleValue, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(offsetValue, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start();
            setshowMenu(false);
          }}>
            <View style={styles.backBtn}>
              <Image source={require('../assets/Left.png')} style={styles.backIcon} />
            </View>
          </Pressable>
          <Text style={styles.menuTitle}>Menu</Text>
          <View style={{width: 40}} />
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image 
                source={{ uri: user.avatar_url }} 
                style={styles.avatarImg} 
              />
            ) : (
              <View style={[styles.letterAvatarMini, { backgroundColor: '#F57C00' }]}>
                <Text style={styles.letterTextMini}>
                  {(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isPremium && <View style={styles.premiumBadgeMini}><Image source={require('../assets/crown.png')} style={styles.crownMini} /></View>}
          </View>
          <Text style={styles.userName}>
            {user?.display_name || user?.username || 'User'}
          </Text>
          <Text style={[styles.userEmail, isPremium && { color: '#6B8F04', fontWeight: 'bold' }]}>
            {isPremium ? 'PRO MEMBER' : (user?.email || 'Free Member')}
          </Text>
        </View>

        <ScrollView 
          style={styles.navLinks} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Pressable onPress={() => navigation.navigate('Account')} style={styles.navItem}>
             <Image source={require('../assets/Acc.png')} style={styles.navIcon} />
             <Text style={styles.navText}>My Account</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Referral')} style={styles.navItem}>
             <Image source={require('../assets/Sha.png')} style={styles.navIcon} />
             <Text style={styles.navText}>Invite Friends</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('SplitTunneling')} style={styles.navItem}>
             <Image source={require('../assets/Spl.png')} style={styles.navIcon} />
             <Text style={styles.navText}>Split Tunneling</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Protocol')} style={styles.navItem}>
             <Image source={require('../assets/Pro.png')} style={styles.navIcon} />
             <Text style={styles.navText}>Protocol</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Setting')} style={styles.navItem}>
             <Image source={require('../assets/Set.png')} style={styles.navIcon} />
             <Text style={styles.navText}>Setting</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Faq')} style={styles.navItem}>
             <Image source={require('../assets/Faq.png')} style={styles.navIcon} />
             <Text style={styles.navText}>FAQ</Text>
          </Pressable>
            <Pressable onPress={() => handleShareApp()} style={styles.navItem}>
              <Image source={require('../assets/Sha.png')} style={styles.navIcon} />
              <Text style={styles.navText}>Share App</Text>
           </Pressable>
          <Pressable onPress={() => navigation.navigate('About')} style={styles.navItem}>
             <Image source={require('../assets/More.png')} style={styles.navIcon} />
             <Text style={styles.navText}>About Us</Text>
          </Pressable>
        </ScrollView>

        <Pressable onPress={() => navigation.navigate('Subscription')} style={styles.premiumBanner}>
           <ImageBackground source={require('../assets/btn.png')} style={styles.premiumBtn}>
              <Text style={styles.premiumText}>Get Premium Account</Text>
              <Image source={require('../assets/crown.png')} style={styles.crownIcon} />
           </ImageBackground>
        </Pressable>
      </View>

      {/* Main Content Area */}
      <Animated.View 
        style={[styles.mainArea, {
          borderRadius: showMenu ? 20 : 0,
          transform: [{ scale: scaleValue }, { translateX: offsetValue }]
        }]}
      >
         <ImageBackground source={require('../assets/HomeBg.png')} style={styles.bgImage}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => {
                  Animated.parallel([
                    Animated.timing(scaleValue, { toValue: 0.7, duration: 300, useNativeDriver: true }),
                    Animated.timing(offsetValue, { toValue: 280, duration: 300, useNativeDriver: true })
                  ]).start();
                  setshowMenu(true);
                }} style={styles.menuBtn}>
                <Image source={require('../assets/Menu.png')} style={styles.menuIcon} />
              </TouchableOpacity>
              <View style={styles.headerLogoContainer}>
                <Text style={styles.headerTitle}>Nerox</Text>
                {isPremium && (
                  <View style={styles.proLabelBadgeInline}>
                    <Text style={styles.proLabelTextInline}>PRO</Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity 
                onPress={() => navigation.navigate('Subscription')} 
                style={[styles.crownHeaderBtn, isPremium && styles.crownHeaderBtnPremium]}
              >
                <Image 
                  source={require('../assets/crown.png')} 
                  style={[styles.crownHeaderIconSmall, { tintColor: isPremium ? '#fff' : '#6B8F04' }]} 
                />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {vpnState === VPN_STATES.CONNECTED ? (
                <View style={styles.statsContainer}>
                   <View style={styles.timerCard}>
                      <Text style={styles.labelSmall}>SECURE CONNECTION ACTIVE</Text>
                      <Text style={styles.timerText}>{formatTime(connectingTime)}</Text>
                   </View>
                   
                   <View style={styles.speedRow}>
                      <View style={styles.speedBox}>
                         <View style={[styles.speedIconBg, { backgroundColor: 'rgba(107, 143, 4, 0.1)' }]}>
                            <Image source={require('../assets/Download.png')} style={[styles.speedIcon, { tintColor: '#6B8F04' }]} />
                         </View>
                         <View>
                            <Text style={styles.speedLabel}>DOWNLOAD</Text>
                            <Text style={styles.speedValue}>{downloadSpeed}</Text>
                         </View>
                      </View>
                      <View style={styles.speedDivider} />
                      <View style={styles.speedBox}>
                         <View style={[styles.speedIconBg, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
                            <Image source={require('../assets/Upload.png')} style={[styles.speedIcon, { tintColor: '#FF9800' }]} />
                         </View>
                         <View>
                            <Text style={styles.speedLabel}>UPLOAD</Text>
                            <Text style={styles.speedValue}>{uploadSpeed}</Text>
                          </View>
                       </View>
                    </View>
                    
                    <View style={styles.chartWrapper}>
                      <LineChart
                        data={{
                          labels: [],
                          datasets: [
                            {
                              data: downloadHistory.length > 0 ? downloadHistory : [0],
                              color: (opacity = 1) => `rgba(107, 143, 4, ${opacity})`,
                              strokeWidth: 3
                            },
                            {
                              data: uploadHistory.length > 0 ? uploadHistory : [0],
                              color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
                              strokeWidth: 2
                            }
                          ]
                        }}
                        width={Dimensions.get('window').width - 80}
                        height={120}
                        withInnerLines={false}
                        withOuterLines={false}
                        chartConfig={{
                          backgroundColor: 'transparent',
                          backgroundGradientFrom: 'rgba(23, 27, 46, 0.0)',
                          backgroundGradientTo: 'rgba(23, 27, 46, 0.0)',
                          backgroundGradientFromOpacity: 0,
                          backgroundGradientToOpacity: 0,
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(107, 143, 4, ${opacity})`,
                          labelColor: (opacity = 1) => `rgba(161, 161, 172, ${opacity})`,
                          propsForDots: { r: '0' },
                          propsForBackgroundLines: {
                            strokeWidth: 1,
                            stroke: 'rgba(255, 255, 255, 0.03)',
                            strokeDasharray: '4 4'
                          }
                        }}
                        bezier
                        style={{
                          marginVertical: 8,
                          borderRadius: 16,
                          paddingRight: 30, // Fixes cutoff on right
                          marginLeft: -15, // Aligns graph properly on left
                        }}
                      />
                    </View>
                </View>
              ) : vpnState === VPN_STATES.CONNECTING ? (
                <View style={styles.statsContainer}>
                   <View style={styles.timerCard}>
                      <Text style={styles.labelSmall}>{statusMessage || 'ESTABLISHING TUNNEL...'}</Text>
                      <ActivityIndicator size="large" color="#6B8F04" style={{ marginTop: 20 }} />
                   </View>
                </View>
              ) : vpnState === VPN_STATES.FALLBACK ? (
                <View style={styles.statsContainer}>
                   <View style={styles.timerCard}>
                      <Text style={styles.labelSmall}>{statusMessage || 'SWITCHING SERVERS...'}</Text>
                      <ActivityIndicator size="large" color="#FF9800" style={{ marginTop: 20 }} />
                   </View>
                </View>
              ) : (
                <View style={{height: 20}} />
              )}

              <Pressable onPress={() => navigation.navigate('Location')} style={styles.locationCard}>
                 <View style={styles.locationInner}>
                    <View style={styles.flagBox}>
                      <Image 
                        source={
                          vpnState === VPN_STATES.CONNECTED && activeSession?.server?.country_code
                          ? { uri: `https://flagcdn.com/w80/${activeSession.server.country_code.toLowerCase()}.png` }
                          : selectedServer
                          ? { uri: `https://flagcdn.com/w80/${selectedServer.country_code.toLowerCase()}.png` }
                          : require('../assets/US.png')
                        } 
                        style={styles.flagImg} 
                      />
                    </View>
                    <View style={styles.locationTexts}>
                       <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.locationName}>
                            {vpnState === VPN_STATES.CONNECTED && activeSession?.server?.location
                              ? activeSession.server.location 
                              : selectedServer 
                              ? selectedServer.location 
                              : 'Smart Location'}
                          </Text>
                          {!selectedServer && vpnState === VPN_STATES.DISCONNECTED && (
                            <View style={styles.smartBadge}>
                              <Text style={styles.smartBadgeText}>FASTEST</Text>
                            </View>
                          )}
                       </View>
                       <Text style={styles.locationSub}>
                        {vpnState === VPN_STATES.CONNECTED && activeSession?.server?.hostname
                          ? activeSession.server.hostname 
                          : selectedServer 
                          ? selectedServer.hostname 
                          : 'Automatically find fastest server'}
                       </Text>
                    </View>
                    <View style={styles.arrowContainer}>
                      <Image source={require('../assets/Right.png')} style={styles.arrowIcon} />
                    </View>
                 </View>
              </Pressable>

               <View style={styles.connectArea}>
                 <TouchableOpacity 
                   onPress={() => {
                     const now = Date.now();
                     if (now - lastTapRef.current < 1000) return; // 1s Cool-off
                     lastTapRef.current = now;
                     
                     if (vpnState === VPN_STATES.CONNECTED) {
                       confirmDisconnect();
                     } else {
                       handleConnect();
                     }
                   }}
                   disabled={vpnState === VPN_STATES.CONNECTING}
                   style={styles.touchTarget}
                   activeOpacity={0.7}
                 >
                   <Animated.Image 
                     source={
                       vpnState === VPN_STATES.CONNECTED 
                       ? require('../assets/Connected.png') 
                       : require('../assets/Disconnected.png')
                     } 
                     style={[
                       styles.connectBtnLarge, 
                       vpnState === VPN_STATES.CONNECTING && { opacity: 0.8 },
                       { transform: [{ scale: pulseValue }] }
                     ]} 
                   />
                 </TouchableOpacity>
                 <View style={{ height: 10 }} />
                 <Image 
                   source={
                     vpnState === VPN_STATES.CONNECTED 
                     ? require('../assets/Connected_Status.png') 
                     : vpnState === VPN_STATES.CONNECTING || vpnState === VPN_STATES.FALLBACK
                     ? require('../assets/Tap_to_Connect.png')
                     : require('../assets/Tap_to_Connect.png')
                   } 
                   style={[styles.statusImg, (vpnState === VPN_STATES.CONNECTING || vpnState === VPN_STATES.FALLBACK) && { opacity: 0.5 }]} 
                 />

                 {planState && (
                   <View style={styles.dataCapContainer}>
                     <View style={styles.dataCapHeader}>
                       <Text style={styles.dataCapTitle}>Daily Data Usage</Text>
                       <Text style={styles.dataCapPercent}>
                         {isPremium ? 'Unlimited' : `${Math.round(dailyUsagePercent)}%`}
                       </Text>
                     </View>
                     <View style={styles.progressBarBg}>
                       <View 
                         style={[
                           styles.progressBarFill, 
                           { 
                             width: isPremium ? '100%' : `${dailyUsagePercent}%`,
                             backgroundColor: isPremium ? '#00FF88' : dailyUsagePercent > 80 ? '#FF4444' : '#00FF88'
                           }
                         ]} 
                       />
                     </View>
                     <Text style={styles.dataCapLabel}>
                       {formatData(safeDailyUsed)} / {dailyLimitLabel}
                     </Text>
                   </View>
                 )}

                  {(vpnState === VPN_STATES.CONNECTING || vpnState === VPN_STATES.FALLBACK) && (
                    <Text style={[styles.labelSmall, { marginTop: -20 }]}>
                      {statusMessage.toUpperCase() || 'CONNECTING...'}
                    </Text>
                  )}

                  {/* FREE TIER SPONSORED BANNER */}
                  {!isPremium && (
                    <TouchableOpacity 
                      style={styles.bottomBanner}
                      onPress={() => navigation.navigate('Subscription')}
                    >
                       <View style={styles.bannerBadge}>
                          <Text style={styles.bannerBadgeText}>AD</Text>
                       </View>
                       <View style={styles.bannerTextContent}>
                          <Text style={styles.bannerTitle}>Upgrade to Premium</Text>
                          <Text style={styles.bannerSub}>Get 10x Speed & Unlimited Data</Text>
                       </View>
                       <Image source={require('../assets/crown.png')} style={styles.bannerIcon} />
                    </TouchableOpacity>
                  )}
               </View>
            </ScrollView>
         </ImageBackground>
      </Animated.View>

      {/* MODAL AD (INTERSTITIAL SIMULATION) */}
      <Modal visible={showAd} transparent animationType="slide">
        <View style={styles.adOverlay}>
          <ImageBackground source={require('../assets/HomeBg.png')} style={styles.adContainer} imageStyle={{ borderRadius: 20 }}>
            <View style={styles.adBlur} />
            
            <View style={styles.adHeader}>
              <View style={styles.adBadge}><Text style={styles.adBadgeText}>FREE TIER</Text></View>
              <Text style={styles.adLabel}>SPONSORED</Text>
            </View>
            
            <View style={styles.adContent}>
              <View style={styles.crownContainer}>
                <Image source={require('../assets/crown.png')} style={styles.adIcon} />
              </View>
              <Text style={styles.adTitle}>Nerox Premium</Text>
              <Text style={styles.adSub}>Enjoy unlimited data, ultra-speed servers, and an ad-free experience.</Text>
              
              <TouchableOpacity 
                style={styles.adButton}
                onPress={() => { setShowAd(false); navigation.navigate('Subscription'); }}
              >
                <Text style={styles.adButtonText}>UPGRADE NOW</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.adFooter}>
              <View style={styles.timerPill}>
                <ActivityIndicator size="small" color="#00FF88" style={{ marginRight: 8 }} />
                <Text style={styles.adTimer}>
                  {adCountdown > 0 ? `Connecting in ${adCountdown}s...` : 'Starting...'}
                </Text>
              </View>
            </View>
          </ImageBackground>
        </View>
      </Modal>

      {/* Native Alert is now used instead of custom modal for maximum reliability */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00091F' },
  sideMenu: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 280, padding: 25, backgroundColor: '#00081C' },
  menuHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 20, height: 20 },
  menuTitle: { fontSize: 22, color: '#fff', marginLeft: 15, fontWeight: 'bold' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' },
  menuBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  menuIcon: { width: 22, height: 22 },
  headerLogoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  proLabelBadgeInline: { backgroundColor: '#6B8F04', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  proLabelTextInline: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  crownHeaderBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(107, 143, 4, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(107, 143, 4, 0.3)' },
  crownHeaderBtnPremium: { backgroundColor: '#6B8F04', borderColor: '#6B8F04' },
  crownHeaderIconSmall: { width: 22, height: 22 },
  statsArea: { backgroundColor: 'rgba(23, 27, 46, 0.8)', borderRadius: 24, padding: 20, marginTop: 15, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  profileSummary: { marginTop: 30, marginBottom: 30, alignItems: 'center' },
  avatarMini: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 50, height: 50, resizeMode: 'contain' },
  userName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 12 },
  navLinks: { flex: 1, paddingVertical: 10 },
  navItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, paddingVertical: 2 },
  navIcon: { width: 22, height: 22, opacity: 0.8 },
  navText: { color: '#fff', marginLeft: 18, fontSize: 16, fontWeight: '500' },
  premiumBanner: { marginTop: 'auto', paddingVertical: 10 },
  premiumBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, overflow: 'hidden' },
  premiumText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  crownIcon: { width: 24, height: 24, marginLeft: 12 },
  mainArea: { flex: 1, backgroundColor: '#00091F', overflow: 'hidden' },
  bgImage: { flex: 1, padding: 20 },
  expiryBanner: { backgroundColor: '#E74C3C', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 20, borderRadius: 12, marginBottom: 20, marginTop: 10 },
  expiryText: { color: '#FFF', fontSize: 12, fontWeight: '600', flex: 1, marginLeft: 8 },
  mainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  iconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  mapImg: { width: '100%', height: 180, resizeMode: 'contain', marginVertical: 10, opacity: 0.6 },
  timerCard: { backgroundColor: 'rgba(23, 27, 46, 0.4)', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  timerText: { fontSize: 42, color: '#fff', fontWeight: '200', letterSpacing: 2, marginTop: 5 },
  labelSmall: { color: '#6B8F04', textAlign: 'center', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  statsContainer: { marginTop: 10, paddingHorizontal: 5 },
  speedRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 15,
    backgroundColor: 'rgba(23, 27, 46, 0.4)', 
    borderRadius: 20, 
    paddingVertical: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  speedBox: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  speedIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  speedIcon: { width: 18, height: 18 },
  speedLabel: { color: '#A1A1AC', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  speedValue: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginTop: 2 },
  speedTierIndicator: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'center'
  },
  speedTierText: {
    color: '#A1A1AC',
    fontSize: 10,
    fontWeight: 'bold'
  },
  speedDivider: { width: 1, height: 40, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginHorizontal: 10 },
  chartWrapper: { 
    marginTop: 15, 
    alignItems: 'center', 
    width: '100%',
    backgroundColor: 'rgba(23, 27, 46, 0.4)',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden'
  },
  locationCard: { 
    backgroundColor: 'rgba(23, 27, 46, 0.8)', 
    borderRadius: 24, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.1)', 
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10
  },
  locationInner: { flexDirection: 'row', alignItems: 'center' },
  flagBox: { 
    width: 54, 
    height: 54, 
    borderRadius: 16, 
    backgroundColor: '#171B2E', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  flagImg: { width: 34, height: 22, borderRadius: 4 },
  locationTexts: { flex: 1, marginLeft: 16 },
  locationName: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  locationSub: { color: '#A1A1AC', fontSize: 12, marginTop: 2 },
  smartBadge: { 
    backgroundColor: 'rgba(107, 143, 4, 0.15)', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 6, 
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(107, 143, 4, 0.3)'
  },
  smartBadgeText: { color: '#6B8F04', fontSize: 9, fontWeight: 'bold' },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  adOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adContainer: {
    width: SCREEN_WIDTH * 0.9,
    height: 480,
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
  },
  adBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  adBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  adBadgeText: {
    color: '#00FF88',
    fontSize: 10,
    fontWeight: 'bold',
  },
  adLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  adContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  crownContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  adIcon: {
    width: 40,
    height: 40,
    tintColor: '#FFD700',
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  adSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  bottomBanner: {
    backgroundColor: 'rgba(23, 27, 46, 0.95)',
    width: '100%',
    padding: 16,
    borderRadius: 20,
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 143, 4, 0.3)',
  },
  bannerBadge: {
    backgroundColor: 'rgba(107, 143, 4, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 15,
  },
  bannerBadgeText: {
    color: '#6B8F04',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bannerTextContent: {
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bannerSub: {
    color: '#A1A1AC',
    fontSize: 11,
    marginTop: 2,
  },
  bannerIcon: {
    width: 24,
    height: 24,
    tintColor: '#6B8F04',
  },
  adButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  adButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  adFooter: {
    alignItems: 'center',
    zIndex: 1,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adTimer: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  profileSection: {
    alignItems: 'center',
    marginVertical: 30,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#00FF88',
    padding: 3,
    marginBottom: 15,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  letterAvatarMini: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterTextMini: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  premiumBadgeMini: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFD700',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  crownMini: {
    width: 12,
    height: 12,
    tintColor: '#000',
  },
  userName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  arrowIcon: { width: 14, height: 14, tintColor: '#A1A1AC' },
  connectArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    zIndex: 1,
  },
  touchTarget: {
    zIndex: 10,
    padding: 10,
  },
  connectBtnLarge: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
  },
  statusImg: {
    width: 140,
    height: 30,
    resizeMode: 'contain',
    marginTop: 5,
  },
  dataCapContainer: {
    width: '80%',
    marginTop: 30,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dataCapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dataCapTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  dataCapPercent: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  dataCapLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textAlign: 'center',
  },
  adBannerContainer: {
    width: '85%',
    backgroundColor: '#171B2E',
    borderRadius: 15,
    padding: 15,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center'
  },
  adBannerLabel: {
    color: '#6B8F04',
    fontSize: 10,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  adBannerImg: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    opacity: 0.6
  },
  adBannerText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10
  },
  speedTierIndicator: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: 'center'
  },
  speedTierText: {
    color: '#A1A1AC',
    fontSize: 10,
    fontWeight: 'bold'
  }
});
