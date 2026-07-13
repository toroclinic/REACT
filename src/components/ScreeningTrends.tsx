// Trends tab for ScreeningScreen — ported from Web PWA ScreeningTrends.tsx.
// The web version renders chart.js line charts; here we draw the same data
// with react-native-svg (already a dependency) to avoid a native chart lib.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { ScreeningHistoryEntry } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ── Result parsers (same regexes as the PWA) ──────────────────────────

interface ParsedPoint {
  date: string;
  values: Record<string, number>;
}

function parseBP(entries: ScreeningHistoryEntry[]): ParsedPoint[] {
  return entries.flatMap(e => {
    if (!e.result) {
      return [];
    }
    const m = e.result.match(/(\d+)\/(\d+)/);
    if (!m || !m[1] || !m[2]) {
      return [];
    }
    return [
      {
        date: e.logged_at.slice(0, 10),
        values: { systolic: +m[1], diastolic: +m[2] },
      },
    ];
  });
}

function parseGlucose(entries: ScreeningHistoryEntry[]): ParsedPoint[] {
  return entries.flatMap(e => {
    if (!e.result) {
      return [];
    }
    const m = e.result.match(/([\d.]+)/);
    if (!m || !m[1]) {
      return [];
    }
    return [{ date: e.logged_at.slice(0, 10), values: { glucose: +m[1] } }];
  });
}

function parseCholesterol(entries: ScreeningHistoryEntry[]): ParsedPoint[] {
  return entries.flatMap(e => {
    if (!e.result) {
      return [];
    }
    const total = e.result.match(/Total ([\d.]+)/)?.[1];
    const hdl = e.result.match(/HDL ([\d.]+)/)?.[1];
    const ldl = e.result.match(/LDL ([\d.]+)/)?.[1];
    if (!total) {
      return [];
    }
    return [
      {
        date: e.logged_at.slice(0, 10),
        values: {
          total: +total,
          ...(hdl ? { hdl: +hdl } : {}),
          ...(ldl ? { ldl: +ldl } : {}),
        },
      },
    ];
  });
}

