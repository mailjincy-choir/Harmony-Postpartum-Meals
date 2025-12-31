
export interface UserState {
  name: string;
  birthDate: string;
  onboardingComplete: boolean;
  optedIntoFood: boolean;
  history: DailyRecord[];
}

export interface DailyRecord {
  date: string;
  symptomIds: string[];
}

export interface Symptom {
  id: string;
  label: string;
  category: 'Physical' | 'Internal' | 'Emotional';
}

export interface MoodOption {
  id: string;
  label: string;
  validation: string;
}

export interface MealItem {
  name: string;
  ingredients: string[];
  steps: string[];
}

export interface DailyMessage {
  reassurance: string;
  focus: string;
  actions: string[];
  ignore: string;
  meals?: MealItem[];
  spouseMessage?: string;
  checkInWarning?: string;
}

export enum AppStatus {
  LOADING = 'LOADING',
  ONBOARDING = 'ONBOARDING',
  READY = 'READY'
}
