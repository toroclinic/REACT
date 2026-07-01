import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { ClinicApi, PricingApi } from '../services/api';
import {
  Clinic,
  ScreeningHistoryEntry,
  ScreeningStatus,
  EventType,
} from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

type ScreeningKey =
  | 'bp'
  | 'glucose'
  | 'spo2'
  | 'cholesterol'
  | 'bmi'
  | 'eye'
  | 'dental';
type ScreenTab = 'tests' | 'history';

interface ScreeningMeta {
  label: string;
  subtitle: string;
  icon: string;
  points: string | null;
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
  cholesterol: {
    label: 'Cholesterol',
    subtitle: 'Total · HDL · LDL (mmol/L)',
    icon: 'molecule',
    points: null,
    eventType: 'cholesterol_screening',
  },
  bmi: {
    label: 'BMI check',
    subtitle: 'Weight & height measurement',
    icon: 'scale-bathroom',
    points: null,
    eventType: 'bmi_check',
  },
  eye: {
    label: 'Eye screening',
    subtitle: 'Visual acuity – right & left',
    icon: 'eye-outline',
    points: null,
    eventType: 'eye_screening',
  },
  dental: {
    label: 'Dental check',
    subtitle: 'Oral health examination',
    icon: 'tooth-outline',
    points: null,
    eventType: 'dental_check',
  },
};

// ─── Classification ───────────────────────────────────────────────────

function bpClass(
  sys: string,
  dia: string,
): 'normal' | 'warning' | 'critical' | null {
  const s = parseFloat(sys);
  const d = parseFloat(dia);
  if (isNaN(s) || isNaN(d)) {
    return null;
  }
  if (s >= 180 || d >= 110) {
    return 'critical';
  }
  if (s >= 140 || d >= 90) {
    return 'warning';
  }
  return 'normal';
}
function glucoseClass(v: string): 'normal' | 'warning' | 'critical' | null {
  const n = parseFloat(v);
  if (isNaN(n)) {
    return null;
  }
  if (n >= 11.1) {
    return 'critical';
  }
  if (n >= 6.1) {
    return 'warning';
  }
  return 'normal';
}
function spo2Class(v: string): 'normal' | 'warning' | 'critical' | null {
  const n = parseFloat(v);
  if (isNaN(n)) {
    return null;
  }
  if (n < 90) {
    return 'critical';
  }
  if (n < 95) {
    return 'warning';
  }
  return 'normal';
}
function cholesterolClass(
  total: string,
): 'normal' | 'warning' | 'critical' | null {
  const n = parseFloat(total);
  if (isNaN(n)) {
    return null;
  }
  if (n >= 6.2) {
    return 'critical';
  }
  if (n >= 5.2) {
    return 'warning';
  }
  return 'normal';
}
function bmiClass(
  weight: string,
  height: string,
): 'normal' | 'warning' | 'critical' | null {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (isNaN(w) || isNaN(h) || h === 0) {
    return null;
  }
  const bmi = w / (h * h);
  if (bmi >= 30 || bmi < 17) {
    return 'critical';
  }
  if (bmi >= 25 || bmi < 18.5) {
    return 'warning';
  }
  return 'normal';
}

const CLASS_CONFIG = {
  normal: {
    color: colors.successText,
    bg: colors.successBg,
    icon: 'check-circle',
    label: 'Normal range',
  },
  warning: {
    color: colors.warningText,
    bg: colors.warningBg,
    icon: 'alert-circle',
    label: 'Above normal',
  },
  critical: {
    color: colors.dangerText,
    bg: colors.dangerBg,
    icon: 'alert',
    label: 'Seek medical advice',
  },
};

