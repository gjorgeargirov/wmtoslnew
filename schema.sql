-- Cloudflare D1 Database Schema for User Management
-- Run this after creating the D1 database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- In production, should be hashed
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User', -- Admin, User, Viewer
  avatar TEXT, -- URL or base64
  department TEXT,
  permissions TEXT, -- JSON array stored as text
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User-Project relationships (many-to-many)
CREATE TABLE IF NOT EXISTS user_projects (
  user_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, project_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Migration history table (optional, for future use)
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  project_id INTEGER,
  file_name TEXT,
  status TEXT NOT NULL, -- success, failed, in_progress, cancelled
  start_time DATETIME,
  end_time DATETIME,
  duration INTEGER, -- in seconds
  result_data TEXT, -- JSON stored as text
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Insert default users
INSERT OR IGNORE INTO users (id, email, password, name, role, department, permissions) VALUES
  (1, 'demo@iwconnect.com', 'demo123', 'Demo User', 'Admin', 'IT', '["upload","migrate","cancel","view_history","admin"]'),
  (2, 'admin@iwconnect.com', 'admin123', 'Admin User', 'Admin', 'Management', '["upload","migrate","cancel","view_history","admin"]'),
  (3, 'user@iwconnect.com', 'user123', 'Regular User', 'User', 'Development', '["upload","migrate","view_history"]'),
  (4, 'viewer@iwconnect.com', 'viewer123', 'Viewer User', 'Viewer', 'Business', '["view_history"]');

-- Insert default projects
INSERT OR IGNORE INTO projects (id, name, description) VALUES
  (1, 'Project Alpha', 'Main migration project'),
  (2, 'Project Beta', 'Secondary project'),
  (3, 'Project Gamma', 'Enterprise project');

-- Link users to projects
INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES
  (1, 1), (1, 2), -- Demo user: Alpha, Beta
  (2, 1), (2, 2), (2, 3), -- Admin: All projects
  (3, 1), -- Regular user: Alpha only
  (4, 2); -- Viewer: Beta only
