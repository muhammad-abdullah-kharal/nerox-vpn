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
import api from '../services/api';
import SocialSignInButtons from '../components/SocialSignInButtons';
import {signInWithApple, signInWithGoogle} from '../services/socialAuth';

export default function Login({navigation}) {
  const [Email, setEmail] = React.useState('');
  const [Password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [socialLoading, setSocialLoading] = React.useState(null);

  const validateEmail = email => {
    return /^\S+@\S+\.\S+$/.test(email);
  };

  const handleSignIn = async () => {
    const newErrors = {};
    if (!Email) {
      newErrors.email = 'Email Address is required';
    } else if (!validateEmail(Email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!Password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const cleanEmail = Email.toLowerCase().trim();
      const res = await api.post('/auth/login', {
        email: cleanEmail,
        password: Password,
      });

      if (res.success) {
        if (res.requireVerification) {
          Alert.alert(
            'Verification Required',
            'A verification code has been sent to your email. Please enter it to sign in.',
            [
              {
                text: 'OK',
                onPress: () =>
                  navigation.navigate('OtpVerification', {email: cleanEmail}),
              },
            ],
          );
        } else if (res.token) {
          // Normal successful login
          await api.setAuthToken(res.token);
          navigation.replace('MainScreen');
        }
      }
    } catch (err) {
      console.error('[Auth] Sign in failed', {
        message: err?.message,
        stack: err?.stack,
      });
      setLoading(false);
      Alert.alert(
        'Sign In Failed',
        err.message || 'Invalid email or password.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async provider => {
    setSocialLoading(provider);
    try {
      const res =
        provider === 'google'
          ? await signInWithGoogle()
          : await signInWithApple();

      if (res?.cancelled) {
        return;
      }

      if (res?.success && res.token) {
        await api.setAuthToken(res.token);
        navigation.replace('MainScreen');
      }
    } catch (err) {
      Alert.alert(
        'Sign In Failed',
        err.message || `Could not sign in with ${provider}.`,
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
            Sign in to your account and stay protected
          </Text>

          <View style={styles.inputContainer}>
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
              keyboardType="email-address"
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
              onChangeText={text => {
                setPassword(text);
                setErrors({...errors, password: null});
              }}
              mode="outlined"
              secureTextEntry={!showPassword}
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
          </View>

          <View style={styles.buttonSection}>
            <Pressable
              onPress={handleSignIn}
              disabled={loading}
              style={styles.signInButtonContainer}>
              <ImageBackground
                source={require('../assets/btn.png')}
                style={styles.signInButton}
                imageStyle={{borderRadius: 15}}>
                <Text style={styles.signInTextBtn}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Text>
              </ImageBackground>
            </Pressable>

            <SocialSignInButtons
              loadingProvider={socialLoading}
              onPressGoogle={() => handleSocialSignIn('google')}
              onPressApple={() => handleSocialSignIn('apple')}
            />

            <Pressable
              onPress={() => navigation.navigate('ForgetPassword')}
              style={styles.forgotPasswordBtn}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an Account? </Text>
            <Pressable onPress={() => navigation.navigate('CreateAccount')}>
              <Text style={styles.signUpText}>Sign Up</Text>
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
  signInButtonContainer: {
    width: '100%',
    shadowColor: '#6B8F04',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  signInButton: {
    width: '100%',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInTextBtn: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPasswordBtn: {
    alignSelf: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: '#6B8F04',
    fontSize: 14,
    fontWeight: '500',
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
  signUpText: {
    color: '#6B8F04',
    fontSize: 14,
    fontWeight: '600',
  },
});
