-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER DEFAULT 30,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL DEFAULT 'essay',
  correct_answer TEXT,
  max_score INTEGER DEFAULT 100,
  order_index INTEGER DEFAULT 0
);

-- Assignments table (teacher assigns quiz to students)
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  due_date TIMESTAMP,
  UNIQUE(quiz_id, student_id)
);

-- Quiz attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  total_score NUMERIC(5,2),
  time_taken INTEGER,
  status VARCHAR(20) DEFAULT 'in_progress'
);

-- Student answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  score NUMERIC(5,2),
  teacher_feedback TEXT,
  ai_feedback TEXT,
  scored_at TIMESTAMP
);

-- Sessions table for auth
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed demo teacher
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Pak Budi',
  'teacher@demo.com',
  '$2b$10$YourHashHere',
  'teacher'
) ON CONFLICT (email) DO NOTHING;

-- Seed demo student
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Siti Rahayu',
  'student@demo.com',
  '$2b$10$YourHashHere',
  'student'
) ON CONFLICT (email) DO NOTHING;
