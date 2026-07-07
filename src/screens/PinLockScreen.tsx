// PIN unlock screen (new auth model) — auth migration Phase 3.
// Shown when the session is locked (cold start or background timeout). The PIN
// is verified SERVER-SIDE via /auth/pin/login; the backend owns the lockout
// counters, so a wrong PIN here can't be brute-forced by tampering with the
// client. Biometrics, when enabled, attempt a silent unlock first (convenience
// over the PIN, not a replacement).
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
} from 'react-native';
import { PinAuthApi, ApiError, attemptSilentUnlock } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Mode = 'pin' | 'recover';

export function PinLockScreen() {
  const { memberId, deviceId, biometricEnabled, setPinSession, wipeSession } =
    useAuthStore();
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // recovery state
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [recoverPhone, setRecoverPhone] = useState('');

  // Auto-attempt biometric unlock on mount when enabled.
  useEffect(() => {
    if (biometricEnabled) {
      void attemptSilentUnlock();
    }
  }, [biometricEnabled]);

  const unlock = async () => {
    if (!deviceId) {
      await wipeSession();
      return;
    }
    setError('');
    setLoading(true);
    try {
      const session = await PinAuthApi.pinLogin(deviceId, pin);
      await setPinSession(session);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        (e.message || '').toLowerCase().includes('enroll')
      ) {
        await wipeSession(); // device_revoked — drop to enrollment
        return;
      }
      setError(
        e instanceof ApiError ? e.message : 'Could not unlock. Try again.',
      );
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const sendRecovery = async () => {
    if (!memberId) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Recovery is keyed by phone; the member's number isn't held client-side,
      // so recovery/start is triggered from the enrollment number the member
      // re-enters. Here we reuse the enrolled flow: prompt for the code sent to
      // their number (the backend looked it up from the device's member).
      await PinAuthApi.recoveryStart(recoverPhone);
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send a code.');
    } finally {
      setLoading(false);
    }
  };

  const completeRecovery = async () => {
    if (!deviceId) {
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setError('PIN must be 4-6 digits.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const session = await PinAuthApi.recoveryVerify(
        recoverPhone,
        otp.trim(),
        deviceId,
        newPin,
      );
      await setPinSession(session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That code did not work.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.container}>
        <Text style={s.title}>
          {mode === 'pin' ? 'Enter your PIN' : 'Reset your PIN'}
        </Text>

        {mode === 'pin' ? (
          <>
            <Text style={s.sub}>Welcome back. Enter your PIN to unlock.</Text>
            <TextInput
              style={s.input}
              placeholder="PIN"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              maxLength={6}
              autoFocus
              onSubmitEditing={unlock}
            />
            <Btn
              label="Unlock"
              onPress={unlock}
              loading={loading}
              disabled={pin.length < 4}
            />
            {biometricEnabled ? (
              <TouchableOpacity
                onPress={() => attemptSilentUnlock()}
                style={s.link}
              >
                <Text style={s.linkText}>Use biometrics</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setMode('recover');
                setError('');
              }}
              style={s.link}
            >
              <Text style={s.linkText}>Forgot PIN?</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!otpSent ? (
              <>
                <Text style={s.sub}>
                  Enter your mobile number — we'll send a code to reset your
                  PIN.
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="+267 7X XXX XXX"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  value={recoverPhone}
                  onChangeText={setRecoverPhone}
                  autoFocus
                />
                <Btn
                  label="Send code"
                  onPress={sendRecovery}
                  loading={loading}
                  disabled={recoverPhone.length < 8}
                />
              </>
            ) : (
              <>
                <Text style={s.sub}>Enter the code and choose a new PIN.</Text>
                <TextInput
                  style={s.input}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                />
                <TextInput
                  style={s.input}
                  placeholder="New PIN (4-6 digits)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  secureTextEntry
                  value={newPin}
                  onChangeText={setNewPin}
                  maxLength={6}
                />
                <Btn
                  label="Reset PIN"
                  onPress={completeRecovery}
                  loading={loading}
                  disabled={otp.length < 6 || newPin.length < 4}
                />
              </>
            )}
            <TouchableOpacity
              onPress={() => {
                setMode('pin');
                setError('');
                setOtpSent(false);
              }}
              style={s.link}
            >
              <Text style={s.linkText}>Back to PIN</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Btn({
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
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl },
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
