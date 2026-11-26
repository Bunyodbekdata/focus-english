import type { CefrLevel } from "./types";

export interface SpeakingPrompt {
  id: string;
  examType: "ielts" | "cefr";
  levelOrPart: string;
  title: string;
  question: string;
  cueCardPoints?: string[];
  guidance: string;
  targetDurationSeconds: number;
}

export interface WritingPrompt {
  id: string;
  examType: "ielts_academic" | "ielts_general" | "cefr";
  levelOrTask: string;
  taskFormat: string;
  title: string;
  prompt: string;
  minWords: number;
  recommendedMinutes: number;
}

export const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  // IELTS Part 1
  {
    id: "ielts-p1-daily-routine",
    examType: "ielts",
    levelOrPart: "Part 1",
    title: "Daily Routine & Focus",
    question:
      "What part of the day do you find most productive for studying or working, and why? Has your daily routine changed much over the past few years?",
    guidance:
      "Aim for 30–50 seconds. Give a clear direct answer, then extend with a brief reason or personal example.",
    targetDurationSeconds: 45,
  },
  {
    id: "ielts-p1-reading-habits",
    examType: "ielts",
    levelOrPart: "Part 1",
    title: "Reading Habits",
    question:
      "Do you prefer reading printed books or reading on a screen? What kind of topics do you usually enjoy reading about in your free time?",
    guidance:
      "Keep your tone natural and conversational. Avoid single-sentence answers; explain your preference clearly.",
    targetDurationSeconds: 45,
  },
  // IELTS Part 2
  {
    id: "ielts-p2-quiet-place",
    examType: "ielts",
    levelOrPart: "Part 2",
    title: "Describe a quiet place where you like to spend time",
    question: "Describe a quiet place where you like to study, read, or relax.",
    cueCardPoints: [
      "Where this place is located",
      "How often you visit it",
      "What you usually do while you are there",
      "And explain why this place helps you feel calm or focused",
    ],
    guidance:
      "Take up to 1 minute to organize your notes, then speak continuously for 1.5–2 minutes covering all four prompts.",
    targetDurationSeconds: 120,
  },
  {
    id: "ielts-p2-useful-skill",
    examType: "ielts",
    levelOrPart: "Part 2",
    title: "Describe a practical skill you learned recently",
    question:
      "Describe a useful skill you learned that has helped you in your studies or everyday life.",
    cueCardPoints: [
      "What the skill is",
      "How and where you learned it",
      "What challenges you faced at the beginning",
      "And explain how this skill benefits you today",
    ],
    guidance:
      "Speak for 1.5–2 minutes with clear transitions between past learning experience and present benefits.",
    targetDurationSeconds: 120,
  },
  // IELTS Part 3
  {
    id: "ielts-p3-digital-distraction",
    examType: "ielts",
    levelOrPart: "Part 3",
    title: "Technology & Attention in Education",
    question:
      "Some educators argue that digital devices make independent language learning easier, while others believe they reduce students' ability to concentrate deeply. What is your view, and how should learners balance both sides?",
    guidance:
      "Give a structured analytical answer (60–90 seconds): address both viewpoints, weigh trade-offs, and conclude with a reasoned opinion.",
    targetDurationSeconds: 75,
  },
  {
    id: "ielts-p3-lifelong-learning",
    examType: "ielts",
    levelOrPart: "Part 3",
    title: "Adult & Lifelong Learning",
    question:
      "Why do you think more adults are continuing to learn new languages or professional skills later in life compared with previous generations?",
    guidance:
      "Discuss broader social or economic factors rather than only personal stories. Aim for 60–90 seconds.",
    targetDurationSeconds: 75,
  },

  // CEFR Speaking A1–C2
  {
    id: "cefr-a1-introduce",
    examType: "cefr",
    levelOrPart: "A1",
    title: "Introducing Yourself & Your Day",
    question:
      "Please introduce yourself. Tell me your name, where you live, what you do, and two things you usually do in the evening.",
    guidance: "Speak slowly and clearly using simple present sentences (30–45 seconds).",
    targetDurationSeconds: 40,
  },
  {
    id: "cefr-a2-weekend-trip",
    examType: "cefr",
    levelOrPart: "A2",
    title: "A Recent Weekend or Short Visit",
    question:
      "Tell me about a place you visited recently, such as a park, café, or another town. Who did you go with, what did you do there, and did you enjoy it?",
    guidance: "Use past simple verbs clearly and connect ideas with 'and', 'but', and 'because' (45–60 seconds).",
    targetDurationSeconds: 50,
  },
  {
    id: "cefr-b1-learning-method",
    examType: "cefr",
    levelOrPart: "B1",
    title: "Effective Ways to Learn a Language",
    question:
      "What methods have helped you improve your English the most so far? Describe one challenge you still want to overcome and how you plan to practice.",
    guidance: "Organize your answer with clear reasons and specific examples (60–75 seconds).",
    targetDurationSeconds: 65,
  },
  {
    id: "cefr-b2-remote-work",
    examType: "cefr",
    levelOrPart: "B2",
    title: "Evaluating Flexible Study & Work",
    question:
      "Compare studying or working independently from home with attending a physical classroom or office. What are the key advantages and drawbacks of each environment?",
    guidance: "Present balanced arguments using clear linking expressions and precise vocabulary (75–90 seconds).",
    targetDurationSeconds: 80,
  },
  {
    id: "cefr-c1-public-spaces",
    examType: "cefr",
    levelOrPart: "C1",
    title: "Designing Cities for Calm & Wellbeing",
    question:
      "To what extent does the architectural and environmental design of a city influence residents' mental clarity and community life? Support your position with concrete reasoning.",
    guidance: "Demonstrate cohesive structure, nuanced stance, and natural idiomatic precision (90–110 seconds).",
    targetDurationSeconds: 100,
  },
  {
    id: "cefr-c2-information-judgment",
    examType: "cefr",
    levelOrPart: "C2",
    title: "Expertise vs. Algorithmic Curation",
    question:
      "As automated recommendation systems increasingly shape what people read and hear, how might societies safeguard independent critical judgment without forfeiting the efficiencies of digital access?",
    guidance: "Deliver a fluent, conceptually nuanced response with controlled register and subtle emphasis (90–120 seconds).",
    targetDurationSeconds: 110,
  },
];

