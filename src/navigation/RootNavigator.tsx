// Bottom tab navigator — 5 destinations per Frontend & Backend Spec,
// Section 3.1: "bottom tab navigator (5 destinations) with stack
// navigators nested per tab for any drill-in screens."
// No drill-in screens exist yet (Section 3.6, reward detail explicitly
// deferred), so each tab is a single screen for now — nesting a stack
// navigator per tab later is additive, not a refactor.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { ScreeningScreen } from '../screens/ScreeningScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, string> = {
  Home: 'water-outline',
  Screening: 'stethoscope',
  Activity: 'walk',
  Rewards: 'gift-outline',
  Profile: 'account-outline',
};

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primaryTeal,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopColor: colors.border, borderTopWidth: 0.5 },
        tabBarIcon: ({ color, size }) => (
          <Icon name={TAB_ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Screening" component={ScreeningScreen} options={{ title: 'Screen' }} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
