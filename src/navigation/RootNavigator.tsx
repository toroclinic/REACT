import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabBarButtonProps,
  BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { RootTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { ScreeningScreen } from '../screens/ScreeningScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator<RootTabParamList>();

// Raindrop logo — two overlapping teardrops + wordmark, matches Web PWA logo-on-dark.svg
function ToroLogo() {
  return (
    <Svg width={120} height={42} viewBox="0 0 160 56">
      <Path
        d="M14,3 C15,7 21,19 21,31 C21,40 18,47 13,47 C8,47 5,40 5,31 C5,19 10,7 11,3 C12,1 13,1 14,3 Z"
        fill="#0D9E8F"
      />
      <Path
        d="M25,11 C26,14 30,23 30,33 C30,40 27,45 23,45 C19,45 16,40 16,33 C16,23 20,14 21,11 C22,9 24,9 25,11 Z"
        fill="#C8873A"
      />
      <SvgText
        x="40"
        y="32"
        fontFamily="Georgia, serif"
        fontWeight="700"
        fontSize="24"
        fill="#ffffff"
      >
        TORO
      </SvgText>
      <SvgText
        x="41"
        y="46"
        fontFamily="Arial, sans-serif"
        fontSize="8.5"
        fill="#C8873A"
        letterSpacing="3"
      >
        WELLNESS+
      </SvgText>
    </Svg>
  );
}

// Header logo button — navigates to Home on press. Reads navigation via the
// hook rather than a prop threaded through screenOptions' per-render
// closure, so this stays a single stable component reference across
// RootNavigator re-renders instead of being redefined (and remounted) every
// time — see the module-scope note below `renderTabBarIcon`.
function HeaderLogo() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Home')}
      style={styles.headerLogoBtn}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Go to Home"
    >
      <ToroLogo />
    </TouchableOpacity>
  );
}

const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Home: 'home-outline',
  Screening: 'stethoscope',
  Activity: 'walk',
  Messages: 'message-text-outline',
  Coach: 'robot-outline',
  Rewards: 'gift-outline',
  Wallet: 'wallet-outline',
  Profile: 'account-outline',
};

// Built once at module load — a plain arrow function assigned inside
// `screenOptions` (which itself is re-invoked by React Navigation on every
// focus/navigation-state change, not just on RootNavigator re-render) would
// get a brand-new reference every time even if it just delegates to a
// hoisted helper. Only a reference to something built OUTSIDE the render
// path is truly stable, so each tab's icon renderer is created exactly once
// here and looked up by route name — no inline function literal ever
// appears in the render body.
const TAB_ICON_RENDERERS = Object.fromEntries(
  (Object.keys(TAB_ICONS) as (keyof RootTabParamList)[]).map(name => [
    name,
    ({ color }: { color: string }) => (
      <Icon name={TAB_ICONS[name]} color={color} size={26} />
    ),
  ]),
) as Record<
  keyof RootTabParamList,
  (props: { color: string }) => React.ReactElement
>;

// Same reasoning as renderTabBarIcon — must be a stable reference, not an
// inline arrow function inside a Tab.Screen's `options` object.
function ProfileTabButton(props: BottomTabBarButtonProps) {
  return <TouchableOpacity activeOpacity={0.7} {...props} />;
}

const styles = StyleSheet.create({
  headerLogoBtn: { marginLeft: 12 },
});

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.toroInk,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: '600',
        },
        headerTintColor: colors.textPrimary,
        headerLeft: HeaderLogo,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(212,168,67,0.5)',
        tabBarStyle: {
          backgroundColor: colors.toroInk,
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarIcon: TAB_ICON_RENDERERS[route.name as keyof RootTabParamList],
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarButton: () => null, headerTitle: '' }}
      />
      <Tab.Screen
        name="Screening"
        component={ScreeningScreen}
        options={{ headerTitle: 'Health Check' }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ headerTitle: 'Activity' }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarButton: () => null, headerTitle: 'Inbox' }}
      />
      <Tab.Screen
        name="Coach"
        component={CoachScreen}
        options={{ tabBarButton: () => null, headerTitle: 'Tora AI' }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsScreen}
        options={{ tabBarButton: () => null, headerTitle: 'Rewards' }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ headerTitle: 'Wallet' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'Profile',
          tabBarButton: ProfileTabButton,
        }}
      />
    </Tab.Navigator>
  );
}
