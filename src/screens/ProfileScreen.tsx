import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { ProfileApi, ClinicApi, SchemesApi } from '../services/api';
import { cacheMemberProfile, getCachedMemberProfile } from '../services/cache';
import {
  Clinic,
  MedicalAidScheme,
  MemberProfile,
  ProfileUpdatePayload,
} from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

function PickerSeparator() {
  return <View style={pickerSepStyle} />;
}
const pickerSepStyle = StyleSheet.create({
  s: { height: 0.5, backgroundColor: colors.toroBorder },
}).s;

function initials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  Starting: colors.tierStarting,
  Bronze: colors.tierBronze,
  Silver: colors.tierSilver,
  Gold: colors.tierGold,
};

export function ProfileScreen() {
  const memberId = useAuthStore(s => s.memberId);
  const signOut = useAuthStore(s => s.signOut);
  const engagementProfile = useEngagementStore(s => s.profile);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Clinic picker
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [showClinicPicker, setShowClinicPicker] = useState(false);
  const [savingClinic, setSavingClinic] = useState(false);

  // Scheme picker
  const [schemes, setSchemes] = useState<MedicalAidScheme[]>([]);
  const [showSchemePicker, setShowSchemePicker] = useState(false);
  const [savingScheme, setSavingScheme] = useState(false);
  const [currentSchemeId, setCurrentSchemeId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Edit profile
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editMaritalStatus, setEditMaritalStatus] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const loadProfile = useCallback(async () => {
    const cached = await getCachedMemberProfile();
    if (cached) {
      setProfile(cached);
      setCurrentSchemeId(cached.scheme_id ?? null);
    }
    if (!memberId) {
      if (!cached) {
        setFetchError('Not signed in. Please sign in again.');
      }
      return;
    }
    setFetchError(null);
    setSyncing(true);
    try {
      const fresh = await ProfileApi.getProfile(memberId);
      setProfile(fresh);
      setCurrentSchemeId(fresh.scheme_id ?? null);
      await cacheMemberProfile(fresh);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not load profile.';
      if (!cached) {
        setFetchError(message);
      }
    } finally {
      setSyncing(false);
    }
  }, [memberId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    ClinicApi.all()
      .then(setClinics)
      .catch(() => setClinics([]));
    SchemesApi.listSchemes()
      .then(setSchemes)
      .catch(() => setSchemes([]));
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const selectClinic = async (clinicId: string | null) => {
    if (!memberId) {
      return;
    }
    setShowClinicPicker(false);
    setSavingClinic(true);
    try {
      await ProfileApi.updateClinic(memberId, clinicId);
      setProfile(prev =>
        prev ? { ...prev, preferred_clinic_id: clinicId } : prev,
      );
    } catch {
      Alert.alert(
        'Error',
        'Could not update your preferred clinic. Try again.',
      );
    } finally {
      setSavingClinic(false);
    }
  };

  const selectScheme = async (schemeId: string | null) => {
    if (!memberId) {
      return;
    }
    setShowSchemePicker(false);
    setSavingScheme(true);
    try {
      await SchemesApi.updateMemberScheme(memberId, schemeId);
      setCurrentSchemeId(schemeId);
    } catch {
      Alert.alert('Error', 'Could not update your scheme. Try again.');
    } finally {
      setSavingScheme(false);
    }
  };

  const openEditProfile = () => {
    if (!profile) {
      return;
    }
    setEditFullName(profile.full_name);
    setEditDateOfBirth(profile.date_of_birth ?? '');
    setEditGender(profile.gender ?? '');
    setEditMaritalStatus(profile.marital_status ?? '');
    setEditAddress(profile.address ?? '');
    setShowEditProfile(true);
  };

  const saveProfile = async () => {
    if (!memberId) {
      return;
    }
    const trimmedName = editFullName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Full name cannot be empty.');
      return;
    }
    const payload: ProfileUpdatePayload = {
      full_name: trimmedName,
      date_of_birth: editDateOfBirth.trim(),
      gender: editGender,
      marital_status: editMaritalStatus,
      address: editAddress.trim(),
    };
    setSavingProfile(true);
    try {
      const updated = await ProfileApi.updateProfile(memberId, payload);
      setProfile(updated);
      await cacheMemberProfile(updated);
      setShowEditProfile(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not update your profile.';
      Alert.alert('Error', message);
    } finally {
      setSavingProfile(false);
    }
  };

  if (!profile) {
    if (fetchError) {
      return (
        <View style={styles.loading}>
          <Icon
            name="cloud-off-outline"
            size={40}
            color={colors.textTertiary}
          />
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              void loadProfile();
            }}
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primaryTeal} />
      </View>
    );
  }

  const tier = engagementProfile?.tier ?? 'Starting';
  const score = engagementProfile?.score ?? 0;
  const creditPct = engagementProfile?.credit_pct ?? 0;
  const tierColors = TIER_COLORS[tier] ?? colors.tierStarting;

  const preferredClinic = clinics.find(
    c => c.clinic_id === profile.preferred_clinic_id,
  );
  const currentScheme = schemes.find(s => s.scheme_id === currentSchemeId);

  const detailRows: [string, string | React.ReactNode][] = [
    ['Phone', profile.phone_number],
    ['Policy', profile.policy_number],
    ['Language', profile.preferred_language === 'tn' ? 'Setswana' : 'English'],
    [
      'Renewal',
      new Date(profile.renewal_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    ],
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile.full_name)}</Text>
          </View>
          {(syncing || savingClinic || savingScheme) && (
            <ActivityIndicator
              size="small"
              color={colors.primaryTeal}
              style={styles.syncIndicator}
            />
          )}
        </View>
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.memberId}>Member · {profile.member_id}</Text>
      </View>

      {/* Tier badge */}
      <View style={[styles.tierBadge, { backgroundColor: tierColors.bg }]}>
        <View style={styles.tierLeft}>
          <Text style={[styles.tierLabel, { color: tierColors.text }]}>
            {tier}
          </Text>
          <Text style={[styles.tierScore, { color: tierColors.text }]}>
            {score.toFixed(0)} / 100 pts
          </Text>
        </View>
        <View style={styles.tierRight}>
          <Text style={[styles.creditPct, { color: tierColors.text }]}>
            {creditPct}%
          </Text>
          <Text style={[styles.creditLabel, { color: tierColors.text }]}>
            premium credit
          </Text>
        </View>
      </View>

      {/* Detail rows */}
      <View style={styles.card}>
        {detailRows.map(([label, value], i) => (
          <View
            key={String(label)}
            style={[styles.row, i < detailRows.length - 1 && styles.rowDivider]}
          >
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {String(value)}
            </Text>
          </View>
        ))}
      </View>

      {/* Edit profile */}
      <TouchableOpacity style={styles.settingRow} onPress={openEditProfile}>
        <View style={styles.settingRowLeft}>
          <Icon
            name="account-edit-outline"
            size={18}
            color={colors.primaryTeal}
          />
          <View>
            <Text style={styles.settingRowLabel}>Personal details</Text>
            <Text style={styles.settingRowValue}>Edit your profile</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Preferred clinic */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setShowClinicPicker(true)}
      >
        <View style={styles.settingRowLeft}>
          <Icon name="hospital-building" size={18} color={colors.primaryTeal} />
          <View>
            <Text style={styles.settingRowLabel}>Preferred clinic</Text>
            <Text style={styles.settingRowValue}>
              {preferredClinic ? preferredClinic.name : 'Tap to select'}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Medical aid scheme */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => setShowSchemePicker(true)}
      >
        <View style={styles.settingRowLeft}>
          {currentScheme ? (
            <View
              style={[
                styles.schemeInitials,
                { backgroundColor: currentScheme.color },
              ]}
            >
              <Text style={styles.schemeInitialsText}>
                {currentScheme.logo_initials}
              </Text>
            </View>
          ) : (
            <Icon
              name="card-account-details-outline"
              size={18}
              color={colors.primaryTeal}
            />
          )}
          <View>
            <Text style={styles.settingRowLabel}>Medical aid scheme</Text>
            <Text style={styles.settingRowValue}>
              {currentScheme ? currentScheme.name : 'Tap to select'}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Member type pill */}
      {profile.chronic_member && (
        <View style={styles.chronicPill}>
          <Icon name="shield-heart" size={14} color={colors.primaryTeal} />
          <Text style={styles.chronicText}>
            Chronic member — enhanced scoring applies
          </Text>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Icon name="logout" size={16} color={colors.coral} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Wellness+ · Policy ID {profile.policy_number}
      </Text>

      {/* Clinic picker modal */}
      <Modal
        visible={showClinicPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClinicPicker(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose preferred clinic</Text>
            <TouchableOpacity
              onPress={() => setShowClinicPicker(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={clinics}
            keyExtractor={c => c.clinic_id}
            removeClippedSubviews
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pickerRow,
                  item.clinic_id === profile.preferred_clinic_id &&
                    styles.pickerRowSelected,
                ]}
                onPress={() => selectClinic(item.clinic_id)}
              >
                <View style={styles.pickerRowLeft}>
                  <Icon
                    name="hospital-building"
                    size={16}
                    color={
                      item.clinic_id === profile.preferred_clinic_id
                        ? colors.primaryTeal
                        : colors.textTertiary
                    }
                  />
                  <View>
                    <Text style={styles.pickerRowLabel}>{item.name}</Text>
                    {item.address && (
                      <Text style={styles.pickerRowSub}>{item.address}</Text>
                    )}
                  </View>
                </View>
                {item.clinic_id === profile.preferred_clinic_id && (
                  <Icon
                    name="check-circle"
                    size={18}
                    color={colors.primaryTeal}
                  />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={PickerSeparator}
            contentContainerStyle={styles.pickerListContent}
          />
        </View>
      </Modal>

      {/* Scheme picker modal */}
      <Modal
        visible={showSchemePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSchemePicker(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose medical aid scheme</Text>
            <TouchableOpacity
              onPress={() => setShowSchemePicker(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={schemes}
            keyExtractor={s => s.scheme_id}
            removeClippedSubviews
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.pickerRow,
                  item.scheme_id === currentSchemeId &&
                    styles.pickerRowSelected,
                ]}
                onPress={() => selectScheme(item.scheme_id)}
              >
                <View style={styles.pickerRowLeft}>
                  <View
                    style={[
                      styles.schemeInitials,
                      { backgroundColor: item.color },
                    ]}
                  >
                    <Text style={styles.schemeInitialsText}>
                      {item.logo_initials}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.pickerRowLabel}>{item.name}</Text>
                    <Text style={styles.pickerRowSub}>
                      Gold threshold: {item.gold_threshold} pts ·{' '}
                      {item.gold_credit_pct}% max credit
                    </Text>
                  </View>
                </View>
                {item.scheme_id === currentSchemeId && (
                  <Icon
                    name="check-circle"
                    size={18}
                    color={colors.primaryTeal}
                  />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={PickerSeparator}
            contentContainerStyle={styles.pickerListContent}
          />
        </View>
      </Modal>

      {/* Edit profile modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <TouchableOpacity
              onPress={() => setShowEditProfile(false)}
              style={styles.modalClose}
              disabled={savingProfile}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.editForm}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.fieldInput}
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Full name"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Date of birth</Text>
            <TextInput
              style={styles.fieldInput}
              value={editDateOfBirth}
              onChangeText={setEditDateOfBirth}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.segmentRow}>
              {[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
                { value: 'prefer_not_to_say', label: 'Prefer not to say' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segmentChip,
                    editGender === opt.value && styles.segmentChipSelected,
                  ]}
                  onPress={() =>
                    setEditGender(editGender === opt.value ? '' : opt.value)
                  }
                >
                  <Text
                    style={[
                      styles.segmentChipText,
                      editGender === opt.value &&
                        styles.segmentChipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Marital status</Text>
            <View style={styles.segmentRow}>
              {[
                { value: 'single', label: 'Single' },
                { value: 'married', label: 'Married' },
                { value: 'divorced', label: 'Divorced' },
                { value: 'widowed', label: 'Widowed' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segmentChip,
                    editMaritalStatus === opt.value &&
                      styles.segmentChipSelected,
                  ]}
                  onPress={() =>
                    setEditMaritalStatus(
                      editMaritalStatus === opt.value ? '' : opt.value,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.segmentChipText,
                      editMaritalStatus === opt.value &&
                        styles.segmentChipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="Street, city"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveBtn, savingProfile && styles.saveBtnDisabled]}
              onPress={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: {
    padding: spacing.lg + 2,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTeal,
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '600' as const,
  },

  header: { alignItems: 'center', paddingTop: spacing.md },
  avatarWrap: { position: 'relative', marginBottom: spacing.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.lightTealSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primaryTeal,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '500' as const,
    color: colors.toroInk,
  },
  syncIndicator: { position: 'absolute', bottom: -4, right: -4 },
  name: { ...typography.h2, color: colors.textPrimary },
  memberId: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },

  tierBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tierLeft: { gap: 2 },
  tierLabel: { ...typography.h3 },
  tierScore: { ...typography.caption },
  tierRight: { alignItems: 'flex-end', gap: 2 },
  creditPct: { fontSize: 28, fontWeight: '500' as const },
  creditLabel: { ...typography.caption },

  card: {
    borderWidth: 1,
    borderColor: colors.toroBorder,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: colors.toroBorder },
  rowLabel: { ...typography.bodySmall, color: colors.textSecondary },
  rowValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingRowLabel: { ...typography.caption, color: colors.textTertiary },
  settingRowValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginTop: 2,
  },
  schemeInitials: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schemeInitialsText: {
    color: colors.white,
    fontWeight: '700' as const,
    fontSize: 11,
  },

  chronicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chronicText: { ...typography.caption, color: colors.primaryTeal },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.dangerText,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  signOutText: {
    ...typography.bodySmall,
    color: colors.dangerText,
    fontWeight: '600' as const,
  },
  footer: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  modal: { flex: 1, backgroundColor: colors.screenBg, paddingTop: spacing.lg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalClose: { padding: spacing.sm },
  modalCloseText: {
    ...typography.bodySmall,
    color: colors.primaryTeal,
    fontWeight: '600' as const,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pickerRowSelected: { backgroundColor: colors.lightTealSurface },
  pickerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  pickerRowLabel: { ...typography.body, color: colors.textPrimary },
  pickerRowSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },

  editForm: { padding: spacing.lg, gap: spacing.xs, paddingBottom: 40 },
  fieldLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  fieldInputMultiline: { minHeight: 72, textAlignVertical: 'top' as const },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  segmentChip: {
    borderWidth: 1,
    borderColor: colors.toroBorder,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  segmentChipSelected: {
    backgroundColor: colors.primaryTealLight,
    borderColor: colors.primaryTeal,
  },
  segmentChipText: { ...typography.bodySmall, color: colors.textSecondary },
  segmentChipTextSelected: {
    color: colors.primaryTeal,
    fontWeight: '600' as const,
  },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600' as const,
  },
  pickerListContent: { paddingBottom: 40 },
});
