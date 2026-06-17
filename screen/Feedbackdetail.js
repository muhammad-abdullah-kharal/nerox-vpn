import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import {TextInput} from 'react-native-paper';
import UserService from '../services/UserService';
import VpnService from '../services/VpnService';

export default function FeedbackDetail({navigation, route}) {
  const {title, text1} = route.params;
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(title || '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      try {
        const profile = await UserService.getProfile();
        if (profile) {
          setEmail(profile.email);
        }
      } catch (err) {
        console.error('Error fetching user for feedback:', err);
      } finally {
        setInitialLoading(false);
      }
    }
    getUser();
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Incomplete', 'Please describe your issue or suggestion.');
      return;
    }

    try {
      setLoading(true);
      await VpnService.submitFeedback('User Feedback', subject, description);
      
      Alert.alert(
        'Success',
        'Thank you for your feedback! Our team has received your message.',
        [{ text: 'OK', onPress: () => navigation.navigate('Feedback') }]
      );
    } catch (err) {
      Alert.alert('Submission Failed', 'We couldn\'t send your feedback at this time. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#00091F', justifyContent: 'center' }}>
        <ActivityIndicator color="#6B8F04" size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#00091F',
        }}>
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
          }}>
          <View style={{height: 20}} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
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
                  backgroundColor: '#171B2E',
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
              Submit Feedback
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{height: 20}} />

          <TextInput
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            style={styles.textInput}
            underlineColor="transparent"
            selectionColor="#5B7905"
            activeUnderlineColor="#5B7905"
            textColor="#fff"
          />
          <View style={{height: 15}} />

          <TextInput
            label="Contact Email"
            value={email}
            disabled={true}
            style={[styles.textInput, { opacity: 0.7 }]}
            underlineColor="transparent"
            textColor="#fff"
          />
          <View style={{height: 15}} />

          <TextInput
            label="Description"
            placeholder="Tell us what's on your mind..."
            placeholderTextColor="#A1A1AC"
            value={description}
            onChangeText={setDescription}
            style={[styles.textInput, { height: 160 }]}
            underlineColor="transparent"
            selectionColor="#5B7905"
            activeUnderlineColor="#5B7905"
            textColor="#fff"
            multiline={true}
            numberOfLines={5}
          />
        </View>
        
        <View
          style={{
            alignSelf: 'center',
            paddingBottom: 20,
            width: '90%',
            marginTop: 'auto'
          }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '200',
              color: '#A1A1AC',
              textAlign: 'center',
              marginBottom: 15,
            }}>
            Your privacy is our top priority. This report does
            not contain any personally identifiable information beyond your contact email.
          </Text>

          <Pressable
            style={{ width: '100%' }}
            onPress={handleSubmit}
            disabled={loading}
          >
            <ImageBackground
              source={require('../assets/Button.png')}
              style={{
                width: '100%',
                height: 56,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    color: '#fff',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}>
                  Submit Feedback
                </Text>
              )}
            </ImageBackground>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  textInput: {
    backgroundColor: 'rgba(58, 58, 77, 0.3)',
    borderRadius: 12,
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
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
    height: 40,
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

