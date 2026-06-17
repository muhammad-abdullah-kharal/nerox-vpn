import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import api from '../services/api';

export default function OtpVerification({navigation, route}) {
  const { email } = route.params || {};
  const [otpFields, setOtpFields] = useState(
    Array.from({length: 6}, (_, index) => ({
      id: index,
      value: '',
    })),
  );

  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [expiryCountdown, setExpiryCountdown] = useState(300); // 5 minutes global expiry
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer;
    if (countdown > 0 && resendDisabled) {
      timer = setInterval(() => {
        setCountdown(prevCount => prevCount - 1);
      }, 1000);
    } else {
      setResendDisabled(false);
    }
    return () => clearInterval(timer);
  }, [countdown, resendDisabled]);

  useEffect(() => {
    let timer;
    if (expiryCountdown > 0) {
      timer = setInterval(() => {
        setExpiryCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [expiryCountdown]);

  const inputRefs = Array.from({length: 6}, () => useRef());

  const handleOTPChange = (text, fieldId) => {
    const updatedFields = [...otpFields];
    updatedFields[fieldId].value = text;
    setOtpFields(updatedFields);
  
    if (text.length === 1 && fieldId < 5 && inputRefs[fieldId + 1]?.current) {
      inputRefs[fieldId + 1].current.focus();
    }
  };

  const handleResendClick = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const data = await api.post('/auth/send-otp', { email: email.toLowerCase() });
      
      if (!data?.success) throw new Error(data?.error || 'Failed to resend OTP');

      setResendDisabled(true);
      setCountdown(30);
      setExpiryCountdown(300);
      Alert.alert('Success', 'New OTP code sent to your email.');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpFields.map(f => f.value).join('');
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code.');
      return;
    }

    if (expiryCountdown <= 0) {
      Alert.alert('OTP Expired', 'The verification code has expired. Please request a new one.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/auth/verify-otp', {
        email: email,
        code: code
      });

      if (!data?.success || !data?.token) {
        Alert.alert('Verification Failed', data?.error || 'Invalid code');
        setLoading(false);
        return;
      }

      // Store JWT token
      await api.setAuthToken(data.token);

      setLoading(false);
      const { nextScreen } = route.params || {};
      if (nextScreen) {
        navigation.replace(nextScreen, { email: email });
      } else {
        navigation.replace('MainScreen');
      }
      
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
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
              onPress={() => navigation.goBack()}>
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
            Verification
          </Text>
          <View style={{height: 5}} />

          <Text
            style={{
              fontSize: 14,
              fontWeight: '100',
              color: '#A1A1AC',
            }}>
            We have sent the OTP code to the email
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '400',
              color: '#FFFFFF',
              marginTop: 4,
            }}>
            {email || 'your email'}
          </Text>
          <View style={{height: 60}} />

          <View style={styles.otpContainer}>
            {otpFields.map((field, index) => (
              <TextInput
                key={field.id}
                style={styles.otpInput}
                onChangeText={text => handleOTPChange(text, index)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && field.value === '' && index > 0) {
                    inputRefs[index - 1].current.focus();
                  }
                }}
                value={field.value}
                maxLength={1}
                keyboardType="numeric"
                ref={inputRefs[index]}
                placeholder="-"
                placeholderTextColor="rgba(255, 255, 255, 0.2)"
              />
            ))}
          </View>

          <View style={{height: 40}} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#A1A1AC',
              textAlign: 'center',
            }}>
            {resendDisabled
              ? `Resend Code in 00:${
                  countdown < 10 ? `0${countdown}` : countdown
                }`
              : 'Didn’t receive code?'}
          </Text>
          <TouchableOpacity
            style={{marginTop: 20}}
            onPress={handleResendClick}
            disabled={resendDisabled || loading}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: resendDisabled ? '#A1A1AC' : '#6B8F04',
                textAlign: 'center',
              }}>
              Resend OTP
            </Text>
          </TouchableOpacity>
          <View style={{height: 15}} />

          <View style={{height: 60}} />
          <Pressable
            style={{
              width: 327,
            }}
            onPress={handleVerifyOtp}
            disabled={loading}>
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
                  Verify OTP
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  otpInput: {
    width: 48,
    height: 60,
    color: '#fff',
    backgroundColor: 'rgba(25, 30, 48, 0.8)',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 143, 4, 0.2)',
  },
});
