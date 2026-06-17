import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Image,
  StyleSheet,
  Switch,
  ImageBackground,
  Pressable,
} from 'react-native';

export default function PrivacyPolicy({navigation}) {
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
            width: '100%',
            // height:"100%",
            alignSelf: 'center',
          }}>
          <View style={{height: 20}} />
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '90%',

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

            <Text
              style={{
                fontSize: 20,
                fontWeight: '300',
                color: '#fff',
              }}>
              Privacy Policy
            </Text>
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
          <View
            style={{
              width: '90%',
              alignSelf: 'center',
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                // justifyContent: 'center',
                width: '100%',
              }}>
              <Image
                source={require('../assets/calendar.png')}
                style={{
                  width: 16,
                  height: 16,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '100',
                  color: '#ABABB1',
                  marginLeft: 10,
                }}>
                Last update : November 10, 2023
              </Text>
            </View>

            <View style={{height: 20}} />

            <Text
              style={{
                fontSize: 14,
                fontWeight: '200',
                color: '#fff',
                // marginLeft:10
              }}>
              Privacy Policy is provided in layers, meaning that all information
              related to our general personal data processing practices is
              provided here. Meanwhile, additional Service-specific information
              applicable to separate FastVPN products or websites are accessible
              via links in this Privacy Policy.
            </Text>

            <View style={{height: 20}} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '200',
                color: '#fff',
                // marginLeft:10
              }}>
              Privacy Policy is provided in layers, meaning that all information
              related to our general personal data processing practices is
              provided here. Meanwhile, additional Service-specific information
              applicable to separate NEROX products or websites are accessible
              via links in this Privacy Policy.
            </Text>

            <View style={{height: 20}} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '200',
                color: '#fff',
                // marginLeft:10
              }}>
              Information in this Privacy Policy is provided in layers, meaning
              that all information related to our general personal data
              processing practices is provided here. Meanwhile, additional
              Service-specific information applicable to separate NEROX products
              or websites are accessible via links in this Privacy Policy.
            </Text>
            <View style={{height: 20}} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '200',
                color: '#fff',
                // marginLeft:10
              }}>
              Privacy Policy is provided in layers, meaning that all information
              related to our general personal data processing practices is
              provided here. Meanwhile, additional Service-specific information
              applicable to separate FastVPN products or websites are accessible
              via links in this Privacy Policy.practices is provided here.
              Meanwhile, additional Service-specific information applicable to
              separate FastVPN products or websites are accessible via links in
              this Privacy Policy.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
