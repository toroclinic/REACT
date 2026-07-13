// Addendum 2 board component kit — RN ports of the PWA's src/ui/ patterns.
// Semantics rules enforced by these components (same as the PWA):
//   - Gold ONLY for rewards/earned-pula/streak (PulaCreditChip, StreakBadge,
//     EducationSteps number chips, tier-gold).
//   - Orange Money ONLY for the payment rail (QuickActionsRow orange variant).
//   - Emergency Red ONLY in EmergencyNotice/escalation contexts.
//   - VerifiedTick renders null unless a SERVER-confirmed boolean is true.
//   - No card shadows — hairline borders + tint only.
export { SectionHeading } from './SectionHeading';
export { MintTag } from './MintTag';
export { FilterChips } from './FilterChips';
export { VerifiedTick } from './VerifiedTick';
export { StreakBadge } from './StreakBadge';
export { EscalationBadge } from './EscalationBadge';
export { EmergencyNotice } from './EmergencyNotice';
export { PulaCreditChip } from './PulaCreditChip';
export { HeroHeaderCard } from './HeroHeaderCard';
export { QuickActionsRow, type QuickAction } from './QuickActionsRow';
export { MonthSummaryCard } from './MonthSummaryCard';
export { EducationSteps, type EducationStep } from './EducationSteps';
export { DarkPaySurface } from './DarkPaySurface';
export { DayHeader, dayLabel, groupByDay } from './GroupedList';
export { ActivityCalendar, ACTIVITIES, DURATIONS } from './ActivityCalendar';
