import React, {useEffect, useState} from 'react';
import {View, Image, StyleSheet, Text, ImageBackground, ActivityIndicator} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import Onboarding from './screen/Onboarding';
import Login from './screen/Login';
import CreateAccount from './screen/CreateAccount';
import ForgetPassword from './screen/ForgetPassword';
import OtpVerification from './screen/OtpVerification';
import ResetPassword from './screen/ResetPassword';
import MainScreen from './screen/MainScreen';
import Account from './screen/Account';
import SplitTunneling from './screen/SplitTunneling';
import Protocol from './screen/Protocol';
import Setting from './screen/Setting';
import Faq from './screen/Faq';
import Subscription from './screen/Subscription';
import ReferralScreen from './screen/ReferralScreen';
import Term from './screen/Term';
import PrivacyPolicy from './screen/PrivacyPolicy';
import About from './screen/About';
import FaqDetail from './screen/FaqDetail';
import Feedback from './screen/Feedback';
import FeedbackDetail from './screen/Feedbackdetail';
import FeedbackHistory from './screen/FeedbackHistory';
import ViewFeedback from './screen/ViewFeedback';
import ConnectionReport from './screen/ConnectionReport';
import Serverlist from './screen/Serverlist';
import Location from './screen/Location';

const Stack = createNativeStackNavigator();

// Splash screen - checks JWT token then redirects
const SplashScreenComponent = ({navigation}) => {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        setTimeout(() => {
          if (token) {
            navigation.replace('MainScreen');
          } else {
            navigation.replace('Onboarding');
          }
        }, 2000);
      } catch (err) {
        navigation.replace('Onboarding');
      }
    };
    checkAuth();
  }, [navigation]);

  return (
    <ImageBackground
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        resizeMode: 'cover',
      }}
      source={require('./assets/Splash.png')}>
      <Image source={require('./assets/Logo.png')} style={styles.splashImage} />
      <Image source={require('./assets/LGText.png')} style={styles.LGText} />
      <Text
        style={{
          fontWeight: '200',
          fontSize: 14,
          color: '#A1A1AC',
          marginTop: 4,
        }}>
        Best VPN App
      </Text>
    </ImageBackground>
  );
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        setIsLoggedIn(!!token);
      } catch (err) {
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    checkToken();
  }, []);

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: '#00081C', justifyContent: 'center'}}>
        <ActivityIndicator size="large" color="#6B8F04" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{flex: 1}}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Splash always first */}
          <Stack.Screen name="SplashScreen" component={SplashScreenComponent} />

          {/* Auth Screens */}
          <Stack.Screen name="Onboarding" component={Onboarding} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="CreateAccount" component={CreateAccount} />
          <Stack.Screen name="ForgetPassword" component={ForgetPassword} />
          <Stack.Screen name="OtpVerification" component={OtpVerification} />
          <Stack.Screen name="ResetPassword" component={ResetPassword} />

          {/* App Screens */}
          <Stack.Screen name="MainScreen" component={MainScreen} />
          <Stack.Screen name="Account" component={Account} />
          <Stack.Screen name="SplitTunneling" component={SplitTunneling} />
          <Stack.Screen name="Protocol" component={Protocol} />
          <Stack.Screen name="Setting" component={Setting} />
          <Stack.Screen name="Faq" component={Faq} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="Subscription" component={Subscription} />
          <Stack.Screen name="Term" component={Term} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
          <Stack.Screen name="About" component={About} />
          <Stack.Screen name="FaqDetail" component={FaqDetail} />
          <Stack.Screen name="Feedback" component={Feedback} />
          <Stack.Screen name="FeedbackDetail" component={FeedbackDetail} />
          <Stack.Screen name="FeedbackHistory" component={FeedbackHistory} />
          <Stack.Screen name="ViewFeedback" component={ViewFeedback} />
          <Stack.Screen name="ConnectionReport" component={ConnectionReport} />
          <Stack.Screen name="Serverlist" component={Serverlist} />
          <Stack.Screen name="Location" component={Location} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashImage: {
    width: 302,
    alignSelf: 'center',
    height: 216,
  },
  LGText: {
    width: 120,
    alignSelf: 'center',
    height: 39,
    marginTop: 6,
  },
});

export default App;
