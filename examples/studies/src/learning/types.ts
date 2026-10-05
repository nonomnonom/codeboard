export interface Lesson {
  id: string;
  title: string;
  question: string;
  observe: string;
  takeaway: string;
  experiment: string;
  source: string;
}

export interface Chapter {
  id: string;
  title: string;
  introduction: string;
  lessons: Lesson[];
}
