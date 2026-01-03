// User Management System
// Uses Cloudflare Worker API (D1 database) when available, falls back to localStorage

// Default users (used only on first load)
const DEFAULT_USERS = [
  {
    id: 1,
    email: "demo@iwconnect.com",
    password: "demo123", // In production, this should be hashed
    name: "Demo User",
    role: "Admin",
    avatar: null,
    department: "IT",
    permissions: ["upload", "migrate", "cancel", "view_history", "admin"],
    projects: ["Project Alpha", "Project Beta"] // Projects user has access to
  },
  {
    id: 2,
    email: "admin@iwconnect.com",
    password: "admin123",
    name: "Admin User",
    role: "Admin",
    avatar: null,
    department: "Management",
    permissions: ["upload", "migrate", "cancel", "view_history", "admin"],
    projects: ["Project Alpha", "Project Beta", "Project Gamma"] // Admins see all projects
  },
  {
    id: 3,
    email: "user@iwconnect.com",
    password: "user123",
    name: "Regular User",
    role: "User",
    avatar: null,
    department: "Development",
    permissions: ["upload", "migrate", "view_history"],
    projects: ["Project Alpha"] // User only sees Project Alpha
  },
  {
    id: 4,
    email: "viewer@iwconnect.com",
    password: "viewer123",
    name: "Viewer User",
    role: "Viewer",
    avatar: null,
    department: "Business",
    permissions: ["view_history"],
    projects: ["Project Beta"] // Viewer only sees Project Beta
  }
];

// Default projects list
const DEFAULT_PROJECTS = [
  { id: 1, name: "Project Alpha", description: "Main migration project" },
  { id: 2, name: "Project Beta", description: "Secondary project" },
  { id: 3, name: "Project Gamma", description: "Enterprise project" }
];

// Storage key for users
const USERS_STORAGE_KEY = 'migrationAppUsers';
const PROJECTS_STORAGE_KEY = 'migrationAppProjects';

// Load users from localStorage or use defaults
function loadUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading users from localStorage:', e);
  }
  // First time - save defaults to localStorage
  saveUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
}

// Save users to localStorage
function saveUsers(users) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return true;
  } catch (e) {
    console.error('Error saving users to localStorage:', e);
    return false;
  }
}

// Get current users array (always use this instead of USERS directly)
function getUsers() {
  if (!window._usersCache) {
    window._usersCache = loadUsers();
  }
  return window._usersCache;
}

// Refresh users from localStorage (call after add/edit/delete)
function refreshUsers() {
  // Clear cache to force fresh load
  window._usersCache = null;
  window._usersCache = loadUsers();
  // Also update the USERS variable for backward compatibility
  USERS = window._usersCache;
  return window._usersCache;
}

// Initialize users on load
let USERS = loadUsers();

// Check if API is available
let USE_API = false;
let API_CLIENT = null;

// Try to load API client (check after a short delay to ensure api-client.js has loaded)
function initializeAPIClient() {
  try {
    if (typeof userAPI !== 'undefined') {
      API_CLIENT = userAPI;
      USE_API = true;
      console.log('API client loaded - will use database API');
    } else if (window.userAPI) {
      API_CLIENT = window.userAPI;
      USE_API = true;
      console.log('API client loaded - will use database API');
    } else {
      console.log('API client not available - using localStorage fallback');
    }
  } catch (e) {
    console.log('API client not available, using localStorage fallback:', e);
  }
}

// Initialize immediately and also after a short delay (in case script loads after)
initializeAPIClient();
if (typeof window !== 'undefined') {
  window.addEventListener('load', initializeAPIClient);
  // Also try after a short delay
  setTimeout(initializeAPIClient, 100);
}

