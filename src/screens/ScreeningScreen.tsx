import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { ClinicApi } from '../services/api';
import { Clinic, ScreeningStatus, EventType } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

type ScreeningKey = 'bp' | 'glucose' | 'spo2';

interface ScreeningMeta {
  label: string;
  subtitle: string;
  icon: string;
  points: string;
  eventType: EventType;
}

const SCREENING_META: Record<ScreeningKey, ScreeningMeta> = {
  bp: {
    label: 'Blood pressure',
    subtitle: 'Systolic / Diastolic (mmHg)',
    icon: 'heart-pulse',
    points: '25 pts',
    eventType: 'bp_screening',
  },
  glucose: {
    label: 'Blood glucose',
    subtitle: 'Fasting glucose (mmol/L)',
    icon: 'water-opacity',
    points: '25 pts',
    eventType: 'glucose_screening',
  },
  spo2: {
    label: 'Blood oxygen (SpO₂)',
    subtitle: 'Oxygen saturation (%)',
    icon: 'lungs',
    points: '10 pts',
    eventType: 'spo2_reading',
  },
};

// Traffic light classification
function bpClass(sys: string, dia: string): 'normal' | 'warning' | 'critical' | null {
  const s = parseFloat(sys); const d = parseFloat(dia);
  if (isNaN(s) || isNaN(d)) return null;
  if (s >= 180 || d >= 110) return 'critical';
  if (s >= 140 || d >= 90)  return 'warning';
  return 'normal';
}

function glucoseClass(val: string): 'normal' | 'warning' | 'critical' | null {
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  if (v >= 11.1) return 'critical';
  if (v >= 6.1)  return 'warning';
  return 'normal';
}

function spo2Class(val: string): 'normal' | 'warning' | 'critical' | null {
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  if (v < 90)  return 'critical';
  if (v < 95)  return 'warning';
  return 'normal';
}

const CLASS_CONFIG = {
  normal:   { color: '#16A34A', bg: '#F0FDF4', icon: 'check-circle', label: 'Normal range' },
  warning:  { color: '#D97706', bg: '#FFFBEB', icon: 'alert-circle',  label: 'Above normal' },
  critical: { color: '#DC2626', bg: '#FEF2F2', icon: 'alert',         label: 'Seek medical advice' },
};

