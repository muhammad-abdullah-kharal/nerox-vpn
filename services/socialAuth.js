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
  return api.post('/auth/social', {
    ...payload,
    deviceInfo,
  });
};

export const signInWithGoogle = async () => {
  configureGoogle();

  try {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const response = await GoogleSignin.signIn();
    const googleData = getGoogleData(response);

    if (!googleData) {
      return {cancelled: true};
    }

    let idToken = googleData.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }

    if (!idToken) {
      throw new Error('Google did not return an identity token.');
    }

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
    const message = getGoogleErrorMessage(error);
    if (!message) {
      return {cancelled: true};
    }
    throw new Error(message);
  }
};

export const signInWithApple = async () => {
  const nonce = randomString();

  if (Platform.OS === 'ios') {
    if (!appleAuth.isSupported) {
      throw new Error('Apple Sign In is not supported on this device.');
    }

    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      nonce,
    });

    if (!response.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const credentialState = await appleAuth.getCredentialStateForUser(
      response.user,
    );

    if (credentialState !== appleAuth.State.AUTHORIZED) {
      throw new Error('Apple sign in was not authorized.');
    }

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
    throw new Error('Apple Sign In is not supported on this device.');
  }

  if (!APPLE_ANDROID_CLIENT_ID || !APPLE_ANDROID_REDIRECT_URI) {
    throw new Error(
      'Apple Sign In for Android needs APPLE_ANDROID_CLIENT_ID and APPLE_ANDROID_REDIRECT_URI in services/socialAuthConfig.js.',
    );
  }

  const state = randomString();
  appleAuthAndroid.configure({
    clientId: APPLE_ANDROID_CLIENT_ID,
    redirectUri: APPLE_ANDROID_REDIRECT_URI,
    responseType: appleAuthAndroid.ResponseType.ALL,
    scope: appleAuthAndroid.Scope.ALL,
    nonce,
    state,
  });

  const response = await appleAuthAndroid.signIn();
  if (response.state && response.state !== state) {
    throw new Error('Apple sign in returned an invalid state.');
  }

  const identityToken = response.id_token || response.identityToken;
  if (!identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  return postSocialToken({
    provider: 'apple',
    identityToken,
    nonce,
    user: {
      email: response.user?.email,
      name: getAppleDisplayName(response.user?.name),
    },
  });
};
