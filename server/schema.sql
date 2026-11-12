-- Workout Tracker schema (MySQL / MariaDB). Auto-applied on first run by inc/lib.php.
-- NOTE: statements are split on semicolons, so keep semicolons out of comments.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A training (a routine day) such as Push, Pull or Legs
CREATE TABLE IF NOT EXISTS trainings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- An exercise inside a training. type = sets (weight x reps) or duration (cardio)
CREATE TABLE IF NOT EXISTS exercises (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  training_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  description TEXT NULL,
  type ENUM('sets','duration') NOT NULL DEFAULT 'sets',
  target_weight DECIMAL(7,2) NULL,
  est_duration_min INT NULL,
  target_duration_min INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Planned sets of a sets-type exercise
CREATE TABLE IF NOT EXISTS exercise_sets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exercise_id INT UNSIGNED NOT NULL,
  set_no SMALLINT UNSIGNED NOT NULL,
  target_reps SMALLINT UNSIGNED NOT NULL,
  target_weight DECIMAL(7,2) NULL,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One logged session of a training on a date
CREATE TABLE IF NOT EXISTS workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  training_id INT UNSIGNED NULL,
  training_name VARCHAR(60) NOT NULL,
  workout_date DATE NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  UNIQUE KEY uq_workout (user_id, training_id, workout_date),
  KEY idx_user_date (user_id, workout_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Actual logged sets (or a duration) of an exercise in a workout
CREATE TABLE IF NOT EXISTS log_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workout_id INT UNSIGNED NOT NULL,
  exercise_id INT UNSIGNED NULL,
  exercise_name VARCHAR(80) NOT NULL,
  set_no SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  weight DECIMAL(7,2) NULL,
  reps SMALLINT UNSIGNED NULL,
  duration_min DECIMAL(7,1) NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_ex (exercise_id),
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
