import type { IFeedback } from './schema.types';

export type FeedbackBase = Omit<IFeedback, 'tasks' | 'projects'> & {
  tasks?: string[];
  owners?: string;
  sections?: string;
};

export type FeedbackWithScores = FeedbackBase & {
  rank?: number;
  commentScore?: number;
  // pageScore?: number; // not using page score for now
};

export type WordRelevance = {
  word: string;
  word_occurrences: number;
  comment_occurrences: number;
  // page_occurrences: number;
  term_frequency: number;
  // page_frequency: number;
  comment_frequency: number;
  inverse_doc_frequency: number;
  // inverse_page_frequency: number;
  comment_score: number;
  // page_score: number;
};

export type MostRelevantCommentsAndWords = {
  comments: Omit<FeedbackWithScores, 'words'>[];
  words: WordRelevance[];
};

export type MostRelevantCommentsAndWordsByLang = {
  en: MostRelevantCommentsAndWords;
  fr: MostRelevantCommentsAndWords;
};

// to get around JSON.stringify string length/memory issues
export type ChunkedMostRelevantCommentsAndWords = {
  enComments: MostRelevantCommentsAndWords['comments'];
  enWords: MostRelevantCommentsAndWords['words'];
  frComments: MostRelevantCommentsAndWords['comments'];
  frWords: MostRelevantCommentsAndWords['words'];
};

export type FeedbackWord = Pick<
    WordRelevance,
    'word' | 'word_occurrences' | 'comment_occurrences'
  >;

export type CommentsAndWords = {
  comments: Omit<FeedbackBase, 'words'>[];
  words: FeedbackWord[];
};

export type CommentsAndWordsByLang = {
  en: CommentsAndWords;
  fr: CommentsAndWords;
};

// to get around JSON.stringify string length/memory issues
export type ChunkedCommentsAndWords = {
  enComments: CommentsAndWords['comments'];
  enWords: CommentsAndWords['words'];
  frComments: CommentsAndWords['comments'];
  frWords: CommentsAndWords['words'];
};
