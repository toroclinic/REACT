import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { ClinicApi, MemberApi, ProfileApi } from '../services/api';
import { Clinic } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

type BookingStep = null | 'form';

export function ClinicsScreen() {
  const memberId = useAuthStore(s => s.memberId);
  const insets = useSafeAreaInsets();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filtered, setFiltered] = useState<Clinic[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferredClinicId, setPreferredClinicId] = useState<string | null>(
    null,
  );

  // Booking modal state
  const [bookingClinic, setBookingClinic] = useState<Clinic | null>(null);
  const [bookingStep, setBookingStep] = useState<BookingStep>(null);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('');
  const [bookNotes, setBookNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookSuccess, setBookSuccess] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const [allClinics, profile] = await Promise.all([
          ClinicApi.all(),
          memberId ? ProfileApi.getProfile(memberId) : Promise.resolve(null),
        ]);
        setClinics(allClinics);
        setFiltered(allClinics);
        if (profile) {
          setPreferredClinicId(profile.preferred_clinic_id);
        }
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const q = search.toLowerCase();
      setFiltered(
        clinics.filter(
          c =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            (c.address ?? '').toLowerCase().includes(q),
        ),
      );
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [search, clinics]);

  const openBooking = (clinic: Clinic) => {
    setBookingClinic(clinic);
    setBookDate('');
    setBookTime('');
    setBookNotes('');
    setBookSuccess(false);
    setBookingStep('form');
  };

  const submitBooking = async () => {
    if (!memberId || !bookingClinic || !bookDate) {
      return;
    }
    setBooking(true);
    try {
      await MemberApi.bookAppointment(memberId, {
        clinic_id: bookingClinic.clinic_id,
        location: bookingClinic.name,
        appointment_date: bookDate,
        appointment_time: bookTime || undefined,
        notes: bookNotes || undefined,
      });
      setBookSuccess(true);
    } catch {
      /* keep modal open with error — a future iteration can show inline error */
    } finally {
      setBooking(false);
    }
  };

  const renderClinic = ({ item }: { item: Clinic }) => {
    const isPreferred = item.clinic_id === preferredClinicId;
    const isActive = item.partner_status === 'active';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.clinicName}>{item.name}</Text>
            {isPreferred && (
              <View style={styles.preferredBadge}>
                <Text style={styles.preferredText}>Preferred</Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.statusBadge,
              isActive ? styles.statusActive : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isActive ? styles.statusTextActive : styles.statusTextPending,
              ]}
            >
              {isActive ? 'Partner' : 'Pending'}
            </Text>
          </View>
        </View>

        {item.address && <Text style={styles.address}>{item.address}</Text>}

        <View style={styles.metaRow}>
          {item.distance_km > 0 && (
            <Text style={styles.meta}>
              {item.distance_km.toFixed(1)} km away
            </Text>
          )}
          {item.opening_hours && (
            <Text style={styles.meta}>· {item.opening_hours}</Text>
          )}
        </View>

        {item.services && (
          <View style={styles.servicesRow}>
            {item.services
              .split(',')
              .slice(0, 4)
              .map(s => (
                <View key={s.trim()} style={styles.serviceTag}>
                  <Text style={styles.serviceTagText}>{s.trim()}</Text>
                </View>
              ))}
          </View>
        )}

        <View style={styles.actions}>
          {item.phone && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
            >
              <Text style={styles.actionBtnText}>📞 Call</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => openBooking(item)}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>
                Book appointment
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.screenTitle}>Clinics</Text>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search clinics…"
          placeholderTextColor={colors.textTertiary}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primaryTeal} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.clinic_id}
          renderItem={renderClinic}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={colors.primaryTeal}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🏥</Text>
              <Text style={styles.emptyTitle}>
                {search ? 'No clinics match your search' : 'No clinics found'}
              </Text>
            </View>
          }
        />
      )}

      {/* Booking modal */}
      <Modal
        visible={bookingStep === 'form'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setBookingStep(null);
        }}
      >
        <View style={[styles.modal, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book at {bookingClinic?.name}</Text>
            <TouchableOpacity
              onPress={() => setBookingStep(null)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {bookSuccess ? (
            <View style={styles.successWrap}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Appointment booked!</Text>
              <Text style={styles.successBody}>
                You'll receive a confirmation via SMS. View it on your Home
                screen.
              </Text>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setBookingStep(null)}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.fieldLabel}>Date *</Text>
              <TextInput
                style={styles.fieldInput}
                value={bookDate}
                onChangeText={setBookDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Time (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                value={bookTime}
                onChangeText={setBookTime}
                placeholder="e.g. 09:00"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                value={bookNotes}
                onChangeText={setBookNotes}
                placeholder="Any details for the clinic…"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[
                  styles.bookBtn,
                  (!bookDate || booking) && styles.bookBtnDisabled,
                ]}
                onPress={submitBooking}
                disabled={!bookDate || booking}
              >
                {booking ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.bookBtnText}>Confirm booking</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
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
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  searchInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },

  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  clinicName: { ...typography.h3, color: colors.textPrimary },
  preferredBadge: {
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  preferredText: {
    ...typography.caption,
    color: colors.primaryTeal,
    fontWeight: '600' as const,
  },
  statusBadge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusActive: { backgroundColor: colors.lightTealSurface },
  statusPending: { backgroundColor: colors.surfaceNeutral },
  statusText: { ...typography.caption, fontWeight: '600' as const },
  statusTextActive: { color: colors.primaryTeal },
  statusTextPending: { color: colors.textTertiary },
  address: { ...typography.bodySmall, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { ...typography.caption, color: colors.textTertiary },
  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  serviceTag: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  serviceTagText: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: colors.primaryTeal,
    borderColor: colors.primaryTeal,
  },
  actionBtnText: { ...typography.bodySmall, color: colors.textPrimary },
  actionBtnTextPrimary: { color: colors.white, fontWeight: '600' as const },

  emptyWrap: { alignItems: 'center', paddingTop: spacing.xl * 3 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  modal: { flex: 1, backgroundColor: colors.screenBg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalClose: { padding: spacing.sm },
  modalCloseText: { fontSize: 18, color: colors.textSecondary },
  modalContent: { padding: spacing.lg, gap: spacing.sm },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500' as const,
    marginTop: spacing.sm,
  },
  fieldInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldInputMulti: { height: 80, textAlignVertical: 'top' },
  bookBtn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  bookBtnDisabled: { backgroundColor: colors.surfaceNeutral },
  bookBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600' as const,
  },

  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  successIcon: { fontSize: 48, marginBottom: spacing.md },
  successTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  successBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  doneBtn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  doneBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600' as const,
  },
});
