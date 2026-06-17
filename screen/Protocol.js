import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import VpnService from '../services/VpnService';

export default function Protocol({navigation}) {
  const data = [
    { label: 'Auto', value: 'Auto' },
    { label: 'WireGuard', value: 'WireGuard' },
    { label: 'Open VPN (UDP)', value: 'OpenVPN_UDP' },
    { label: 'Open VPN (TCP)', value: 'OpenVPN_TCP' },
    { label: 'IKEv2', value: 'IKEv2' },
    { label: 'IPSec', value: 'IPSec' },
  ];

  const [selectedProtocol, setSelectedProtocol] = useState('Auto');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadPref() {
      const pref = await VpnService.getPreferredProtocol();
      setSelectedProtocol(pref);
      setLoading(false);
    }
    loadPref();
  }, []);

  const handlePress = async (protocolValue) => {
    const planState = await VpnService.getUserPlanState();
    const isPremium = planState.is_premium || planState.is_trial;

    const restrictedProtocols = ['WireGuard', 'IKEv2', 'IPSec'];
    if (restrictedProtocols.includes(protocolValue) && !isPremium) {
      Alert.alert(
        'Premium Protocol 💎',
        `${protocolValue} is a high-performance protocol reserved for Premium users. Upgrade now to experience better stability and speed!`,
        [
          { text: 'Upgrade Now', onPress: () => navigation.navigate('Subscription') },
          { text: 'Close', style: 'cancel' }
        ]
      );
      return;
    }

    try {
      setUpdating(true);
      await VpnService.setPreferredProtocol(protocolValue);
      setSelectedProtocol(protocolValue);
    } catch (err) {
      console.error('Failed to update protocol:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: '#00091F' }}>
      <View
        style={{
          flexGrow: 1,
          height: Dimensions.get('window').height,
          backgroundColor: '#00091F',
        }}>
        <View style={{ width: '100%', alignSelf: 'center' }}>
          <View style={{ height: 20 }} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '90%',
              alignSelf: 'center',
              height: 40,
            }}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Image source={require('../assets/Left.png')} style={{ width: 24, height: 24 }} />
            </Pressable>

            <Text style={{ fontSize: 20, fontWeight: '300', color: '#fff' }}>Protocol</Text>
            
            <Pressable onPress={() => navigation.navigate('MainScreen')}>
              <Image source={require('../assets/Re.png')} style={{ width: 24, height: 24 }} />
            </Pressable>
          </View>
          
          <View style={{ height: 20 }} />

          <Text style={{ fontSize: 12, fontWeight: '400', color: '#979797', textAlign: 'center', paddingHorizontal: '25%' }}>
            Select the appropriate location and protocol
          </Text>
          
          <View style={{ height: 20 }} />

          {loading ? (
             <ActivityIndicator color="#6B8F04" size="large" style={{ marginTop: 50 }} />
          ) : (
            data.map((item, index) => (
              <Pressable key={index} onPress={() => handlePress(item.value)} disabled={updating}>
                <View
                  style={{
                    marginBottom: 2,
                    width: '100%',
                    height: 63,
                    backgroundColor: '#171B2E',
                    justifyContent: 'space-between',
                    paddingHorizontal: 40,
                    alignItems: 'center',
                    alignSelf: 'center',
                    flexDirection: 'row',
                    opacity: updating ? 0.6 : 1
                  }}>
                  <Text style={{ fontSize: 14, fontWeight: '200', color: '#fff' }}>
                    {item.label}
                  </Text>

                  <View
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: 19,
                      backgroundColor: selectedProtocol === item.value ? '#6B8F04' : '#171B2E',
                      borderWidth: selectedProtocol === item.value ? 0 : 1,
                      borderColor: '#4A4A61',
                      justifyContent: "center",
                      alignItems: "center"
                    }}>
                    {selectedProtocol === item.value && (
                      <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: '#fff' }} />
                    )}
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    alignItems: 'center',
    width: 40,
    height: 40,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111',
  }
});

