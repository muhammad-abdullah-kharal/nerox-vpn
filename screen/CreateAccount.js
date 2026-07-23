import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  SafeAreaView,
  Alert,
} from 'react-native';
import {TextInput} from 'react-native-paper';
import Entypo from 'react-native-vector-icons/Entypo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import SocialSignInButtons from '../components/SocialSignInButtons';
import {signInWithApple, signInWithGoogle} from '../services/socialAuth';

export default function CreateAccount({navigation}) {
  const [Email, setEmail] = React.useState('');
  const [FullName, setFullName] = React.useState('');
  const [Password, setPassword] = React.useState('');
  const [ConfirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [socialLoading, setSocialLoading] = React.useState(null);
  const [ReferralCode, setReferralCode] = React.useState('');

  const validateEmail = email => {
    return /^\S+@\S+\.\S+$/.test(email);
  };

  const handleSignUp = async () => {
    const newErrors = {};
    if (!FullName) newErrors.fullName = 'Full Name is required';
    if (!Email) {
      newErrors.email = 'Email Address is required';
    } else if (!validateEmail(Email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!Password) {
      newErrors.password = 'Password is required';
    } else if (Password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (Password !== ConfirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const cleanEmail = Email.toLowerCase().trim();

      const res = await api.post('/auth/register', {
        email: cleanEmail,
        password: Password,
        username: FullName.trim(),
        referralCode: ReferralCode.trim() || null,
      });

      if (res.success) {
        if (res.requireVerification) {
          Alert.alert(
            'Verification Required',
            'We have sent a verification code to your email. Please enter it to continue.',
            [
              {
                text: 'OK',
                onPress: () =>
                  navigation.navigate('OtpVerification', {email: cleanEmail}),
              },
            ],
          );
        } else if (res.token) {
          await AsyncStorage.setItem('auth_token', res.token);
          Alert.alert(
            'Success',
            'Account created successfully! You are now on the Free Plan.',
            [{text: 'OK', onPress: () => navigation.replace('MainScreen')}],
          );
        }
      }
    } catch (err) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[Auth] Sign up failed', {
          message: err?.message,
          stack: err?.stack,
        });
      }
      setLoading(false);
      Alert.alert(
        'Sign Up Failed',
        err.message || 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async provider => {
    console.log(`[Create Account Screen] User initiated ${provider} sign-in`);
    setSocialLoading(provider);
    try {
      console.log(`[Create Account Screen] Calling ${provider} authentication function`);
      const res =
        provider === 'google'
          ? await signInWithGoogle()
          : await signInWithApple();

      console.log(`[Create Account Screen] ${provider} authentication response:`, {
        provider,
        cancelled: res?.cancelled,
        success: res?.success,
        hasToken: !!res?.token,
        isNewUser: res?.isNewUser,
      });

      if (res?.cancelled) {
        console.log(`[Create Account Screen] ${provider} sign-in was cancelled by user`);
        return;
      }

      if (res?.success && res.token) {
        console.log(`[Create Account Screen] ${provider} sign-in successful, setting token and navigating`);
        await api.setAuthToken(res.token);
        navigation.replace('MainScreen');
      } else {
        console.warn(`[Create Account Screen] ${provider} response missing success or token:`, res);
      }
    } catch (err) {
      console.error(`[Create Account Screen] ${provider} sign-in error:`, {
        message: err.message,
        stack: err.stack,
      });
      Alert.alert(
        'Sign Up Failed',
        err.message || `Could not continue with ${provider}.`,
      );
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate('Onboarding')}
            style={styles.closeButton}>
            <Image
              source={require('../assets/Cross.png')}
              style={styles.closeIcon}
            />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Nerox</Text>
          <Text style={styles.subtitle}>
            Create account and enjoy 7 day free trial
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              label="Full Name"
              value={FullName}
              onChangeText={text => {
                setFullName(text);
                setErrors({...errors, fullName: null});
              }}
              mode="outlined"
              style={styles.input}
              outlineColor="#171B2E"
              activeOutlineColor="#6B8F04"
              selectionColor="#6B8F04"
              cursorColor="#6B8F04"
              textColor="#fff"
              placeholderTextColor="#A1A1AC"
              theme={{
                roundness: 15,
                colors: {primary: '#6B8F04', onSurfaceVariant: '#A1A1AC'},
              }}
            />
            {errors.fullName && (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            )}

            <View style={{height: 15}} />
            <TextInput
              label="Email Address"
              value={Email}
              onChangeText={text => {
                setEmail(text);
                setErrors({...errors, email: null});
              }}
              mode="outlined"
              style={styles.input}
              outlineColor="#171B2E"
              activeOutlineColor="#6B8F04"
              selectionColor="#6B8F04"
              cursorColor="#6B8F04"
              textColor="#fff"
              autoCapitalize="none"
              theme={{
                roundness: 15,
                colors: {primary: '#6B8F04', onSurfaceVariant: '#A1A1AC'},
              }}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}

            <View style={{height: 15}} />
            <TextInput
              label="Password"
              value={Password}
              secureTextEntry={!showPassword}
              onChangeText={text => {
                setPassword(text);
                setErrors({...errors, password: null});
              }}
              mode="outlined"
              style={styles.input}
              outlineColor="#171B2E"
              activeOutlineColor="#6B8F04"
              selectionColor="#6B8F04"
              cursorColor="#6B8F04"
              textColor="#fff"
              theme={{
                roundness: 15,
                colors: {primary: '#6B8F04', onSurfaceVariant: '#A1A1AC'},
              }}
              right={
                <TextInput.Icon
                  icon={() => (
                    <Entypo
                      name={showPassword ? 'eye-with-line' : 'eye'}
                      size={20}
                      color="#A1A1AC"
                    />
                  )}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            <View style={{height: 15}} />
            <TextInput
              label="Confirm Password"
              value={ConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              onChangeText={text => {
                setConfirmPassword(text);
                setErrors({...errors, confirmPassword: null});
              }}
              mode="outlined"
              style={styles.input}
              outlineColor="#171B2E"
              activeOutlineColor="#6B8F04"
              selectionColor="#6B8F04"
              cursorColor="#6B8F04"
              textColor="#fff"
              theme={{
                roundness: 15,
                colors: {primary: '#6B8F04', onSurfaceVariant: '#A1A1AC'},
              }}
              right={
                <TextInput.Icon
                  icon={() => (
                    <Entypo
                      name={showConfirmPassword ? 'eye-with-line' : 'eye'}
                      size={20}
                      color="#A1A1AC"
                    />
                  )}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}

            <View style={{height: 15}} />
            <TextInput
              label="Referral Code (Optional)"
              value={ReferralCode}
              onChangeText={setReferralCode}
              mode="outlined"
              style={styles.input}
              outlineColor="#171B2E"
              activeOutlineColor="#6B8F04"
              selectionColor="#6B8F04"
              cursorColor="#6B8F04"
              textColor="#fff"
              autoCapitalize="characters"
              theme={{
                roundness: 15,
                colors: {primary: '#6B8F04', onSurfaceVariant: '#A1A1AC'},
              }}
            />
          </View>

          <View style={styles.buttonSection}>
            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              style={styles.signUpButtonContainer}>
              <ImageBackground
                source={require('../assets/btn.png')}
                style={styles.signUpButton}
                imageStyle={{borderRadius: 15}}>
                <Text style={styles.signUpTextBtn}>
                  {loading ? 'Processing...' : 'Sign Up'}
                </Text>
              </ImageBackground>
            </Pressable>

            <SocialSignInButtons
              loadingProvider={socialLoading}
              onPressGoogle={() => handleSocialSignIn('google')}
              onPressApple={() => handleSocialSignIn('apple')}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Have an Account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00081C',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    marginBottom: 40,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(58, 58, 77, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 20,
    height: 20,
    tintColor: '#fff',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: 'normal',
    color: '#fff',
    fontFamily: 'Outfit-Regular',
  },
  subtitle: {
    fontSize: 16,
    color: '#A1A1AC',
    marginTop: 8,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#0A1227',
    height: 56,
    borderRadius: 15,
  },
  errorText: {
    color: '#FF4C4C',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 10,
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
  },
  signUpButtonContainer: {
    width: '100%',
    shadowColor: '#6B8F04',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  signUpButton: {
    width: '100%',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpTextBtn: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 40,
  },
  footerText: {
    color: '#A1A1AC',
    fontSize: 14,
  },
  signInText: {
    color: '#6B8F04',
    fontSize: 14,
    fontWeight: '600',
  },
});
