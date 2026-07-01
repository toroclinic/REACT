import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { spacing } from '../theme/tokens';

// ─── Toro raindrop logo — matches RootNavigator.tsx ToroLogo ─────────────────

function ToroRaindrop({
  width = 120,
  height = 42,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 160 56">
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

// ─── Loader screen ─────────────────────────────────────────────────────────────

const PROGRESS_BAR_W = 220;
const LOADER_DURATION = 1800;

function LoaderScreen({
  hydrated,
  onDone,
}: {
  hydrated: boolean;
  onDone: () => void;
}) {
  const breathAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.7)).current;
  const animDoneRef = useRef(false);
  const bothReadyRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep ref so the animation callback always calls the latest onDone prop
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const tryAdvance = (animDone: boolean, appHydrated: boolean) => {
    if (animDone) {
      animDoneRef.current = true;
    }
    if (appHydrated) {
      bothReadyRef.current = true;
    }
    if (animDoneRef.current && bothReadyRef.current) {
      onDoneRef.current();
    }
  };

  useEffect(() => {
    // Breathing logo
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.07,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    breath.start();

    // Wordmark shimmer
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmer.start();

    // Progress bar — fills to 100% in LOADER_DURATION, then waits for hydration
    Animated.timing(progressAnim, {
      toValue: PROGRESS_BAR_W,
      duration: LOADER_DURATION,
      useNativeDriver: false,
    }).start(() => {
      advanceTimerRef.current = setTimeout(
        () => tryAdvance(true, bothReadyRef.current),
        260,
      );
    });

    return () => {
      breath.stop();
      shimmer.stop();
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
    // breathAnim/progressAnim/shimmerAnim are useRef(...).current values —
    // stable identity across renders, safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydration may complete before or after the animation
  useEffect(() => {
    if (hydrated) {
      tryAdvance(animDoneRef.current, true);
    }
  }, [hydrated]);

  return (
    <View style={ls.screen}>
      <Animated.View
        style={[
          ls.logoWrap,
          { transform: [{ scale: breathAnim }], opacity: shimmerAnim },
        ]}
      >
        <ToroRaindrop width={180} height={63} />
      </Animated.View>

      <View style={ls.progressTrack}>
        <Animated.View style={[ls.progressFill, { width: progressAnim }]} />
      </View>
    </View>
  );
}

// ─── Feature rows (matches Web PWA landing screen) ─────────────────────────────

const FEATURES = [
  {
    emoji: '🩺',
    label: 'Health screenings',
    sub: 'Log BP, glucose, SpO₂ and more',
    accent: '#7FB3A0',
  },
  {
    emoji: '🏃',
    label: 'Activity tracking',
    sub: 'Earn points for every workout',
    accent: '#6FCF97',
  },
  {
    emoji: '💊',
    label: 'Wellness rewards',
    sub: 'Unlock premium discounts up to 10%',
    accent: '#C8A96A',
  },
  {
    emoji: '🚨',
    label: 'Instant escalation',
    sub: 'Critical results reach a doctor in minutes',
    accent: '#EB5757',
  },
];

function LandingScreen({ onContinue }: { onContinue: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 480,
        useNativeDriver: true,
      }),
    ]).start();
    // fadeAnim/slideAnim are useRef(...).current values — stable identity
    // across renders, safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={ld.screen}>
      <ScrollView
        contentContainerStyle={ld.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <Animated.View
          style={[
            ld.hero,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Badge */}
          <View style={ld.badge}>
            <View style={ld.badgeDot} />
            <Text style={ld.badgeText}>TORO WELLNESS+</Text>
          </View>

          {/* Logo */}
          <View style={ld.logoWrap}>
            <ToroRaindrop width={160} height={56} />
          </View>

          {/* Headline */}
          <Text style={ld.headline}>
            Your health,{'\n'}
            <Text style={ld.headlineAccent}>rewarded.</Text>
          </Text>

          <Text style={ld.sub}>
            Premium health insurance that pays you back for living well.
          </Text>
        </Animated.View>

        {/* Gradient rule */}
        <View style={ld.rule} />

        {/* Feature rows */}
        <Animated.View style={{ opacity: fadeAnim }}>
          {FEATURES.map((f, i) => (
            <View
              key={f.label}
              style={[
                ld.featureRow,
                i < FEATURES.length - 1 && ld.featureBorder,
              ]}
            >
              <View style={ld.featureIconWrap}>
                <Text style={ld.featureEmoji}>{f.emoji}</Text>
              </View>
              <View style={ld.featureText}>
                <Text style={ld.featureLabel}>{f.label}</Text>
                <Text style={ld.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[ld.ctaWrap, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={ld.ctaBtn}
            onPress={onContinue}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={ld.ctaBtnText}>Get started →</Text>
          </TouchableOpacity>
          <Text style={ld.legal}>
            Botswana · NBFIRA regulated · Your data stays private
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── WelcomeScreen (loader → landing or auto-skip) ─────────────────────────────

interface Props {
  hydrated: boolean;
  firstLaunch: boolean;
  onContinue: () => void;
}

export function WelcomeScreen({ hydrated, firstLaunch, onContinue }: Props) {
  const [phase, setPhase] = useState<'loader' | 'landing'>('loader');

  const handleLoaderDone = () => {
    if (firstLaunch) {
      setPhase('landing');
    } else {
      onContinue();
    }
  };

  if (phase === 'loader') {
    return <LoaderScreen hydrated={hydrated} onDone={handleLoaderDone} />;
  }
  return <LandingScreen onContinue={onContinue} />;
}

// ─── Loader styles ─────────────────────────────────────────────────────────────

const INK = '#0F1C16';
const FOREST = '#1A3328';
const SAGE = '#2D5C47';
const GOLD = '#C8A96A';
const CREAM = '#F2EFE8';
const MIST = '#7FB3A0';

const ls = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: { marginBottom: 48 },
  progressTrack: {
    width: PROGRESS_BAR_W,
    height: 3,
    backgroundColor: 'rgba(200,169,106,0.18)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: GOLD, borderRadius: 99 },
});

// ─── Landing styles ────────────────────────────────────────────────────────────

const ld = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK },
  scroll: { paddingBottom: spacing.xl * 2 },

  hero: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 28,
    paddingBottom: 32,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(45,92,71,0.45)',
    borderWidth: 1,
    borderColor: SAGE,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GOLD },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: MIST,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },

  logoWrap: { marginBottom: 28 },

  headline: {
    fontSize: 38,
    fontWeight: '400',
    color: CREAM,
    textAlign: 'center',
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  headlineAccent: { color: GOLD, fontStyle: 'italic' },
  sub: {
    fontSize: 15,
    color: 'rgba(242,239,232,0.55)',
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 24,
  },

  rule: {
    height: 1,
    backgroundColor: 'rgba(45,92,71,0.35)',
    marginHorizontal: 0,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  featureBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45,92,71,0.25)',
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: FOREST,
    borderWidth: 1,
    borderColor: 'rgba(45,92,71,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: { fontSize: 20 },
  featureText: { flex: 1 },
  featureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CREAM,
    lineHeight: 20,
  },
  featureSub: {
    fontSize: 12,
    color: 'rgba(242,239,232,0.55)',
    lineHeight: 17,
    marginTop: 2,
  },

  ctaWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: 'center',
    gap: 14,
  },
  ctaBtn: {
    width: '100%',
    paddingVertical: 17,
    backgroundColor: CREAM,
    borderRadius: 99,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    letterSpacing: 0.3,
  },
  legal: {
    fontSize: 11,
    color: 'rgba(127,179,160,0.5)',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});
