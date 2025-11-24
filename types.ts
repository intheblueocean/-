
export interface PinyinChar {
  char: string;
  pinyin: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  correctAnswer: string;
  relatedPageIndex: number; // The index of the page image to show for this question
}

export interface StoryPage {
  id: number;
  content: PinyinChar[];
  imagePrompt: string;
  imageData?: string; // Base64 or URL
  isGeneratingImage: boolean;
}

export interface StoryData {
  title: string;
  pages: StoryPage[];
  quiz: QuizItem[];
}

export enum AppState {
  INPUT,
  PROCESSING,
  READING,
  GAME,
  ERROR
}
