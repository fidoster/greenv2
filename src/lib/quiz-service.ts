import { supabase } from "./supabase";
import type { TablesInsert } from "../types/supabase";

/**
 * Quiz Service - Manages quiz results and learning progress
 */

export interface QuizAnswer {
  questionId: string;
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpent?: number; // seconds spent on this question
}

export interface SaveQuizResultParams {
  quizType: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  timeTaken?: number; // total time in seconds
  answers?: QuizAnswer[];
}

/**
 * Save a completed quiz result to the database
 * @param params Quiz result parameters
 * @returns Success status and result ID
 */
export async function saveQuizResult(params: SaveQuizResultParams): Promise<{
  success: boolean;
  resultId?: string;
  error?: string;
}> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "User not authenticated. Please sign in to save quiz results."
      };
    }

    // Prepare the quiz result data
    const quizResultData: TablesInsert<"quiz_results"> = {
      user_id: user.id,
      quiz_type: params.quizType,
      quiz_title: params.quizTitle,
      score: params.score,
      total_questions: params.totalQuestions,
      time_taken_seconds: params.timeTaken || null,
      answers: params.answers ? JSON.parse(JSON.stringify(params.answers)) : null,
      attempts_count: 1, // Will be updated by trigger if user retakes quiz
    };

    // Insert the quiz result
    const { data, error } = await supabase
      .from("quiz_results")
      .insert(quizResultData)
      .select()
      .single();

    if (error) {
      console.error("Error saving quiz result:", error);
      return {
        success: false,
        error: `Failed to save quiz result: ${error.message}`
      };
    }

    console.log("Quiz result saved successfully:", data.id);
    return {
      success: true,
      resultId: data.id
    };

  } catch (error) {
    console.error("Error in saveQuizResult:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Get user's quiz history
 * @param limit Optional limit on number of results (default: 50)
 * @returns Array of quiz results
 */
export async function getQuizHistory(limit: number = 50) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching quiz history:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in getQuizHistory:", error);
    throw error;
  }
}

/**
 * Get quiz results for a specific quiz type
 * @param quizType The type of quiz (e.g., 'greenbot', 'lifestyle')
 * @returns Array of quiz results for that type
 */
export async function getQuizResultsByType(quizType: string) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("user_id", user.id)
      .eq("quiz_type", quizType)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("Error fetching quiz results by type:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error in getQuizResultsByType:", error);
    throw error;
  }
}

/**
 * Get user's learning progress
 * @returns Learning progress data or null if not found
 */
export async function getLearningProgress() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("learning_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching learning progress:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in getLearningProgress:", error);
    throw error;
  }
}

/**
 * Get user's best score for a specific quiz type
 * @param quizType The type of quiz
 * @returns Best percentage score or null if no attempts
 */
export async function getBestScore(quizType: string): Promise<number | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("quiz_results")
      .select("percentage")
      .eq("user_id", user.id)
      .eq("quiz_type", quizType)
      .order("percentage", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching best score:", error);
      throw error;
    }

    return data?.percentage || null;
  } catch (error) {
    console.error("Error in getBestScore:", error);
    throw error;
  }
}

/**
 * Get statistics for all quiz types
 * @returns Object with stats for each quiz type
 */
export async function getQuizStatistics() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("quiz_results")
      .select("quiz_type, score, total_questions, percentage")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching quiz statistics:", error);
      throw error;
    }

    // Group by quiz type and calculate stats
    const stats: Record<string, {
      attempts: number;
      bestScore: number;
      averageScore: number;
      totalQuestions: number;
    }> = {};

    data?.forEach((result) => {
      if (!stats[result.quiz_type]) {
        stats[result.quiz_type] = {
          attempts: 0,
          bestScore: 0,
          averageScore: 0,
          totalQuestions: result.total_questions
        };
      }

      stats[result.quiz_type].attempts += 1;
      stats[result.quiz_type].bestScore = Math.max(
        stats[result.quiz_type].bestScore,
        result.percentage
      );
      stats[result.quiz_type].averageScore += result.percentage;
    });

    // Calculate averages
    Object.keys(stats).forEach((quizType) => {
      stats[quizType].averageScore =
        stats[quizType].averageScore / stats[quizType].attempts;
    });

    return stats;
  } catch (error) {
    console.error("Error in getQuizStatistics:", error);
    throw error;
  }
}
