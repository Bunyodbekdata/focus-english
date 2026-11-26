export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type ReadingCategory =
  | "Technology"
  | "Science"
  | "History"
  | "Business"
  | "Nature"
  | "Society";

export type MaterialType = "youtube" | "pdf" | "reading";

export type ThemeId = "sage" | "ocean" | "warm" | "lavender" | "forest";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  targetLevel: CefrLevel;
  nativeLanguage: string;
  readingWidth: "narrow" | "medium" | "wide";
  readingFontSize: "sm" | "md" | "lg";
  theme: ThemeId;
  createdAt: string;
  updatedAt: string;
}

export interface LearningMaterial {
  id: string;
  userId: string;
  type: MaterialType;
  title: string;
  sourceUrl: string | null;
  videoId: string | null;
  thumbnailUrl: string | null;
  filePath: string | null;
  progressPercent: number;
  lastPositionSeconds: number;
  lastOpenedAt: string;
  createdAt: string;
}

export interface NoteItem {
  id: string;
  userId: string;
  materialId: string | null;
  materialType: MaterialType | "general";
  materialTitle: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyEntry {
  id: string;
  userId: string;
  word: string;
  meaningUz: string;
  example: string;
  personalNote: string;
  sourceMaterialId: string | null;
  sourceTitle: string;
  sourceType: MaterialType | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  cefrLevel: CefrLevel;
  category: ReadingCategory;
  summary: string;
  content: string;
  wordCount: number;
  estimatedMinutes: number;
  pdfPath: string | null;
  createdAt: string;
}

export interface CriterionScore {
  name: string;
  score: string;
  feedback: string;
}

export interface MistakeItem {
  original: string;
  correction: string;
  category: string;
  explanation: string;
}

export interface SpeakingAssessment {
  examType: "ielts" | "cefr";
  levelOrPart: string;
  estimatedOverall: string;
  transcript: string;
  pronunciationAnalysis: string;
  criteria: CriterionScore[];
  mistakes: MistakeItem[];
  strengths: string[];
  improvements: string[];
  followUpQuestion?: string;
  disclaimer: string;
}

export interface SpeakingSession {
  id: string;
  userId: string;
  examType: "ielts" | "cefr";
  levelOrPart: string;
  promptQuestion: string;
  audioPath: string | null;
  audioMimeType: string | null;
  durationSeconds: number;
  transcript: string | null;
  assessment: SpeakingAssessment | null;
  status: "recorded" | "evaluated" | "ai_unconfigured" | "error";
  createdAt: string;
}

export interface WritingAssessment {
  examType: "ielts_academic" | "ielts_general" | "cefr";
  levelOrTask: string;
  estimatedOverall: string;
  summary: string;
  criteria: CriterionScore[];
  grammarMistakes: MistakeItem[];
  vocabularyWeaknesses: {
    phrase: string;
    suggestion: string;
    reason: string;
  }[];
  structuralIssues: string[];
  improvements: string[];
  disclaimer: string;
}

export interface WritingSession {
  id: string;
  userId: string;
  examType: "ielts_academic" | "ielts_general" | "cefr";
  levelOrTask: string;
  promptTitle: string;
  promptText: string;
  answerText: string;
  wordCount: number;
  assessment: WritingAssessment | null;
  status: "draft" | "evaluated" | "ai_unconfigured" | "error";
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPayload {
  user: UserProfile;
  continueLearning: LearningMaterial | null;
  recentNotes: NoteItem[];
  vocabularyCount: number;
  recentMaterials: LearningMaterial[];
}

export interface AiStatusInfo {
  configured: boolean;
  provider: "gemini" | "openai";
  speakingModel: string;
  writingModel: string;
  missingEnvVar: string | null;
  note: string;
}
