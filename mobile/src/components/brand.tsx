import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

export function BrandLogo() {
  return <View style={brandStyles.logo} accessible accessibilityRole="image" accessibilityLabel="SAIWAY Transfer">
    <Image source={require('../../assets/images/saiway-mark.png')} style={{ width: 44, height: 44 }} contentFit="contain" accessible={false} />
    <View style={{ gap: 3 }}>
      <Text style={brandStyles.name}>SAIWAY</Text>
      <Text style={brandStyles.tagline}>TRANSFER</Text>
    </View>
  </View>;
}

export function AngkorBackground() {
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={StyleSheet.absoluteFill}>
    <Image source={require('../../assets/images/angkor-landscape.png')} style={StyleSheet.absoluteFill}
      contentFit="cover" contentPosition="center" />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(243,246,252,0.72)' }]} />
    <Image source={require('../../assets/images/angkor-temples.png')} contentFit="contain" contentPosition="bottom center"
      style={{ position: 'absolute', width: '100%', height: '45%', bottom: 0, opacity: 0.24 }} />
  </View>;
}

const brandStyles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  name: { color: '#021F73', fontSize: 21, fontWeight: '900', letterSpacing: 4 },
  tagline: { color: '#101B3D', fontSize: 10, fontWeight: '700', letterSpacing: 3 },
});
