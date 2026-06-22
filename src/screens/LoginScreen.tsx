import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { AuthApi, ApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Step = 'phone' | 'otp';

export function LoginScreen() {
  const setSession = useAuthStore((s) => s.setSession);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const requestOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      await AuthApi.requestOtp({ phone_number: phone });
      setStep('otp');
      setResendCooldown(60);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'No account found for this number. Please register first.'
          : e instanceof ApiError
          ? e.message
          : 'Could not send code. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const tokens = await AuthApi.verifyOtp({ phone_number: phone, otp });
      await setSession(tokens);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Incorrect code. Check the SMS and try again.'
          : e instanceof ApiError && e.status === 410
          ? 'This code has expired. Request a new one below.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setOtp('');
    setLoading(true);
    try {
      await AuthApi.requestOtp({ phone_number: phone });
      setResendCooldown(60);
    } catch {
      setError('Could not resend code. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <Text style={styles.logo}>🌿</Text>
          <Text style={styles.title}>Wellness+</Text>
          <Text style={styles.tagline}>Your health, rewarded.</Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              placeholder="+267 7X XXX XXX"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={requestOtp}
            />
            <Text style={styles.hint}>Enter your Botswana number in +267 format</Text>

            <TouchableOpacity
              style={[styles.button, (!phone || loading) && styles.buttonDisabled]}
              onPress={requestOtp}
              disabled={!phone || loading}
              accessibilityRole="button"
              accessibilityLabel="Send verification code"
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.buttonText}>Send code</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Verification code</Text>
            <Text style={styles.sentTo}>Code sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="_ _ _ _ _ _"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={verifyOtp}
            />

            <TouchableOpacity
              style={[styles.button, (!otp || loading) && styles.buttonDisabled]}
              onPress={verifyOtp}
              disabled={!otp || loading}
              accessibilityRole="button"
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.buttonText}>Verify</Text>
              }
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                onPress={resendOtp}
                disabled={resendCooldown > 0 || loading}
                accessibilityRole="button"
              >
                <Text style={[styles.link, resendCooldown > 0 && styles.linkDisabled]}>
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStep('phone'); setError(null); setOtp(''); }}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Use a different number</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  screen: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },

  logoArea: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { fontSize: 40, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.pulaCardBg, fontSize: 28 },
  tagline: { ...typography.bodySmall, color: colors.textTertiary, marginTop: 2 },

  form: { gap: spacing.sm },
  label: { ...typography.bodySmall, fontWeight: '500', color: colors.textPrimary },
  sentTo: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.xs },
  hint: { ...typography.caption, color: colors.textTertiary, marginTop: -spacing.xs + 2 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceNeutral,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },

  button: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...typography.body, fontWeight: '500', color: colors.white },

  secondaryActions: { gap: spacing.sm, marginTop: spacing.sm },
  link: { ...typography.bodySmall, color: colors.primaryTeal, textAlign: 'center' },
  linkDisabled: { color: colors.textTertiary },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { ...typography.bodySmall, color: '#DC2626' },
});
