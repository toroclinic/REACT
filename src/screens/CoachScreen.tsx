import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { ApiError, CoachApi, ConsentApi } from '../services/api';
import { CoachMessage } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

// A rendered turn. `failed` marks an optimistic user bubble whose send did not
// reach the server — after the orphan-row fix a failed send leaves NOTHING
// stored, so the bubble must read as "not sent" rather than as delivered. This
// is the behaviour the PWA was missing, not the other way round: RN used to
// drop the bubble entirely, which was closer to the truth but silently lost the
// member's text.
interface ChatItem extends CoachMessage {
  localId: string;
  failed?: boolean;
  truncated?: boolean;
}

type Gate = 'checking' | 'needed' | 'ok';

function isConsentRequired(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    (err.body as { reason?: string } | undefined)?.reason === 'consent_required'
  );
}

let localSeq = 0;
const nextLocalId = () => `local_${++localSeq}`;

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 600 - delay)),
        ]),
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={dotStyles.row} accessibilityLabel="Tora is typing">
      {([dot1, dot2, dot3] as Animated.Value[]).map((dot, i) => (
        <Animated.View key={i} style={[dotStyles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.toroMuted,
  },
});

export function CoachScreen() {
  const memberId = useAuthStore(s => s.memberId);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [gate, setGate] = useState<Gate>('checking');
  const [granting, setGranting] = useState(false);
  const listRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adopt = (rows: CoachMessage[]): ChatItem[] =>
    rows.map(r => ({ ...r, localId: nextLocalId() }));

  useEffect(() => {
    if (!memberId) {
      return;
    }
    CoachApi.getHistory(memberId)
      .then(rows => {
        setGate('ok');
        setMessages(adopt(rows));
      })
      .catch(err => {
        setGate(isConsentRequired(err) ? 'needed' : 'ok');
        setMessages([]);
      })
      .finally(() => setLoadingHistory(false));
  }, [memberId]);

  const grantConsent = async () => {
    if (!memberId) {
      return;
    }
    setGranting(true);
    try {
      await ConsentApi.set(memberId, 'ai_coach', true);
      setGate('ok');
      const rows = await CoachApi.getHistory(memberId).catch(() => []);
      setMessages(adopt(rows));
    } catch {
      Alert.alert('Error', 'Could not save your choice. Please try again.');
    } finally {
      setGranting(false);
    }
  };

  useEffect(
    () => () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    },
    [],
  );

  const scrollToBottom = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      100,
    );
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Shared by the composer and the per-bubble retry. `retryId` re-uses the
  // existing bubble rather than appending a duplicate.
  const deliver = async (text: string, retryId?: string) => {
    if (!memberId || loading) {
      return;
    }

    const localId = retryId ?? nextLocalId();
    setMessages(prev =>
      retryId
        ? prev.map(m => (m.localId === retryId ? { ...m, failed: false } : m))
        : [
            ...prev,
            {
              localId,
              role: 'user',
              content: text,
              created_at: new Date().toISOString(),
            },
          ],
    );
    setLoading(true);

    try {
      // Backend returns {message_id, role, content, truncated} — no created_at
      // (coach.ts). Stamp the display timestamp client-side, as above.
      const { content, truncated } = await CoachApi.sendMessage(memberId, text);
      setMessages(prev => [
        ...prev,
        {
          localId: nextLocalId(),
          role: 'assistant',
          content,
          created_at: new Date().toISOString(),
          truncated: truncated === true,
        },
      ]);
    } catch (err) {
      if (isConsentRequired(err)) {
        setGate('needed');
        setMessages(prev => prev.filter(m => m.localId !== localId));
        return;
      }
      // Deliberately NOT removed: the server stored nothing, so dropping the
      // bubble would also drop the member's text. Mark it and offer a retry.
      setMessages(prev =>
        prev.map(m => (m.localId === localId ? { ...m, failed: true } : m)),
      );
    } finally {
      setLoading(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput('');
    void deliver(text);
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear chat',
      'This will delete your entire conversation history with Tora.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (!memberId) {
              return;
            }
            await CoachApi.clearHistory(memberId).catch(() => {});
            setMessages([]);
          },
        },
      ],
    );
  };

  const renderMessage = ({ item }: { item: ChatItem }) => {
    const isUser = item.role === 'user';
    const timeStr = item.created_at
      ? new Date(item.created_at).toLocaleTimeString('en-BW', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
    return (
      <View
        style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}
      >
        {!isUser && (
          <View style={styles.avatar} accessibilityElementsHidden>
            <Text style={styles.avatarText}>T</Text>
          </View>
        )}
        <View style={styles.msgGroup}>
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleBot,
              item.failed ? styles.bubbleFailed : null,
            ]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${isUser ? 'You' : 'Tora'}: ${item.content}${
              item.failed ? '. Not sent' : ''
            }`}
          >
            <Text
              style={[
                styles.bubbleText,
                isUser ? styles.bubbleTextUser : styles.bubbleTextBot,
              ]}
            >
              {item.content}
            </Text>
          </View>
          {item.failed && (
            <TouchableOpacity
              onPress={() => {
                void deliver(item.content, item.localId);
              }}
              disabled={loading}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="Message not sent. Retry"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.retryText}>Not sent — tap to retry</Text>
            </TouchableOpacity>
          )}
          {item.truncated && (
            <Text style={styles.truncatedText}>
              Tora ran out of room. Ask a follow-up for the rest.
            </Text>
          )}
          {timeStr && !item.failed && (
            <Text
              style={[
                styles.msgTime,
                isUser ? styles.msgTimeUser : styles.msgTimeBot,
              ]}
            >
              {timeStr}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Consent screen. "Your AI health coach" in the header is disclosure; this is
  // the actual permission, recorded in the member_consent ledger.
  if (gate === 'needed') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <View style={styles.toraAvatar} accessibilityElementsHidden>
              <Text style={styles.toraAvatarText}>T</Text>
            </View>
            <View>
              <Text style={styles.headerName}>Tora</Text>
              <Text style={styles.headerSub}>Your AI health coach</Text>
            </View>
          </View>
        </View>

        <View style={styles.consentWrap}>
          <Text style={styles.consentTitle}>Before we start</Text>
          <Text style={styles.consentBody}>
            Tora is an AI coach. To give advice that fits you, it sends a
            summary of your wellness profile — your tier, score, recent
            screenings and activity, and whether a visit is coming up — to
            Anthropic, the company that provides the AI.
          </Text>
          <Text style={styles.consentBody}>
            Your name is shortened to your first name, and exact dates and
            clinic locations are never sent. You can turn this off at any time,
            and clearing your chat deletes the conversation.
          </Text>
          <TouchableOpacity
            onPress={grantConsent}
            disabled={granting}
            style={[
              styles.consentBtn,
              granting ? styles.consentBtnDisabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Agree and start chatting"
          >
            <Text style={styles.consentBtnText}>
              {granting ? 'Saving…' : 'I agree — start chatting'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.toraAvatar} accessibilityElementsHidden>
            <Text style={styles.toraAvatarText}>T</Text>
          </View>
          <View>
            <Text style={styles.headerName}>Tora</Text>
            <Text style={styles.headerSub}>Your AI health coach</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={clearHistory}
          style={styles.clearBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear conversation history"
          accessibilityHint="Deletes all messages with Tora"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Message list */}
      {loadingHistory ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primaryTeal} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.messageList}
          data={messages}
          keyExtractor={item => item.localId}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          initialNumToRender={20}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyAvatar} accessibilityElementsHidden>
                <Text style={styles.emptyAvatarText}>T</Text>
              </View>
              <Text style={styles.emptyTitle}>Hi, I'm Tora</Text>
              <Text style={styles.emptyBody}>
                Your personal health coach. Ask me about your wellness journey,
                health tips, or how to improve your score.
              </Text>
              {[
                'How can I improve my score?',
                'What should I eat to lower blood pressure?',
                'How many steps should I walk daily?',
              ].map(suggestion => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestion}
                  onPress={() => {
                    setInput(suggestion);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={suggestion}
                  accessibilityHint="Tap to use this suggested prompt"
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
      )}

      {/* Typing indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.avatar} accessibilityElementsHidden>
            <Text style={styles.avatarText}>T</Text>
          </View>
          <View style={styles.typingBubble}>
            <TypingDots />
          </View>
        </View>
      )}

      {/* Input bar */}
      <View
        style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message Tora…"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
          accessibilityLabel="Message input"
          accessibilityHint="Type your message to Tora"
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || loading) && styles.sendBtnDisabled,
          ]}
          onPress={send}
          disabled={!input.trim() || loading}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !input.trim() || loading }}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },

  header: {
    backgroundColor: colors.heroTeal,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toraAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toraAvatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  headerName: { ...typography.h3, color: colors.white },
  headerSub: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  clearBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  clearBtnText: { ...typography.bodySmall, color: 'rgba(255,255,255,0.8)' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },

  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: spacing.xl * 2 },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.heroTeal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyAvatarText: { color: colors.white, fontSize: 28, fontWeight: '700' },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: colors.toroBorder,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  suggestionText: { ...typography.bodySmall, color: colors.primaryTeal },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  msgGroup: { maxWidth: '78%' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.heroTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  bubble: { borderRadius: radius.lg, padding: spacing.md },
  bubbleUser: {
    backgroundColor: colors.primaryTeal,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: colors.surfaceNeutral,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { ...typography.body },
  bubbleTextUser: { color: colors.white },
  bubbleTextBot: { color: colors.textPrimary },

  msgTime: { ...typography.caption, marginTop: 3 },
  msgTimeUser: { color: colors.textTertiary, textAlign: 'right' },
  msgTimeBot: { color: colors.textTertiary },

  // A failed send stored nothing server-side, so the bubble must not look
  // delivered: muted, dashed, and carrying its own retry.
  bubbleFailed: {
    opacity: 0.55,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dangerText,
  },
  retryBtn: {
    marginTop: 3,
    alignSelf: 'flex-end',
    minHeight: 32,
    justifyContent: 'center',
  },
  retryText: {
    ...typography.caption,
    color: colors.dangerText,
    fontWeight: '600',
  },
  truncatedText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 3,
  },

  consentWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  consentTitle: { ...typography.h2, color: colors.textPrimary },
  consentBody: { ...typography.body, color: colors.textSecondary },
  consentBtn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  consentBtnDisabled: { opacity: 0.6 },
  consentBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },

  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  typingBubble: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.screenBg,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceNeutral },
  sendBtnText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