function TrafficLight({ cls }: { cls: 'normal' | 'warning' | 'critical' }) {
  const cfg = CLASS_CONFIG[cls];
  return (
    <View style={[styles.trafficLight, { backgroundColor: cfg.bg }]}>
      <Icon name={cfg.icon} size={14} color={cfg.color} />
      <Text style={[styles.trafficLightText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

// ─── History helpers ──────────────────────────────────────────────────

const EVENT_LABELS: Partial<Record<EventType, string>> = {
  bp_screening: 'Blood pressure',
  glucose_screening: 'Blood glucose',
  spo2_reading: 'SpO₂',
  cholesterol_screening: 'Cholesterol',
  bmi_check: 'BMI check',
  eye_screening: 'Eye screening',
  dental_check: 'Dental check',
};

function fmtHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtResult(result: string | null): string {
  if (!result) {
    return '';
  }
  try {
    const p = JSON.parse(result);
    if (p.result) {
      return p.result;
    }
    if (p.total) {
      const parts = [`Total ${p.total}`];
      if (p.hdl) {
        parts.push(`HDL ${p.hdl}`);
      }
      if (p.ldl) {
        parts.push(`LDL ${p.ldl}`);
      }
      return parts.join(' · ') + ' mmol/L';
    }
    if (p.bmi) {
      return `${p.weight}kg · ${p.height}cm · BMI ${p.bmi}`;
    }
    if (p.right !== undefined) {
      return `R: ${p.right}  L: ${p.left}`;
    }
    if (p.notes) {
      return p.notes;
    }
  } catch {
    /* not JSON */
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────

export function ScreeningScreen() {
  const memberId = useAuthStore(s => s.memberId);
  const { profile, logEvent } = useEngagementStore();

  const [tab, setTab] = useState<ScreenTab>('tests');
  const [activeKey, setActiveKey] = useState<ScreeningKey | null>(null);
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [submitting, setSubmitting] = useState<ScreeningKey | null>(null);
  const [submitted, setSubmitted] = useState<Set<ScreeningKey>>(new Set());

  const [history, setHistory] = useState<ScreeningHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // BP
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  // Glucose
  const [glucoseVal, setGlucoseVal] = useState('');
  // SpO2
  const [spo2Val, setSpo2Val] = useState('');
  // Cholesterol
  const [cholTotal, setCholTotal] = useState('');
  const [cholHdl, setCholHdl] = useState('');
  const [cholLdl, setCholLdl] = useState('');
  // BMI
  const [bmiWeight, setBmiWeight] = useState('');
  const [bmiHeight, setBmiHeight] = useState('');
  // Eye
  const [eyeRight, setEyeRight] = useState('');
  const [eyeLeft, setEyeLeft] = useState('');
  // Dental
  const [dentalNotes, setDentalNotes] = useState('');

  const loadHistory = useCallback(async () => {
    if (!memberId || historyLoaded) {
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await PricingApi.getScreeningHistory(memberId);
      setHistory(data);
      setHistoryLoaded(true);
    } catch {
      /* silently fail */
    } finally {
      setLoadingHistory(false);
    }
  }, [memberId, historyLoaded]);

  // Stable ref — setLoadingClinics/setClinics are stable useState dispatchers
  const findClinics = useCallback(async () => {
    setLoadingClinics(true);
    try {
      const results = await ClinicApi.nearby(-24.6282, 25.9231);
      setClinics(results.slice(0, 5));
    } catch {
      setClinics([]);
    } finally {
      setLoadingClinics(false);
    }
  }, []);

  if (!profile) {
    return null;
  }

  const handleTabChange = (t: ScreenTab) => {
    setTab(t);
    if (t === 'history') {
      void loadHistory();
    }
  };

  const buildRawValue = (key: ScreeningKey): string | undefined => {
    if (key === 'bp') {
      if (!bpSys || !bpDia) {
        return undefined;
      }
      return JSON.stringify({ result: `${bpSys}/${bpDia}` });
    }
    if (key === 'glucose') {
      if (!glucoseVal) {
        return undefined;
      }
      return JSON.stringify({ result: `${glucoseVal} mmol/L` });
    }
    if (key === 'spo2') {
      if (!spo2Val) {
        return undefined;
      }
      return JSON.stringify({ result: `${spo2Val}%` });
    }
    if (key === 'cholesterol') {
      if (!cholTotal) {
        return undefined;
      }
      const p: Record<string, string> = { total: cholTotal };
      if (cholHdl) {
        p.hdl = cholHdl;
      }
      if (cholLdl) {
        p.ldl = cholLdl;
      }
      return JSON.stringify(p);
    }
    if (key === 'bmi') {
      if (!bmiWeight || !bmiHeight) {
        return undefined;
      }
      const w = parseFloat(bmiWeight);
      const h = parseFloat(bmiHeight) / 100;
      const bmi = h > 0 ? (w / (h * h)).toFixed(1) : '?';
      return JSON.stringify({ weight: bmiWeight, height: bmiHeight, bmi });
    }
    if (key === 'eye') {
      if (!eyeRight && !eyeLeft) {
        return undefined;
      }
      return JSON.stringify({ right: eyeRight || '?', left: eyeLeft || '?' });
    }
    if (key === 'dental') {
      if (!dentalNotes) {
        return undefined;
      }
      return JSON.stringify({ notes: dentalNotes });
    }
  };

  const canSubmit = (key: ScreeningKey): boolean => {
    if (key === 'bp') {
      return !!(bpSys && bpDia);
    }
    if (key === 'glucose') {
      return !!glucoseVal;
    }
    if (key === 'spo2') {
      return !!spo2Val;
    }
    if (key === 'cholesterol') {
      return !!cholTotal;
    }
    if (key === 'bmi') {
      return !!(bmiWeight && bmiHeight);
    }
    if (key === 'eye') {
      return !!(eyeRight || eyeLeft);
    }
    if (key === 'dental') {
      return !!dentalNotes;
    }
    return false;
  };

  const logResult = async (key: ScreeningKey) => {
    if (!memberId) {
      return;
    }
    setSubmitting(key);
    try {
      await logEvent(
        memberId,
        SCREENING_META[key].eventType,
        profile.chronic_member,
        buildRawValue(key),
      );
      setSubmitted(prev => new Set(prev).add(key));
      setActiveKey(null);
      if (key === 'bp') {
        setBpSys('');
        setBpDia('');
      }
      if (key === 'glucose') {
        setGlucoseVal('');
      }
      if (key === 'spo2') {
        setSpo2Val('');
      }
      if (key === 'cholesterol') {
        setCholTotal('');
        setCholHdl('');
        setCholLdl('');
      }
      if (key === 'bmi') {
        setBmiWeight('');
        setBmiHeight('');
      }
      if (key === 'eye') {
        setEyeRight('');
        setEyeLeft('');
      }
      if (key === 'dental') {
        setDentalNotes('');
      }
    } finally {
      setSubmitting(null);
    }
  };

  const statusFor = (key: ScreeningKey): ScreeningStatus => {
    if (submitted.has(key)) {
      return 'pending_confirmation';
    }
    if (key === 'bp') {
      return profile.bp_screening_status;
    }
    if (key === 'glucose') {
      return profile.glucose_screening_status;
    }
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
    if (key === 'cholesterol') {
      const cls = cholesterolClass(cholTotal);
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Cholesterol panel (mmol/L)</Text>
          <View style={styles.row3}>
            <View style={styles.field3}>
              <Text style={styles.bpFieldLabel}>Total *</Text>
              <TextInput
                style={styles.input}
                placeholder="4.2"
                keyboardType="decimal-pad"
                value={cholTotal}
                onChangeText={setCholTotal}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field3}>
              <Text style={styles.bpFieldLabel}>HDL</Text>
              <TextInput
                style={styles.input}
                placeholder="1.2"
                keyboardType="decimal-pad"
                value={cholHdl}
                onChangeText={setCholHdl}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field3}>
              <Text style={styles.bpFieldLabel}>LDL</Text>
              <TextInput
                style={styles.input}
                placeholder="2.5"
                keyboardType="decimal-pad"
                value={cholLdl}
                onChangeText={setCholLdl}
                returnKeyType="done"
              />
            </View>
          </View>
          {cls && <TrafficLight cls={cls} />}
          <Text style={styles.rangeNote}>Normal total: &lt; 5.2 mmol/L</Text>
        </View>
      );
    }
    if (key === 'bmi') {
      const cls = bmiClass(bmiWeight, bmiHeight);
      const bmiVal =
        bmiWeight && bmiHeight
          ? (
              parseFloat(bmiWeight) / Math.pow(parseFloat(bmiHeight) / 100, 2)
            ).toFixed(1)
          : null;
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Weight & height</Text>
          <View style={styles.bpRow}>
            <View style={styles.bpField}>
              <Text style={styles.bpFieldLabel}>Weight</Text>
              <View style={styles.unitRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="70"
                  keyboardType="decimal-pad"
                  value={bmiWeight}
                  onChangeText={setBmiWeight}
                  returnKeyType="next"
                />
                <Text style={styles.unitSm}>kg</Text>
              </View>
            </View>
            <View style={styles.bpField}>
              <Text style={styles.bpFieldLabel}>Height</Text>
              <View style={styles.unitRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="170"
                  keyboardType="number-pad"
                  value={bmiHeight}
                  onChangeText={setBmiHeight}
                  returnKeyType="done"
                />
                <Text style={styles.unitSm}>cm</Text>
              </View>
            </View>
          </View>
          {bmiVal && !isNaN(parseFloat(bmiVal)) && (
            <View style={styles.bmiResult}>
              <Text style={styles.bmiLabel}>BMI:</Text>
              <Text style={styles.bmiValue}>{bmiVal}</Text>
            </View>
          )}
          {cls && <TrafficLight cls={cls} />}
          <Text style={styles.rangeNote}>Normal BMI: 18.5–24.9</Text>
        </View>
      );
    }
    if (key === 'eye') {
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Visual acuity</Text>
          <View style={styles.bpRow}>
            <View style={styles.bpField}>
              <Text style={styles.bpFieldLabel}>Right eye</Text>
              <TextInput
                style={styles.input}
                placeholder="6/6"
                value={eyeRight}
                onChangeText={setEyeRight}
                returnKeyType="next"
              />
            </View>
            <View style={styles.bpField}>
              <Text style={styles.bpFieldLabel}>Left eye</Text>
              <TextInput
                style={styles.input}
                placeholder="6/6"
                value={eyeLeft}
                onChangeText={setEyeLeft}
                returnKeyType="done"
              />
            </View>
          </View>
          <Text style={styles.rangeNote}>
            e.g. 6/6 = normal, 6/12 = reduced vision
          </Text>
        </View>
      );
    }
    if (key === 'dental') {
      return (
        <View style={styles.inputs}>
          <Text style={styles.inputLabel}>Dental examination findings</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="e.g. No cavities found. Gums healthy."
            value={dentalNotes}
            onChangeText={setDentalNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            returnKeyType="done"
          />
        </View>
      );
    }
    return null;
  };

  const renderHistoryItem = ({ item }: { item: ScreeningHistoryEntry }) => {
    const confirmed = item.status === 'confirmed';
    return (
      <View style={styles.historyRow}>
        <View style={styles.historyLeft}>
          <Text style={styles.historyType}>
            {EVENT_LABELS[item.event_type] ?? item.event_type}
          </Text>
          {!!item.result && (
            <Text style={styles.historyResult}>{fmtResult(item.result)}</Text>
          )}
          {!!item.clinic_name && (
            <Text style={styles.historyClinic}>At {item.clinic_name}</Text>
          )}
        </View>
        <View style={styles.historyRight}>
          <Text style={styles.historyDate}>
            {fmtHistoryDate(item.logged_at)}
          </Text>
          <View
            style={[
              styles.histBadge,
              confirmed ? styles.histBadgeConfirmed : styles.histBadgePending,
            ]}
          >
            <Text
              style={[
                styles.histBadgeText,
                confirmed
                  ? styles.histBadgeTextConfirmed
                  : styles.histBadgeTextPending,
              ]}
            >
              {confirmed ? 'Confirmed' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Tab selector */}
      <View style={styles.tabStrip}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'tests' && styles.tabBtnActive]}
          onPress={() => handleTabChange('tests')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'tests' && styles.tabBtnTextActive,
            ]}
          >
            Tests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          onPress={() => handleTabChange('history')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'history' && styles.tabBtnTextActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'tests' ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Health screening</Text>
          <Text style={styles.subtitle}>
            Free at any partner clinic, or log a recent result yourself.
          </Text>

          {(Object.keys(SCREENING_META) as ScreeningKey[]).map(key => {
            const meta = SCREENING_META[key];
            const status = statusFor(key);
            const done = status !== 'not_logged';
            const isActive = activeKey === key;
            const isSubmitting = submitting === key;
            const ready = canSubmit(key);

            return (
              <View
                key={key}
                style={[styles.card, isActive && styles.cardActive]}
              >
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() => !done && setActiveKey(isActive ? null : key)}
                  activeOpacity={done ? 1 : 0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${meta.label}${
                    done ? ', completed' : ''
                  }`}
                  accessibilityHint={
                    done
                      ? undefined
                      : isActive
                      ? 'Tap to collapse'
                      : 'Tap to expand and log reading'
                  }
                  accessibilityState={{ expanded: isActive }}
                >
                  <View
                    style={[styles.iconCircle, done && styles.iconCircleDone]}
                  >
                    <Icon
                      name={meta.icon}
                      size={18}
                      color={done ? colors.primaryTeal : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardLabel}>{meta.label}</Text>
                    <Text
                      style={[styles.cardStatus, done && styles.cardStatusDone]}
                    >
                      {done
                        ? status === 'confirmed'
                          ? '✓ Confirmed'
                          : '⏳ Pending confirmation'
                        : meta.points
                        ? `${meta.points} · ${meta.subtitle}`
                        : meta.subtitle}
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
                    <Icon
                      name="check-circle"
                      size={20}
                      color={colors.primaryTeal}
                    />
                  )}
                  {done && status !== 'confirmed' && (
                    <Icon
                      name="clock-outline"
                      size={20}
                      color={colors.textTertiary}
                    />
                  )}
                </TouchableOpacity>

                {isActive && !done && (
                  <View style={styles.expanded}>
                    {renderInputs(key)}
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[
                          styles.submitBtn,
                          (!ready || isSubmitting) && styles.submitBtnDisabled,
                        ]}
                        onPress={() => void logResult(key)}
                        disabled={!ready || isSubmitting}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isSubmitting ? 'Saving reading' : 'Save reading'
                        }
                        accessibilityState={{
                          disabled: !ready || isSubmitting,
                          busy: isSubmitting,
                        }}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.white}
                          />
                        ) : (
                          <>
                            <Icon
                              name="pencil-check"
                              size={16}
                              color={colors.white}
                            />
                            <Text style={styles.submitBtnText}>
                              Save result
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.clinicBtn}
                        onPress={() => void findClinics()}
                        disabled={loadingClinics}
                        accessibilityRole="button"
                        accessibilityLabel="Find a partner clinic nearby"
                      >
                        {loadingClinics ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primaryTeal}
                          />
                        ) : (
                          <>
                            <Icon
                              name="map-marker-outline"
                              size={16}
                              color={colors.primaryTeal}
                            />
                            <Text style={styles.clinicBtnText}>
                              Find clinic
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    {clinics && clinics.length > 0 && (
                      <View style={styles.clinicList}>
                        {clinics.map(c => (
                          <View key={c.clinic_id} style={styles.clinicRow}>
                            <Icon
                              name="hospital-building"
                              size={14}
                              color={colors.textTertiary}
                            />
                            <Text style={styles.clinicName}>{c.name}</Text>
                            <Text style={styles.clinicDist}>
                              {c.distance_km.toFixed(1)} km
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {clinics?.length === 0 && (
                      <Text style={styles.noClinics}>
                        No partner clinics found nearby.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.infoBox}>
            <Icon
              name="information-outline"
              size={14}
              color={colors.textTertiary}
            />
            <Text style={styles.infoText}>
              Self-reported results are marked pending until confirmed by a
              partner clinic. Confirmed screenings earn full points.
            </Text>
          </View>
        </ScrollView>
      ) : loadingHistory ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primaryTeal} />
        </View>
      ) : (
        <FlatList
          style={styles.historyFlatList}
          data={history}
          keyExtractor={h => h.event_id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.historyList}
          removeClippedSubviews
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyBody}>
                Your past screenings will appear here once logged.
              </Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: {
    padding: spacing.lg + 2,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.screenBg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabBtnActive: { borderBottomColor: colors.primaryTeal },
  tabBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primaryTeal, fontWeight: '600' as const },

  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.toroBorder,
  },
  cardActive: {
    borderColor: colors.primaryTeal,
    backgroundColor: colors.primaryTealLight,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceNeutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDone: { backgroundColor: colors.lightTealSurface },
  cardText: { flex: 1 },
  cardLabel: { ...typography.h3, color: colors.textPrimary },
  cardStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardStatusDone: { color: colors.primaryTeal },

  expanded: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  inputs: { gap: spacing.sm },
  inputLabel: {
    ...typography.bodySmall,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  bpField: { flex: 1, gap: 4 },
  bpFieldLabel: { ...typography.caption, color: colors.textSecondary },
  bpSlash: {
    ...typography.h2,
    color: colors.textTertiary,
    paddingBottom: spacing.sm,
  },
  row3: { flexDirection: 'row', gap: spacing.sm },
  field3: { flex: 1, gap: 4 },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputFlex: { flex: 1 },
  unit: { ...typography.bodySmall, color: colors.textSecondary, width: 60 },
  unitSm: { ...typography.caption, color: colors.textSecondary, width: 24 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceNeutral,
    textAlign: 'center',
  },
  multilineInput: { height: 80, textAlign: 'left', textAlignVertical: 'top' },
  rangeNote: { ...typography.caption, color: colors.textTertiary },
  bmiResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bmiLabel: { ...typography.bodySmall, color: colors.textSecondary },
  bmiValue: { ...typography.h3, color: colors.textPrimary },
  trafficLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  trafficLightText: { ...typography.caption, fontWeight: '500' as const },

  actions: { flexDirection: 'row', gap: spacing.sm },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    ...typography.bodySmall,
    fontWeight: '500' as const,
    color: colors.white,
  },
  clinicBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surfaceNeutral,
  },
  clinicBtnText: { ...typography.bodySmall, color: colors.primaryTeal },
  clinicList: { gap: spacing.xs + 2 },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  clinicName: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  clinicDist: { ...typography.caption, color: colors.textTertiary },
  noClinics: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  infoBox: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  infoText: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
    lineHeight: 17,
  },

  // History tab
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  historyFlatList: { flex: 1 },
  historyList: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl * 2,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  historyLeft: { flex: 1, gap: 3 },
  historyRight: { alignItems: 'flex-end', gap: 4, marginLeft: spacing.sm },
  historyType: {
    ...typography.bodySmall,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  historyResult: { ...typography.caption, color: colors.textSecondary },
  historyClinic: { ...typography.caption, color: colors.textTertiary },
  historyDate: { ...typography.caption, color: colors.textTertiary },
  histBadge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  histBadgeConfirmed: { backgroundColor: colors.lightTealSurface },
  histBadgePending: { backgroundColor: colors.surfaceNeutral },
  histBadgeText: { ...typography.caption, fontWeight: '600' as const },
  histBadgeTextConfirmed: { color: colors.primaryTeal },
  histBadgeTextPending: { color: colors.textTertiary },
  emptyWrap: { alignItems: 'center', paddingTop: spacing.xl * 3 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
