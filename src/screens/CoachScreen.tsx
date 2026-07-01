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
import { CoachApi } from '../services/api';
import { CoachMessage } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

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
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef<FlatList>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!memberId) {
      return;
    }
    CoachApi.getHistory(memberId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [memberId]);

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

  const send = async () => {
    if (!memberId || !input.trim() || loading) {
      return;
    }
    const text = input.trim();
    setInput('');

    const userMsg: CoachMessage = {
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { reply, created_at } = await CoachApi.sendMessage(memberId, text);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: reply, created_at },
      ]);
    } catch {
      Alert.alert('Error', 'Could not reach Tora. Please try again.');
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setLoading(false);
    }
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

  const renderMessage = ({ item }: { item: CoachMessage }) => {
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
            ]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${isUser ? 'You' : 'Tora'}: ${item.content}`}
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
          {timeStr && (
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
          keyExtractor={(item, i) =>
            item.created_at ? `${item.role}_${item.created_at}` : `msg_${i}`
          }
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
