
import { Symptom } from './types';

export const SYMPTOMS: Symptom[] = [
  // Physical
  { id: 'aching_muscles', label: 'Aching muscles', category: 'Physical' },
  { id: 'sore_lower', label: 'Soreness (lower body)', category: 'Physical' },
  { id: 'pelvic_heaviness', label: 'Pelvic heaviness', category: 'Physical' },
  { id: 'back_pain', label: 'Back pain', category: 'Physical' },
  { id: 'stiff_joints', label: 'Stiff joints', category: 'Physical' },
  
  // Internal
  { id: 'feeling_cold', label: 'Feeling cold', category: 'Internal' },
  { id: 'feeling_hot', label: 'Feeling hot/flushed', category: 'Internal' },
  { id: 'bloated_gas', label: 'Bloated or Gas', category: 'Internal' },
  { id: 'constipated', label: 'Constipated', category: 'Internal' },
  { id: 'very_thirsty', label: 'Very thirsty', category: 'Internal' },
  { id: 'weak_digestion', label: 'Weak digestion', category: 'Internal' },

  // Emotional / Mind
  { id: 'restless_anxious', label: 'Restless or Anxious', category: 'Emotional' },
  { id: 'exhausted_depleted', label: 'Exhausted & Depleted', category: 'Emotional' },
  { id: 'brain_fog', label: 'Brain fog or Sluggish', category: 'Emotional' },
  { id: 'irritable', label: 'Short-tempered', category: 'Emotional' },
  { id: 'feeling_blue', label: 'Feeling blue or Sad', category: 'Emotional' },
  { id: 'overwhelmed', label: 'Overwhelmed', category: 'Emotional' }
];

export const STORAGE_KEY = 'harmony_recovery_user_data_v2';
