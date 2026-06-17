import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VpnService from '../services/VpnService';

const { width } = Dimensions.get('window');

const ICONS = {
  protocol: require('../assets/Pro.png'),
  stats: require('../assets/C1.png'),
  auto: require('../assets/Split.png'), 
  notify: require('../assets/No.png'),
  split: require('../assets/Split.png'),
  back: require('../assets/Left.png'),
  right: require('../assets/Right.png'),
  legal: require('../assets/Id.png'),
  support: require('../assets/Faq.png'),
  feedback: require('../assets/Sha.png'),
  about: require('../assets/Subscription.png'),
};

export default function Setting({ navigation }) {
  const [protocolLabel, setProtocolLabel] = useState('Auto');
  const [loading, setLoading] = useState(true);
  
  const [statsEnabled, setStatsEnabled] = useState(false);
  const [autoConnect, setAutoConnect] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [splitTunneling, setSplitTunneling] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const pref = await VpnService.getPreferredProtocol();
      const mapping = {
        'Auto': 'Automatic',
        'WireGuard': 'WireGuard',
        'OpenVPN_UDP': 'OpenVPN (UDP)',
        'OpenVPN_TCP': 'OpenVPN (TCP)',
        'IKEv2': 'IKEv2',
        'IPSec': 'IPSec'
      };
      setProtocolLabel(mapping[pref] || 'Automatic');

      const [sStats, sAuto, sNotify, sSplit] = await Promise.all([
        AsyncStorage.getItem('setting_stats'),
        AsyncStorage.getItem('setting_auto_connect'),
        AsyncStorage.getItem('setting_notifications'),
        AsyncStorage.getItem('setting_split_tunneling')
      ]);

      if (sStats !== null) setStatsEnabled(JSON.parse(sStats));
      if (sAuto !== null) setAutoConnect(JSON.parse(sAuto));
      if (sNotify !== null) setShowNotifications(JSON.parse(sNotify));
      if (sSplit !== null) setSplitTunneling(JSON.parse(sSplit));
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = async (key, value, setter) => {
    try {
      setter(value);
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={ICONS.back} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator color="#6B8F04" size="large" />
            <Text style={styles.loadingText}>Loading Preferences...</Text>
          </View>
        ) : (
          <>
            <Section title="Connection">
              <SettingRow 
                icon="protocol" 
                label="VPN Protocol" 
                value={protocolLabel} 
                onPress={() => navigation.navigate('Protocol')} 
              />
              <SettingToggle 
                icon="auto" 
                label="Auto Connect" 
                subtext="Connect when app starts"
                value={autoConnect} 
                onValueChange={(v) => toggleSetting('setting_auto_connect', v, setAutoConnect)} 
              />
              <SettingToggle 
                icon="split" 
                label="Split Tunneling" 
                subtext="Exclude specific apps"
                value={splitTunneling} 
                onValueChange={(v) => toggleSetting('setting_split_tunneling', v, setSplitTunneling)} 
                onPress={() => navigation.navigate('SplitTunneling')}
              />
            </Section>

            <Section title="Preferences">
              <SettingToggle 
                icon="notify" 
                label="Notifications" 
                value={showNotifications} 
                onValueChange={(v) => toggleSetting('setting_notifications', v, setShowNotifications)} 
              />
              <SettingToggle 
                icon="stats" 
                label="Analytics" 
                subtext="Help us improve Nerox VPN"
                value={statsEnabled} 
                onValueChange={(v) => toggleSetting('setting_stats', v, setStatsEnabled)} 
              />
            </Section>

            <Section title="Support & Legal">
              <SettingRow icon="support" label="FAQ & Help" onPress={() => navigation.navigate('Faq')} />
              <SettingRow icon="feedback" label="Feedback" onPress={() => navigation.navigate('Feedback')} />
              <SettingRow icon="legal" label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
              <SettingRow icon="legal" label="Terms of Service" onPress={() => navigation.navigate('Term')} />
              <SettingRow icon="about" label="About Us" onPress={() => navigation.navigate('About')} />
            </Section>

            <View style={styles.footer}>
              <Text style={styles.versionLabel}>Nerox VPN v1.3.0 (Stable)</Text>
              <Text style={styles.buildLabel}>Build ID: 2026.05.04.01</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const Section = ({ title, children }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionHeader}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

const SettingRow = ({ icon, label, value, onPress }) => (
  <Pressable style={styles.row} onPress={onPress}>
    <View style={styles.rowLeft}>
      <View style={styles.iconBg}><Image source={ICONS[icon]} style={styles.rowIcon} /></View>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <View style={styles.rowRight}>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      <Image source={ICONS.right} style={styles.arrowIcon} />
    </View>
  </Pressable>
);

const SettingToggle = ({ icon, label, subtext, value, onValueChange, onPress }) => (
  <Pressable style={styles.row} onPress={onPress}>
    <View style={styles.rowLeft}>
      <View style={styles.iconBg}><Image source={ICONS[icon]} style={styles.rowIcon} /></View>
      <View>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtext && <Text style={styles.rowSubtext}>{subtext}</Text>}
      </View>
    </View>
    <Switch
      trackColor={{ false: '#171B2E', true: '#6B8F04' }}
      thumbColor={value ? '#fff' : '#4A4A61'}
      onValueChange={onValueChange}
      value={value}
    />
  </Pressable>
);

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#00091F' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: 45,
    backgroundColor: '#000C29',
    borderBottomWidth: 1,
    borderBottomColor: '#171B2E'
  },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 22, height: 22 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  scrollContent: { paddingBottom: 40 },
  loadingArea: { marginTop: 100, alignItems: 'center' },
  loadingText: { color: '#A1A1AC', marginTop: 15, fontSize: 14 },
  sectionContainer: { marginTop: 25, paddingHorizontal: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#6B8F04', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  sectionContent: { backgroundColor: '#0A1227', borderRadius: 20, borderWidth: 1, borderColor: '#171B2E', overflow: 'hidden' },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#171B2E'
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rowIcon: { width: 18, height: 18, resizeMode: 'contain' },
  rowLabel: { fontSize: 15, color: '#fff', fontWeight: '500' },
  rowSubtext: { fontSize: 11, color: '#A1A1AC', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, color: '#6B8F04', fontWeight: 'bold', marginRight: 10 },
  arrowIcon: { width: 14, height: 14, opacity: 0.5 },
  footer: { marginTop: 40, alignItems: 'center' },
  versionLabel: { fontSize: 12, color: '#5C5C66', fontWeight: '600' },
  buildLabel: { fontSize: 10, color: '#2E2E3D', marginTop: 4 }
});
