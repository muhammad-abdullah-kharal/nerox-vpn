import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  Alert,
  ActivityIndicator
} from 'react-native';
import {TextInput} from 'react-native-paper';
import api from '../services/api';

export default function ForgetPassword({navigation}) {
  const [Email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email) => {
    return /^\S+@\S+\.\S+$/.test(email);
  };

  const handleSendOtp = async () => {
    if (!Email) {
      setError('Email address is required');
      return;
    }
    if (!validateEmail(Email)) {
      setError('Please enter a valid email');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/send-otp', {
        email: Email.toLowerCase().trim()
      });

      if (!res.success) {
        setLoading(false);
        Alert.alert('Error', res.error || 'Failed to send OTP');
        return;
      }

      setLoading(false);
      Alert.alert(
        'OTP Sent',
        'If an account exists for this email, you will receive an OTP code shortly.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('OtpVerification', { email: Email.toLowerCase(), nextScreen: 'ResetPassword' })
          }
        ]
      );
    } catch (err) {
      setLoading(false);
      console.error('Reset Password Error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{flexGrow: 1}}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#00091F',
        }}>
        <View
          style={{
            width: 327,
            alignSelf: 'center',
            paddingTop: 20,
          }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              alignItems: 'center',
              width: '100%',
              height: 40,
            }}>
            <Pressable
              onPress={() => {
                navigation.goBack();
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: 'rgba(58, 58, 77, 0.3)',
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
          </View>
          <View style={{height: 20}} />
          <Text
            style={{
              fontSize: 32,
              fontWeight: '400',
              color: '#fff',
            }}>
          Forgot Password
          </Text>
          <View style={{height: 5}} />

          <Text
            style={{
              fontSize: 14,
              fontWeight: '100',
              color: '#A1A1AC',
            }}>
        Enter your email and we will send OTP code to recovery the password
          </Text>

          <View style={{height: 60}} />
         
          <TextInput
            label="Email Address"
            value={Email}
            onChangeText={text => {
              setEmail(text);
              setError('');
            }}
            mode="flat"
            style={{
              backgroundColor: 'rgba(58, 58, 77, 0.3)',
              borderRadius: 10,
              borderTopRightRadius: 10,
              borderTopLeftRadius: 10,
            }}
            underlineColor="transparent"
            activeUnderlineColor="#5B7905"
            textColor="#fff"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {error ? <Text style={{color: '#FF4C4C', fontSize: 12, marginTop: 5}}>{error}</Text> : null}
        
          <View style={{height: 60}} />
          <Pressable
            style={{
              width: 327,
            }}
            disabled={loading}
            onPress={handleSendOtp}>
            <ImageBackground
              source={require('../assets/btn.png')}
              style={{
                width: '100%',
                height: 64,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              imageStyle={{borderRadius: 15}}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    color: '#fff',
                    fontWeight: '600',
                  }}>
                Send OTP
                </Text>
              )}
            </ImageBackground>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
