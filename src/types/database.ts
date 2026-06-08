export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type BiologicalProfile = 'female' | 'male';

export type SafetyStatus = 'active' | 'medical_alert';

export type UserProfile =
  | 'bienestar'
  | 'optimizacion'
  | 'rendimiento'
  | 'condicion'
  | 'primer_paso';

export type BiomarkerState = 'Optimal' | 'Watch' | 'Attention' | 'Critical';

export type BiomarkerResultType = 'quantitative' | 'qualitative';

export type FeedbackEffectiveness = 'validated' | 'neutral' | 'failed';

export type AccountStatus =
  | 'active'
  | 'suspended'
  | 'banned'
  | 'disabled'
  | 'pending_review';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'analyst'
  | 'support'
  | 'clinician_readonly';

export type NotificationType =
  | 'in_app'
  | 'email'
  | 'push'
  | 'system_alert'
  | 'safety_alert';

export type NotificationStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'archived';

export type HealthEventType =
  | 'appointment'
  | 'lab'
  | 'inbody'
  | 'imaging'
  | 'other';

export type PrepStatus =
  | 'not_started'
  | 'in_progress'
  | 'ready';

export type HealthEventStatus =
  | 'upcoming'
  | 'completed'
  | 'cancelled'
  | 'needs_follow_up';

export type TirzepatideSite =
  | 'abdomen_left'
  | 'abdomen_right'
  | 'thigh_left'
  | 'thigh_right';

export type MedicationCategory =
  | 'glp1'
  | 'hormone'
  | 'thyroid'
  | 'rx'
  | 'other';

export type MedicationRoute =
  | 'oral'
  | 'subcutaneous'
  | 'intramuscular'
  | 'topical'
  | 'sublingual'
  | 'intranasal'
  | 'other';

export type MedicationSite =
  | 'abdomen_left'
  | 'abdomen_right'
  | 'thigh_left'
  | 'thigh_right'
  | 'arm_left'
  | 'arm_right'
  | 'other';

export type SupplementDoseUnit =
  | 'mg'
  | 'mcg'
  | 'g'
  | 'IU'
  | 'capsules'
  | 'ml'
  | 'drops'
  | 'servings';

export type SupplementFrequency =
  | 'daily'
  | '2x_week'
  | '3x_week'
  | '5x_week'
  | 'as_needed'
  | 'high_stress_only'
  | 'cycling'
  | 'other';

export type SupplementTiming =
  | 'morning'
  | 'midday'
  | 'evening'
  | 'before_bed'
  | 'with_food'
  | 'before_training'
  | 'after_training'
  | 'other';

export type PeptideDoseUnit = 'mcg' | 'mg' | 'units' | 'IU';

export type PeptideRoute =
  | 'subcutaneous'
  | 'intramuscular'
  | 'oral'
  | 'intranasal'
  | 'sublingual'
  | 'other';

export type TrainingGoal =
  | 'fat_loss'
  | 'muscle_gain'
  | 'recomposition'
  | 'performance'
  | 'wellness'
  | 'maintenance';

export type PendingBiomarkerStatus =
  | 'pending_classification'
  | 'classified'
  | 'ignored'
  | 'rejected';

export type LandingBackgroundTheme =
  | 'deep_teal'
  | 'midnight'
  | 'forest'
  | 'glacier';

export type LandingAmbientMode =
  | 'standard'
  | 'minimal'
  | 'intense'
  | 'disabled';

export type Profile = {
  id: string;

  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;

  biological_profile: BiologicalProfile;
  hormonal_profile: string | null;
  birth_date: string | null;
  medications: Json | null;

  safety_status: SafetyStatus;
  user_profile: UserProfile;
  onboarding_completed: boolean;
  baseline_completed: boolean;
  current_state: string | null;

  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  training_days: string | null;
  body_goal_phase: string | null;
  diet_pattern: string | null;

  glp1_protocol_enabled: boolean;
  medications_enabled: boolean;
  peptides_enabled: boolean;

  account_status: AccountStatus;
  suspended_at: string | null;
  banned_at: string | null;
  disabled_at: string | null;
  deleted_at: string | null;
  moderation_reason: string | null;

  created_at: string;
  updated_at: string | null;
};

export type ProfileInsert = Partial<Profile> & {
  id: string;
};

export type ProfileUpdate = Partial<Profile>;

