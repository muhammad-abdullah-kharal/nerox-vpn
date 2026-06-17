import React, {useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  TextInput,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import VpnService from '../services/VpnService';

export default function Location({navigation}) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(0);
  const [protocolLabel, setProtocolLabel] = useState('Automatic');

  useEffect(() => {
    fetchServers();
    fetchProtocol();
  }, []);

  const fetchProtocol = async () => {
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
  };

  const fetchServers = async () => {
    try {
      setLoading(true);
      const data = await VpnService.getServers();
      setServers(data || []);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (server, index) => {
    const planState = await VpnService.getUserPlanState();
    const isPremium = planState.is_premium || planState.is_trial;

    if (server && server.is_premium && !isPremium) {
      Alert.alert(
        'Premium Location 💎',
        'This server is reserved for Premium users. Upgrade now to unlock all 50+ global locations!',
        [
          { text: 'Upgrade Now', onPress: () => navigation.navigate('Subscription') },
          { text: 'Maybe Later', style: 'cancel' }
        ]
      );
      return;
    }

    setSelectedItem(index);
    navigation.navigate('MainScreen', { selectedServer: server });
  };

  const getFlag = (code) => {
    const mapping = {
      'US': require('../assets/US.png'),
      'IN': require('../assets/IN.png'),
      'GB': require('../assets/GB.png'),
      'SG': require('../assets/Singapore.png'),
      'CA': require('../assets/CA.png'),
      'AU': require('../assets/AU.png'),
      'DE': require('../assets/DE.png'),
      'FR': require('../assets/FR.png'),
    };
    return mapping[code] || require('../assets/Defaultflag.png');
  };

  return (
    <ScrollView style={{ backgroundColor: '#00091F' }}>
      <View style={styles.mainWrapper}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Image source={require('../assets/Left.png')} style={styles.backIcon} />
          </Pressable>
          <Text style={styles.headerTitle}>Location</Text>
          <Pressable onPress={fetchServers}>
            <Image source={require('../assets/Re.png')} style={styles.headerIcon} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>Select the appropriate location and protocol</Text>
        
        <View style={styles.content}>
          <Pressable onPress={() => navigation.navigate('Protocol')}>
            <View style={styles.protocolCard}>
              <View style={styles.protocolInner}>
                <View>
                  <Text style={styles.cardTitle}>Protocol</Text>
                  <Text style={styles.cardSub}>{protocolLabel}</Text>
                </View>
                <Image source={require('../assets/Ar.png')} style={styles.arrowIcon} />
              </View>
            </View>
          </Pressable>

          <Text style={styles.sectionTitle}>Smart Location</Text>
          
          {loading ? (
            <ActivityIndicator color="#6B8F04" size="large" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Pressable onPress={() => handleSelect(null, -1)}>
                <View style={[styles.serverCard, selectedItem === -1 && styles.selectedCard]}>
                   <View style={styles.serverInfo}>
                      <Image source={require('../assets/Defaultflag.png')} style={styles.flagImg} />
                      <View style={{ marginLeft: 15 }}>
                         <Text style={styles.serverName}>Auto Select</Text>
                         <Text style={styles.serverDetails}>Fastest Server Available</Text>
                      </View>
                   </View>
                   <View style={[styles.radio, selectedItem === -1 && styles.selectedRadio]}>
                      {selectedItem === -1 && <View style={styles.radioInner} />}
                   </View>
                </View>
              </Pressable>

              <Text style={styles.sectionTitle}>All Servers</Text>
              {servers.map((server, index) => (
                <Pressable key={server.server_id} onPress={() => handleSelect(server, index)}>
                  <View style={[styles.serverCard, selectedItem === index && styles.selectedCard]}>
                     <View style={[styles.serverInfo, { flex: 1 }]}>
                        <Image source={getFlag(server.country_code)} style={styles.flagImg} />
                        <View style={{ marginLeft: 15, flex: 1 }}>
                           <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.serverName}>{server.location}</Text>
                              {server.is_premium && (
                                <View style={styles.premiumBadge}>
                                   <Text style={styles.premiumTextSmall}>PRO</Text>
                                </View>
                              )}
                           </View>
                           <Text style={styles.serverDetails}>{server.current_load}% Load - {server.hostname}</Text>
                        </View>
                     </View>
                     <View style={[styles.radio, selectedItem === index && styles.selectedRadio]}>
                        {selectedItem === index && <View style={styles.radioInner} />}
                     </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#00091F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, height: 80 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 24, height: 24 },
  headerTitle: { color: '#fff', fontSize: 20 },
  headerIcon: { width: 24, height: 24 },
  subtitle: { color: '#979797', fontSize: 12, textAlign: 'center', paddingHorizontal: 50, marginBottom: 20 },
  content: { paddingHorizontal: 20 },
  protocolCard: { backgroundColor: '#171B2E', borderRadius: 20, padding: 15, marginBottom: 20 },
  protocolInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 16 },
  cardSub: { color: '#A1A1AC', fontSize: 12 },
  arrowIcon: { width: 20, height: 16 },
  sectionTitle: { color: '#fff', fontSize: 14, marginBottom: 15, marginTop: 10 },
  serverCard: { height: 72, backgroundColor: '#171B2E', borderRadius: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  selectedCard: { borderColor: '#6B8F04' },
  serverInfo: { flexDirection: 'row', alignItems: 'center' },
  flagImg: { width: 44, height: 28, borderRadius: 4 },
  serverName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  serverDetails: { color: '#A1A1AC', fontSize: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#4A4A61', justifyContent: 'center', alignItems: 'center' },
  selectedRadio: { borderColor: '#6B8F04', backgroundColor: '#6B8F04' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  premiumBadge: { backgroundColor: '#6B8F04', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  premiumTextSmall: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});
