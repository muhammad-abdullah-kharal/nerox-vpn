import {AppRegistry, LogBox} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import bcrypt from 'react-native-bcrypt';
import isaac from 'isaac';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// 1. Setup PRNG fallback for React Native globally
bcrypt.setRandomFallback((len) => {
	const buf = new Uint8Array(len);
	return buf.map(() => Math.floor(isaac.random() * 256));
});

// 2. Initialize Google Sign-In
GoogleSignin.configure({
    webClientId: '595221930597-pj8dta32veg34qvtnp4u9jjlt1b51aft.apps.googleusercontent.com',
    offlineAccess: true,
    forceCodeForRefreshToken: true,
});

// 3. Ignore the security warning since we've already provided the secure fallback above
LogBox.ignoreLogs(['Using Math.random is not cryptographically secure']);

AppRegistry.registerComponent(appName, () => App);