export type BiomarkerStatic = {
  id: string;
  user_id: string;
  marker_name: string;

  value: number | null;
  value_qualitative: string | null;
  result_type: BiomarkerResultType | null;

  unit: string | null;
  reference_range_min: number | null;
  reference_range_max: number | null;
  optimal_range_min: number | null;
  optimal_range_max: number | null;

  state: BiomarkerState;
  collected_at: string;
  source_pdf_url: string | null;

  source_marker_name: string | null;
  source_raw_value: string | null;
  panel_type: string | null;

  flag_error: boolean;
  validated: boolean;
  created_at: string;
};

export type BiomarkerStaticInsert = Partial<BiomarkerStatic> & {
  user_id: string;
  marker_name: string;
  state: BiomarkerState;
  collected_at: string;
};

export type BiomarkerStaticUpdate = Partial<BiomarkerStatic>;

export type WearableTelemetry = {
  id: string;
  user_id: string;
  metric_type: string;
  value: number;
  recorded_at: string;
  rolling_average_7d: number | null;
  rolling_average_21d: number | null;
  baseline_established: boolean;
  source: string | null;
  created_at: string;
};

export type WearableTelemetryInsert = Partial<WearableTelemetry> & {
  user_id: string;
  metric_type: string;
  value: number;
  recorded_at: string;
};

export type FeedbackLoop = {
  id: string;
  user_id: string;
  insight_id: string;
  adherence_score: number | null;
  skip_reason: string | null;
  biometric_delta: Json | null;
  effectiveness: FeedbackEffectiveness;
  window_days: number;
  created_at: string;
};

export type FeedbackLoopInsert = Partial<FeedbackLoop> & {
  user_id: string;
  insight_id: string;
  effectiveness: FeedbackEffectiveness;
  window_days: number;
};

export type HealthEvent = {
  id: string;
  user_id: string;

  event_type: HealthEventType;
  title: string | null;
  specialty: string;
  provider_name: string | null;
  location: string | null;
  is_virtual: boolean;
  starts_at: string;
  reason: string | null;

  symptoms_notes: string | null;
  medications_to_review: string | null;
  supplements_to_review: string | null;
  related_lab_ids: string[];
  things_to_bring: string | null;
  user_questions: string | null;

  ai_suggested_questions: Json | null;
  prep_status: PrepStatus;

  outcome_notes: string | null;
  follow_up_tasks: string | null;
  follow_up_date: string | null;

  status: HealthEventStatus;
  created_at: string;
  updated_at: string;
};

export type HealthEventInsert = Partial<HealthEvent> & {
  user_id: string;
  specialty: string;
  starts_at: string;
};

export type HealthEventUpdate = Partial<HealthEvent>;

export type LabDocument = {
  id: string;
  user_id: string;

  name: string;
  lab_date: string | null;
  specialty: string | null;

  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
};

export type LabDocumentInsert = Partial<LabDocument> & {
  user_id: string;
  name: string;
  storage_path: string;
};

export type LabDocumentUpdate = Partial<LabDocument>;

export type TirzepatideEntry = {
  id: string;
  user_id: string;
  date: string;
  dose: number;
  site: TirzepatideSite;
  notes: string | null;
  created_at: string;
};

export type TirzepatideEntryInsert = Partial<TirzepatideEntry> & {
  user_id: string;
  date: string;
  dose: number;
  site: TirzepatideSite;
};

