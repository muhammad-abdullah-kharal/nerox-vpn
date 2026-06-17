import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import VpnService from '../services/VpnService';

export default function Faq({navigation}) {
  const [categories, setCategories] = useState([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faqsLoading, setFaqsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Initial Load: Fetch Categories + First Category FAQs
  useEffect(() => {
    async function loadCategories() {
      try {
        setLoading(true);
        console.log('[Faq] Fetching categories from backend...');
        const data = await VpnService.getFaqCategories();
        console.log('[Faq] Categories received:', data?.length, data);
        if (!Array.isArray(data) || data.length === 0) {
          console.warn('[Faq] No categories returned.');
          return;
        }
        setCategories(data);
        // ✅ Await the initial FAQ load BEFORE dismissing the loading spinner
        await loadFaqs(data[0].id);
      } catch (err) {
        console.error('[Faq] Error loading FAQ categories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  // 2. Fetch FAQs for selected category
  const loadFaqs = async (categoryId) => {
    try {
      setFaqsLoading(true);
      console.log('[Faq] Fetching FAQs for category:', categoryId);
      const data = await VpnService.getFaqsByCategory(categoryId);
      console.log('[Faq] FAQs received:', data?.length, data);
      setFaqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Faq] Error loading FAQs:', err);
    } finally {
      setFaqsLoading(false);
    }
  };

  const handleTabPress = (index) => {
    setActiveCategoryIndex(index);
    if (!searchQuery) {
      loadFaqs(categories[index].id);
    }
  };

  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.length >= 2) {
      try {
        setFaqsLoading(true);
        const results = await VpnService.searchFaqs(text);
        setFaqs(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setFaqsLoading(false);
      }
    } else if (text.length === 0 && categories.length > 0) {
      loadFaqs(categories[activeCategoryIndex].id);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: '#00091F' }}>
      <View style={{ flexGrow: 1, backgroundColor: '#00091F' }}>
        <View style={{ width: '100%', alignSelf: 'center' }}>
          <View style={{ height: 20 }} />
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Image source={require('../assets/Left.png')} style={styles.headerIcon} />
            </Pressable>
            <Text style={styles.headerTitle}>FAQ</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <View style={{ height: 20 }} />

          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#6B8F04" style={styles.searchIcon} />
            <TextInput
              style={styles.input}
              placeholder="Search for keywords..."
              placeholderTextColor="#A1A1AC"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          {loading ? (
             <ActivityIndicator size="large" color="#6B8F04" style={{ marginTop: 50 }} />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabBarContainer}>
                {categories.map((cat, index) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => handleTabPress(index)}
                    style={[
                      styles.tab,
                      { backgroundColor: activeCategoryIndex === index ? '#32342C' : '#171B2E' },
                      { borderColor: activeCategoryIndex === index ? '#A4D616' : '#4A4A61' }
                    ]}>
                    <Text style={[
                      styles.tabText,
                      { color: activeCategoryIndex === index ? "#6B8F04" : "#ABABB1" }
                    ]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ height: 20 }} />

              <View style={styles.faqListContainer}>
                <View style={styles.faqInner}>
                  {faqsLoading ? (
                    <ActivityIndicator size="small" color="#6B8F04" style={{ marginVertical: 30 }} />
                  ) : faqs.length === 0 ? (
                    <Text style={styles.emptyText}>No questions found.</Text>
                  ) : (
                    faqs.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          navigation.navigate('FaqDetail', {
                            categoryName: item.faq_categories?.name || categories[activeCategoryIndex]?.name || 'FAQ',
                            title: item.question,
                            text1: item.answer_text_1,
                            text2: item.answer_text_2,
                          });
                        }}>
                        <View>
                          <View style={styles.faqRow}>
                            <Text style={styles.faqQuestion}>{item.question}</Text>
                            <Image
                              source={require('../assets/Right.png')}
                              style={styles.faqArrow}
                            />
                          </View>
                          <View style={{ height: 15 }} />
                          <View style={styles.divider} />
                          <View style={{ height: 15 }} />
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              </View>
            </>
          )}

          <View style={{ height: 24 }} />

          <Pressable onPress={() => navigation.navigate("Feedback")}>
            <Image source={require('../assets/More.png')} style={styles.moreIcon} />
            <Text style={styles.moreText}>More questions?</Text>
            <View style={{ height: 40 }} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    height: 40,
    marginTop: 20,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: '#171B2E',
    borderRadius: 8,
    paddingLeft: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
  },
  tabBarContainer: {
    flexDirection: 'row',
    marginTop: 20,
    height: 56,
    marginLeft: 20,
  },
  tab: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
    borderWidth: 1,
    borderRadius: 12,
    height: 40,
  },
  tabText: {
    fontSize: 14,
  },
  faqListContainer: {
    width: '100%',
    backgroundColor: '#171B2E',
    paddingTop: 15,
  },
  faqInner: {
    width: '90%',
    alignSelf: 'center',
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '200',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  faqArrow: {
    width: 24,
    height: 24,
    opacity: 0.5,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#3A3A4D',
  },
  emptyText: {
    color: '#A1A1AC',
    textAlign: 'center',
    marginVertical: 30,
  },
  moreIcon: {
    width: 48,
    alignSelf: 'center',
    height: 48,
  },
  moreText: {
    fontSize: 14,
    fontWeight: '200',
    color: '#fff',
    textAlign: 'center',
    marginTop: 5,
  },
});
