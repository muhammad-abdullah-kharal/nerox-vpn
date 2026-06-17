import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VpnService from '../services/VpnService';

const APPS_LIST = [
  { id: 'chrome', name: 'Chrome', icon: require('../assets/Chromee.png') },
  { id: 'instagram', name: 'Instagram', icon: require('../assets/Instagramm.png') },
  { id: 'facebook', name: 'Facebook', icon: require('../assets/Facebookk.png') },
  { id: 'twitter', name: 'Twitter', icon: require('../assets/Twitterr.png') },
  { id: 'youtube', name: 'Youtube', icon: require('../assets/Youtubee.png') },
  { id: 'playstore', name: 'PlayStore', icon: require('../assets/PlayStoree.png') },
  { id: 'telegram', name: 'Telegram', icon: require('../assets/Telegramm.png') },
];

export default function SplitTunneling({navigation}) {
  const [appStates, setAppStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadAppStates();
  }, []);

  const loadAppStates = async () => {
    try {
      setLoading(true);
      
      // 1. Try to fetch from Backend first (Source of Truth)
      const backendConfig = await VpnService.getSplitTunnelingConfig();
      
      if (Object.keys(backendConfig).length > 0) {
        setAppStates(backendConfig);
        await AsyncStorage.setItem('split_tunneling_apps', JSON.stringify(backendConfig));
      } else {
        // 2. Fallback to Local if backend is empty
        const saved = await AsyncStorage.getItem('split_tunneling_apps');
        if (saved) {
          const localConfig = JSON.parse(saved);
          setAppStates(localConfig);
          // Sync local to backend
          await VpnService.setSplitTunnelingConfig(localConfig);
        } else {
          // 3. Initial defaults
          const defaults = {};
          APPS_LIST.forEach(app => defaults[app.id] = false);
          setAppStates(defaults);
        }
      }
    } catch (err) {
      console.error('Failed to load split tunneling states:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleApp = async (appId) => {
    try {
      setSyncing(true);
      const newState = {
        ...appStates,
        [appId]: !appStates[appId]
      };
      
      // Update Local State instantly for responsiveness
      setAppStates(newState);
      
      // Background Sync to Backend & Local Storage
      await Promise.all([
        VpnService.setSplitTunnelingConfig(newState),
        AsyncStorage.setItem('split_tunneling_apps', JSON.stringify(newState))
      ]);
      
    } catch (err) {
      console.error('Failed to save app state:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={styles.mainContainer}>
      <View style={styles.innerContent}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Image source={require('../assets/Left.png')} style={styles.backIcon} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
             <Text style={styles.headerTitle}>Split Tunneling</Text>
             {syncing && <ActivityIndicator size="small" color="#6B8F04" style={{ marginLeft: 10 }} />}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ height: 20 }} />

        <Image source={require('../assets/Split.png')} style={styles.mainIcon} />
        
        <View style={{ height: 10 }} />

        <Text style={styles.description}>
          All apps run through encrypted VPN connection. If you want to
          exclude any app, tap the button on right.
        </Text>

        <View style={{ height: 25 }} />

        {loading ? (
          <ActivityIndicator color="#6B8F04" size="large" style={{ marginTop: 30 }} />
        ) : (
          <View style={styles.appsContainer}>
            {APPS_LIST.map((app) => (
              <View key={app.id}>
                <View style={styles.appRow}>
                  <View style={styles.appInfo}>
                    <Image source={app.icon} style={styles.appIcon} />
                    <Text style={styles.appName}>{app.name}</Text>
                  </View>

                  <Switch
                    trackColor={{ false: '#4A4A61', true: '#1A1A24' }}
                    thumbColor={appStates[app.id] ? '#6B8F04' : '#ABABB1'}
                    onValueChange={() => toggleApp(app.id)}
                    value={appStates[app.id] || false}
                  />
                </View>
                <View style={styles.divider} />
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 50 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#00091F',
  },
  innerContent: {
    flexGrow: 1,
    backgroundColor: '#00091F',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    height: 40,
    marginTop: 20,
  },
  backBtn: {
    alignItems: 'center',
    width: 40,
    height: 40,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#fff',
  },
  mainIcon: {
    width: 64,
    height: 64,
    alignSelf: 'center',
  },
  description: {
    fontSize: 14,
    fontWeight: '200',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: '15%',
    lineHeight: 20,
  },
  appsContainer: {
    width: '90%',
    alignSelf: 'center',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 15,
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 48,
    height: 48,
  },
  appName: {
    fontSize: 14,
    fontWeight: '200',
    color: '#fff',
    marginLeft: 10,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#3A3A4D',
  },
});

