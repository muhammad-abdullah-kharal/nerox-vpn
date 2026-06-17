import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Pressable,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import {Platform, UIManager} from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


const {width} = Dimensions.get('window');

const Onboarding = ({navigation}) => {
  const scrollViewRef = useRef(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const totalSlides = 3;

  const handleScroll = event => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== currentSlideIndex) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentSlideIndex(newIndex);
    }
  };

  const renderPagination = index => {
    return (
      <View
        style={{
          width: 66,
          height: 6,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          alignSelf: 'center',
        }}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={{
              width: i === index ? 32 : 12,
              height: 6,
              borderRadius: 8,
              backgroundColor: i === index ? '#6B8F04' : '#4A4A61',
            }}
          />
        ))}
      </View>
    );
  };


  const handleContinue = () => {
    const nextSlideIndex = currentSlideIndex + 1;

    if (nextSlideIndex < totalSlides) {
      scrollViewRef.current.scrollTo({
        x: nextSlideIndex * width,
        animated: true,
      });
      setCurrentSlideIndex(nextSlideIndex);
    } else {
      // Navigate to the login screen when on the last slide
      navigation.navigate('CreateAccount');
    }
  };
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        // backgroundColor: '#F8F8F8',
      }}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#00091F',
        }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}>

          <View style={styles.slide}>
            <View style={{height: 80}} />

            <Image
              source={require('../assets/onboarding3.png')}
              style={{
                width: 240,
                height: 240,
                marginBottom: 20,
                alignSelf: 'center',
              }}
              resizeMode="cover"
            />
            <View style={{height: 30}} />

            <Text style={styles.title}>Safe and Secured</Text>
            <View style={{height: 20}} />
            <Text style={styles.description}>
              We offer additional security features such as ad-blocking, malware
              protection, double VPN{' '}
            </Text>
            <View style={{height: 50}} />
            {renderPagination(0)}
            <View style={{height: 50}} />


            {/* Continue btn */}
            <Pressable
              style={{
                width: 327,
              }}
              onPress={handleContinue}>
              <ImageBackground
                source={require('../assets/btn.png')}
                style={{
                  width: "100%",
                  height: 68,


                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#fff',
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                  Continue
                </Text>
              </ImageBackground>
            </Pressable>
            <View style={{height: 10}} />

            <Pressable
              style={{
                width: '90%',
              }}
              onPress={() => {
                navigation.navigate('CreateAccount');
              }}>
              <View
                style={{
                  width: '90%',
                  height: 56,

                  borderRadius: 10,

                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#fff',
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                  Skip
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Slide 2: Fast and Reliable */}
          <View style={styles.slide}>
            <View style={{height: 80}} />

            <Image
              source={require('../assets/onboarding2.png')}
              style={{
                width: 240,
                height: 240,
                marginBottom: 20,
                alignSelf: 'center',
              }}
              resizeMode="cover"
            />
            <View style={{height: 30}} />

            <Text style={styles.title}>Fast and Reliable</Text>
            <View style={{height: 20}} />
            <Text style={styles.description}>
              Ensure smooth browsing, streaming, and downloading without
              significant speed loss.
            </Text>
            <View style={{height: 50}} />
            {renderPagination(1)}
            <View style={{height: 50}} />


            {/* Continue btn */}
            <Pressable
              style={{
                width: 327,
              }}
              onPress={handleContinue}>
              <ImageBackground
                source={require('../assets/btn.png')}
                style={{
                  width: "100%",
                  height: 68,


                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#fff',
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                  Continue
                </Text>
              </ImageBackground>
            </Pressable>
            <View style={{height: 10}} />
            <Pressable
              style={{
                width: '90%',
              }}
              onPress={() => {
                navigation.navigate('CreateAccount');
              }}>
              <View
                style={{
                  width: '90%',
                  height: 56,

                  borderRadius: 10,

                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#fff',
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                  Skip
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Slide 3: Refer & Get */}
          <View style={styles.slide}>
            <View style={{height: 80}} />
            <Image
              source={require('../assets/onboarding1.png')}
              style={{
                width: 240,
                height: 240,
                marginBottom: 20,
                alignSelf: 'center',
              }}
              resizeMode="cover"
            />
            <View style={{height: 30}} />

            <Text style={styles.title}>Refer & Get</Text>
            <View style={{height: 20}} />
            <Text style={{
              fontSize: 14,
              color: '#A1A1AC',
              textAlign: 'center',
              paddingBottom:15,
              paddingHorizontal: 20,
            }}>
              Refer And get extra days subscriptions.
            </Text>
            <Text
              style={{
           
                backgroundColor: "transparent",
    display: "none",
              }}>
              Refer And get extra days subscriptions.
            </Text>
            <View style={{height: 50}} />
            {renderPagination(2)}
            <View style={{height: 50}} />


            {/* Continue btn */}
            <Pressable
              style={{
                width: 327,
              }}
              onPress={handleContinue}>
              <ImageBackground
                source={require('../assets/btn.png')}
                style={{
                  width: "100%",
                  height: 68,


                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#fff',
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                  Continue
                </Text>
              </ImageBackground>
            </Pressable>
            <View style={{height: 10}} />
            <Pressable
              style={{
                width: '90%',
              }}
              onPress={() => {
                navigation.navigate('CreateAccount');
              }}>
              <View
                style={{
                  width: '90%',
                  height: 56,

                  borderRadius: 10,

                  justifyContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: '#fff',
                    fontWeight: '500',
                    textAlign: 'center',
                  }}>
                  Skip
                </Text>
              </View>
            </Pressable>
          </View>


        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    width,
  },
  image: {
    width: 260,
    height: 260,
    marginBottom: 20,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#A1A1AC',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    // alignItems: 'center',
    justifyContent: 'flex-end',
    // alignItems:"flex-end",
    alignSelf: 'center',
    width: '90%',
  },
  skipButton: {
    width: '100%',
    // alignItems: 'flex-start',
    borderRadius: 10,
    // margin: 20,
  },
  nextButton: {
    width: '100%',
    // alignItems: 'flex-end',
    borderRadius: 10,
    margin: 20,
  },
  buttonText: {
    color: '#858597',
    fontSize: 14,
    fontWeight: 'normal',
  },
});

export default Onboarding;
