import { PersonaType } from "../components/PersonaSelector";
import { quizData } from "../lib/quiz-data";

/**
 * Get the questions for a specific persona
 */
export function getQuestionsForPersona(persona: PersonaType) {
  return quizData[persona].questions;
}

/**
 * Calculate quiz results
 */
export function calculateQuizResults(
  userAnswers: number[],
  persona: PersonaType,
) {
  const questions = getQuestionsForPersona(persona);
  const correctCount = userAnswers.reduce((count, answer, index) => {
    return index < questions.length
      ? count + (answer === questions[index].correctAnswerIndex ? 1 : 0)
      : count;
  }, 0);

  const total = questions.length;
  const percentage = Math.round((correctCount / total) * 100);

  return {
    correct: correctCount,
    total,
    percentage,
  };
}

/**
 * Get feedback message based on quiz score percentage
 */
export function getQuizFeedback(percentage: number): string {
  if (percentage >= 90) return "Excellent! You're a sustainability expert!";
  if (percentage >= 70) return "Great job! You know your stuff!";
  if (percentage >= 50) return "Good effort! There's always more to learn.";
  return "Keep learning! Sustainability is a journey.";
}
