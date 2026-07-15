// Device enrollment (new auth model) — the only member auth path post
// auth-teardown. Two entry funnels converge on the same OTP → PIN steps:
//   - existing member: phone → OTP → PIN
//   - new member:      register (name/policy/renewal/phone) → OTP → PIN
//     (registration itself requests the enroll-purpose OTP server-side)
import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { PinAuthApi, ApiError } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Step = 'phone' | 'register' | 'otp' | 'pin';

export function EnrollmentScreen() {
  const setPinSession = useAuthStore(s => s.setPinSession);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [ticket, setTicket] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Registration-only fields.
  const [fullName, setFullName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const normalizedPhone = () => {
    const p = phone.replace(/\s/g, '');
    return p.startsWith('+') ? p : `+267${p.replace(/^267/, '')}`;
  };

  const startEnroll = async () => {
    setError('');
    setLoading(true);
    try {
      await PinAuthApi.enrollStart(normalizedPhone());
      setStep('otp');
    } catch (e) {
      // Unregistered number: route straight into registration instead of a
      // dead end (backend answers not_registered explicitly since 2026-07-15;
      // previously it silently returned ok and members waited for an SMS
      // that never came).
      if (e instanceof ApiError && e.body?.not_registered === true) {
        setError(
          'This number is not registered yet — set up your account below.',
        );
        setStep('register');
        return;
      }
      setError(
        e instanceof ApiError ? e.message : 'Could not send a code. Try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    if (!fullName.trim() || !policyNumber.trim() || !renewalDate.trim()) {
      setError('Full name, policy number and renewal date are required.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms & Privacy Policy to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await PinAuthApi.register({
        phone_number: normalizedPhone(),
        full_name: fullName.trim(),
        policy_number: policyNumber.trim(),
        renewal_date: renewalDate.trim(),
        consent_terms: true,
        consent_channel: 'app',
      });
      setStep('otp'); // registration itself requested the enroll OTP
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Could not register. Try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const { enrollment_ticket } = await PinAuthApi.enrollVerify(
        normalizedPhone(),
        otp.trim(),
      );
      setTicket(enrollment_ticket);
      setStep('pin');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That code did not work.');
    } finally {
      setLoading(false);
    }
  };

  const completeEnroll = async () => {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits.');
      return;
    }
    if (pin !== pin2) {
      setError('The two PINs do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const session = await PinAuthApi.enrollComplete(
        ticket,
        pin,
        `${Platform.OS} device`,
      );
      await setPinSession(session);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not finish setup. Try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>Set up this device</Text>

        {step === 'phone' && (
          <>
            <Text style={s.sub}>
              Enter your mobile number to receive a one-time code.
            </Text>
            <TextInput
              style={s.input}
              placeholder="+267 7X XXX XXX"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
            <PrimaryButton
              label="Send code"
              onPress={startEnroll}
              loading={loading}
              disabled={phone.length < 8}
            />
            <TouchableOpacity
              style={s.link}
              onPress={() => {
                setError('');
                setStep('register');
              }}
            >
              <Text style={s.linkText}>New here? Register</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'register' && (
          <>
            <Text style={s.sub}>
              Create your account. We'll send a code to your number to confirm
              it's you.
            </Text>
            <TextInput
              style={s.input}
              placeholder="Full name"
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoFocus
            />
            <TextInput
              style={s.input}
              placeholder="Policy number"
              placeholderTextColor={colors.textSecondary}
              value={policyNumber}
              onChangeText={setPolicyNumber}
            />
            <TextInput
              style={s.input}
              placeholder="Renewal date (YYYY-MM-DD)"
              placeholderTextColor={colors.textSecondary}
              value={renewalDate}
              onChangeText={setRenewalDate}
            />
            <TextInput
              style={s.input}
              placeholder="+267 7X XXX XXX"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TouchableOpacity
              style={s.checkboxRow}
              onPress={() => setAgreedToTerms(a => !a)}
            >
              <Text style={s.checkbox}>{agreedToTerms ? '☑' : '☐'}</Text>
              <Text style={s.checkboxLabel}>
                I agree to the Terms & Privacy Policy
              </Text>
            </TouchableOpacity>
            <PrimaryButton
              label="Register"
              onPress={submitRegister}
              loading={loading}
              disabled={
                !fullName || !policyNumber || !renewalDate || phone.length < 8
              }
            />
            <TouchableOpacity
              style={s.link}
              onPress={() => {
                setError('');
                setStep('phone');
              }}
            >
              <Text style={s.linkText}>Already a member? Sign in</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={s.sub}>
              Enter the 6-digit code we sent to {normalizedPhone()}.
            </Text>
            <TextInput
              style={s.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              autoFocus
            />
            <PrimaryButton
              label="Verify"
              onPress={verifyOtp}
              loading={loading}
              disabled={otp.length < 6}
            />
          </>
        )}

        {step === 'pin' && (
          <>
            <Text style={s.sub}>
              Create a PIN. You'll use it to unlock the app — no more SMS codes
              at every login.
            </Text>
            <TextInput
              style={s.input}
              placeholder="New PIN (4-6 digits)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              maxLength={6}
              autoFocus
            />
            <TextInput
              style={s.input}
              placeholder="Confirm PIN"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              value={pin2}
              onChangeText={setPin2}
              maxLength={6}
            />
            <PrimaryButton
              label="Finish setup"
              onPress={completeEnroll}
              loading={loading}
              disabled={pin.length < 4 || pin2.length < 4}
            />
          </>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.btn, (disabled || loading) && s.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={s.btnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.screenBg },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 21,
  },
  input: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkbox: {
    fontSize: 18,
    color: colors.primaryTeal,
    marginRight: spacing.sm,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  btn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...typography.body, color: colors.white, fontWeight: '700' },
  link: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: {
    ...typography.body,
    color: colors.primaryTeal,
    fontWeight: '600',
  },
  error: {
    color: colors.dangerText,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
