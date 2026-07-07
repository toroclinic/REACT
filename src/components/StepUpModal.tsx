// Step-up verification modal — auth teardown Phase 1. Server-side step-up is
// now unconditional (>P250 pay-clinic, first-payment-from-device, phone
// change), so every client needs to handle its 403 { step_up_required } the
// same minimal way: request an OTP, verify it, then let the caller retry the
// original action. One reusable component for every call site rather than
// duplicating this per screen. Deliberately plain — no redesign, just the
// three states the contract requires: prompt, wrong code, and (if the caller
// retries and still gets step_up_required — e.g. the grant expired between
// verify and retry) the same prompt reopens and sends a fresh code.
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PinAuthApi, ApiError, StepUpPurpose } from '../services/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

const PURPOSE_COPY: Record<StepUpPurpose, string> = {
  wallet_pay: "For your security, we've sent a code to confirm this payment.",
  phone_change: "For your security, we've sent a code to confirm this change.",
};

interface Props {
  visible: boolean;
  purpose: StepUpPurpose;
  onClose: () => void;
  onVerified: () => void; // caller retries the original action after this fires
}

export function StepUpModal({ visible, purpose, onClose, onVerified }: Props) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      setOtp('');
      setError('');
      return;
    }
    setSending(true);
    setError('');
    PinAuthApi.stepUpRequest(purpose)
      .catch(() => setError('Could not send a code. Try again.'))
      .finally(() => setSending(false));
  }, [visible, purpose]);

  const verify = async () => {
    if (!otp.trim() || verifying) {
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await PinAuthApi.stepUpVerify(purpose, otp.trim());
      setOtp('');
      onVerified();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That code did not work.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Verify to continue</Text>
          <Text style={s.sub}>{PURPOSE_COPY[purpose]}</Text>

          {sending ? (
            <ActivityIndicator
              color={colors.primaryTeal}
              style={{ marginVertical: spacing.md }}
            />
          ) : (
            <TextInput
              style={s.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, (verifying || otp.length < 4) && s.btnDisabled]}
            onPress={verify}
            disabled={verifying || otp.length < 4}
          >
            {verifying ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.btnText}>Confirm</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
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
  error: { color: colors.dangerText, marginBottom: spacing.md, fontSize: 13 },
  btn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...typography.body, color: colors.white, fontWeight: '700' },
  cancelBtn: { marginTop: spacing.md, alignItems: 'center' },
  cancelText: { ...typography.body, color: colors.textSecondary },
});
