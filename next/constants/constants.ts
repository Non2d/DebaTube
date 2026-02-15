// Debate speech format types
export type SpeechFormat = {
  name: string;
  duration: number;
  team: 'proposition' | 'opposition';
};

// NA Format (6 speeches)
export const NA_FORMAT: SpeechFormat[] = [
  { name: 'Proposition_1st', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_1st', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_2nd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_2nd', duration: 7 * 60, team: 'opposition' },
  { name: 'Opposition_3rd', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_3rd', duration: 7 * 60, team: 'proposition' },
];

// Asian Format (8 speeches)
export const ASIAN_FORMAT: SpeechFormat[] = [
  { name: 'Proposition_1st', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_1st', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_2nd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_2nd', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_3rd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_3rd', duration: 7 * 60, team: 'opposition' },
  { name: 'Opposition_4th', duration: 4 * 60, team: 'opposition' },
  { name: 'Proposition_4th', duration: 4 * 60, team: 'proposition' }
];

// BP Format (8 speeches - British Parliamentary)
export const BP_FORMAT: SpeechFormat[] = [
  { name: 'Proposition_1st', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_1st', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_2nd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_2nd', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_3rd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_3rd', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_4th', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_4th', duration: 7 * 60, team: 'opposition' }
];

// Opening Half BP Format (4 speeches - modified BP)
export const OPENING_HALF_BP_FORMAT: SpeechFormat[] = [
  { name: 'Proposition_1st', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_1st', duration: 7 * 60, team: 'opposition' },
  { name: 'Proposition_2nd', duration: 7 * 60, team: 'proposition' },
  { name: 'Opposition_2nd', duration: 7 * 60, team: 'opposition' },
];

// WSDC Format (8 speeches - 8min x6, 4min x2)
export const WSDC_FORMAT: SpeechFormat[] = [
  { name: 'Proposition_1st', duration: 8 * 60, team: 'proposition' },
  { name: 'Opposition_1st', duration: 8 * 60, team: 'opposition' },
  { name: 'Proposition_2nd', duration: 8 * 60, team: 'proposition' },
  { name: 'Opposition_2nd', duration: 8 * 60, team: 'opposition' },
  { name: 'Proposition_3rd', duration: 8 * 60, team: 'proposition' },
  { name: 'Opposition_3rd', duration: 8 * 60, team: 'opposition' },
  { name: 'Opposition_4th', duration: 4 * 60, team: 'opposition' },
  { name: 'Proposition_4th', duration: 4 * 60, team: 'proposition' }
];

// HPDU Format (8 speeches - 5min x6, 4min x2)
export const HPDU_FORMAT: SpeechFormat[] = [
  { name: 'Proposition_1st', duration: 5 * 60, team: 'proposition' },
  { name: 'Opposition_1st', duration: 5 * 60, team: 'opposition' },
  { name: 'Proposition_2nd', duration: 5 * 60, team: 'proposition' },
  { name: 'Opposition_2nd', duration: 5 * 60, team: 'opposition' },
  { name: 'Proposition_3rd', duration: 5 * 60, team: 'proposition' },
  { name: 'Opposition_3rd', duration: 5 * 60, team: 'opposition' },
  { name: 'Opposition_4th', duration: 4 * 60, team: 'opposition' },
  { name: 'Proposition_4th', duration: 4 * 60, team: 'proposition' }
];


export const DEBATE_FORMATS = {
  NA: NA_FORMAT,
  ASIAN: ASIAN_FORMAT,
  WSDC: WSDC_FORMAT,
  HPDU: HPDU_FORMAT,
  BP: BP_FORMAT,
  OPENING_HALF_BP_ORDER: OPENING_HALF_BP_FORMAT,
} as const;

export type DebateFormatType = keyof typeof DEBATE_FORMATS;

// Legacy order arrays (kept for backward compatibility)
export const NA_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd", "Opposition_3rd", "Proposition_3rd"]
export const ASIAN_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd", "Proposition_3rd", "Opposition_3rd", "Opposition_4th", "Proposition_4th"]
// WSDC and HPDU use the same speech order as ASIAN (only durations differ)
export const WSDC_ORDER = ASIAN_ORDER
export const HPDU_ORDER = ASIAN_ORDER
export const BP_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd", "Proposition_3rd", "Opposition_3rd", "Proposition_4th", "Opposition_4th"]
export const OPENING_HALF_BP_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd"]

// Round names that cannot be deleted (e.g. sample/demo data)
export const PROTECTED_ROUND_NAMES: string[] = [
    "debate_record_sample_lUjrTQcY_Dw",
];