export type SupplementStack = {
  id: string;
  user_id: string;
  supplement_name: string;
  brand: string | null;
  dose: number | null;
  dose_unit: SupplementDoseUnit;
  frequency: SupplementFrequency;
  timing: SupplementTiming | null;
  connected_biomarker: string | null;
  active: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SupplementStackInsert = Partial<SupplementStack> & {
  user_id: string;
  supplement_name: string;
};

export type MedicationEntry = {
  id: string;
  user_id: string;
  medication_name: string;
  category: MedicationCategory;
  date: string;
  dose: number;
  dose_unit: 'mg' | 'mcg' | 'g' | 'units' | 'IU' | 'ml';
  route: MedicationRoute;
  site: MedicationSite | null;
  notes: string | null;
  created_at: string;
};

export type MedicationEntryInsert = Partial<MedicationEntry> & {
  user_id: string;
  medication_name: string;
  date: string;
  dose: number;
};

export type PeptideEntry = {
  id: string;
  user_id: string;
  peptide_name: string;
  date: string;
  dose: number;
  dose_unit: PeptideDoseUnit;
  route: PeptideRoute;
  cycle_id: string | null;
  cycle_active: boolean;
  cycle_start: string | null;
  cycle_end: string | null;
  notes: string | null;
  created_at: string;
};

export type PeptideEntryInsert = Partial<PeptideEntry> & {
  user_id: string;
  peptide_name: string;
  date: string;
  dose: number;
};

export type TrainingProgram = {
  id: string;
  user_id: string;
  name: string;
  goal: TrainingGoal;
  total_weeks: number;
  start_date: string;
  sessions_per_week: number;
  template_id: string | null;
  phases: Json;
  milestones: Json;
  deload_weeks: number[];
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingProgramInsert = Partial<TrainingProgram> & {
  user_id: string;
  name: string;
  start_date: string;
};

export type PendingBiomarker = {
  id: string;
  user_id: string;

  raw_name: string;
  raw_value: number | null;
  raw_unit: string | null;
  raw_reference_range: string | null;

  collected_at: string;
  source_pdf_name: string | null;

  status: PendingBiomarkerStatus;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution: string | null;
  canonical_slug: string | null;

  created_at: string;
  updated_at: string;
};

export type PendingBiomarkerInsert = Partial<PendingBiomarker> & {
  user_id: string;
  raw_name: string;
};

export type AdminUser = {
  id: string;
  user_id: string;
  role: AdminRole;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserInsert = Partial<AdminUser> & {
  user_id: string;
  role: AdminRole;
};

export type AdminActivityLog = {
  id: string;
  admin_user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Json | null;
  ip_address: string | null;
  created_at: string;
};

export type AdminActivityLogInsert = Partial<AdminActivityLog> & {
  admin_user_id: string;
  action: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  status: NotificationStatus;
  target_segment: string;
  segment_filters: Json | null;
  recipient_count: number | null;
  created_by: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationInsert = Partial<Notification> & {
  title: string;
  body: string;
  type: NotificationType;
};

export type NotificationRecipient = {
  id: string;
  notification_id: string;
  user_id: string;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  delivered_at: string | null;
  opened_at: string | null;
  created_at: string;
};

export type NotificationRecipientInsert = Partial<NotificationRecipient> & {
  notification_id: string;
  user_id: string;
};

export type LandingExperience = {
  id: string;
  is_active: boolean;

  hero_video_url: string | null;
  mobile_video_url: string | null;
  poster_image_url: string | null;
  logo_variant_url: string | null;

  headline: string;
  subcopy: string;
  primary_cta_label: string;
  secondary_cta_label: string;

  background_theme: LandingBackgroundTheme;
  overlay_opacity: number;
  ambient_mode: LandingAmbientMode;

  created_at: string;
  updated_at: string;
};

export type LandingExperienceInsert = Partial<LandingExperience>;

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, ProfileInsert, ProfileUpdate>;
      biomarkers_static: Table<BiomarkerStatic, BiomarkerStaticInsert, BiomarkerStaticUpdate>;
      wearable_telemetry: Table<WearableTelemetry, WearableTelemetryInsert, Partial<WearableTelemetry>>;
      feedback_loop: Table<FeedbackLoop, FeedbackLoopInsert, Partial<FeedbackLoop>>;

      health_events: Table<HealthEvent, HealthEventInsert, HealthEventUpdate>;
      lab_documents: Table<LabDocument, LabDocumentInsert, LabDocumentUpdate>;

      tirzepatide_entries: Table<TirzepatideEntry, TirzepatideEntryInsert, Partial<TirzepatideEntry>>;
      supplement_stack: Table<SupplementStack, SupplementStackInsert, Partial<SupplementStack>>;
      medication_entries: Table<MedicationEntry, MedicationEntryInsert, Partial<MedicationEntry>>;
      peptide_entries: Table<PeptideEntry, PeptideEntryInsert, Partial<PeptideEntry>>;
      training_programs: Table<TrainingProgram, TrainingProgramInsert, Partial<TrainingProgram>>;

      pending_biomarkers: Table<PendingBiomarker, PendingBiomarkerInsert, Partial<PendingBiomarker>>;

      admin_users: Table<AdminUser, AdminUserInsert, Partial<AdminUser>>;
      admin_activity_logs: Table<AdminActivityLog, AdminActivityLogInsert, Partial<AdminActivityLog>>;
      notifications: Table<Notification, NotificationInsert, Partial<Notification>>;
      notification_recipients: Table<NotificationRecipient, NotificationRecipientInsert, Partial<NotificationRecipient>>;

      landing_experience: Table<LandingExperience, LandingExperienceInsert, Partial<LandingExperience>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
