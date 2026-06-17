import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VpnService from '../services/VpnService';

export default function FeedbackHistory({navigation}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await VpnService.getFeedbackHistory();
      setHistory(data);
    } catch (err) {
      console.error('Fetch History Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open': return '#FFA500'; // Orange
      case 'responded': return '#6B8F04'; // Green
      case 'closed': return '#A1A1AC'; // Gray
      default: return '#fff';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Image source={require('../assets/Left.png')} style={styles.headerIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>My Feedback</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B8F04" />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#6B8F04" />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.centerContainer}>
            <Image source={require('../assets/Play.png')} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>You haven't submitted any feedback yet.</Text>
            <Pressable 
                style={styles.newFeedbackBtn}
                onPress={() => navigation.navigate('Feedback')}
            >
                <Text style={styles.newFeedbackBtnText}>Report an Issue</Text>
            </Pressable>
          </View>
        ) : (
          history.map((item) => (
            <Pressable 
              key={item.feedback_id} 
              style={styles.historyCard}
              onPress={() => navigation.navigate('ViewFeedback', { feedback: item })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.categoryTag}>{item.category}</Text>
                <Text style={[styles.statusTag, { color: getStatusColor(item.status) }]}>
                  {item.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.subjectText} numberOfLines={1}>{item.subject}</Text>
              <Text style={styles.messagePreview} numberOfLines={2}>{item.message}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                {item.admin_response && (
                  <View style={styles.responseIndicator}>
                    <View style={styles.indicatorDot} />
                    <Text style={styles.indicatorText}>Team Replied</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))
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
  centerContainer: {
    height: Dimensions.get('window').height - 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    opacity: 0.3,
    tintColor: '#6B8F04',
  },
  emptyText: {
    color: '#A1A1AC',
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#171B2E',
    borderRadius: 20,
    padding: 16,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#2E2E3D',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryTag: {
    backgroundColor: 'rgba(107, 143, 4, 0.1)',
    color: '#6B8F04',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusTag: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  subjectText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  messagePreview: {
    color: '#A1A1AC',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(58, 58, 77, 0.3)',
    paddingTop: 10,
  },
  dateText: {
    color: '#585863',
    fontSize: 11,
  },
  responseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B8F04',
    marginRight: 6,
  },
  indicatorText: {
    color: '#6B8F04',
    fontSize: 11,
    fontWeight: 'bold',
  },
  newFeedbackBtn: {
    marginTop: 25,
    backgroundColor: '#6B8F04',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 15,
  },
  newFeedbackBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
