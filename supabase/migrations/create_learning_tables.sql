-- ============================================================
-- LEARNING & ASSESSMENT SYSTEM
-- Tables for Quiz Results and Scenario-Based Learning
-- ============================================================

-- 1. QUIZ RESULTS TABLE
-- Stores completed quiz attempts with scores and details
CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,

  -- Quiz Information
  quiz_type TEXT NOT NULL, -- 'greenbot', 'lifestyle', 'waste', 'nature', 'energy', 'climate'
  quiz_title TEXT NOT NULL,

  -- Score Information
  score INTEGER NOT NULL, -- Number of correct answers
  total_questions INTEGER NOT NULL,
  percentage DECIMAL(5,2) GENERATED ALWAYS AS ((score::DECIMAL / total_questions::DECIMAL) * 100) STORED,

  -- Performance Metrics
  time_taken_seconds INTEGER, -- How long it took to complete the quiz
  attempts_count INTEGER DEFAULT 1, -- Number of times user has taken this quiz

  -- Detailed Results (JSON)
  answers JSONB, -- Array of {questionId, selectedAnswer, correctAnswer, isCorrect, timeSpent}

  -- Timestamps
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SCENARIO RESULTS TABLE (For Future Use)
-- Stores results from scenario-based learning exercises
CREATE TABLE IF NOT EXISTS scenario_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,

  -- Scenario Information
  scenario_type TEXT NOT NULL, -- Type of scenario (e.g., 'decision_making', 'simulation', 'case_study')
  scenario_id TEXT NOT NULL, -- Unique identifier for the scenario
  scenario_title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'greenbot', 'lifestyle', 'waste', 'nature', 'energy', 'climate'

  -- Performance Metrics
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  percentage DECIMAL(5,2) GENERATED ALWAYS AS ((score::DECIMAL / max_score::DECIMAL) * 100) STORED,

  -- Additional Metrics
  decisions_made JSONB, -- Array of decisions and their outcomes
  time_taken_seconds INTEGER,
  completion_status TEXT DEFAULT 'completed', -- 'completed', 'abandoned', 'in_progress'

  -- Learning Outcomes
  learning_points TEXT[], -- Array of key learning points achieved
  recommendations TEXT[], -- Personalized recommendations based on performance

  -- Timestamps
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER LEARNING PROGRESS TABLE
-- Tracks overall learning journey and achievements
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,

  -- Progress Tracking
  total_quizzes_completed INTEGER DEFAULT 0,
  total_scenarios_completed INTEGER DEFAULT 0,

  -- Category-wise Progress (JSONB for flexibility)
  quiz_progress JSONB DEFAULT '{
    "greenbot": {"completed": 0, "best_score": 0, "average_score": 0},
    "lifestyle": {"completed": 0, "best_score": 0, "average_score": 0},
    "waste": {"completed": 0, "best_score": 0, "average_score": 0},
    "nature": {"completed": 0, "best_score": 0, "average_score": 0},
    "energy": {"completed": 0, "best_score": 0, "average_score": 0},
    "climate": {"completed": 0, "best_score": 0, "average_score": 0}
  }'::JSONB,

  -- Achievements & Badges
  achievements TEXT[], -- Array of achievement IDs earned
  current_streak INTEGER DEFAULT 0, -- Days in a row of learning activity
  longest_streak INTEGER DEFAULT 0,

  -- Timestamps
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one record per user
  UNIQUE(user_id)
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Quiz Results Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_email ON quiz_results(user_email);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_type ON quiz_results(quiz_type);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON quiz_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_quiz ON quiz_results(user_id, quiz_type);

