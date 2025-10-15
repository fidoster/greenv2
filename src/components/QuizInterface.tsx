import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { quizData, QuizQuestion } from "../lib/quiz-data";
import { PersonaType } from "./PersonaSelector";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  Award,
} from "lucide-react";
import { Progress } from "./ui/progress";
import { cn } from "@/lib/utils";
import { Toaster } from "./ui/toaster";
import { useToast } from "./ui/use-toast";
import { saveQuizResult, QuizAnswer } from "../lib/quiz-service";

interface QuizInterfaceProps {
  currentPersona: PersonaType;
  onClose: () => void;
  onComplete?: (score: number, total: number) => void;
  className?: string;
}

const QuizInterface = ({
  currentPersona,
  onClose,
  onComplete,
  className = "",
}: QuizInterfaceProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizStartTime] = useState<number>(Date.now());
  const [isSavingResults, setIsSavingResults] = useState(false);
  const { toast } = useToast();

  // Load the quiz based on current persona
  const quiz = quizData[currentPersona];
  const questions = quiz.questions;
  const currentQuestion = questions[currentQuestionIndex];

  // Calculate progress
  const progress = (currentQuestionIndex / questions.length) * 100;

  // Handle answer selection
  const handleSelectAnswer = (optionIndex: number) => {
    if (showExplanation) return; // Prevent selection during explanation

    // Record the user's answer
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setUserAnswers(newAnswers);

    // Show explanation
    setShowExplanation(true);
  };

  // Handle next question
  const handleNextQuestion = async () => {
    setShowExplanation(false);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Quiz completed
      setQuizCompleted(true);

      // Calculate score
      const correctCount = userAnswers.reduce((count, answer, index) => {
        return count + (answer === questions[index].correctAnswerIndex ? 1 : 0);
      }, 0);

      // Calculate time taken in seconds
      const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);

      // Prepare detailed answers
      const detailedAnswers: QuizAnswer[] = questions.map((question, index) => ({
        questionId: question.id,
        selectedAnswer: userAnswers[index],
        correctAnswer: question.correctAnswerIndex,
        isCorrect: userAnswers[index] === question.correctAnswerIndex,
      }));

      // Save quiz result to database
      setIsSavingResults(true);
      try {
        const result = await saveQuizResult({
          quizType: currentPersona, // PersonaType is already lowercase (greenbot, lifestyle, waste, nature, energy, climate)
          quizTitle: quiz.title,
          score: correctCount,
          totalQuestions: questions.length,
          timeTaken: timeTaken,
          answers: detailedAnswers,
        });

        if (result.success) {
          toast({
            title: "Quiz Completed!",
            description: "Your results have been saved successfully.",
          });
        } else {
          console.error("Failed to save quiz results:", result.error);
          toast({
            title: "Results Saved Locally",
            description: "Could not save to database, but your score was recorded.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error saving quiz results:", error);
      } finally {
        setIsSavingResults(false);
      }

      // Callback with results
      if (onComplete) {
        onComplete(correctCount, questions.length);
      }
    }
  };

  // Restart quiz
  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowExplanation(false);
    setQuizCompleted(false);
  };

  // Calculate final score for results screen
  const calculateResults = () => {
    const correctCount = userAnswers.reduce((count, answer, index) => {
      return count + (answer === questions[index].correctAnswerIndex ? 1 : 0);
    }, 0);

    const percentage = Math.round((correctCount / questions.length) * 100);

    return {
      correct: correctCount,
      total: questions.length,
      percentage,
    };
  };

  // Get feedback based on score percentage
  const getFeedback = (percentage: number) => {
    if (percentage >= 90) return "Excellent! You're a sustainability expert!";
    if (percentage >= 70) return "Great job! You know your stuff!";
    if (percentage >= 50) return "Good effort! There's always more to learn.";
    return "Keep learning! Sustainability is a journey.";
  };

  // Render different views based on quiz state
  if (quizCompleted) {
    const results = calculateResults();

    return (
      <>
        <Toaster />
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
            className,
          )}
        >
          <Card className="w-full max-w-lg mx-4 overflow-hidden">
          <CardHeader className="bg-[#98C9A3]/20 dark:bg-[#2C4A3E]/30">
            <CardTitle className="text-center text-[#2C4A3E] dark:text-[#98C9A3]">
              Quiz Results
            </CardTitle>
            <CardDescription className="text-center">
              {quiz.title}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    className="text-[#E0E0E0] dark:text-[#3A4140] stroke-current"
                    strokeWidth="8"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                  />
                  <circle
                    className="text-[#4B9460] dark:text-[#98C9A3] stroke-current"
                    strokeWidth="8"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - results.percentage / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-[#2C4A3E] dark:text-[#98C9A3]">
                    {results.percentage}%
                  </span>
                  <span className="text-xs text-[#8BA888] dark:text-[#8BA888]">
                    {results.correct}/{results.total}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-lg font-medium mb-2 text-[#2C4A3E] dark:text-white">
                  {getFeedback(results.percentage)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  You answered {results.correct} out of {results.total}{" "}
                  questions correctly.
                </p>
              </div>

              <Award className="h-12 w-12 text-[#F6C344] dark:text-[#F6C344] opacity-90" />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between p-4 bg-[#F5F5F5] dark:bg-[#2A3130]">
            <Button
              variant="outline"
              onClick={handleRestartQuiz}
              className="border-[#8BA888] text-[#2C4A3E] dark:border-[#8BA888] dark:text-[#98C9A3]"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              onClick={onClose}
              className="bg-[#2C4A3E] hover:bg-[#1a2e26] text-white dark:bg-[#98C9A3] dark:hover:bg-[#8BA888] dark:text-[#2F3635]"
            >
              Finish
            </Button>
          </CardFooter>
        </Card>
      </div>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
          className,
        )}
      >
        <Card className="w-full max-w-lg mx-4 overflow-hidden">
        <CardHeader className="bg-[#98C9A3]/20 dark:bg-[#2C4A3E]/30">
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-[#2C4A3E] dark:text-[#98C9A3]">
              {quiz.title}
            </CardTitle>
            <div className="text-sm font-medium text-[#8BA888] dark:text-[#8BA888]">
              {currentQuestionIndex + 1}/{questions.length}
            </div>
          </div>
          <Progress
            value={progress}
            className="h-2 bg-[#E0E0E0] dark:bg-[#3A4140]"
          >
            <div
              className="h-full bg-[#4B9460] dark:bg-[#98C9A3] rounded-full"
              style={{ width: `${progress}%` }}
            />
          </Progress>
        </CardHeader>

        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg font-medium mb-4 text-[#2C4A3E] dark:text-white">
                {currentQuestion.question}
              </h3>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectAnswer(index)}
                    className={cn(
                      "w-full text-left p-3 rounded-md border transition-all",
                      !showExplanation &&
                        "hover:bg-[#98C9A3]/10 dark:hover:bg-[#98C9A3]/10",
                      showExplanation &&
                        userAnswers[currentQuestionIndex] === index &&
                        index === currentQuestion.correctAnswerIndex &&
                        "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-500",
                      showExplanation &&
                        userAnswers[currentQuestionIndex] === index &&
                        index !== currentQuestion.correctAnswerIndex &&
                        "bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-500",
                      showExplanation &&
                        index === currentQuestion.correctAnswerIndex &&
                        "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-500",
                      !showExplanation &&
                        "border-[#E0E0E0] dark:border-[#3A4140] bg-white dark:bg-[#2F3635]",
                    )}
                    disabled={showExplanation}
                  >
                    <div className="flex items-center">
                      <div
                        className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full mr-2 flex items-center justify-center border",
                          showExplanation &&
                            index === currentQuestion.correctAnswerIndex
                            ? "border-green-500 text-green-500"
                            : "",
                          showExplanation &&
                            userAnswers[currentQuestionIndex] === index &&
                            index !== currentQuestion.correctAnswerIndex
                            ? "border-red-500 text-red-500"
                            : "",
                          !showExplanation && "border-[#8BA888] text-[#8BA888]",
                        )}
                      >
                        {showExplanation &&
                        index === currentQuestion.correctAnswerIndex ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : showExplanation &&
                          userAnswers[currentQuestionIndex] === index &&
                          index !== currentQuestion.correctAnswerIndex ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span>{String.fromCharCode(65 + index)}</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[#2F3635] dark:text-[#F5F5F5]",
                          showExplanation &&
                            index === currentQuestion.correctAnswerIndex &&
                            "font-medium text-green-800 dark:text-green-300",
                          showExplanation &&
                            userAnswers[currentQuestionIndex] === index &&
                            index !== currentQuestion.correctAnswerIndex &&
                            "font-medium text-red-800 dark:text-red-300",
                        )}
                      >
                        {option}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {showExplanation && (
                <div className="mt-6 p-4 bg-[#98C9A3]/10 rounded-md border border-[#98C9A3]/30 dark:bg-[#2C4A3E]/30 dark:border-[#98C9A3]/30">
                  <p className="text-[#2C4A3E] dark:text-[#98C9A3] font-medium mb-1">
                    Explanation:
                  </p>
                  <p className="text-sm text-[#2F3635] dark:text-[#F5F5F5]">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>

        <CardFooter className="flex justify-between p-4 bg-[#F5F5F5] dark:bg-[#2A3130]">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#8BA888] text-[#2C4A3E] dark:border-[#8BA888] dark:text-[#98C9A3]"
          >
            Quit Quiz
          </Button>
          {showExplanation && (
            <Button
              onClick={handleNextQuestion}
              className="bg-[#2C4A3E] hover:bg-[#1a2e26] text-white dark:bg-[#98C9A3] dark:hover:bg-[#8BA888] dark:text-[#2F3635]"
            >
              {currentQuestionIndex < questions.length - 1
                ? "Next Question"
                : "See Results"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
    </>
  );
};

export default QuizInterface;
