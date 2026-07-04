import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { AuthApi, ApiError, RegisterPayload } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Step = 'phone' | 'otp' | 'register';

function ToroRaindrop() {
  return (
    <Svg width={160} height={56} viewBox="0 0 160 56">
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

export function LoginScreen() {
  const setSession = useAuthStore(s => s.setSession);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Registration fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPolicy, setRegPolicy] = useState('');
  const [regRenewal, setRegRenewal] = useState('');
  const [regLang, setRegLang] = useState<'en' | 'tn'>('en');
  // Stage 2 — consent. Terms is required by the backend; scheme-sharing is
  // an explicit, revocable opt-in (togglable later in Profile).
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [shareScheme, setShareScheme] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // ── Login flow ──────────────────────────────────────────────────────────────

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
          ? "No account found. Register below if you're a new member."
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
    if (resendCooldown > 0) {
      return;
    }
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

  // ── Registration flow ───────────────────────────────────────────────────────

  const submitRegister = async () => {
    setError(null);
    if (!regName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!regPhone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if (!regPolicy.trim()) {
      setError('Policy number is required.');
      return;
    }
    if (!regRenewal.trim()) {
      setError('Renewal date is required (YYYY-MM-DD).');
      return;
    }
    if (!acceptTerms) {
      setError('You must accept the Terms & data processing to register.');
      return;
    }

    setLoading(true);
    try {
      const payload: RegisterPayload = {
        phone_number: regPhone.trim(),
        full_name: regName.trim(),
        policy_number: regPolicy.trim(),
        renewal_date: regRenewal.trim(),
        preferred_language: regLang,
        consent_terms: true,
        consent_scheme_sharing: shareScheme,
        consent_channel: 'app',
      };
      await AuthApi.register(payload);
      // Backend sends OTP automatically after registration — go straight to verify
      setPhone(regPhone.trim());
      setOtp('');
      setStep('otp');
      setResendCooldown(60);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'An account already exists for this number. Sign in instead.'
          : e instanceof ApiError
          ? e.message
          : 'Registration failed. Check your details and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const goRegister = () => {
    setError(null);
    setStep('register');
  };
  const goLogin = () => {
    setError(null);
    setStep('phone');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.screen}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={s.logoArea}>
          <ToroRaindrop />
          <Text style={s.tagline}>Your health, rewarded.</Text>
        </View>

        {/* ── Phone step ── */}
        {step === 'phone' && (
          <View style={s.form}>
            <Text style={s.label}>Mobile number</Text>
            <TextInput
              style={s.input}
              placeholder="+267 7X XXX XXX"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={requestOtp}
            />
            <Text style={s.hint}>
              Enter your Botswana number in +267 format
            </Text>

            <TouchableOpacity
              style={[s.button, (!phone || loading) && s.buttonDisabled]}
              onPress={requestOtp}
              disabled={!phone || loading}
              accessibilityRole="button"
              accessibilityLabel="Send verification code"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.buttonText}>Send code</Text>
              )}
            </TouchableOpacity>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>New member?</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity
              style={s.outlineButton}
              onPress={goRegister}
              accessibilityRole="button"
            >
              <Text style={s.outlineButtonText}>Register</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── OTP step ── */}
        {step === 'otp' && (
          <View style={s.form}>
            <Text style={s.label}>Verification code</Text>
            <Text style={s.sentTo}>Code sent to {phone}</Text>
            <TextInput
              style={[s.input, s.otpInput]}
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
              style={[s.button, (!otp || loading) && s.buttonDisabled]}
              onPress={verifyOtp}
              disabled={!otp || loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={s.secondaryActions}>
              <TouchableOpacity
                onPress={resendOtp}
                disabled={resendCooldown > 0 || loading}
                accessibilityRole="button"
              >
                <Text style={[s.link, resendCooldown > 0 && s.linkDisabled]}>
                  {resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : 'Resend code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep('phone');
                  setError(null);
                  setOtp('');
                }}
                accessibilityRole="button"
              >
                <Text style={s.link}>Use a different number</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Register step ── */}
        {step === 'register' && (
          <View style={s.form}>
            <Text style={s.formTitle}>Create your account</Text>

            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Lesedi Mokobi"
              placeholderTextColor={colors.textTertiary}
              value={regName}
              onChangeText={setRegName}
              autoFocus
              returnKeyType="next"
              autoCapitalize="words"
            />

            <Text style={s.label}>Mobile number</Text>
            <TextInput
              style={s.input}
              placeholder="+267 7X XXX XXX"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              value={regPhone}
              onChangeText={setRegPhone}
              returnKeyType="next"
            />
            <Text style={s.hint}>Botswana number in +267 format</Text>

            <Text style={s.label}>Policy number</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. TW-2024-00123"
              placeholderTextColor={colors.textTertiary}
              value={regPolicy}
              onChangeText={setRegPolicy}
              returnKeyType="next"
              autoCapitalize="characters"
            />

            <Text style={s.label}>Policy renewal date</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              value={regRenewal}
              onChangeText={setRegRenewal}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              maxLength={10}
            />

            <Text style={s.label}>Preferred language</Text>
            <View style={s.langRow}>
              <TouchableOpacity
                style={[s.langBtn, regLang === 'en' && s.langBtnActive]}
                onPress={() => setRegLang('en')}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    s.langBtnText,
                    regLang === 'en' && s.langBtnTextActive,
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.langBtn, regLang === 'tn' && s.langBtnActive]}
                onPress={() => setRegLang('tn')}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    s.langBtnText,
                    regLang === 'tn' && s.langBtnTextActive,
                  ]}
                >
                  Setswana
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.consentRow}
              onPress={() => setAcceptTerms(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptTerms }}
              accessibilityLabel="Accept terms and data processing consent"
            >
              <View style={[s.checkbox, acceptTerms && s.checkboxChecked]}>
                {acceptTerms && <Text style={s.checkMark}>✓</Text>}
              </View>
              <Text style={s.consentText}>
                I accept the Terms and consent to Toro processing my health data
                (DPA 2024).
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.consentRowLast}
              onPress={() => setShareScheme(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: shareScheme }}
              accessibilityLabel="Share verified score with medical scheme"
            >
              <View style={[s.checkbox, shareScheme && s.checkboxChecked]}>
                {shareScheme && <Text style={s.checkMark}>✓</Text>}
              </View>
              <Text style={s.consentTextMuted}>
                Optional: share my verified score with my medical scheme to earn
                discounts. I can turn this off anytime.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.button, loading && s.buttonDisabled]}
              onPress={submitRegister}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.buttonText}>Create account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goLogin}
              style={s.backLink}
              accessibilityRole="button"
            >
              <Text style={s.link}>Already registered? Sign in</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠ {error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.toroInk },
  screen: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.lg,
  },

  logoArea: { alignItems: 'center', marginBottom: spacing.md },
  tagline: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  form: { gap: spacing.sm },
  formTitle: {
    ...typography.h2,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  sentTo: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.55)',
    marginTop: -spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.45)',
    marginTop: -spacing.xs + 2,
  },

  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
    ...typography.body,
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  otpInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },

  button: {
    backgroundColor: colors.primaryTealDark,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
    elevation: 4,
    shadowColor: colors.primaryTeal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...typography.body, fontWeight: '600', color: colors.white },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: 10,
  },
  consentRowLast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primaryTeal,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: { backgroundColor: colors.primaryTeal },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  consentText: { flex: 1, color: colors.toroInk, fontSize: 13, lineHeight: 18 },
  consentTextMuted: {
    flex: 1,
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 18,
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  outlineButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryTeal,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { ...typography.caption, color: 'rgba(255,255,255,0.35)' },

  langRow: { flexDirection: 'row', gap: spacing.sm },
  langBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  langBtnActive: {
    borderColor: colors.primaryTeal,
    backgroundColor: 'rgba(13,158,143,0.15)',
  },
  langBtnText: { ...typography.bodySmall, color: 'rgba(255,255,255,0.5)' },
  langBtnTextActive: { color: colors.primaryTeal, fontWeight: '600' as const },

  secondaryActions: { gap: spacing.sm, marginTop: spacing.sm },
  backLink: { marginTop: spacing.xs, alignItems: 'center' },
  link: {
    ...typography.bodySmall,
    color: colors.primaryTeal,
    textAlign: 'center',
  },
  linkDisabled: { color: colors.textTertiary },

  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerText,
  },
  errorText: { ...typography.bodySmall, color: colors.dangerText },
});
