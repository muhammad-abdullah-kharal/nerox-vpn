import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  Pressable,
  Linking
} from 'react-native';

const { width } = Dimensions.get('window');

const ICONS = {
  globe: require('../assets/globe.png'),
  shield: require('../assets/crown.png'), // Using crown as a substitute for shield
  speed: require('../assets/Al.png'),
  nologs: require('../assets/No.png'),
  back: require('../assets/Left.png'),
  logo: require('../assets/Logo2.png'),
};

export default function About({ navigation }) {
  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.mainContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={ICONS.back} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>About Nerox VPN</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* App Overview */}
        <View style={styles.logoSection}>
          <Image source={ICONS.logo} style={styles.logo} />
          <Text style={styles.versionText}>Version 1.3.0 • Build 2026.05</Text>
        </View>

        <Section title="App Overview">
          <Text style={styles.descriptionText}>
            Nerox VPN provides a military-grade encrypted tunnel for your internet traffic. Our mission is to ensure digital privacy, robust security, and unrestricted access to the global web for everyone, everywhere.
          </Text>
        </Section>

        {/* Key Features */}
        <Section title="Key Features">
          <View style={styles.featureGrid}>
            <FeatureItem icon="shield" title="Secure Encryption" />
            <FeatureItem icon="speed" title="Global Servers" />
            <FeatureItem icon="nologs" title="Zero-Logs Policy" />
            <FeatureItem icon="globe" title="Cross-Platform" />
          </View>
        </Section>

        {/* How It Works */}
        <Section title="How It Works">
          <View style={styles.workflowRow}>
            <WorkflowStep number="1" text="Connect" />
            <View style={styles.arrow} />
            <WorkflowStep number="2" text="Encrypt" />
            <View style={styles.arrow} />
            <WorkflowStep number="3" text="Browse" />
          </View>
          <Text style={styles.subText}>Simple one-tap connection to any of our 50+ global locations.</Text>
        </Section>

        {/* Contact & Support */}
        <Section title="Support">
          <Pressable style={styles.linkItem} onPress={() => openLink('mailto:support@neroxvpn.app')}>
            <Text style={styles.linkText}>Email Support</Text>
            <Text style={styles.linkSub}>support@neroxvpn.app</Text>
          </Pressable>
          <Pressable style={styles.linkItem} onPress={() => {}}>
            <Text style={styles.linkText}>Help & FAQ</Text>
            <Text style={styles.linkSub}>Get help with your connection</Text>
          </Pressable>
        </Section>

        <Section title="Legal">
          <View style={styles.legalRow}>
            <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} style={styles.legalButton}>
              <Text style={styles.legalText}>Privacy Policy</Text>
            </Pressable>
            <View style={styles.legalDivider} />
            <Pressable onPress={() => navigation.navigate('Term')} style={styles.legalButton}>
              <Text style={styles.legalText}>Terms of Service</Text>
            </Pressable>
          </View>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.copyright}>© 2026 Nerox Technologies. All rights reserved.</Text>
          <Text style={styles.footerLink}>www.NeroxVPN.app</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const Section = ({ title, children }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

const FeatureItem = ({ icon, title }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIconBg}>
      <Image source={ICONS[icon]} style={styles.featureIcon} />
    </View>
    <Text style={styles.featureText}>{title}</Text>
  </View>
);

const WorkflowStep = ({ number, text }) => (
  <View style={styles.stepItem}>
    <View style={styles.stepCircle}><Text style={styles.stepNumber}>{number}</Text></View>
    <Text style={styles.stepLabel}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#00091F' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: 45,
    backgroundColor: '#000C29',
    borderBottomWidth: 1,
    borderBottomColor: '#171B2E'
  },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 22, height: 22 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  scrollContent: { paddingBottom: 40 },
  logoSection: { alignItems: 'center', paddingVertical: 40 },
  logo: { width: 120, height: 120, marginBottom: 15, resizeMode: 'contain' },
  versionText: { fontSize: 12, color: '#6B8F04', fontWeight: '500' },
  sectionContainer: { marginTop: 30, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B8F04', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  sectionContent: { backgroundColor: '#0A1227', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#171B2E' },
  descriptionText: { color: '#ABABB1', lineHeight: 22, fontSize: 14 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  featureItem: { width: '45%', flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  featureIconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#171B2E', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  featureIcon: { width: 24, height: 24, resizeMode: 'contain' },
  featureText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  workflowRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#6B8F04', justifyContent: 'center', alignItems: 'center' },
  stepNumber: { color: '#fff', fontWeight: '800', fontSize: 12 },
  stepLabel: { color: '#fff', fontSize: 11, fontWeight: '500', marginTop: 5 },
  arrow: { width: 30, height: 1, backgroundColor: '#171B2E', marginHorizontal: 15 },
  subText: { color: '#5C5C66', textAlign: 'center', fontSize: 11 },
  linkItem: { marginBottom: 15 },
  linkText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  linkSub: { color: '#6B8F04', fontSize: 12, marginTop: 2 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  legalButton: { padding: 10 },
  legalText: { color: '#6B8F04', fontSize: 13, textDecorationLine: 'underline' },
  legalDivider: { width: 1, height: 15, backgroundColor: '#171B2E' },
  footer: { marginTop: 50, alignItems: 'center' },
  copyright: { color: '#5C5C66', fontSize: 11 },
  footerLink: { color: '#171B2E', fontSize: 12, fontWeight: '600', marginTop: 5 }
});
