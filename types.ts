
export interface UserState {
  name: string;
  email?: string;
  birthDate: string;
  deliveryType: 'Vaginal' | 'C-section';
  optedIntoFood: boolean;
  preferences: string[];
}

export interface SymptomCheck {
  physical: string[];
  emotional: string[];
  lactation: string[];
}

export interface Meal {
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  name: string;
  why: string;
  ingredients: string[]; // Should include quantities now
  instructions: string[]; // New field for cooking steps
}

export interface DailyRecoveryPlan {
  validation: string;
  focus: string;
  actions: string[];
  ignore: string;
  meals: Meal[];
}

export type AppView = 'ONBOARDING' | 'CHECKIN' | 'VALIDATION' | 'PLAN' | 'SETTINGS';
