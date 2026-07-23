import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import appleAuth, {
  appleAuthAndroid,
} from '@invertase/react-native-apple-authentication';
import api from './api';
import {
  APPLE_ANDROID_CLIENT_ID,
  APPLE_ANDROID_REDIRECT_URI,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from './socialAuthConfig';

let googleConfigured = false;

const configureGoogle = () => {
  if (googleConfigured) {
    return;
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? {iosClientId: GOOGLE_IOS_CLIENT_ID} : {}),
    offlineAccess: false,
    profileImageSize: 160,
  });
  googleConfigured = true;
};

const getDeviceInfo = async () => ({
  deviceId: await DeviceInfo.getUniqueId(),
  model: DeviceInfo.getModel(),
  os: `${Platform.OS} ${Platform.Version}`,
});

const getGoogleData = response => {
  if (isCancelledResponse(response)) {
    return null;
  }

  if (isSuccessResponse(response)) {
    return response.data;
  }

  return response?.data || response;
};

const getGoogleErrorMessage = error => {
  if (!isErrorWithCode(error)) {
    return error?.message || 'Google sign in failed. Please try again.';
  }

  switch (error.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return null;
    case statusCodes.IN_PROGRESS:
      return 'Google sign in is already in progress.';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services is not available or needs an update.';
    default:
      return error?.message || 'Google sign in failed. Please try again.';
  }
};

const randomString = (length = 32) => {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  const values = new Uint8Array(length);

  if (global.crypto?.getRandomValues) {
    global.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i += 1) {
      values[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(values, value => chars[value % chars.length]).join('');
};

const getAppleDisplayName = fullName => {
  if (!fullName) {
    return '';
  }

  return [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const postSocialToken = async payload => {
  const deviceInfo = await getDeviceInfo();
  const fullPayload = {
    ...payload,
    deviceInfo,
  };

  console.log('[Social Auth] Sending request to backend:', {
    provider: payload.provider,
    timestamp: new Date().toISOString(),
    hasIdToken: !!fullPayload.idToken,
    hasIdentityToken: !!fullPayload.identityToken,
    userEmail: payload.user?.email,
    deviceInfo: deviceInfo,
  });

  try {
    const response = await api.post('/auth/social', fullPayload);
    console.log('[Social Auth] Backend response received:', {
      provider: payload.provider,
      timestamp: new Date().toISOString(),
      success: response.success,
      isNewUser: response.isNewUser,
      hasToken: !!response.token,
    });
    return response;
  } catch (error) {
    console.error('[Social Auth] Backend request failed:', {
      provider: payload.provider,
      timestamp: new Date().toISOString(),
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.status,
      fullError: error,
    });
    throw error;
  }
};

export const signInWithGoogle = async () => {
  configureGoogle();

  try {
    console.log('[Google Auth] Starting Google sign-in process');
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    console.log('[Google Auth] Google Play Services check passed');
    
    const response = await GoogleSignin.signIn();
    console.log('[Google Auth] Google sign-in response received');
    const googleData = getGoogleData(response);

    if (!googleData) {
      console.log('[Google Auth] User cancelled Google sign-in');
      return {cancelled: true};
    }

    let idToken = googleData.idToken;
    if (!idToken) {
      console.log('[Google Auth] No idToken in initial response, fetching tokens');
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }

    if (!idToken) {
      console.error('[Google Auth] Failed to obtain identity token');
      throw new Error('Google did not return an identity token.');
    }

    console.log('[Google Auth] Identity token obtained, posting to social endpoint');
    return postSocialToken({
      provider: 'google',
      idToken,
      user: {
        email: googleData.user?.email,
        name: googleData.user?.name,
        photo: googleData.user?.photo,
      },
    });
  } catch (error) {
    console.error('[Google Auth] Error during Google sign-in:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    const message = getGoogleErrorMessage(error);
    if (!message) {
      console.log('[Google Auth] Error treated as user cancellation');
      return {cancelled: true};
    }
    throw new Error(message);
  }
};

export const signInWithApple = async () => {
  const nonce = randomString();

  try {
    console.log('[Apple Auth] Starting Apple sign-in process on', Platform.OS);

    if (Platform.OS === 'ios') {
      if (!appleAuth.isSupported) {
        console.error('[Apple Auth] Apple Sign In is not supported on this device');
        throw new Error('Apple Sign In is not supported on this device.');
      }

      console.log('[Apple Auth] Performing Apple authentication request');
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        nonce,
      });

      if (!response.identityToken) {
        console.error('[Apple Auth] Apple did not return an identity token');
        throw new Error('Apple did not return an identity token.');
      }

      console.log('[Apple Auth] Getting credential state for user');
      const credentialState = await appleAuth.getCredentialStateForUser(
        response.user,
      );

      if (credentialState !== appleAuth.State.AUTHORIZED) {
        console.error('[Apple Auth] Credential state is not authorized:', credentialState);
        throw new Error('Apple sign in was not authorized.');
      }

      console.log('[Apple Auth] Identity token obtained, posting to social endpoint');
      return postSocialToken({
        provider: 'apple',
        identityToken: response.identityToken,
        nonce,
        user: {
          email: response.email,
          name: getAppleDisplayName(response.fullName),
        },
      });
    }

    if (!appleAuthAndroid.isSupported) {
      console.error('[Apple Auth] Apple Sign In is not supported on Android device');
      throw new Error('Apple Sign In is not supported on this device.');
    }

    if (!APPLE_ANDROID_CLIENT_ID || !APPLE_ANDROID_REDIRECT_URI) {
      console.error('[Apple Auth] Apple Android credentials not configured');
      throw new Error(
        'Apple Sign In for Android needs APPLE_ANDROID_CLIENT_ID and APPLE_ANDROID_REDIRECT_URI in services/socialAuthConfig.js.',
      );
    }

    const state = randomString();
    console.log('[Apple Auth] Configuring Apple Android authentication');
    appleAuthAndroid.configure({
      clientId: APPLE_ANDROID_CLIENT_ID,
      redirectUri: APPLE_ANDROID_REDIRECT_URI,
      responseType: appleAuthAndroid.ResponseType.ALL,
      scope: appleAuthAndroid.Scope.ALL,
      nonce,
      state,
    });

    console.log('[Apple Auth] Signing in with Apple Android');
    const response = await appleAuthAndroid.signIn();
    if (response.state && response.state !== state) {
      console.error('[Apple Auth] State mismatch - security validation failed');
      throw new Error('Apple sign in returned an invalid state.');
    }

    const identityToken = response.id_token || response.identityToken;
    if (!identityToken) {
      console.error('[Apple Auth] Apple Android did not return an identity token');
      throw new Error('Apple did not return an identity token.');
    }

    console.log('[Apple Auth] Identity token obtained, posting to social endpoint');
    return postSocialToken({
      provider: 'apple',
      identityToken,
      nonce,
      user: {
        email: response.user?.email,
        name: getAppleDisplayName(response.user?.name),
      },
    });
  } catch (error) {
    console.error('[Apple Auth] Error during Apple sign-in:', {
      platform: Platform.OS,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};
