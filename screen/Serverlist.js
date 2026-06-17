import React, {useState} from 'react';
import {
  View,
  Text,
  Dimensions,
  Image,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ImageBackground,
  ActivityIndicator, 
  RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import VpnService from '../services/VpnService';

export default function Serverlist({navigation}) {
  const [servers, setServers] = useState([]);
  const [filteredServers, setFilteredServers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const flagMap = {
    'DE': require('../assets/DE.png'),
    'AU': require('../assets/AU.png'),
    'IN': require('../assets/IN.png'),
    'CA': require('../assets/CA.png'),
    'FR': require('../assets/FR.png'),
    'GB': require('../assets/GB.png'),
    'US': require('../assets/US.png'),
    'SG': require('../assets/Singapore.png'),
  };

  const loadIcon = (load) => {
    if (load < 30) return require('../assets/1CL.png');
    if (load < 70) return require('../assets/2CL.png');
    return require('../assets/3CL.png');
  };

  const fetchServers = async () => {
    try {
      const data = await VpnService.getServers();

      const formattedData = (data || []).map(server => ({
        key: server.server_id,
        city: server.location || server.hostname,
        country: server.country || 'Global',
        country_code: server.country_code,
        flag: flagMap[server.country_code] || require('../assets/DE.png'),
        icon: loadIcon(server.current_load),
        arrowIcon: require('../assets/down.png'),
        hostname: server.hostname,
        ip_address: server.ip_address, // added IP
        server_id: server.server_id,
        is_premium: server.is_premium,
        latency: server.latency_ms || 0,
        protocols: server.protocol ? [server.protocol] : [],
      }));

      setServers(formattedData);
      setFilteredServers(formattedData);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text) {
      setFilteredServers(servers);
      return;
    }
    const filtered = servers.filter(s => 
      s.city.toLowerCase().includes(text.toLowerCase()) || 
      s.country.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredServers(filtered);
  };

  const handleSelectServer = (server) => {
    navigation.navigate('MainScreen', { selectedServer: server });
  };

  React.useEffect(() => {
    fetchServers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServers();
  };

  const renderItem = ({item}) => (
    <Pressable onPress={() => handleSelectServer(item)}>
      <View style={{height: 15}} />
      <View style={styles.itemContainer}>
        <View style={styles.leftSection}>
          <Image source={item.flag} style={styles.flagIcon} />
          <View style={{ marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.cityName}>{item.city}</Text>
              <Text style={styles.ipText}>{item.ip_address}</Text>
              {item.is_premium && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumTextSmall}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.countryName}>{item.country}</Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <View style={{ alignItems: 'flex-end', marginRight: 15 }}>
            <Text style={styles.latencyText}>{item.latency}ms</Text>
            <Text style={styles.protocolText}>{item.protocols.join(', ')}</Text>
          </View>
          <Image source={item.icon} style={styles.loadIcon} />
        </View>
      </View>
      <View style={{height: 15}} />
      <View style={styles.divider} />
    </Pressable>
  );

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Image source={require('../assets/Left.png')} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>Server list</Text>
        <View style={{width: 40}} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search location"
          placeholderTextColor="#A1A1AC"
          value={searchQuery}
          onChangeText={handleSearch}
        />
        <Icon name="search" size={18} color="#A1A1AC" />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6B8F04" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={filteredServers}
          renderItem={renderItem}
          keyExtractor={item => item.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B8F04" />}
          contentContainerStyle={{paddingHorizontal: '5%', paddingBottom: 150}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#00091F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '90%', alignSelf: 'center', height: 80 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 24, height: 24 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '300' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', height: 50, alignSelf: 'center', width: '90%', backgroundColor: '#171B2E', borderRadius: 15, paddingHorizontal: 15, marginTop: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  itemContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftSection: { flexDirection: 'row', alignItems: 'center' },
  flagIcon: { width: 28, height: 20, borderRadius: 2 },
  cityName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  countryName: { color: '#A1A1AC', fontSize: 12 },
  rightSection: { flexDirection: 'row', alignItems: 'center' },
  latencyText: { color: '#6B8F04', fontSize: 12, fontWeight: 'bold' },
  protocolText: { color: '#A1A1AC', fontSize: 10 },
  loadIcon: { width: 20, height: 20 },
  divider: { height: 1, backgroundColor: '#171B2E' },
  premiumBadge: { backgroundColor: '#6B8F04', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 10 },
  premiumTextSmall: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  ipText: { color: '#A1A1AC', fontSize: 11, marginLeft: 8 }
});
