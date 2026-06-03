export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type BiologicalProfile = 'female' | 'male';

export type SafetyStatus = 'active' | 'medical_alert';

export type UserProfile =
  | 'bienestar'
  | 'optimizacion'
  | 'rendimiento'
  | 'condicion'
  | 'primer_paso';

export type BiomarkerState = 'Optimal' | 'Watch' | 'Attention' | 'Critical';

export type FeedbackEffectiveness = 'validated' | 'neutral' | 'failed';

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

export type Profile = {
  id: string;
  full_name: string | null;
  biological_profile: BiologicalProfile;
  hormonal_profile: string | null;
  birth_date: string | null;
  medications: Json | null;
  safety_status: SafetyStatus;
  user_profile: UserProfile;
  onboarding_completed: boolean;
  glp1_protocol_enabled: boolean;
  created_at: string;
};

export type BiomarkerStatic = {
  id: string;
  user_id: string;
  marker_name: string;
  value: number;
  unit: string | null;
  reference_range_min: number | null;
  reference_range_max: number | null;
  optimal_range_min: number | null;
  optimal_range_max: number | null;
  state: BiomarkerState;
  collected_at: string;
  source_pdf_url: string | null;
  flag_error: boolean;
  validated: boolean;
  created_at: string;
};

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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string | null;
          biological_profile: BiologicalProfile;
          hormonal_profile?: string | null;
          birth_date?: string | null;
          medications?: Json | null;
          safety_status?: SafetyStatus;
          user_profile?: UserProfile;
          onboarding_completed?: boolean;
          glp1_protocol_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          biological_profile?: BiologicalProfile;
          hormonal_profile?: string | null;
          birth_date?: string | null;
          medications?: Json | null;
          safety_status?: SafetyStatus;
          user_profile?: UserProfile;
          onboarding_completed?: boolean;
          glp1_protocol_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      biomarkers_static: {
        Row: BiomarkerStatic;
        Insert: {
          id?: string;
          user_id: string;
          marker_name: string;
          value: number;
          unit?: string | null;
          reference_range_min?: number | null;
          reference_range_max?: number | null;
          optimal_range_min?: number | null;
          optimal_range_max?: number | null;
          state: BiomarkerState;
          collected_at: string;
          source_pdf_url?: string | null;
          flag_error?: boolean;
          validated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          marker_name?: string;
          value?: number;
          unit?: string | null;
          reference_range_min?: number | null;
          reference_range_max?: number | null;
          optimal_range_min?: number | null;
          optimal_range_max?: number | null;
          state?: BiomarkerState;
          collected_at?: string;
          source_pdf_url?: string | null;
          flag_error?: boolean;
          validated?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      wearable_telemetry: {
        Row: WearableTelemetry;
        Insert: {
          id?: string;
          user_id: string;
          metric_type: string;
          value: number;
          recorded_at: string;
          rolling_average_7d?: number | null;
          rolling_average_21d?: number | null;
          baseline_established?: boolean;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          metric_type?: string;
          value?: number;
          recorded_at?: string;
          rolling_average_7d?: number | null;
          rolling_average_21d?: number | null;
          baseline_established?: boolean;
          source?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback_loop: {
        Row: FeedbackLoop;
        Insert: {
          id?: string;
          user_id: string;
          insight_id: string;
          adherence_score?: number | null;
          skip_reason?: string | null;
          biometric_delta?: Json | null;
          effectiveness: FeedbackEffectiveness;
          window_days: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          insight_id?: string;
          adherence_score?: number | null;
          skip_reason?: string | null;
          biometric_delta?: Json | null;
          effectiveness?: FeedbackEffectiveness;
          window_days?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      health_events: {
        Row: HealthEvent;
        Insert: {
          id?: string;
          user_id: string;

          event_type?: HealthEventType;
          title?: string | null;
          specialty: string;
          provider_name?: string | null;
          location?: string | null;
          is_virtual?: boolean;
          starts_at: string;
          reason?: string | null;

          symptoms_notes?: string | null;
          medications_to_review?: string | null;
          supplements_to_review?: string | null;
          related_lab_ids?: string[];
          things_to_bring?: string | null;
          user_questions?: string | null;

          ai_suggested_questions?: Json | null;
          prep_status?: PrepStatus;

          outcome_notes?: string | null;
          follow_up_tasks?: string | null;
          follow_up_date?: string | null;

          status?: HealthEventStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;

          event_type?: HealthEventType;
          title?: string | null;
          specialty?: string;
          provider_name?: string | null;
          location?: string | null;
          is_virtual?: boolean;
          starts_at?: string;
          reason?: string | null;

          symptoms_notes?: string | null;
          medications_to_review?: string | null;
          supplements_to_review?: string | null;
          related_lab_ids?: string[];
          things_to_bring?: string | null;
          user_questions?: string | null;

          ai_suggested_questions?: Json | null;
          prep_status?: PrepStatus;

          outcome_notes?: string | null;
          follow_up_tasks?: string | null;
          follow_up_date?: string | null;

          status?: HealthEventStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lab_documents: {
        Row: LabDocument;
        Insert: {
          id?: string;
          user_id: string;

          name: string;
          lab_date?: string | null;
          specialty?: string | null;

          storage_path: string;
          file_name?: string | null;
          file_size?: number | null;
          file_type?: string | null;
          notes?: string | null;

          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;

          name?: string;
          lab_date?: string | null;
          specialty?: string | null;

          storage_path?: string;
          file_name?: string | null;
          file_size?: number | null;
          file_type?: string | null;
          notes?: string | null;

          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