export const WRITING_PROMPTS: WritingPrompt[] = [
  // IELTS Academic
  {
    id: "ielts-ac-task1-study-time",
    examType: "ielts_academic",
    levelOrTask: "Task 1",
    taskFormat: "Data Summary Report",
    title: "Weekly Language Study Methods (2015 vs. 2025)",
    prompt:
      "The survey data below compares the average weekly hours university students spent on four English learning methods in 2015 and 2025:\n\n• Classroom lectures: 6.5 hrs (2015) → 4.0 hrs (2025)\n• Printed textbooks: 4.5 hrs (2015) → 2.0 hrs (2025)\n• Online video & audio lectures: 1.5 hrs (2015) → 5.5 hrs (2025)\n• Digital reading & writing practice: 1.0 hrs (2015) → 3.5 hrs (2025)\n\nSummarize the information by selecting and reporting the main features, and make comparisons where relevant.",
    minWords: 150,
    recommendedMinutes: 20,
  },
  {
    id: "ielts-ac-task2-focus-education",
    examType: "ielts_academic",
    levelOrTask: "Task 2",
    taskFormat: "Academic Essay",
    title: "Self-Directed Online Study vs. Traditional Instruction",
    prompt:
      "Many adult learners now rely primarily on self-directed online videos and digital articles rather than formal classroom courses to master a foreign language. Do the advantages of this shift outweigh the disadvantages?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.",
    minWords: 250,
    recommendedMinutes: 40,
  },

  // IELTS General Training
  {
    id: "ielts-gt-task1-library-letter",
    examType: "ielts_general",
    levelOrTask: "Task 1",
    taskFormat: "Formal / Semi-Formal Letter",
    title: "Request for Quiet Study Hours at a Community Library",
    prompt:
      "You regularly use your local public library to study in the evenings, but recent noise levels in the main reading area have made it difficult to concentrate. Write a letter to the library manager.\n\nIn your letter:\n• Explain how you use the library and why you value it\n• Describe the problem you have experienced recently\n• Suggest practical ways the library could maintain a quieter study zone",
    minWords: 150,
    recommendedMinutes: 20,
  },
  {
    id: "ielts-gt-task2-work-balance",
    examType: "ielts_general",
    levelOrTask: "Task 2",
    taskFormat: "Opinion Essay",
    title: "Continuous Availability After Work Hours",
    prompt:
      "Because of smartphones and messaging apps, many employees are expected to respond to work messages outside normal working hours. Some people believe this improves flexibility, while others think it harms wellbeing and productivity.\n\nDiscuss both views and give your own opinion.",
    minWords: 250,
    recommendedMinutes: 40,
  },

  // CEFR Writing A1–C2
  {
    id: "cefr-w-a1-email",
    examType: "cefr",
    levelOrTask: "A1" satisfies CefrLevel,
    taskFormat: "Short Email",
    title: "An Email to a New Study Partner",
    prompt:
      "Write a short email to a new English study partner. Tell them your name, what time you are free this week, and what you want to practice together (reading, listening, or speaking).",
    minWords: 50,
    recommendedMinutes: 10,
  },
  {
    id: "cefr-w-a2-description",
    examType: "cefr",
    levelOrTask: "A2" satisfies CefrLevel,
    taskFormat: "Personal Description",
    title: "My Favorite Place to Study",
    prompt:
      "Write a description of your favorite place to study or read. Explain where it is, what it looks like, when you go there, and why you like studying in that place.",
    minWords: 80,
    recommendedMinutes: 15,
  },
  {
    id: "cefr-w-b1-letter",
    examType: "cefr",
    levelOrTask: "B1" satisfies CefrLevel,
    taskFormat: "Advice Email",
    title: "Recommending a Study Routine to a Friend",
    prompt:
      "A friend wrote to you saying they always get distracted on YouTube when trying to study English. Write a reply giving practical advice on how to organize their daily listening, reading, and vocabulary practice.",
    minWords: 130,
    recommendedMinutes: 20,
  },
  {
    id: "cefr-w-b2-essay",
    examType: "cefr",
    levelOrTask: "B2" satisfies CefrLevel,
    taskFormat: "Structured Essay",
    title: "Should Schools Limit Smartphone Use During the Day?",
    prompt:
      "Write an essay discussing whether secondary schools should restrict smartphone use throughout the school day. Consider academic focus, student independence, and practical communication needs before stating your conclusion.",
    minWords: 180,
    recommendedMinutes: 30,
  },
  {
    id: "cefr-w-c1-essay",
    examType: "cefr",
    levelOrTask: "C1" satisfies CefrLevel,
    taskFormat: "Analytical Essay",
    title: "The Value of Slow Reading in a Fast Information Culture",
    prompt:
      "Write an analytical essay examining how habits of rapid skimming online affect deep comprehension and critical thinking. Propose realistic strategies individuals and educational institutions can adopt to cultivate sustained reading.",
    minWords: 240,
    recommendedMinutes: 35,
  },
  {
    id: "cefr-w-c2-critique",
    examType: "cefr",
    levelOrTask: "C2" satisfies CefrLevel,
    taskFormat: "Argumentative Essay",
    title: "Measuring Learning Beyond Standardized Scores",
    prompt:
      "Standardized language assessments provide comparability across institutions, yet critics contend they narrow how languages are taught and experienced. Critically evaluate this tension and articulate a balanced framework for assessing genuine communicative competence.",
    minWords: 280,
    recommendedMinutes: 45,
  },
];
