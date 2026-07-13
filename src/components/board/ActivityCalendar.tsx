// Board pattern: the monthly activity calendar with embedded log form —
// faithful RN port of the PWA's ActivityCalendar (screens/ActivityScreen.tsx).
// Collapsible month card; Mon-first grid; cells show up to 2 activity emojis;
// tapping a past/today day opens an inline panel listing that day's entries
// plus the activity/duration log form. Logging a past day timestamps the
// event at that day's noon — same as the PWA.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { PricingApi } from '../../services/api';
import type { ActivityHistoryEntry } from '../../types/api';
import { colors, fonts, radius, spacing, typography } from '../../theme/tokens';

export const DURATIONS = [
  { minutes: 15, label: '15 min', sublabel: 'Light', weight: 0.5, emoji: '🌱' },
  {
    minutes: 30,
    label: '30 min',
    sublabel: 'Moderate',
    weight: 1.0,
    emoji: '⚡',
  },
  { minutes: 45, label: '45 min', sublabel: 'Good', weight: 1.5, emoji: '🔥' },
  {
    minutes: 60,
    label: '60+ min',
    sublabel: 'Strong',
    weight: 2.0,
    emoji: '💪',
  },
] as const;

export const ACTIVITIES = [
  { id: 'walking', label: 'Walking', emoji: '🚶' },
  { id: 'running', label: 'Running', emoji: '🏃' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴' },
  { id: 'swimming', label: 'Swimming', emoji: '🏊' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘' },
  { id: 'pilates', label: 'Pilates', emoji: '🤸' },
  { id: 'gym', label: 'Gym', emoji: '🏋️' },
  { id: 'dancing', label: 'Dancing', emoji: '💃' },
  { id: 'football', label: 'Football', emoji: '⚽' },
  { id: 'netball', label: 'Netball', emoji: '🏐' },
  { id: 'basketball', label: 'Basketball', emoji: '🏀' },
  { id: 'hiking', label: 'Hiking', emoji: '🥾' },
  { id: 'jump_rope', label: 'Jump rope', emoji: '⚡' },
  { id: 'aerobics', label: 'Aerobics', emoji: '🎽' },
  { id: 'other', label: 'Other', emoji: '🏅' },
] as const;

const CAL_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function groupByDate(
  history: ActivityHistoryEntry[],
): Map<string, ActivityHistoryEntry[]> {
  const map = new Map<string, ActivityHistoryEntry[]>();
  for (const h of history) {
    const key = new Date(h.logged_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
    const arr = map.get(key) ?? [];
    arr.push(h);
    map.set(key, arr);
  }
  return map;
}

// 7-col grid, Mon-first; 0 = padding cell.
function buildCalendarGrid(year: number, month: number): number[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: number[] = Array(startOffset).fill(0);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(0);
  }
  return cells;
}

type Props = {
  history: ActivityHistoryEntry[];
  memberId: string;
  onLogged: () => void;
};

export function ActivityCalendar({ history, memberId, onLogged }: Props) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [open, setOpen] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [selActivity, setSelActivity] = useState<string | null>(null);
  const [selDuration, setSelDuration] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState(false);

  const byDate = useMemo(() => groupByDate(history), [history]);
  const cells = useMemo(
    () => buildCalendarGrid(calYear, calMonth),
    [calYear, calMonth],
  );
  const todayKey = today.toLocaleDateString('en-CA');

  const totalThisMonth = useMemo(() => {
    let count = 0;
    byDate.forEach((_, key) => {
      const [y, m] = key.split('-').map(Number);
      if (y === calYear && (m as number) - 1 === calMonth) {
        count++;
      }
    });
    return count;
  }, [byDate, calYear, calMonth]);

  const isCurrentMonth =
    calYear === today.getFullYear() && calMonth === today.getMonth();

  const prevMonth = () => {
    setSelectedDay(null);
    if (calMonth === 0) {
      setCalYear(y => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth(m => m - 1);
    }
  };
  const nextMonth = () => {
    if (isCurrentMonth) {
      return;
    }
    setSelectedDay(null);
    if (calMonth === 11) {
      setCalYear(y => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth(m => m + 1);
    }
  };

  const selectDay = (key: string) => {
    setSelectedDay(prev => (prev === key ? null : key));
    setSelActivity(null);
    setSelDuration(null);
    setDone(false);
  };

  const logActivity = async () => {
    if (!memberId || !selActivity || !selDuration || logging) {
      return;
    }
    setLogging(true);
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'activity_checkin',
        channel: 'app',
        timestamp: selectedDay
          ? new Date(selectedDay + 'T12:00:00').toISOString()
          : new Date().toISOString(),
        metadata: { activity_type: selActivity, duration_minutes: selDuration },
      });
      setDone(true);
      setSelActivity(null);
      setSelDuration(null);
      onLogged();
      setTimeout(() => setDone(false), 2500);
    } catch {
      /* offline/failed — the screen's refresh keeps state honest */
    } finally {
      setLogging(false);
    }
  };

  const selectedEntries = selectedDay ? byDate.get(selectedDay) ?? [] : [];
  const selectedIsPast = selectedDay ? selectedDay <= todayKey : false;

  const formatDayHeading = (key: string) => {
    if (key === todayKey) {
      return 'Today';
    }
    return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <View style={styles.wrap}>
      {/* Collapsible header */}
      <TouchableOpacity style={styles.header} onPress={() => setOpen(o => !o)}>
        <Text style={styles.headerTitle}>
          {MONTH_NAMES[calMonth]} {calYear}
        </Text>
        <Text style={styles.headerCount}>
          {totalThisMonth} active day{totalThisMonth !== 1 ? 's' : ''}
        </Text>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {/* Month nav */}
          <View style={styles.nav}>
            <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
              <Icon
                name="chevron-left"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <Text style={styles.navLabel}>
              {MONTH_NAMES[calMonth]!.slice(0, 3).toUpperCase()} {calYear}
            </Text>
            <TouchableOpacity
              style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
              onPress={nextMonth}
              disabled={isCurrentMonth}
            >
              <Icon
                name="chevron-right"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {CAL_HEADERS.map(h => (
              <View key={h} style={styles.cell}>
                <Text style={styles.dow}>{h}</Text>
              </View>
            ))}
            {cells.map((day, i) => {
              if (day === 0) {
                return <View key={`e${i}`} style={styles.cell} />;
              }
              const key = `${calYear}-${String(calMonth + 1).padStart(
                2,
                '0',
              )}-${String(day).padStart(2, '0')}`;
              const entries = byDate.get(key) ?? [];
              const isToday = key === todayKey;
              const hasActivity = entries.length > 0;
              const isFuture = key > todayKey;
              const isSelected = key === selectedDay;
              const emojis = entries
                .slice(0, 2)
                .map(
                  e =>
                    ACTIVITIES.find(a => a.id === e.activity_type)?.emoji ??
                    '🏅',
                );

              return (
                <TouchableOpacity
                  key={key}
                  style={styles.cell}
                  onPress={() => !isFuture && selectDay(key)}
                  disabled={isFuture}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} ${MONTH_NAMES[calMonth]}${
                    hasActivity ? `, ${entries.length} activities` : ''
                  }`}
                >
                  <View
                    style={[
                      styles.cellInner,
                      hasActivity && styles.cellActive,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                      isFuture && styles.cellFuture,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isSelected && styles.dayNumSelected,
                        isFuture && styles.dayNumFuture,
                      ]}
                    >
                      {day}
                    </Text>
                    {hasActivity ? (
                      <Text style={styles.cellEmojis} numberOfLines={1}>
                        {emojis.join('')}
                        {entries.length > 2 ? `+${entries.length - 2}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Inline day panel */}
          {selectedDay && selectedIsPast ? (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>
                  {formatDayHeading(selectedDay)}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedDay(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {selectedEntries.length > 0 && (
                <View style={styles.entryList}>
                  {selectedEntries.map(e => {
                    const act = ACTIVITIES.find(a => a.id === e.activity_type);
                    const dur = DURATIONS.find(
                      d => d.minutes === e.duration_minutes,
                    );
                    return (
                      <View key={e.event_id} style={styles.entryRow}>
                        <Text style={styles.entryEmoji}>
                          {act?.emoji ?? '🏅'}
                        </Text>
                        <Text style={styles.entryLabel}>
                          {act?.label ?? e.activity_type}
                        </Text>
                        {dur ? (
                          <Text style={styles.entryDur}>{dur.label}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {done ? (
                <View style={styles.doneWrap}>
                  <Text style={styles.doneCheck}>✓</Text>
                  <Text style={styles.doneText}>Activity logged!</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.formLabel}>
                    {selectedEntries.length > 0
                      ? 'LOG ANOTHER ACTIVITY'
                      : 'WHAT DID YOU DO?'}
                  </Text>
                  <View style={styles.tileGrid}>
                    {ACTIVITIES.map(a => (
                      <TouchableOpacity
                        key={a.id}
                        style={[
                          styles.tile,
                          selActivity === a.id && styles.tileSelected,
                        ]}
                        onPress={() =>
                          setSelActivity(prev => (prev === a.id ? null : a.id))
                        }
                      >
                        <Text style={styles.tileEmoji}>{a.emoji}</Text>
                        <Text
                          style={[
                            styles.tileLabel,
                            selActivity === a.id && styles.tileLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selActivity ? (
                    <>
                      <Text style={styles.formLabel}>HOW LONG?</Text>
                      <View style={styles.durRow}>
                        {DURATIONS.map(d => (
                          <TouchableOpacity
                            key={d.minutes}
                            style={[
                              styles.durTile,
                              selDuration === d.minutes && styles.tileSelected,
                            ]}
                            onPress={() =>
                              setSelDuration(prev =>
                                prev === d.minutes ? null : d.minutes,
                              )
                            }
                          >
                            <Text style={styles.tileEmoji}>{d.emoji}</Text>
                            <Text
                              style={[
                                styles.durLabel,
                                selDuration === d.minutes &&
                                  styles.tileLabelSelected,
                              ]}
                            >
                              {d.label}
                            </Text>
                            <Text style={styles.durSub}>{d.sublabel}</Text>
                            <Text style={styles.durWeight}>×{d.weight}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.logBtn,
                      (!selActivity || !selDuration || logging) &&
                        styles.logBtnDim,
                    ]}
                    onPress={logActivity}
                    disabled={!selActivity || !selDuration || logging}
                  >
                    {logging ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : null}
                    <Text style={styles.logBtnText}>
                      {logging
                        ? 'Logging…'
                        : selActivity && selDuration
                        ? `Log ${
                            ACTIVITIES.find(a => a.id === selActivity)?.label
                          } — ${
                            DURATIONS.find(d => d.minutes === selDuration)
                              ?.label
                          }`
                        : !selActivity
                        ? 'Select an activity above'
                        : 'Select a duration above'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const CELL_GAP = 4;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    minHeight: 48,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.display600,
    color: colors.textPrimary,
  },
  headerCount: { ...typography.eyebrow, color: colors.primaryTealText },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navLabel: { ...typography.eyebrow, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CELL_GAP / 2,
  },
  dow: { ...typography.eyebrow, fontSize: 10, color: colors.textTertiary },
  cellInner: {
    width: 40,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  cellActive: { backgroundColor: colors.mintWash },
  cellToday: { borderWidth: 1.5, borderColor: colors.primaryTeal },
  cellSelected: { backgroundColor: colors.pine },
  cellFuture: { opacity: 0.35 },
  dayNum: {
    fontSize: 13,
    fontFamily: fonts.body500,
    color: colors.textPrimary,
  },
  dayNumSelected: { color: colors.white },
  dayNumFuture: { color: colors.textTertiary },
  cellEmojis: { fontSize: 9 },

  panel: {
    borderTopWidth: 1,
    borderTopColor: colors.toroBorder,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontSize: 15,
    fontFamily: fonts.display600,
    color: colors.textPrimary,
  },
  entryList: { gap: spacing.xs },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  entryEmoji: { fontSize: 18 },
  entryLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body600,
    color: colors.textPrimary,
  },
  entryDur: {
    fontSize: 12,
    fontFamily: fonts.body400,
    color: colors.textTertiary,
  },
  doneWrap: { alignItems: 'center', paddingVertical: spacing.lg, gap: 4 },
  doneCheck: { fontSize: 26, color: colors.primaryTeal },
  doneText: { ...typography.body, color: colors.textPrimary },
  formLabel: {
    ...typography.eyebrow,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '22.5%',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    paddingVertical: spacing.sm,
  },
  tileSelected: {
    backgroundColor: colors.mintWash,
    borderColor: colors.primaryTeal,
  },
  tileEmoji: { fontSize: 18 },
  tileLabel: {
    fontSize: 10,
    fontFamily: fonts.body500,
    color: colors.textSecondary,
  },
  tileLabelSelected: { color: colors.primaryTealText },
  durRow: { flexDirection: 'row', gap: spacing.sm },
  durTile: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    paddingVertical: spacing.sm,
  },
  durLabel: {
    fontSize: 11,
    fontFamily: fonts.body600,
    color: colors.textPrimary,
  },
  durSub: {
    fontSize: 9,
    fontFamily: fonts.body400,
    color: colors.textTertiary,
  },
  durWeight: {
    fontSize: 9,
    fontFamily: fonts.mono500,
    color: colors.primaryTealText,
  },

  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    marginTop: spacing.xs,
  },
  logBtnDim: { opacity: 0.5 },
  logBtnText: {
    fontSize: 14,
    fontFamily: fonts.body600,
    color: colors.white,
  },
});
