// Types for the parts of cantojam.js that Moodence calls.

export interface Syllable {
  char: string;
  jyutping: string | null;
  tone: string | null;
  source: "corpus" | "curated" | "override" | null;
  ambiguous: boolean;
  skipped: boolean;
  latin: boolean;
}

export interface CheckRow {
  index: number;
  char: string;
  jyutping: string | null;
  tone: string | null;
  midi: number | null;
  note: string | null;
  violation: boolean;
  unusual: boolean;
  message?: string;
}

export interface CheckResult {
  rows: CheckRow[];
  violations: CheckRow[];
  unusual: CheckRow[];
  syllables: number;
  notes: number;
  length_mismatch: boolean;
}

export const TONE_NAMES: Record<string, string>;
export const corpusSongs: number;
export const corpusSyllables: number;
export function syllabify(text: string, overrides?: Record<string, string>): Syllable[];
export function check(text: string, melody: number[], overrides?: Record<string, string>): CheckResult;