function parseBMI(entries: ScreeningHistoryEntry[]): ParsedPoint[] {
  return entries.flatMap(e => {
    if (!e.result) {
      return [];
    }
    const w = e.result.match(/([\d.]+)\s*kg/)?.[1];
    const h = e.result.match(/([\d.]+)\s*cm/)?.[1];
    if (!w || !h) {
      return [];
    }
    const bmi = parseFloat(w) / Math.pow(parseFloat(h) / 100, 2);
    return [
      {
        date: e.logged_at.slice(0, 10),
        values: { bmi: Math.round(bmi * 10) / 10 },
      },
    ];
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ── Latest-value classification (same thresholds as ScreeningScreen) ──

type Light = 'normal' | 'warning' | 'critical';

function classifyLatest(
  eventType: string,
  values: Record<string, number>,
): Light | null {
  if (eventType === 'bp_screening') {
    const s = values.systolic ?? NaN;
    const d = values.diastolic ?? NaN;
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
  if (eventType === 'glucose_screening') {
    const n = values.glucose ?? NaN;
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
  if (eventType === 'cholesterol_screening') {
    const n = values.total ?? NaN;
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
  if (eventType === 'bmi_check') {
    const n = values.bmi ?? NaN;
    if (isNaN(n)) {
      return null;
    }
    if (n >= 30 || n < 17) {
      return 'critical';
    }
    if (n >= 25 || n < 18.5) {
      return 'warning';
    }
    return 'normal';
  }
  return null;
}

const LIGHT_STYLES: Record<Light, { bg: string; text: string; label: string }> =
  {
    normal: {
      bg: colors.successBg,
      text: colors.successText,
      label: 'Normal range',
    },
    warning: {
      bg: colors.warningBg,
      text: colors.warningText,
      label: 'Above normal',
    },
    critical: {
      bg: colors.dangerBg,
      text: colors.dangerText,
      label: 'Seek advice',
    },
  };

// ── SVG line chart ────────────────────────────────────────────────────

interface Dataset {
  label: string;
  dataKey: string;
  color: string;
}

const CHART_HEIGHT = 160;
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

function TrendChart({
  title,
  unit,
  points,
  datasets,
  yMin,
  yMax,
  eventType,
}: {
  title: string;
  unit: string;
  points: ParsedPoint[];
  datasets: Dataset[];
  yMin?: number;
  yMax?: number;
  eventType: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  // Sort oldest → newest so the line reads left to right.
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.date.localeCompare(b.date)),
    [points],
  );

  if (sorted.length === 0) {
    return null;
  }

  const latest = sorted[sorted.length - 1];
  const light = latest ? classifyLatest(eventType, latest.values) : null;
  const badge = light ? LIGHT_STYLES[light] : null;

  // Y domain — explicit bounds, else data min/max with 10% headroom.
  const allValues = sorted.flatMap(p =>
    datasets
      .map(ds => p.values[ds.dataKey])
      .filter((v): v is number => v != null),
  );
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = (dataMax - dataMin || 1) * 0.1;
  const lo = yMin ?? Math.floor(dataMin - pad);
  const hi = yMax ?? Math.ceil(dataMax + pad);

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xFor = (i: number) =>
    PAD_LEFT +
    (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW);
  const yFor = (v: number) =>
    PAD_TOP + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  // Consecutive-defined segments per dataset (matches chart.js spanGaps: false)
  const segmentsFor = (dataKey: string): string[] => {
    const segs: string[] = [];
    let current: string[] = [];
    sorted.forEach((p, i) => {
      const v = p.values[dataKey];
      if (v == null) {
        if (current.length > 1) {
          segs.push(current.join(' '));
        }
        current = [];
      } else {
        current.push(`${xFor(i)},${yFor(v)}`);
      }
    });
    if (current.length > 1) {
      segs.push(current.join(' '));
    }
    return segs;
  };

  const gridLines = [0, 0.5, 1].map(t => ({
    y: PAD_TOP + plotH * t,
    label: String(Math.round(hi - (hi - lo) * t)),
  }));

  // Show at most 4 x labels to avoid clutter on narrow phones.
  const labelEvery = Math.max(1, Math.ceil(sorted.length / 4));

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardCount}>
            {sorted.length} reading{sorted.length !== 1 ? 's' : ''}
            {unit ? ` · ${unit}` : ''}
          </Text>
        </View>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              Latest: {badge.label}
            </Text>
          </View>
        )}
      </View>

      {datasets.length > 1 && (
        <View style={styles.legend}>
          {datasets.map(ds => (
            <View key={ds.dataKey} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ds.color }]} />
              <Text style={styles.legendLabel}>{ds.label}</Text>
            </View>
          ))}
        </View>
      )}

      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          {gridLines.map(g => (
            <React.Fragment key={g.y}>
              <Line
                x1={PAD_LEFT}
                y1={g.y}
                x2={width - PAD_RIGHT}
                y2={g.y}
                stroke={colors.toroBorder}
                strokeWidth={0.5}
              />
              <SvgText
                x={PAD_LEFT - 6}
                y={g.y + 3}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {g.label}
              </SvgText>
            </React.Fragment>
          ))}

          {datasets.map(ds =>
            segmentsFor(ds.dataKey).map((seg, i) => (
              <Polyline
                key={`${ds.dataKey}_${i}`}
                points={seg}
                fill="none"
                stroke={ds.color}
                strokeWidth={2}
              />
            )),
          )}

          {datasets.map(ds =>
            sorted.map((p, i) => {
              const v = p.values[ds.dataKey];
              if (v == null) {
                return null;
              }
              return (
                <Circle
                  key={`${ds.dataKey}_${p.date}_${i}`}
                  cx={xFor(i)}
                  cy={yFor(v)}
                  r={3.5}
                  fill={ds.color}
                />
              );
            }),
          )}

          {sorted.map((p, i) =>
            i % labelEvery === 0 || i === sorted.length - 1 ? (
              <SvgText
                key={`x_${p.date}_${i}`}
                x={xFor(i)}
                y={CHART_HEIGHT - 8}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="middle"
              >
                {fmtDate(p.date)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────

interface Props {
  history: ScreeningHistoryEntry[];
}

export function ScreeningTrends({ history }: Props) {
  const byType = (type: string) => history.filter(e => e.event_type === type);

  const bpPoints = parseBP(byType('bp_screening'));
  const glucosePoints = parseGlucose(byType('glucose_screening'));
  const cholPoints = parseCholesterol(byType('cholesterol_screening'));
  const bmiPoints = parseBMI(byType('bmi_check'));

  const hasData =
    bpPoints.length +
      glucosePoints.length +
      cholPoints.length +
      bmiPoints.length >
    0;

  if (!hasData) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={styles.emptyTitle}>No results recorded yet</Text>
        <Text style={styles.emptyBody}>
          Log a test result with a value to see your trend here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <TrendChart
        title="Blood Pressure"
        unit="mmHg"
        eventType="bp_screening"
        points={bpPoints}
        yMin={50}
        yMax={200}
        datasets={[
          { label: 'Systolic', dataKey: 'systolic', color: colors.dangerText },
          // Data-viz series hues (not brand chrome — same exception as the
          // map pin): darkened for legibility on the light Paper background.
          { label: 'Diastolic', dataKey: 'diastolic', color: '#3B82C4' },
        ]}
      />
      <TrendChart
        title="Blood Glucose"
        unit="mmol/L"
        eventType="glucose_screening"
        points={glucosePoints}
        yMin={2}
        yMax={15}
        datasets={[
          { label: 'Glucose', dataKey: 'glucose', color: colors.successText },
        ]}
      />
      <TrendChart
        title="Cholesterol"
        unit="mmol/L"
        eventType="cholesterol_screening"
        points={cholPoints}
        datasets={[
          { label: 'Total', dataKey: 'total', color: '#8B5FBF' },
          { label: 'HDL', dataKey: 'hdl', color: colors.successText },
          { label: 'LDL', dataKey: 'ldl', color: colors.dangerText },
        ]}
      />
      <TrendChart
        title="BMI"
        unit=""
        eventType="bmi_check"
        points={bmiPoints}
        yMin={10}
        yMax={45}
        datasets={[{ label: 'BMI', dataKey: 'bmi', color: '#B45309' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  cardCount: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { ...typography.caption, fontWeight: '600' as const },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...typography.caption, color: colors.textSecondary },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.xs,
  },
  emptyIcon: { fontSize: 34 },
  emptyTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
