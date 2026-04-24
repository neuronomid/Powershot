import type { CropRegion } from "@/lib/upload/types";

export type FlashcardStyle =
  | "basic-qa"
  | "concept"
  | "compare"
  | "mcq"
  | "error-based"
  | "application"
  | "cloze"
  | "explain-why"
  | "diagram"
  | "exam-short";

export const ALL_FLASHCARD_STYLES: FlashcardStyle[] = [
  "basic-qa",
  "concept",
  "compare",
  "mcq",
  "error-based",
  "application",
  "cloze",
  "explain-why",
  "diagram",
  "exam-short",
];

export const FLASHCARD_STYLE_LABELS: Record<FlashcardStyle, string> = {
  "basic-qa": "Basic Q/A",
  concept: "Concept explanation",
  compare: "Compare / contrast",
  mcq: "Multiple-choice",
  "error-based": "Error-based",
  application: "Application / problem",
  cloze: "Cloze deletion",
  "explain-why": "Explain why",
  diagram: "Diagram / image",
  "exam-short": "Exam short-answer",
};

export const FLASHCARD_STYLE_DESCRIPTIONS: Record<FlashcardStyle, string> = {
  "basic-qa": "Short question with a short factual answer.",
  concept: "Prompt asks the learner to explain a concept in their own words.",
  compare: "Asks the learner to contrast two related ideas.",
  mcq: "Multiple-choice question with 3–4 options and one correct answer.",
  "error-based": "Presents a common misconception and asks for the correction.",
  application: "Applied problem the learner solves using the material.",
  cloze: "Fill-in-the-blank with the answer hidden inside {{c1::...}} syntax.",
  "explain-why": "Asks for the underlying reason behind a fact or claim.",
  diagram: "Uses a cropped region of the screenshot as the question or answer.",
  "exam-short": "Exam-style short-answer prompt with a 1–3 sentence answer.",
};

export type Difficulty = "easy" | "medium" | "challenging";

export type NoteModel = "basic" | "cloze";

export type SM2State = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: number;
  lastReviewedAt: number | null;
};

export function initialSM2State(now: number): SM2State {
  return {
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now,
    lastReviewedAt: null,
  };
}

export type CardMediaRef = {
  mediaId: string;
  role: "front" | "back";
  alt?: string;
};

export type Card = {
  id: string;
  model: NoteModel;
  style: FlashcardStyle;
  difficulty: Difficulty;
  front: string;
  back: string;
  extra?: string;
  mediaRefs?: CardMediaRef[];
  sourceImageId?: string;
  sourceImageIndex?: number;
  tags: string[];
  scheduler: SM2State;
  createdAt: number;
  updatedAt: number;
  guardrailViolations?: string[];
};

export type StyleCount = {
  style: FlashcardStyle;
  count: number;
};

export type DeckPreferences = {
  styles: StyleCount[];
  difficulty: Difficulty;
  styleAutoPick: boolean;
};

export type PerImageOverride = {
  imageId: string;
  styles?: StyleCount[];
  difficulty?: Difficulty;
};

export type DeckReviewState = {
  sessionsCompleted: number;
  lastReviewedAt: number | null;
  currentStreakDays: number;
};

export type Deck = {
  id: string;
  name: string;
  subject?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  cards: Card[];
  reviewState: DeckReviewState;
  preferences: DeckPreferences;
  _schemaVersion: number;
};

export type DeckPatch = Partial<
  Pick<
    Deck,
    "name" | "subject" | "description" | "cards" | "reviewState" | "preferences"
  >
>;

export type DeckMediaBlob = {
  id: string;
  deckId: string;
  mimeType: string;
  dataBase64: string;
  filenameHint?: string;
  createdAt: number;
  crop?: CropRegion;
};

export const DEFAULT_DECK_PREFERENCES: DeckPreferences = {
  styles: [
    { style: "basic-qa", count: 3 },
    { style: "cloze", count: 2 },
  ],
  difficulty: "medium",
  styleAutoPick: true,
};

export type FlashcardGenCandidate = {
  model: NoteModel;
  style: FlashcardStyle;
  difficulty: Difficulty;
  front: string;
  back: string;
  extra?: string;
  tags?: string[];
  mediaCrop?: CropRegion;
  mediaRole?: "front" | "back";
};

export type FlashcardGenRequest = {
  markdown: string;
  styles: StyleCount[];
  difficulty: Difficulty;
  autoPick: boolean;
  sourceImageId?: string;
  sourceImageIndex?: number;
};

export type FlashcardGenResponse = {
  cards: FlashcardGenCandidate[];
  guardrailViolations: string[];
};

export type FlashcardDedupPair = {
  candidateIndex: number;
  candidateText: string;
  existingTexts: string[];
};

export type FlashcardDedupRequest = {
  pairs: FlashcardDedupPair[];
};

export type FlashcardDedupResponse = {
  duplicateIndices: number[];
};
