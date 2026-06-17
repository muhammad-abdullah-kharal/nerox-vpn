import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Share as RNShare,
  Alert,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../supabase';

export default function Share({navigation}) {
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReferralCode() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('users')
            .select('referral_code')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (error) throw error;
          setReferralCode(data?.referral_code || 'NEROX-XXXX');
        }
      } catch (err) {
        console.error('Error fetching referral code:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReferralCode();
  }, []);

  const onShare = async (platform) => {
    if (loading || !referralCode) return;

    try {
      const result = await RNShare.share({
        message:
          `Join me on Nerox VPN and get extra premium days! Use my referral code: ${referralCode}\n\nDownload now: https://neroxvpn.app`,
        title: 'Share Nerox VPN',
      });
      if (result.action === RNShare.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === RNShare.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      Alert.alert('Sharing Failed', error.message);
    }
  };

  return (
    <ScrollView>
      <View
        style={{
          flexGrow: 1,
          height: Dimensions.get('window').height,
          backgroundColor: '#00091F',
        }}>
        <View
          style={{
            width: '100%',
            alignSelf: 'center',
          }}>
          <View style={{height: 20}} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '90%',
              alignSelf: 'center',
              height: 40,
            }}>
            <Pressable
              onPress={() => {
                navigation.goBack();
              }}>
              <View
                style={{
                  alignItems: 'center',
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: '#00091F',
                }}>
                <Image
                  source={require('../assets/Left.png')}
                  style={{
                    width: 24,
                    height: 24,
                  }}
                />
              </View>
            </Pressable>

            <Text
              style={{
                fontSize: 20,
                fontWeight: '300',
                color: '#fff',
              }}>
              Share
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{height: 20}} />

          <Image
            source={require('../assets/Share.png')}
            style={{
              width: 64,
              alignSelf: 'center',
              height: 64,
            }}
          />
          <View style={{height: 10}} />

          <Text
            style={{
              fontSize: 18,
              fontWeight: '400',
              color: '#fff',
              textAlign: 'center',
              paddingHorizontal: '10%',
            }}>
            Refer to your friends & Get extra days of Subscription
          </Text>

          <View
            style={{
              flexDirection: 'row',
              width: '90%',
              alignSelf: 'center',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <Pressable onPress={() => onShare('whatsapp')}>
              <View
                style={styles.shareCard}>
                <Image
                  source={require('../assets/whatsapp.png')}
                  style={styles.shareIcon}
                />
                <View style={{height: 5}} />
                <Text style={styles.shareText}>Whatsapp</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => onShare('instagram')}>
              <View style={styles.shareCard}>
                <Image
                  source={require('../assets/instagram.png')}
                  style={styles.shareIcon}
                />
                <View style={{height: 5}} />
                <Text style={styles.shareText}>Instagram</Text>
              </View>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              width: '90%',
              alignSelf: 'center',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <Pressable onPress={() => onShare('facebook')}>
              <View style={styles.shareCard}>
                <Image
                  source={require('../assets/facebook1.png')}
                  style={styles.shareIcon}
                />
                <View style={{height: 5}} />
                <Text style={styles.shareText}>Facebook</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => onShare('telegram')}>
              <View style={styles.shareCard}>
                <Image
                  source={require('../assets/telegram.png')}
                  style={styles.shareIcon}
                />
                <View style={{height: 5}} />
                <Text style={styles.shareText}>Telegram</Text>
              </View>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              width: '90%',
              alignSelf: 'center',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <Pressable onPress={() => onShare('slack')}>
              <View style={styles.shareCard}>
                <Image
                  source={require('../assets/slack.png')}
                  style={styles.shareIcon}
                />
                <View style={{height: 5}} />
                <Text style={styles.shareText}>Slack</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => onShare('twitter')}>
              <View style={styles.shareCard}>
                <Image
                  source={require('../assets/twitter.png')}
                  style={styles.shareIcon}
                />
                <View style={{height: 5}} />
                <Text style={styles.shareText}>Twitter</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shareCard: {
    height: 152,
    marginVertical: 10,
    width: 152,
    borderRadius: 16,
    backgroundColor: '#171B2E',
    borderWidth: 1,
    borderColor: '#4A4A61',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    width: 48,
    height: 48,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#fff',
    textAlign: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: '#171B2E',
    borderRadius: 8,
    paddingLeft: 16,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
  },
  tabBarContainer: {
    flexDirection: 'row',
    marginTop: 20,
    height: 56,
    marginLeft: 20,
  },
  tab: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
    borderWidth: 1,
    borderRadius: 12,
  },
  tabText: {
    color: '#FFFFFF',
  },
});