-- Scenario Results Indexes
CREATE INDEX IF NOT EXISTS idx_scenario_results_user_id ON scenario_results(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_results_user_email ON scenario_results(user_email);
CREATE INDEX IF NOT EXISTS idx_scenario_results_category ON scenario_results(category);
CREATE INDEX IF NOT EXISTS idx_scenario_results_completed_at ON scenario_results(completed_at DESC);

-- Learning Progress Indexes
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_email ON learning_progress(user_email);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

-- Quiz Results Policies
CREATE POLICY "Users can view their own quiz results"
  ON quiz_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz results"
  ON quiz_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quiz results"
  ON quiz_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quiz results"
  ON quiz_results FOR DELETE
  USING (auth.uid() = user_id);

-- Scenario Results Policies
CREATE POLICY "Users can view their own scenario results"
  ON scenario_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenario results"
  ON scenario_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenario results"
  ON scenario_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenario results"
  ON scenario_results FOR DELETE
  USING (auth.uid() = user_id);

-- Learning Progress Policies
CREATE POLICY "Users can view their own learning progress"
  ON learning_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning progress"
  ON learning_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning progress"
  ON learning_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Function to automatically update user email when quiz is saved
CREATE OR REPLACE FUNCTION set_user_email_quiz()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_email IS NULL THEN
    NEW.user_email := (SELECT email FROM auth.users WHERE id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for quiz_results
CREATE TRIGGER set_quiz_user_email_trigger
  BEFORE INSERT ON quiz_results
  FOR EACH ROW
  EXECUTE FUNCTION set_user_email_quiz();

-- Trigger for scenario_results
CREATE TRIGGER set_scenario_user_email_trigger
  BEFORE INSERT ON scenario_results
  FOR EACH ROW
  EXECUTE FUNCTION set_user_email_quiz();

-- Function to update learning progress after quiz completion
CREATE OR REPLACE FUNCTION update_learning_progress_after_quiz()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update learning_progress
  INSERT INTO learning_progress (
    user_id,
    user_email,
    total_quizzes_completed,
    quiz_progress,
    last_activity_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.user_email,
    1,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          '{}'::jsonb,
          ARRAY[NEW.quiz_type, 'completed'],
          '1'::jsonb
        ),
        ARRAY[NEW.quiz_type, 'best_score'],
        to_jsonb(NEW.percentage)
      ),
      ARRAY[NEW.quiz_type, 'average_score'],
      to_jsonb(NEW.percentage)
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_quizzes_completed = learning_progress.total_quizzes_completed + 1,
    quiz_progress = jsonb_set(
      jsonb_set(
        jsonb_set(
          learning_progress.quiz_progress,
          ARRAY[NEW.quiz_type, 'completed'],
          to_jsonb((learning_progress.quiz_progress->NEW.quiz_type->>'completed')::int + 1)
        ),
        ARRAY[NEW.quiz_type, 'best_score'],
        to_jsonb(
          GREATEST(
            (learning_progress.quiz_progress->NEW.quiz_type->>'best_score')::numeric,
            NEW.percentage
          )
        )
      ),
      ARRAY[NEW.quiz_type, 'average_score'],
      to_jsonb(
        (
          (learning_progress.quiz_progress->NEW.quiz_type->>'average_score')::numeric *
          (learning_progress.quiz_progress->NEW.quiz_type->>'completed')::numeric +
          NEW.percentage
        ) / ((learning_progress.quiz_progress->NEW.quiz_type->>'completed')::numeric + 1)
      )
    ),
    last_activity_at = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update learning progress when quiz is completed
CREATE TRIGGER update_progress_after_quiz
  AFTER INSERT ON quiz_results
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_progress_after_quiz();

-- ============================================================
-- HELPFUL QUERIES (FOR REFERENCE)
-- ============================================================

-- Get user's quiz history
-- SELECT * FROM quiz_results WHERE user_id = 'user-id' ORDER BY completed_at DESC;

-- Get user's best scores per quiz type
-- SELECT quiz_type, MAX(percentage) as best_score
-- FROM quiz_results
-- WHERE user_id = 'user-id'
-- GROUP BY quiz_type;

-- Get user's learning progress
-- SELECT * FROM learning_progress WHERE user_id = 'user-id';

-- Get average score across all quizzes
-- SELECT AVG(percentage) as overall_average
-- FROM quiz_results
-- WHERE user_id = 'user-id';

-- Get quiz attempts count per type
-- SELECT quiz_type, COUNT(*) as attempts
-- FROM quiz_results
-- WHERE user_id = 'user-id'
-- GROUP BY quiz_type;