function TrafficLight({ cls }: { cls: 'normal' | 'warning' | 'critical' }) {
  const cfg = CLASS_CONFIG[cls];
  return (
    <View style={[styles.trafficLight, { backgroundColor: cfg.bg }]}>
      <Icon name={cfg.icon} size={14} color={cfg.color} />
      <Text style={[styles.trafficLightText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export function ScreeningScreen() {
  const memberId = useAuthStore((s) => s.memberId);
  const { profile, logEvent } = useEngagementStore();

  const [activeKey, setActiveKey] = useState<ScreeningKey | null>(null);
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [submitting, setSubmitting] = useState<ScreeningKey | null>(null);
  const [submitted, setSubmitted] = useState<Set<ScreeningKey>>(new Set());

  // BP inputs
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  // Glucose input
  const [glucoseVal, setGlucoseVal] = useState('');
  // SpO2 input
  const [spo2Val, setSpo2Val] = useState('');

  if (!profile) return null;

  const findClinics = async () => {
    setLoadingClinics(true);
    try {
      const results = await ClinicApi.nearby(-24.6282, 25.9231);
      setClinics(results.slice(0, 5));
    } catch {
      setClinics([]);
    } finally {
      setLoadingClinics(false);
    }
  };

  const buildRawValue = (key: ScreeningKey): string | undefined => {
    if (key === 'bp') {
      if (!bpSys || !bpDia) return undefined;
      return JSON.stringify({ result: `${bpSys}/${bpDia}` });
    }
    if (key === 'glucose') {
      if (!glucoseVal) return undefined;
      return JSON.stringify({ result: `${glucoseVal} mmol/L` });
    }
    if (key === 'spo2') {
      if (!spo2Val) return undefined;
      return JSON.stringify({ result: `${spo2Val}%` });
    }
  };

  const logResult = async (key: ScreeningKey) => {
    if (!memberId) return;
    setSubmitting(key);
    try {
      const rawValue = buildRawValue(key);
      await logEvent(memberId, SCREENING_META[key].eventType, profile.chronic_member, rawValue);
      setSubmitted((prev) => new Set(prev).add(key));
      setActiveKey(null);
      // Reset inputs
      if (key === 'bp') { setBpSys(''); setBpDia(''); }
      if (key === 'glucose') setGlucoseVal('');
      if (key === 'spo2') setSpo2Val('');
    } finally {
      setSubmitting(null);
    }
  };

  const statusFor = (key: ScreeningKey): ScreeningStatus => {
    if (submitted.has(key)) return 'pending_confirmation';
    if (key === 'bp') return profile.bp_screening_status;
    if (key === 'glucose') return profile.glucose_screening_status;
    return 'not_logged';
  };

  const renderInputs = (key: ScreeningKey) => {
    if (key === 'bp') {
      const cls = bpClass(bpSys, bpDia);
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Enter your reading</Text>
          <View style={styles.bpRow}>
            <View style={styles.bpField}>
              <Text style={styles.bpFieldLabel}>Systolic</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 120"
                keyboardType="number-pad"
                value={bpSys}
                onChangeText={setBpSys}
                maxLength={3}
                returnKeyType="next"
              />
            </View>
            <Text style={styles.bpSlash}>/</Text>
            <View style={styles.bpField}>
              <Text style={styles.bpFieldLabel}>Diastolic</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 80"
                keyboardType="number-pad"
                value={bpDia}
                onChangeText={setBpDia}
                maxLength={3}
                returnKeyType="done"
              />
            </View>
          </View>
          {cls && <TrafficLight cls={cls} />}
        </View>
      );
    }
    if (key === 'glucose') {
      const cls = glucoseClass(glucoseVal);
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Fasting glucose reading</Text>
          <View style={styles.unitRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="e.g. 5.4"
              keyboardType="decimal-pad"
              value={glucoseVal}
              onChangeText={setGlucoseVal}
              returnKeyType="done"
            />
            <Text style={styles.unit}>mmol/L</Text>
          </View>
          {cls && <TrafficLight cls={cls} />}
          <Text style={styles.rangeNote}>Normal fasting: 3.9–6.0 mmol/L</Text>
        </View>
      );
    }
    if (key === 'spo2') {
      const cls = spo2Class(spo2Val);
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Oxygen saturation reading</Text>
          <View style={styles.unitRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="e.g. 97"
              keyboardType="number-pad"
              value={spo2Val}
              onChangeText={setSpo2Val}
              maxLength={3}
              returnKeyType="done"
            />
            <Text style={styles.unit}>%</Text>
          </View>
          {cls && <TrafficLight cls={cls} />}
          <Text style={styles.rangeNote}>Normal: 95–100%</Text>
        </View>
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Health screening</Text>
        <Text style={styles.subtitle}>
          Free at any partner clinic, or log a recent result yourself.
        </Text>

        {(Object.keys(SCREENING_META) as ScreeningKey[]).map((key) => {
          const meta = SCREENING_META[key];
          const status = statusFor(key);
          const done = status !== 'not_logged';
          const isActive = activeKey === key;
          const isSubmitting = submitting === key;

          return (
            <View key={key} style={[styles.card, isActive && styles.cardActive]}>
              {/* Card header */}
              <TouchableOpacity
                style={styles.cardRow}
                onPress={() => !done && setActiveKey(isActive ? null : key)}
                activeOpacity={done ? 1 : 0.7}
                accessibilityRole="button"
              >
                <View style={[styles.iconCircle, done && styles.iconCircleDone]}>
                  <Icon
                    name={meta.icon}
                    size={18}
                    color={done ? colors.primaryTeal : colors.textSecondary}
                  />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardLabel}>{meta.label}</Text>
                  <Text style={[styles.cardStatus, done && styles.cardStatusDone]}>
                    {done
                      ? status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending confirmation'
                      : `${meta.points} · ${meta.subtitle}`}
                  </Text>
                </View>
                {!done && (
                  <Icon
                    name={isActive ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textTertiary}
                  />
                )}
                {done && status === 'confirmed' && (
                  <Icon name="check-circle" size={20} color={colors.primaryTeal} />
                )}
                {done && status === 'pending_confirmation' && (
                  <Icon name="clock-outline" size={20} color={colors.textTertiary} />
                )}
              </TouchableOpacity>

              {/* Expanded panel */}
              {isActive && !done && (
                <View style={styles.expanded}>
                  {/* Inputs */}
                  {renderInputs(key)}

                  {/* Actions */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                      onPress={() => logResult(key)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? <ActivityIndicator size="small" color={colors.white} />
                        : <>
                            <Icon name="pencil-check" size={16} color={colors.white} />
                            <Text style={styles.submitBtnText}>Save result</Text>
                          </>
                      }
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clinicBtn}
                      onPress={findClinics}
                      disabled={loadingClinics}
                    >
                      {loadingClinics
                        ? <ActivityIndicator size="small" color={colors.primaryTeal} />
                        : <>
                            <Icon name="map-marker-outline" size={16} color={colors.primaryTeal} />
                            <Text style={styles.clinicBtnText}>Find a partner clinic</Text>
                          </>
                      }
                    </TouchableOpacity>
                  </View>

                  {/* Clinic list */}
                  {clinics && clinics.length > 0 && (
                    <View style={styles.clinicList}>
                      {clinics.map((c) => (
                        <View key={c.clinic_id} style={styles.clinicRow}>
                          <Icon name="hospital-building" size={14} color={colors.textTertiary} />
                          <Text style={styles.clinicName}>{c.name}</Text>
                          <Text style={styles.clinicDist}>{c.distance_km.toFixed(1)} km</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {clinics && clinics.length === 0 && (
                    <Text style={styles.noClinics}>No partner clinics found nearby.</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.infoBox}>
          <Icon name="information-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            Self-reported results are marked pending until confirmed by a partner clinic.
            Confirmed screenings earn full points.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg + 2, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs },

  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardActive: { borderColor: colors.primaryTeal, backgroundColor: colors.white },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircleDone: { backgroundColor: colors.lightTealSurface },
  cardText: { flex: 1 },
  cardLabel: { ...typography.h3, color: colors.textPrimary },
  cardStatus: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardStatusDone: { color: colors.primaryTeal },

  expanded: {
    borderTopWidth: 0.5, borderTopColor: colors.border,
    padding: spacing.md, gap: spacing.md,
  },

  inputs: { gap: spacing.sm },
  inputLabel: { ...typography.bodySmall, fontWeight: '500', color: colors.textPrimary },
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  bpField: { flex: 1, gap: 4 },
  bpFieldLabel: { ...typography.caption, color: colors.textSecondary },
  bpSlash: { ...typography.h2, color: colors.textTertiary, paddingBottom: spacing.sm },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputFlex: { flex: 1 },
  unit: { ...typography.bodySmall, color: colors.textSecondary, width: 60 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
    ...typography.body, color: colors.textPrimary,
    backgroundColor: colors.white,
    textAlign: 'center',
  },
  rangeNote: { ...typography.caption, color: colors.textTertiary },
  trafficLight: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    borderRadius: radius.md, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  trafficLightText: { ...typography.caption, fontWeight: '500' },

  actions: { flexDirection: 'row', gap: spacing.sm },
  submitBtn: {
    flex: 1, backgroundColor: colors.primaryTeal,
    borderRadius: radius.md, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { ...typography.bodySmall, fontWeight: '500', color: colors.white },
  clinicBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.primaryTeal,
    borderRadius: radius.md, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2,
    backgroundColor: colors.white,
  },
  clinicBtnText: { ...typography.bodySmall, color: colors.primaryTeal },

  clinicList: { gap: spacing.xs + 2 },
  clinicRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  clinicName: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  clinicDist: { ...typography.caption, color: colors.textTertiary },
  noClinics: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },

  infoBox: {
    flexDirection: 'row', gap: spacing.xs + 2, alignItems: 'flex-start',
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md, padding: spacing.md,
  },
  infoText: { ...typography.caption, color: colors.textTertiary, flex: 1, lineHeight: 17 },
});
