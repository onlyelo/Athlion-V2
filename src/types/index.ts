// Contrats partagés — miroir des réponses API du backend.

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface EnergyPoint { hour: number; energy: number; }

export interface DailyState {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  readiness: number;
  sleep_debt_min: number;
  energy_curve: {
    points: EnergyPoint[];
    dipHour: number;
    melatoninWindow: { start: number; end: number };
  } | null;
}

export interface DashboardData {
  state: DailyState;
  totals: {
    total_distance_m: string;
    total_duration_min: number;
    total_sessions: number;
  };
  history: Array<Pick<DailyState, 'date' | 'ctl' | 'atl' | 'tsb' | 'readiness' | 'sleep_debt_min'>>;
  pinned: string[];
}

export interface SleepNight {
  date: string;
  duration_min: number;
  wake_time: string | null;
  bedtime: string | null;
}

export interface SportStat {
  sport: string;
  distance: number;   // m
  elevation: number;  // m (D+)
  time: number;       // s
  sessions: number;
  avgHr: number | null;
  avgSpeed: number | null; // m/s
}

export interface StravaSummary {
  days: number;
  totals: { distance: number; elevation: number; time: number; sessions: number; avgHr: number | null };
  bySport: SportStat[];
  weekly: Array<{ week: string; distance: number; time: number; elevation: number }>;
}

export interface StravaStatus {
  connected: boolean;
  athlete_id: number | null;
  last_sync: string | null;
  cached: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
  start_date_local: string;
  average_heartrate?: number;
}
