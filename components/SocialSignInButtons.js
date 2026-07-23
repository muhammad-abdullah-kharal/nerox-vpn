import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PROVIDERS = [
  {
    key: 'google',
    label: 'Google',
    icon: require('../assets/google.png'),
  },
  {
    key: 'apple',
    label: 'Apple',
    icon: require('../assets/apple.png'),
    tintColor: '#fff',
  },
];

export default function SocialSignInButtons({
  loadingProvider,
  onPressApple,
  onPressGoogle,
}) {
  const isLoading = provider => loadingProvider === provider;
  const isDisabled = Boolean(loadingProvider);

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or sign in with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttonStack}>
        {PROVIDERS.map(provider => (
          <Pressable
            key={provider.key}
            accessibilityRole="button"
            accessibilityLabel={`Sign in with ${provider.label}`}
            disabled={isDisabled}
            hitSlop={8}
            onPress={provider.key === 'google' ? onPressGoogle : onPressApple}
            style={({pressed}) => [
              styles.socialButton,
              pressed && !isDisabled ? styles.socialButtonPressed : null,
              isDisabled && !isLoading(provider.key)
                ? styles.socialButtonDisabled
                : null,
            ]}>
            {isLoading(provider.key) ? (
              <ActivityIndicator color="#6B8F04" />
            ) : (
              <>
                <Image
                  source={provider.icon}
                  style={[
                    styles.socialIcon,
                    provider.tintColor ? {tintColor: provider.tintColor} : null,
                  ]}
                />
                <Text style={styles.socialText}>
                  Continue with {provider.label}
                </Text>
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 22,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#171B2E',
  },
  dividerText: {
    color: '#7D8193',
    fontSize: 12,
    marginHorizontal: 12,
  },
  buttonStack: {
    gap: 12,
  },
  socialButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#171B2E',
    backgroundColor: '#0A1227',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  socialButtonPressed: {
    borderColor: '#6B8F04',
    backgroundColor: '#101A32',
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  socialText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
});
