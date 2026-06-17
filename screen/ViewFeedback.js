import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function ViewFeedback({navigation, route}) {
  const { feedback } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Image source={require('../assets/Left.png')} style={styles.headerIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>Issue Details</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusSection}>
            <View style={styles.categoryContainer}>
                <Text style={styles.categoryLabel}>CATEGORY</Text>
                <Text style={styles.categoryValue}>{feedback.category}</Text>
            </View>
            <View style={styles.statusContainer}>
                <Text style={styles.statusLabel}>STATUS</Text>
                <Text style={[styles.statusValue, { color: feedback.status === 'closed' ? '#A1A1AC' : '#6B8F04' }]}>
                    {feedback.status?.toUpperCase()}
                </Text>
            </View>
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.label}>SUBJECT</Text>
          <Text style={styles.subjectText}>{feedback.subject}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.label}>YOUR MESSAGE</Text>
          <Text style={styles.messageText}>{feedback.message}</Text>
          
          <Text style={styles.dateText}>
            Submitted on {new Date(feedback.created_at).toLocaleString()}
          </Text>
        </View>

        {feedback.admin_response ? (
          <View style={[styles.contentCard, styles.adminCard]}>
            <View style={styles.adminHeader}>
                <View style={styles.adminAvatar}>
                   <Icon name="support" size={18} color="#fff" />
                </View>
                <View>
                    <Text style={styles.adminLabel}>TEAM RESPONSE</Text>
                    <Text style={styles.adminDate}>
                        {new Date(feedback.responded_at).toLocaleString()}
                    </Text>
                </View>
            </View>
            
            <Text style={styles.adminResponseText}>{feedback.admin_response}</Text>
          </View>
        ) : (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingText}>
              Our team is reviewing your report. You'll see a response here soon.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00091F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    height: 60,
    marginTop: 10,
  },
  iconButton: {
    alignItems: 'center',
    width: 40,
    height: 40,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#171B2E',
  },
  headerIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: '5%',
    paddingBottom: 40,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#171B2E',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    marginBottom: 15,
  },
  categoryContainer: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 10,
    color: '#A1A1AC',
    marginBottom: 4,
    letterSpacing: 1,
  },
  categoryValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: 10,
    color: '#A1A1AC',
    marginBottom: 4,
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  contentCard: {
    backgroundColor: '#171B2E',
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2E2E3D',
  },
  label: {
    fontSize: 10,
    color: '#A1A1AC',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subjectText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(58, 58, 77, 0.3)',
    marginBottom: 15,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 15,
  },
  dateText: {
    color: '#585863',
    fontSize: 11,
    textAlign: 'right',
  },
  adminCard: {
    borderColor: '#6B8F04',
    backgroundColor: 'rgba(107, 143, 4, 0.05)',
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6B8F04',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminLabel: {
    fontSize: 10,
    color: '#6B8F04',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  adminDate: {
    fontSize: 11,
    color: '#A1A1AC',
  },
  adminResponseText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  pendingCard: {
    padding: 20,
    alignItems: 'center',
  },
  pendingText: {
    color: '#A1A1AC',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});
