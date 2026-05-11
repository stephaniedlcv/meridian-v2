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

export type Profile = {
  id: string;
  full_name: string | null;
  biological_profile: BiologicalProfile | null;
  hormonal_profile: string | null;
  birth_date: string | null;
  medications: Json | null;
  safety_status: SafetyStatus;
  user_profile: UserProfile | null;
  onboarding_completed: boolean;
  created_at: string;
};

export type BiomarkerStatic = {
  id: string;
  user_id: string;
  marker_name: string;
  value: number;
  unit: string;
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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string | null;
          biological_profile?: BiologicalProfile | null;
          hormonal_profile?: string | null;
          birth_date?: string | null;
          medications?: Json | null;
          safety_status?: SafetyStatus;
          user_profile?: UserProfile | null;
          onboarding_completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          biological_profile?: BiologicalProfile | null;
          hormonal_profile?: string | null;
          birth_date?: string | null;
          medications?: Json | null;
          safety_status?: SafetyStatus;
          user_profile?: UserProfile | null;
          onboarding_completed?: boolean;
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
          unit: string;
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
          unit?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
