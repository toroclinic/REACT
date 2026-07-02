import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  AppState,
  Linking,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WalletApi, ClinicApi } from '../services/api';
import {
  WalletBalance,
  WalletTransaction,
  WalletTxnType,
  Clinic,
} from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPula(n: number) {
  return `P ${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function txnIcon(type: WalletTxnType): string {
  if (type === 'clinic_payment') {
    return 'office-building-outline';
  }
  if (type === 'topup') {
    return 'arrow-down-left';
  }
  return 'arrow-down-circle-outline';
}

function txnLabel(txn: WalletTransaction): string {
  if (txn.description) {
    return txn.description;
  }
  const map: Record<WalletTxnType, string> = {
    topup: 'Orange Money Top-up',
    clinic_payment: 'Clinic Payment',
    wellness_credit: 'Wellness Credit',
    employer_credit: 'Employer Credit',
  };
  return map[txn.type] ?? txn.type;
}

const PRESETS = [50, 100, 200, 500];
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

// ─── TxnRow ───────────────────────────────────────────────────────────────────

function TxnRow({ txn }: { txn: WalletTransaction }) {
  const isCredit = txn.direction === 'credit';
  const statusCfg =
    txn.status === 'completed'
      ? { bg: colors.successBg, color: colors.successText, label: 'Completed' }
      : txn.status === 'failed'
      ? { bg: colors.dangerBg, color: colors.dangerText, label: 'Failed' }
      : { bg: colors.warningBg, color: colors.warningText, label: 'Pending' };
  return (
    <View style={styles.txnRow}>
      <View
        style={[
          styles.txnIconWrap,
          { backgroundColor: isCredit ? colors.successBg : colors.dangerBg },
        ]}
      >
        <Icon
          name={txnIcon(txn.type)}
          size={18}
          color={isCredit ? colors.successText : colors.dangerText}
        />
      </View>
      <View style={styles.txnMid}>
        <Text style={styles.txnLabel} numberOfLines={1}>
          {txnLabel(txn)}
        </Text>
        <Text style={styles.txnDate}>{fmtDate(txn.created_at)}</Text>
      </View>
      <View style={styles.txnRight}>
        <Text
          style={[
            styles.txnAmount,
            { color: isCredit ? colors.successText : colors.dangerText },
          ]}
        >
          {isCredit ? '+' : '−'}
          {fmtPula(txn.amount_pula)}
        </Text>
        <View
          style={[styles.txnStatusBadge, { backgroundColor: statusCfg.bg }]}
        >
          <Text style={[styles.txnStatusText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── WalletScreen ─────────────────────────────────────────────────────────────

export function WalletScreen() {
  const [walletData, setWalletData] = useState<WalletBalance | null>(null);
  const [allTxns, setAllTxns] = useState<WalletTransaction[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // TopUp modal
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpPreset, setTopUpPreset] = useState<number | null>(null);
  const [topping, setTopping] = useState(false);
  const [topUpError, setTopUpError] = useState('');

  // PayClinic modal
  const [showPayClinic, setShowPayClinic] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  // Pending top-up
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState<string | null>(
    null,
  );
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  const clearPending = useCallback(() => {
    stopPolling();
    setPendingOrderId(null);
    setPendingPaymentUrl(null);
    setPendingAmount(null);
  }, [stopPolling]);

  const fetchBalance = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const data = await WalletApi.getBalance();
      setWalletData(data);
    } catch {
      /* show stale data */
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  // Refresh on foreground return while payment is pending
  useEffect(() => {
    if (!pendingOrderId) {
      return;
    }
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void fetchBalance(true);
      }
    });
    return () => sub.remove();
  }, [pendingOrderId, fetchBalance]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (orderId: string) => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      pollAttemptsRef.current = 0;
      pollRef.current = setInterval(async () => {
        pollAttemptsRef.current += 1;
        try {
          const result = await WalletApi.pollTopUpStatus(orderId);
          if (result.status === 'completed') {
            clearPending();
            void fetchBalance(true);
          } else if (result.status === 'failed') {
            clearPending();
          } else if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
            clearPending();
          }
        } catch {
          if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
            clearPending();
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPending, fetchBalance],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalance(true);
    setRefreshing(false);
  }, [fetchBalance]);

  const loadAllTxns = useCallback(async () => {
    if (allLoaded) {
      return;
    }
    try {
      const res = await WalletApi.getTransactions(100, 0);
      setAllTxns(res.transactions);
      setAllLoaded(true);
    } catch {
      /* ignore */
    }
  }, [allLoaded]);

  // ── TopUp ──────────────────────────────────────────────────────────────────

  const initiateTopUp = useCallback(async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 10) {
      setTopUpError('Minimum top-up is P10.');
      return;
    }
    if (amount > 5000) {
      setTopUpError('Maximum top-up is P5,000.');
      return;
    }
    setTopping(true);
    setTopUpError('');
    try {
      const res = await WalletApi.initiateTopUp(amount);
      setPendingOrderId(res.order_id);
      setPendingPaymentUrl(res.payment_url);
      setPendingAmount(amount);
      setShowTopUp(false);
      setTopUpAmount('');
      setTopUpPreset(null);
      await Linking.openURL(res.payment_url);
      startPolling(res.order_id);
    } catch (e: unknown) {
      setTopUpError(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setTopping(false);
    }
  }, [topUpAmount, startPolling]);

  // ── Pay clinic ─────────────────────────────────────────────────────────────

  const openPayClinic = useCallback(async () => {
    setShowPayClinic(true);
    setLoadingClinics(true);
    setPayError('');
    setSelectedClinic(null);
    setPayAmount('');
    try {
      const list = await ClinicApi.all();
      setClinics(list.filter(c => c.partner_status === 'active'));
    } catch {
      setClinics([]);
    } finally {
      setLoadingClinics(false);
    }
  }, []);

  const submitPayClinic = useCallback(async () => {
    if (!selectedClinic) {
      setPayError('Please select a clinic.');
      return;
    }
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid amount.');
      return;
    }
    const balance = walletData?.balance_pula ?? 0;
    if (amount > balance) {
      setPayError(`Insufficient balance. You have ${fmtPula(balance)}.`);
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      const res = await WalletApi.payClinic(selectedClinic.clinic_id, amount);
      setWalletData(prev =>
        prev ? { ...prev, balance_pula: res.new_balance_pula } : prev,
      );
      setShowPayClinic(false);
      setSelectedClinic(null);
      setPayAmount('');
      void fetchBalance(true);
    } catch (e: unknown) {
      setPayError(
        e instanceof Error ? e.message : 'Payment failed. Please try again.',
      );
    } finally {
      setPaying(false);
    }
  }, [selectedClinic, payAmount, walletData, fetchBalance]);

  const displayedTxns = allLoaded
    ? allTxns
    : walletData?.recent_transactions ?? [];
  const balance = walletData?.balance_pula ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryTeal}
          />
        }
      >
        {/* ── Balance card ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.walletTitle}>Toro Health Wallet</Text>
          {loading ? (
            <ActivityIndicator
              color={colors.white}
              style={{ marginVertical: spacing.xl }}
            />
          ) : (
            <Text style={styles.balanceAmount}>{fmtPula(balance)}</Text>
          )}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Credited</Text>
              <Text style={styles.statValue}>
                {walletData ? fmtPula(walletData.lifetime_credited_pula) : '—'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Paid out</Text>
              <Text style={styles.statValue}>
                {walletData ? fmtPula(walletData.lifetime_paid_pula) : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.restrictionBadge}>
            <Icon
              name="hospital-building"
              size={11}
              color="rgba(255,255,255,0.45)"
            />
            <Text style={styles.restrictionText}>
              Only usable at Toro-verified clinics
            </Text>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setTopUpError('');
              setTopUpAmount('');
              setTopUpPreset(null);
              setShowTopUp(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Top up wallet via Orange Money"
          >
            <View
              style={[
                styles.actionIconWrap,
                { backgroundColor: colors.primaryTealLight },
              ]}
            >
              <Icon
                name="arrow-down-left"
                size={22}
                color={colors.primaryTeal}
              />
            </View>
            <Text style={styles.actionLabel}>Top Up</Text>
            <Text style={styles.actionSub}>via Orange Money</Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={[styles.actionBtn, balance <= 0 && styles.actionBtnDisabled]}
            onPress={openPayClinic}
            disabled={!walletData || balance <= 0}
            accessibilityRole="button"
            accessibilityLabel="Pay a clinic from wallet balance"
            accessibilityState={{ disabled: !walletData || balance <= 0 }}
          >
            <View
              style={[
                styles.actionIconWrap,
                { backgroundColor: colors.goldLight },
              ]}
            >
              <Icon
                name="office-building-outline"
                size={22}
                color={colors.gold}
              />
            </View>
            <Text
              style={[
                styles.actionLabel,
                balance <= 0 && styles.actionLabelDim,
              ]}
            >
              Pay Clinic
            </Text>
            <Text style={styles.actionSub}>health-restricted</Text>
          </TouchableOpacity>
        </View>

        {/* ── Pending payment banner ── */}
        {pendingOrderId && pendingAmount !== null && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingTop}>
              <Icon name="clock-outline" size={16} color={colors.warningText} />
              <Text style={styles.pendingTitle}>
                Waiting for payment confirmation
              </Text>
            </View>
            <Text style={styles.pendingSub}>
              {fmtPula(pendingAmount)} via Orange Money — complete payment in
              your browser
            </Text>
            <View style={styles.pendingBtns}>
              {pendingPaymentUrl && (
                <TouchableOpacity
                  onPress={() => {
                    if (pendingPaymentUrl) {
                      void Linking.openURL(pendingPaymentUrl);
                    }
                  }}
                  style={styles.pendingBtn}
                >
                  <Text style={styles.pendingBtnResume}>Resume</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={clearPending}
                style={styles.pendingBtn}
              >
                <Text style={styles.pendingBtnCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Transaction history ── */}
        <Text style={styles.txnHeader}>Transaction history</Text>

        {loading && displayedTxns.length === 0 ? (
          <View style={styles.txnEmptyWrap}>
            <ActivityIndicator color={colors.primaryTeal} />
          </View>
        ) : displayedTxns.length === 0 ? (
          <View style={styles.txnEmptyWrap}>
            <Icon name="wallet-outline" size={38} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyBody}>
              Top up your wallet to get started.
            </Text>
          </View>
        ) : (
          <>
            {displayedTxns.map(txn => (
              <TxnRow key={txn.txn_id} txn={txn} />
            ))}
            {!allLoaded && displayedTxns.length >= 5 && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={loadAllTxns}
                accessibilityRole="button"
              >
                <Text style={styles.viewAllText}>View all transactions</Text>
                <Icon
                  name="chevron-right"
                  size={16}
                  color={colors.primaryTeal}
                />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* ════ TopUp Modal ════════════════════════════════════════════════════ */}
      <Modal
        visible={showTopUp}
        transparent
        animationType="slide"
        onRequestClose={() => !topping && setShowTopUp(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => !topping && setShowTopUp(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Top up wallet</Text>
            <Text style={styles.sheetSub}>
              Add funds via Orange Money. Minimum P10.
            </Text>

            <View style={styles.presetsRow}>
              {PRESETS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.presetBtn,
                    topUpPreset === p && styles.presetBtnActive,
                  ]}
                  onPress={() => {
                    setTopUpPreset(p);
                    setTopUpAmount(String(p));
                    setTopUpError('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Set amount to P${p}`}
                >
                  <Text
                    style={[
                      styles.presetText,
                      topUpPreset === p && styles.presetTextActive,
                    ]}
                  >
                    P{p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>P</Text>
              <TextInput
                style={styles.amountField}
                value={topUpAmount}
                onChangeText={v => {
                  setTopUpAmount(v);
                  setTopUpPreset(null);
                  setTopUpError('');
                }}
                placeholder="Enter amount"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                maxLength={7}
                accessibilityLabel="Top up amount"
              />
            </View>

            {!!topUpError && <Text style={styles.errorText}>{topUpError}</Text>}

            <Text style={styles.sheetNote}>
              You will be redirected to Orange Money's secure payment page. Your
              wallet is credited automatically once confirmed.
            </Text>

            <TouchableOpacity
              style={[styles.sheetCta, topping && styles.sheetCtaDim]}
              onPress={initiateTopUp}
              disabled={topping}
              accessibilityRole="button"
              accessibilityLabel="Continue to Orange Money"
              accessibilityState={{ busy: topping }}
            >
              {topping ? (
                <ActivityIndicator
                  color={colors.white}
                  style={{ marginRight: spacing.sm }}
                />
              ) : (
                <Icon
                  name="arrow-down-left"
                  size={18}
                  color={colors.white}
                  style={{ marginRight: spacing.sm }}
                />
              )}
              <Text style={styles.sheetCtaText}>
                {topping ? 'Opening Orange Money…' : 'Continue to Orange Money'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════ PayClinic Modal ════════════════════════════════════════════════ */}
      <Modal
        visible={showPayClinic}
        transparent
        animationType="slide"
        onRequestClose={() => !paying && setShowPayClinic(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => !paying && setShowPayClinic(false)}
          />
          <View style={[styles.sheet, styles.sheetTall]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pay clinic</Text>
            <Text style={styles.sheetSub}>
              Available:{' '}
              <Text style={styles.sheetBalanceHighlight}>
                {fmtPula(balance)}
              </Text>
            </Text>

            <Text style={styles.fieldLabel}>Select clinic</Text>
            {loadingClinics ? (
              <ActivityIndicator
                color={colors.primaryTeal}
                style={{ marginVertical: spacing.md }}
              />
            ) : clinics.length === 0 ? (
              <Text style={styles.noClinicText}>No partner clinics found.</Text>
            ) : (
              <ScrollView
                style={styles.clinicList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {clinics.map(c => {
                  const selected = selectedClinic?.clinic_id === c.clinic_id;
                  return (
                    <TouchableOpacity
                      key={c.clinic_id}
                      style={[
                        styles.clinicRow,
                        selected && styles.clinicRowSelected,
                      ]}
                      onPress={() => {
                        setSelectedClinic(c);
                        setPayError('');
                      }}
                      accessibilityRole="radio"
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected }}
                    >
                      <View
                        style={[
                          styles.clinicCheck,
                          selected && styles.clinicCheckSelected,
                        ]}
                      >
                        {selected && (
                          <Icon
                            name="check"
                            size={12}
                            color={colors.primaryTeal}
                          />
                        )}
                      </View>
                      <View style={styles.clinicInfo}>
                        <Text style={styles.clinicName}>{c.name}</Text>
                        {!!c.address && (
                          <Text style={styles.clinicAddr} numberOfLines={1}>
                            {c.address}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.fieldLabel}>Amount (BWP)</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencyPrefix}>P</Text>
              <TextInput
                style={styles.amountField}
                value={payAmount}
                onChangeText={v => {
                  setPayAmount(v);
                  setPayError('');
                }}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                maxLength={8}
                accessibilityLabel="Payment amount"
              />
            </View>

            <View style={styles.restrictionNotice}>
              <Icon
                name="lock-outline"
                size={12}
                color={colors.textTertiary}
                style={styles.restrictionIcon}
              />
              <Text style={styles.restrictionNoticeText}>
                Health-restricted: funds can only be used at Toro-verified
                clinics.
              </Text>
            </View>

            {!!payError && <Text style={styles.errorText}>{payError}</Text>}

            <TouchableOpacity
              style={[
                styles.sheetCta,
                (paying || !selectedClinic) && styles.sheetCtaDim,
              ]}
              onPress={submitPayClinic}
              disabled={paying || !selectedClinic}
              accessibilityRole="button"
              accessibilityState={{ busy: paying, disabled: !selectedClinic }}
            >
              {paying ? (
                <ActivityIndicator
                  color={colors.white}
                  style={{ marginRight: spacing.sm }}
                />
              ) : (
                <Icon
                  name="office-building-outline"
                  size={18}
                  color={colors.white}
                  style={{ marginRight: spacing.sm }}
                />
              )}
              <Text style={styles.sheetCtaText}>
                {paying
                  ? 'Processing…'
                  : selectedClinic
                  ? `Pay ${selectedClinic.name}`
                  : 'Pay clinic'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { paddingBottom: spacing.xl * 3 },

  // Balance card
  balanceCard: {
    margin: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.pulaCardBg,
    padding: spacing.xl,
  },
  walletTitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -1,
    marginBottom: spacing.lg,
  },
  statsRow: { flexDirection: 'row', marginBottom: spacing.md },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { ...typography.caption, color: 'rgba(255,255,255,0.55)' },
  statValue: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginHorizontal: spacing.lg,
  },
  restrictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  restrictionText: { ...typography.caption, color: 'rgba(255,255,255,0.4)' },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  actionBtnDisabled: { opacity: 0.35 },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  actionLabelDim: { color: colors.textTertiary },
  actionSub: { ...typography.caption, color: colors.textTertiary },
  actionDivider: {
    width: 1,
    backgroundColor: colors.toroBorder,
    marginVertical: spacing.lg,
  },

  // Pending banner
  pendingBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warningText,
    gap: spacing.xs,
  },
  pendingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pendingTitle: {
    ...typography.bodySmall,
    color: colors.warningText,
    fontWeight: '600',
  },
  pendingSub: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  pendingBtns: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  pendingBtn: { paddingVertical: 4, paddingHorizontal: spacing.xs },
  pendingBtnResume: {
    ...typography.bodySmall,
    color: colors.warningText,
    fontWeight: '700',
  },
  pendingBtnCancel: { ...typography.bodySmall, color: colors.textTertiary },

  // Transaction list
  txnHeader: {
    ...typography.h3,
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  txnEmptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyBody: { ...typography.bodySmall, color: colors.textTertiary },

  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.toroBorder,
  },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnMid: { flex: 1, gap: 2 },
  txnLabel: { ...typography.bodySmall, color: colors.textPrimary },
  txnDate: { ...typography.caption, color: colors.textTertiary },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: { ...typography.bodySmall, fontWeight: '700' },
  txnStatusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  txnStatusText: { ...typography.caption, fontWeight: '600' },

  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  viewAllText: { ...typography.bodySmall, color: colors.primaryTeal },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceNeutral,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  sheetTall: { maxHeight: '82%' },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.toroBorder,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sheetBalanceHighlight: { color: colors.primaryTeal, fontWeight: '700' },
  sheetNote: {
    ...typography.caption,
    color: colors.textTertiary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },

  // Presets
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
  },
  presetBtnActive: {
    backgroundColor: colors.primaryTealLight,
    borderColor: colors.primaryTeal,
  },
  presetText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetTextActive: { color: colors.primaryTeal },

  // Amount input
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    paddingHorizontal: spacing.md,
    height: 52,
    marginBottom: spacing.sm,
  },
  currencyPrefix: {
    ...typography.h3,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  amountField: { flex: 1, ...typography.h3, color: colors.textPrimary },

  errorText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    marginBottom: spacing.sm,
  },

  sheetCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    minHeight: 50,
    marginTop: spacing.sm,
  },
  sheetCtaDim: { opacity: 0.55 },
  sheetCtaText: { ...typography.body, color: colors.white, fontWeight: '700' },

  // PayClinic specifics
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  clinicList: { maxHeight: 150, marginBottom: spacing.md },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
    backgroundColor: colors.screenBg,
  },
  clinicRowSelected: {
    borderColor: colors.primaryTeal,
    backgroundColor: colors.primaryTealLight,
  },
  clinicCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicCheckSelected: { borderColor: colors.primaryTeal },
  clinicInfo: { flex: 1 },
  clinicName: { ...typography.bodySmall, color: colors.textPrimary },
  clinicAddr: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  noClinicText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  restrictionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  restrictionIcon: { marginTop: 1 },
  restrictionNoticeText: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
    lineHeight: 16,
  },
});