// Authenticate user - uses API if available, otherwise localStorage
async function authenticateUser(email, password) {
  // Trim whitespace from inputs
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '').trim();
  
  if (!trimmedEmail || !trimmedPassword) {
    return {
      success: false,
      error: "Email and password are required"
    };
  }

  // Try API first
  if (USE_API && API_CLIENT) {
    try {
      const result = await API_CLIENT.login(trimmedEmail, trimmedPassword);
      return result;
    } catch (error) {
      console.warn('API login failed, falling back to localStorage:', error.message);
      // Disable API if server is not available
      if (error.message.includes('not available') || error.message.includes('Failed to fetch')) {
        USE_API = false;
        console.log('API server not available - disabled API, using localStorage only');
      }
      // Fall through to localStorage
    }
  }
  
  // Fallback to localStorage
  const users = loadUsers();
  
  if (!users || users.length === 0) {
    return {
      success: false,
      error: "No users found in system"
    };
  }
  
  // Find user by email (case-insensitive) and password (exact match)
  const user = users.find(u => {
    const userEmail = (u.email || '').trim().toLowerCase();
    const userPassword = (u.password || '').trim();
    return userEmail === trimmedEmail && userPassword === trimmedPassword;
  });
  
  if (user) {
    // Return user without password, but ensure all other data is included
    const { password: pwd, ...userWithoutPassword } = user;
    // Ensure permissions are included
    if (!userWithoutPassword.permissions && user.permissions) {
      userWithoutPassword.permissions = user.permissions;
    }
    return {
      success: true,
      user: userWithoutPassword,
      token: `token-${user.id}-${Date.now()}`
    };
  }
  
  return {
    success: false,
    error: "Invalid email or password"
  };
}

// Check if user has permission
function hasPermission(user, permission) {
  if (!user || !permission) return false;
  return user.permissions && Array.isArray(user.permissions) && user.permissions.includes(permission);
}

// Make hasPermission globally accessible
window.hasPermission = hasPermission;

// Get user by email
function getUserByEmail(email) {
  const users = getUsers();
  return users.find(u => u.email === email);
}

// Get all users (admin only) - returns without passwords
// Can be called synchronously (localStorage) or asynchronously (API)
function getAllUsers() {
  // If API is available, return a promise
  if (USE_API && API_CLIENT) {
    return (async () => {
      try {
        const result = await API_CLIENT.getUsers();
        return result.users || [];
      } catch (error) {
        console.warn('API getUsers failed, falling back to localStorage:', error);
        // Fall through to localStorage
        const users = getUsers();
        return users.map(({ password, ...user }) => user);
      }
    })();
  }
  
  // Synchronous localStorage fallback
  const users = getUsers();
  return users.map(({ password, ...user }) => user);
}

// Add new user (admin only)
async function addUser(userData) {
  // Try API first
  if (USE_API && API_CLIENT) {
    try {
      // Convert projects array to project IDs
      const projectIds = [];
      if (userData.projects && Array.isArray(userData.projects)) {
        const allProjects = await Promise.resolve(getAllProjects());
        for (const projectName of userData.projects) {
          const project = allProjects.find(p => p.name === projectName);
          if (project) projectIds.push(project.id);
        }
      }
      
      const result = await API_CLIENT.createUser({
        ...userData,
        projects: projectIds
      });
      return { success: true, id: result.id };
    } catch (error) {
      console.warn('API addUser failed, falling back to localStorage:', error);
      // Fall through to localStorage
    }
  }
  
  // Fallback to localStorage
  const users = getUsers();
  
  // Check if email already exists
  if (users.find(u => u.email === userData.email)) {
    return { success: false, error: 'Email already exists' };
  }
  
  // Get next ID
  const nextId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
  
  const newUser = {
    id: nextId,
    ...userData
  };
  
  users.push(newUser);
  
  if (saveUsers(users)) {
    refreshUsers();
    return { success: true, user: newUser };
  } else {
    return { success: false, error: 'Failed to save user' };
  }
}

// Update existing user (admin only)
async function updateUser(userId, userData) {
  // Try API first
  if (USE_API && API_CLIENT) {
    try {
      // Convert projects array to project IDs if needed
      if (userData.projects && Array.isArray(userData.projects) && userData.projects.length > 0 && typeof userData.projects[0] === 'string') {
        const allProjects = await Promise.resolve(getAllProjects());
        const projectIds = userData.projects
          .map(projectName => {
            const project = allProjects.find(p => p.name === projectName);
            return project ? project.id : null;
          })
          .filter(id => id !== null);
        userData.projects = projectIds;
      }
      
      await API_CLIENT.updateUser(userId, userData);
      return { success: true };
    } catch (error) {
      console.warn('API updateUser failed, falling back to localStorage:', error);
      // Fall through to localStorage
    }
  }
  
  // Fallback to localStorage
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index === -1) {
    return { success: false, error: 'User not found' };
  }
  
  // Check if email is being changed and already exists
  if (userData.email && userData.email !== users[index].email) {
    if (users.find(u => u.email === userData.email && u.id !== userId)) {
      return { success: false, error: 'Email already exists' };
    }
  }
  
  // Update user (preserve password if not provided)
  const oldPassword = users[index].password;
  users[index] = {
    ...users[index],
    ...userData,
    id: userId // Ensure ID doesn't change
  };
  
  // If password is not provided, keep the old one
  if (!userData.password) {
    users[index].password = oldPassword;
  }
  
  if (saveUsers(users)) {
    refreshUsers();
    return { success: true, user: users[index] };
  } else {
    return { success: false, error: 'Failed to save user' };
  }
}

