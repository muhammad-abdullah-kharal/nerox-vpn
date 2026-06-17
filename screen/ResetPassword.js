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
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import {TextInput} from 'react-native-paper';
import Entypo from 'react-native-vector-icons/Entypo';
import api from '../services/api';

export default function ResetPassword({navigation, route}) {
  const { email } = route.params || {};

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleResetPassword = async () => {
    const newErrors = {};
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        password: password
      });

      if (!res.success) {
        setLoading(false);
        Alert.alert('Error', res.error || 'Failed to reset password');
        return;
      }

      setLoading(false);
      // Clear token to force the user to login with the new password
      await api.logout();
      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    } catch (err) {
      setLoading(false);
      console.error('Reset Password Error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={styles.closeButton}>
            <Image
              source={require('../assets/Cross.png')}
              style={styles.closeIcon}
            />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>Create a strong password to secure your account</Text>

          <View style={styles.inputContainer}>
            <TextInput
              label="New Password"
              value={password}
              secureTextEntry={!showPassword}
              onChangeText={(text) => {setPassword(text); setErrors({...errors, password: null});}}
              mode="flat"
              style={[styles.input, errors.password && styles.inputError]}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              textColor="#fff"
              theme={{ roundness: 15 }}
              right={
                <TextInput.Icon
                  icon={() => <Entypo name={showPassword ? 'eye-with-line' : 'eye'} size={20} color="#A1A1AC" />}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            
            <View style={{height: 15}} />
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              secureTextEntry={!showConfirmPassword}
              onChangeText={(text) => {setConfirmPassword(text); setErrors({...errors, confirmPassword: null});}}
              mode="flat"
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              textColor="#fff"
              theme={{ roundness: 15 }}
              right={
                <TextInput.Icon
                  icon={() => <Entypo name={showConfirmPassword ? 'eye-with-line' : 'eye'} size={20} color="#A1A1AC" />}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          <View style={styles.buttonSection}>
            <Pressable
              onPress={handleResetPassword}
              disabled={loading}
              style={styles.buttonContainer}>
              <ImageBackground
                source={require('../assets/btn.png')}
                style={styles.button}
                imageStyle={{borderRadius: 15}}>
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </ImageBackground>
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
    backgroundColor: 'rgba(25, 30, 48, 0.8)',
    height: 56,
    borderRadius: 15,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF4C4C',
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
  buttonContainer: {
    width: '100%',
    shadowColor: '#6B8F04',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  button: {
    width: '100%',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
