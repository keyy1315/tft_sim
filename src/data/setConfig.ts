export type SetId = 'set16' | 'set17';

export interface SetConfig {
  id: SetId;
  number: number;
  name: string;
  label: string;
  apiPrefix: string;
  status: 'live' | 'pbe';
}

export const SET_CONFIGS: Record<SetId, SetConfig> = {
  set16: { id: 'set16', number: 16, name: '마법공학 시대', label: 'Set 16', apiPrefix: 'TFT16_', status: 'live' },
  set17: { id: 'set17', number: 17, name: 'Space Gods', label: 'Set 17', apiPrefix: 'TFT17_', status: 'live' },
};

export const DEFAULT_SET: SetId = 'set17';
export const AVAILABLE_SETS: SetId[] = ['set17'];
