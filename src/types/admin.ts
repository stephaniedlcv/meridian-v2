export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'analyst'
  | 'support'
  | 'clinician_readonly'

export type AccountStatus =
  | 'active'
  | 'suspended'
  | 'banned'
  | 'disabled'
  | 'pending_review'

export type NotificationStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived'
export type NotificationType   = 'in_app' | 'email' | 'push' | 'system_alert' | 'safety_alert'
export type TargetSegment =
  | 'all'
  | 'active_7d'
  | 'onboarding_incomplete'
  | 'no_labs'
  | 'safety_alert'
  | 'wearable_connected'
  | 'specific_users'
  | 'female_only'
  | 'male_only'
  | 'admins_only'
  | 'non_admins'
  | 'custom'

export interface SegmentFilters {
  biological_profile?: 'female' | 'male'
  is_admin?:           boolean
  has_labs?:           boolean
  active_7d?:          boolean
  onboarding_incomplete?: boolean
  specific_user_ids?:  string[]
  // Future-ready slots
  subscription_tier?:  string
  has_wearable?:       boolean
  health_state?:       string
  feature_flag?:       string
}

export interface AdminUser {
  id:          string
  user_id:     string
  role:        AdminRole
  created_by:  string | null
  created_at:  string
  updated_at:  string
}

export interface AdminActivityLog {
  id:            string
  admin_user_id: string
  action:        string
  resource_type: string | null
  resource_id:   string | null
  metadata:      Record<string, unknown> | null
  ip_address:    string | null
  created_at:    string
}

export interface Notification {
  id:               string
  title:            string
  body:             string
  type:             NotificationType
  status:           NotificationStatus
  target_segment:   TargetSegment
  segment_filters:  Record<string, unknown> | null
  recipient_count:  number
  created_by:       string | null
  scheduled_for:    string | null
  sent_at:          string | null
  created_at:       string
  updated_at:       string
}

export interface NotificationRecipient {
  id:              string
  notification_id: string
  user_id:         string
  delivered:       boolean
  opened:          boolean
  clicked:         boolean
  delivered_at:    string | null
  opened_at:       string | null
  created_at:      string
}

// ── Dashboard metrics ─────────────────────────────────────────────
export interface PlatformStats {
  totalUsers:              number
  activeUsers7d:           number
  activeUsers30d:          number
  labsUploaded:            number
  onboardingCompletionPct: number
  safetyAlertCount:        number
  avgLabsPerUser:          number
  pendingBiomarkers:       number
  flaggedBiomarkers:       number
  topBiomarkers:           { name: string; count: number }[]
  signupsByDay:            { date: string; count: number }[]
  stateDistribution:       { state: string; count: number }[]
  biologicalProfileSplit:  { profile: string; count: number }[]
  userProfileSplit:        { profile: string; count: number }[]
}

// ── User management ───────────────────────────────────────────────
export interface AdminUserRow {
  id:                   string
  email:                string | null
  display_name:         string | null
  full_name:            string | null
  biological_profile:   string | null
  user_profile:         string | null
  safety_status:        string
  onboarding_completed: boolean
  labs_count:           number
  created_at:           string
  updated_at:           string | null
  // Moderation fields
  admin_role:           AdminRole | null
  is_admin:             boolean
  account_status:       AccountStatus
}

export interface AdminUserDetail extends AdminUserRow {
  birth_date:          string | null
  height_cm:           number | null
  weight_kg:           number | null
  activity_level:      string | null
  hormonal_profile:    string | null
  diet_pattern:        string | null
  body_goal_phase:     string | null
  // Moderation detail
  suspended_at:        string | null
  banned_at:           string | null
  disabled_at:         string | null
  deleted_at:          string | null
  moderation_reason:   string | null
  recentBiomarkers:    RecentBiomarkerRow[]
  recentActivity:      AdminActivityLog[]
}

export interface RecentBiomarkerRow {
  id:           string
  marker_name:  string
  value:        number | null
  unit:         string
  state:        string
  collected_at: string
}

// ── Analytics ─────────────────────────────────────────────────────
export interface AnalyticsFilters {
  dateFrom:          string
  dateTo:            string
  biologicalProfile: string
  userProfile:       string
  safetyState:       string
  markerName:        string
}

export interface BiomarkerDistributionRow {
  marker_name:    string
  count:          number
  critical_count: number
  avg_value:      number | null
}
