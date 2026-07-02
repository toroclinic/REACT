import React, { useCallback, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { MessagesApi, RemindersApi } from '../services/api';
import {
  MemberMessage,
  MemberReminder,
  MessageType,
  ReminderUrgency,
} from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

type InboxTab = 'messages' | 'reminders';

function Separator() {
  return <View style={separatorStyle} />;
}
const separatorStyle = StyleSheet.create({
  s: { height: 0.5, backgroundColor: colors.toroBorder },
}).s;

const TYPE_CONFIG: Record<
  MessageType,
  { bg: string; color: string; label: string }
> = {
  alert: { bg: colors.dangerBg, color: colors.dangerText, label: 'Alert' },
  wellness: {
    bg: colors.successBg,
    color: colors.successText,
    label: 'Wellness',
  },
  reminder: {
    bg: colors.warningBg,
    color: colors.warningText,
    label: 'Reminder',
  },
  info: {
    bg: colors.surfaceNeutral,
    color: colors.textSecondary,
    label: 'Info',
  },
};

const URGENCY_CONFIG: Record<
  ReminderUrgency,
  { bg: string; color: string; label: string; icon: string }
> = {
  urgent: {
    bg: colors.dangerBg,
    color: colors.dangerText,
    label: 'Urgent',
    icon: 'alert-circle',
  },
  due: {
    bg: colors.warningBg,
    color: colors.warningText,
    label: 'Due',
    icon: 'clock-alert-outline',
  },
  upcoming: {
    bg: colors.surfaceNeutral,
    color: colors.textSecondary,
    label: 'Upcoming',
    icon: 'clock-outline',
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-BW', { day: 'numeric', month: 'short' });
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return iso;
  }
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} day${
      Math.abs(diffDays) !== 1 ? 's' : ''
    }`;
  }
  if (diffDays === 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Due tomorrow';
  }
  return `Due ${d.toLocaleDateString('en-BW', {
    day: 'numeric',
    month: 'short',
  })}`;
}

export function MessagesScreen() {
  const memberId = useAuthStore(s => s.memberId);

  const [tab, setTab] = useState<InboxTab>('messages');
  const [messages, setMessages] = useState<MemberMessage[]>([]);
  const [reminders, setReminders] = useState<MemberReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!memberId) {
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      try {
        const data = await MessagesApi.getMessages(memberId);
        setMessages(data);
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId],
  );

  const loadReminders = useCallback(
    async (silent = false) => {
      if (!memberId) {
        return;
      }
      if (!silent) {
        setLoadingReminders(true);
      }
      try {
        const data = await RemindersApi.getReminders(memberId);
        setReminders(data);
      } catch {
        /* silently fail */
      } finally {
        setLoadingReminders(false);
      }
    },
    [memberId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadMessages();
      void loadReminders(true);
    }, [loadMessages, loadReminders]),
  );

  const handleTabChange = (t: InboxTab) => {
    setTab(t);
  };

  const markRead = async (messageId: string) => {
    if (!memberId) {
      return;
    }
    setMessages(prev =>
      prev.map(m => (m.message_id === messageId ? { ...m, read: true } : m)),
    );
    await MessagesApi.markRead(memberId, messageId).catch(() => {});
  };

  const handlePress = (item: MemberMessage) => {
    setExpanded(prev => (prev === item.message_id ? null : item.message_id));
    if (!item.read) {
      void markRead(item.message_id);
    }
  };

  const handleDismiss = async (reminderId: string) => {
    if (!memberId || dismissing) {
      return;
    }
    setDismissing(reminderId);
    try {
      await RemindersApi.dismiss(memberId, reminderId);
      setReminders(prev => prev.filter(r => r.reminder_id !== reminderId));
    } catch {
      /* silently fail */
    } finally {
      setDismissing(null);
    }
  };

  const renderMessage = ({ item }: { item: MemberMessage }) => {
    const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info;
    const isOpen = expanded === item.message_id;
    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.typeBadgeText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text
              style={[styles.subject, !item.read && styles.subjectUnread]}
              numberOfLines={isOpen ? undefined : 1}
            >
              {item.subject}
            </Text>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>
          {isOpen ? (
            <Text style={styles.body}>{item.body}</Text>
          ) : (
            <Text style={styles.preview} numberOfLines={1}>
              {item.body}
            </Text>
          )}
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderReminder = ({ item }: { item: MemberReminder }) => {
    const cfg = URGENCY_CONFIG[item.urgency] ?? URGENCY_CONFIG.upcoming;
    const isDismissing = dismissing === item.reminder_id;
    return (
      <View style={[styles.reminderRow, { borderLeftColor: cfg.color }]}>
        <View style={styles.reminderHeader}>
          <View style={[styles.urgencyBadge, { backgroundColor: cfg.bg }]}>
            <Icon name={cfg.icon} size={12} color={cfg.color} />
            <Text style={[styles.urgencyText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
          <Text style={styles.reminderDue}>{formatDueDate(item.due_date)}</Text>
        </View>
        <Text style={styles.reminderTitle}>{item.title}</Text>
        <Text style={styles.reminderBody}>{item.message}</Text>
        <TouchableOpacity
          style={[styles.dismissBtn, isDismissing && styles.dismissBtnDisabled]}
          onPress={() => {
            void handleDismiss(item.reminder_id);
          }}
          disabled={isDismissing || !!dismissing}
          accessibilityRole="button"
          accessibilityLabel="Dismiss this reminder"
        >
          {isDismissing ? (
            <ActivityIndicator size="small" color={colors.textTertiary} />
          ) : (
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const unreadCount = messages.filter(m => !m.read).length;
  const activeReminders = reminders;

  return (
    <View style={styles.screen}>
      <Text style={styles.screenTitle}>Inbox</Text>

      {/* Tab selector */}
      <View style={styles.tabStrip}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'messages' && styles.tabBtnActive]}
          onPress={() => handleTabChange('messages')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'messages' && styles.tabBtnTextActive,
            ]}
          >
            Messages{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'reminders' && styles.tabBtnActive]}
          onPress={() => handleTabChange('reminders')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'reminders' && styles.tabBtnTextActive,
            ]}
          >
            Reminders
            {activeReminders.length > 0 ? ` (${activeReminders.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'messages' ? (
        loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primaryTeal} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={m => m.message_id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            removeClippedSubviews
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            ItemSeparatorComponent={Separator}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void loadMessages(true);
                }}
                tintColor={colors.primaryTeal}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No messages</Text>
                <Text style={styles.emptyBody}>
                  Health tips and alerts from your insurer will appear here.
                </Text>
              </View>
            }
          />
        )
      ) : loadingReminders ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primaryTeal} />
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={r => r.reminder_id}
          renderItem={renderReminder}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                void loadReminders();
              }}
              tintColor={colors.primaryTeal}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>No reminders</Text>
              <Text style={styles.emptyBody}>
                Upcoming check-up and medication reminders will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  screenTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.screenBg,
    marginBottom: spacing.xs,
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

  // Messages
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowUnread: { backgroundColor: colors.primaryTealLight },
  typeBadge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  typeBadgeText: { ...typography.caption, fontWeight: '600' as const },
  rowContent: { flex: 1 },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  subject: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  subjectUnread: { fontWeight: '600' as const },
  date: { ...typography.caption, color: colors.textTertiary },
  preview: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryTeal,
    marginTop: 4,
  },

  // Reminders
  reminderRow: {
    borderLeftWidth: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceNeutral,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs + 2,
    marginVertical: spacing.xs,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  urgencyText: { ...typography.caption, fontWeight: '600' as const },
  reminderDue: { ...typography.caption, color: colors.textTertiary },
  reminderTitle: {
    ...typography.bodySmall,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  reminderBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  dismissBtnDisabled: { opacity: 0.5 },
  dismissBtnText: { ...typography.caption, color: colors.textSecondary },

  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: spacing.xl * 3 },
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