// Delete user (admin only)
async function deleteUserById(userId) {
  // Try API first
  if (USE_API && API_CLIENT) {
    try {
      await API_CLIENT.deleteUser(userId);
      return { success: true };
    } catch (error) {
      console.warn('API deleteUser failed, falling back to localStorage:', error);
      // Fall through to localStorage
    }
  }
  
  // Fallback to localStorage
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  
  if (index === -1) {
    return { success: false, error: 'User not found' };
  }
  
  users.splice(index, 1);
  
  if (saveUsers(users)) {
    refreshUsers();
    return { success: true };
  } else {
    return { success: false, error: 'Failed to delete user' };
  }
}

// Project Management Functions
function loadProjects() {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading projects from localStorage:', e);
  }
  // First time - save defaults to localStorage
  saveProjects(DEFAULT_PROJECTS);
  return DEFAULT_PROJECTS;
}

function saveProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch (e) {
    console.error('Error saving projects to localStorage:', e);
    return false;
  }
}

function getAllProjects() {
  // If API is available, return a promise
  if (USE_API && window.projectAPI) {
    return (async () => {
      try {
        const result = await window.projectAPI.getProjects();
        return result.projects || [];
      } catch (error) {
        console.warn('API getProjects failed, falling back to localStorage:', error);
        // Fall through to localStorage
        return loadProjects();
      }
    })();
  }
  
  // Synchronous localStorage fallback
  return loadProjects();
}

// Make functions globally accessible
window.getAllProjects = getAllProjects;
window.updateProject = updateProject;
window.addProject = addProject;
window.deleteProject = deleteProject;
window.getAllUsers = getAllUsers;

function getProjectById(projectId) {
  const projects = loadProjects();
  return projects.find(p => p.id === projectId);
}

function getProjectByName(projectName) {
  const projects = loadProjects();
  return projects.find(p => p.name === projectName);
}

function addProject(projectData) {
  const projects = loadProjects();
  const nextId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
  
  const newProject = {
    id: nextId,
    ...projectData
  };
  
  projects.push(newProject);
  
  if (saveProjects(projects)) {
    return { success: true, project: newProject };
  } else {
    return { success: false, error: 'Failed to save project' };
  }
}

function updateProject(projectId, projectData) {
  const projects = loadProjects();
  const index = projects.findIndex(p => p.id === projectId);
  
  if (index === -1) {
    return { success: false, error: 'Project not found' };
  }
  
  projects[index] = {
    ...projects[index],
    ...projectData,
    id: projectId
  };
  
  if (saveProjects(projects)) {
    return { success: true, project: projects[index] };
  } else {
    return { success: false, error: 'Failed to save project' };
  }
}

function deleteProject(projectId) {
  const projects = loadProjects();
  const index = projects.findIndex(p => p.id === projectId);
  
  if (index === -1) {
    return { success: false, error: 'Project not found' };
  }
  
  projects.splice(index, 1);
  
  if (saveProjects(projects)) {
    return { success: true };
  } else {
    return { success: false, error: 'Failed to delete project' };
  }
}

// Get user's accessible projects
function getUserProjects(user) {
  if (!user || !user.projects) {
    return [];
  }
  const allProjects = loadProjects();
  return allProjects.filter(p => user.projects.includes(p.name));
}

// Check if user has access to a project
function userHasProjectAccess(user, projectName) {
  if (!user || !user.projects) {
    return false;
  }
  // Admins have access to all projects
  if (user.role === 'Admin' && hasPermission(user, 'admin')) {
    return true;
  }
  return user.projects.includes(projectName);
}

// Role definitions
const ROLES = {
  Admin: {
    name: "Admin",
    description: "Full access to all features",
    permissions: ["upload", "migrate", "cancel", "view_history", "admin"]
  },
  User: {
    name: "User",
    description: "Can upload and migrate packages",
    permissions: ["upload", "migrate", "view_history"]
  },
  Viewer: {
    name: "Viewer",
    description: "View-only access",
    permissions: ["view_history"]
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    USERS,
    ROLES,
    authenticateUser,
    hasPermission,
    getUserByEmail,
    getAllUsers,
    addUser,
    updateUser,
    deleteUserById
  };
}
