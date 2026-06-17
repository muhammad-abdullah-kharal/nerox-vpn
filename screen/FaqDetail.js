import React, {useState} from 'react';
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
} from 'react-native';

export default function FaqDetail({navigation, route}) {
  const {categoryName, title, text1, text2} = route.params;
  const tabs = ['Yes', 'No']; // Add your tab names here
  const [activeTab, setActiveTab] = useState(0);

  const handleTabPress = index => {
    setActiveTab(index);
    // Add logic to handle tab press, such as changing content based on the selected tab
  };
  return (
    <ScrollView>
      <View
        style={{
          flexGrow: 1,
          height: Dimensions.get('window').height,

          backgroundColor: '#00091F',
        }}>
        <View
          style={{
            width: '90%',
            // height:"100%",
            alignSelf: 'center',
          }}>
          <View style={{height: 20}} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',

              alignSelf: 'center',

              height: 40,
            }}>
            <Pressable
              onPress={() => {
                navigation.goBack();
              }}>
              <View
                style={{
                  alignItems: 'center',
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: '#00091F',
                }}>
                <Image
                  source={require('../assets/Left.png')}
                  style={{
                    width: 24,
                    height: 24,
                  }}
                />
              </View>
            </Pressable>

            <View></View>
            <Pressable
              onPress={() => {
                navigation.goBack();
              }}>
              <View
                style={{
                  alignItems: 'center',
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: '#00091F',
                }}></View>
            </Pressable>
          </View>
          <View style={{height: 20}} />

          <Text
            style={{
              fontSize: 14,
              fontWeight: '400',
              color: '#6B8F04',
            }}>
            {categoryName}
          </Text>

          <View style={{height: 20}} />
          <Text
            style={{
              fontSize: 24,
              fontWeight: '300',
              color: '#fff',
            }}>
            {title}
          </Text>
          <View style={{height: 20}} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '200',
              color: '#C2C2CD',
            }}>
            {text1}
          </Text>
          <View style={{height: 20}} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '200',
              color: '#C2C2CD',
            }}>
            {text2}
          </Text>
          <View style={{height: 250}} />

          <View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '200',
                color: '#fff',
              }}>
              Was this answer helpful?
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabBarContainer}>
              {tabs.map((tab, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleTabPress(index)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor:
                        activeTab === index ? '#32342C' : '#171B2E',
                    },
                    {borderColor: activeTab === index ? '#A4D616' : '#4A4A61'},
                    {},
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === index ? '#6B8F04' : '#ABABB1',
                      },
                    ]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    alignSelf: 'center',
    width: '90%',

    backgroundColor: '#171B2E',
    borderRadius: 8,
    paddingLeft: 16,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
  },
  tabBarContainer: {
    flexDirection: 'row',
    marginTop: 20,
    // backgroundColor: '#171B2E',
    height: 40,
    //   marginLeft: 20,
  },
  tab: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
    borderWidth: 1,
    borderRadius: 12,
  },
  tabText: {
    color: '#FFFFFF',
  },
});
