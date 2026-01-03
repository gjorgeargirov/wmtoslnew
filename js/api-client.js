// API Client for Cloudflare Worker API
// Handles all API calls to the backend

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787' // Local development (Worker)
  : window.location.origin; // Production (Pages Functions - same origin)

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // If fetch fails (network error), throw immediately
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(data.error || `API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // Re-throw with more context
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('API server not available - using localStorage fallback');
    }
    throw error;
  }
}

// User API methods
export const userAPI = {
  // Login
  async login(email, password) {
    return apiRequest('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Get all users
  async getUsers() {
    return apiRequest('/api/users');
  },

  // Create user
  async createUser(userData) {
    return apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Update user
  async updateUser(userId, userData) {
    return apiRequest(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  // Delete user
  async deleteUser(userId) {
    return apiRequest(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Project API methods
export const projectAPI = {
  // Get all projects
  async getProjects() {
    return apiRequest('/api/projects');
  },

  // Create project
  async createProject(projectData) {
    return apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  },
};

// Make API client globally available
window.userAPI = userAPI;
window.projectAPI = projectAPI;
window.API_BASE_URL = API_BASE_URL;

// Export API base URL for config (for ES modules)
export { API_BASE_URL };
