// State management
let currentStep = 1;
let uploadedFile = null;
let migrationResult = null;
let currentMigrationId = null;
let backgroundMigration = false;
let migrationInProgress = false;
let migrationHistory = JSON.parse(localStorage.getItem('migrationHistory') || '[]');
let dashboardUpdateInterval = null;
let currentAbortController = null; // For cancelling migrations
let currentPage = 1; // Pagination state
let pageSize = 8; // Items per page

// SECURITY: Sanitize HTML to prevent XSS attacks
function sanitizeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// SECURITY: Sanitize filename - only allow safe characters
function sanitizeFilename(filename) {
  if (!filename) return '';
  // Remove any HTML tags first
  const sanitized = sanitizeHTML(filename);
  // Replace potentially dangerous characters
  return sanitized.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_');
}

// Check for interrupted migration on load
let currentMigration = JSON.parse(localStorage.getItem('currentMigration') || 'null');

// Check if running from file:// protocol (will cause CORS issues)
(function() {
  if (window.location.protocol === 'file:') {
    console.error('⚠️ WARNING: File opened directly from file:// protocol');
    console.error('This will cause CORS errors when making API calls.');
    console.error('Please use a local web server instead:');
    console.error('1. Run: python server.py (or double-click server.bat)');
    console.error('2. Open: http://localhost:8000/index.html');
    showToast('CORS Warning', 'This file is opened directly (file://). This will cause API calls to fail due to CORS. Please use a local web server.', 'warning');
  }
})();

// Navigation functions
window.goToView = function(view) {
  switch(view) {
    case 'dashboard':
      window.showDashboard();
      break;
    case 'wizard':
      window.showNewMigration();
      break;
    case 'profile':
      window.showProfile();
      break;
    default:
      console.error('Unknown view:', view);
  }
};

window.showDashboard = function() {
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('wizardView').classList.add('hidden');
  document.getElementById('profileView').classList.add('hidden');
  document.getElementById('adminView').classList.add('hidden');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById('navDashboard').classList.add('active');
  
  // Reset to first page when showing dashboard
  currentPage = 1;
  
  // Re-initialize admin access (in case user data changed)
  if (typeof initializeAdminAccess === 'function') {
    initializeAdminAccess();
  }
  
  // Update dashboard stats
  updateDashboardStats();
  updateRecentMigrations();
  
  // Update sidebar user card
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    const user = JSON.parse(userStr);
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    updateSidebarUserCard(user, initials);
  }
  
  // Start real-time updates if migration is in progress
  if (migrationInProgress || currentMigration) {
    startDashboardRealtimeUpdates();
  }
};

window.showNewMigration = function() {
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('wizardView').classList.remove('hidden');
  document.getElementById('profileView').classList.add('hidden');
  document.getElementById('adminView').classList.add('hidden');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const navNewMigration = document.getElementById('navNewMigration');
  if (navNewMigration) navNewMigration.classList.add('active');
  
  // Apply permission-based UI restrictions
  applyPermissionRestrictions();
  
  // Reset wizard to clean state (unless migration is in progress)
  if (!migrationInProgress) {
    resetWizardForNewMigration();
  }
  
  // Go to step 1
  goToStep(1);
};

// Reset wizard for a new migration
function resetWizardForNewMigration() {
  // Reset to step 1
  currentStep = 1;
  
  // Clear uploaded file reference (only if migration is not in progress)
  // This prevents clearing the file while migration is starting
  if (!migrationInProgress) {
    uploadedFile = null;
  }
  
  // Clear file input
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.value = '';
  }
  
  // Clear file upload box display
  const uploadBox = document.getElementById("uploadBox");
  if (uploadBox) {
    uploadBox.classList.remove("file-selected", "drag-over");
    
    // Restore original upload text
    const uploadText = uploadBox.querySelector('.upload-text');
    if (uploadText) {
      uploadText.textContent = 'Drag and drop your ZIP file here or click to browse';
      uploadText.style.display = 'block';
    }
    
    // Hide file name display
    const fileNameDisplay = uploadBox.querySelector('.file-name');
    if (fileNameDisplay) {
      fileNameDisplay.textContent = '';
      fileNameDisplay.style.display = 'none';
    }
    
    // Show upload icon if it exists
    const uploadIcon = uploadBox.querySelector('.upload-icon');
    if (uploadIcon) {
      uploadIcon.style.display = 'block';
    }
  }
  
  // Hide file info display
  const fileInfo = document.getElementById("fileInfo");
  if (fileInfo) {
    fileInfo.classList.add("hidden");
    const fileName = document.getElementById("fileName");
    if (fileName) fileName.textContent = '';
    const fileSize = document.getElementById("fileSize");
    if (fileSize) fileSize.textContent = '';
  }
  
  // Clear file list display (if exists)
  const fileList = document.getElementById('fileList');
  if (fileList) {
    fileList.innerHTML = '';
  }
  
  // Reset progress and results sections
  const progressSection = document.getElementById("progressSection");
  if (progressSection) {
    progressSection.classList.add("hidden");
  }
  const resultsSection = document.getElementById("resultsSection");
  if (resultsSection) {
    resultsSection.classList.add("hidden");
  }
  
  // Clear any loading spinner
  const loadingSpinner = document.getElementById('loadingSpinner');
  if (loadingSpinner) {
    loadingSpinner.remove();
  }
  
  // Stop migration time estimate
  if (migrationTimeEstimateInterval) {
    clearInterval(migrationTimeEstimateInterval);
    migrationTimeEstimateInterval = null;
  }
  
  // Reset progress bar
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  if (progressFill) {
    progressFill.style.width = "0%";
  }
  if (progressLabel) {
    progressLabel.textContent = "Ready to start...";
    progressLabel.style.color = "";
  }
  
  // Reset form fields
  const targetEnv = document.getElementById("targetEnv");
  if (targetEnv) targetEnv.value = "Development";
  
  const namingConvention = document.getElementById("namingConvention");
  if (namingConvention) namingConvention.value = "Original Names";
  
  // Reset checkboxes to defaults
  const optHierarchy = document.getElementById("optHierarchy");
  if (optHierarchy) optHierarchy.checked = true;
  
  const optDocs = document.getElementById("optDocs");
  if (optDocs) optDocs.checked = true;
  
  const optMapping = document.getElementById("optMapping");
  if (optMapping) optMapping.checked = true;
  
  const optTransforms = document.getElementById("optTransforms");
  if (optTransforms) optTransforms.checked = true;
  
  // Hide cancel button
  const cancelBtn = document.getElementById('btnCancelMigration');
  if (cancelBtn) {
    cancelBtn.classList.add('hidden');
  }
  
  // Reset step indicators
  for (let i = 1; i <= 3; i++) {
    const wizStep = document.getElementById("wizStep" + i);
    if (wizStep) {
      wizStep.classList.remove("active", "completed");
      if (i === 1) {
        wizStep.classList.add("active");
      }
    }
  }
  
  // Disable next button until file is uploaded
  const nextBtn = document.getElementById("next1");
  if (nextBtn) {
    nextBtn.disabled = true;
  }
}

// Populate project dropdown with user's accessible projects
function populateProjectDropdown() {
  const projectSelect = document.getElementById('migrationProject');
  if (!projectSelect) return;
  
  // Clear existing options except the first one
  projectSelect.innerHTML = '<option value="">Select project...</option>';
  
  // Get current user
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  
  // Get user's accessible projects
  let userProjects = [];
  if (user.role === 'Admin' && hasPermission(user, 'admin')) {
    // Admins see all projects
    userProjects = getAllProjects();
  } else if (user.projects && Array.isArray(user.projects)) {
    // Regular users see only their assigned projects
    const allProjects = getAllProjects();
    userProjects = allProjects.filter(p => user.projects.includes(p.name));
  }
  
  // Populate dropdown
  userProjects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.name;
    option.textContent = project.name;
    if (project.description) {
      option.title = project.description;
    }
    projectSelect.appendChild(option);
  });
  
  // If user has only one project, auto-select it
  if (userProjects.length === 1) {
    projectSelect.value = userProjects[0].name;
  }
}

// Apply UI restrictions based on user permissions
function applyPermissionRestrictions() {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    
    // Check if hasPermission function is available
    const checkPermission = typeof hasPermission === 'function' ? hasPermission : 
                           typeof window.hasPermission === 'function' ? window.hasPermission : 
                           null;
    
    if (!checkPermission) {
      // hasPermission not available, skip restrictions
      return;
    }
    
    const hasUploadPermission = checkPermission(user, 'upload');
    const hasMigratePermission = checkPermission(user, 'migrate');
  
  // Disable/hide upload area if no upload permission
  const uploadBox = document.getElementById('uploadBox');
  const fileInput = document.getElementById('fileInput');
  const next1Btn = document.getElementById('next1');
  const startMigrationBtn = document.querySelector('button[onclick="startMigration()"]');
  
  if (!hasUploadPermission) {
    if (uploadBox) {
      uploadBox.style.opacity = '0.5';
      uploadBox.style.pointerEvents = 'none';
      uploadBox.title = 'You don\'t have permission to upload files';
    }
    if (fileInput) {
      fileInput.disabled = true;
    }
    if (next1Btn) {
      next1Btn.disabled = true;
    }
    // Show message
    const errorEl = document.getElementById('fileError');
    if (errorEl) {
      errorEl.textContent = 'You don\'t have permission to upload files. Contact your administrator.';
      errorEl.style.color = '#b91c1c';
    }
  } else {
    if (uploadBox) {
      uploadBox.style.opacity = '';
      uploadBox.style.pointerEvents = '';
      uploadBox.title = '';
    }
    if (fileInput) {
      fileInput.disabled = false;
    }
  }
  
  // Disable/hide migration button if no migrate permission
  if (!hasMigratePermission && startMigrationBtn) {
    startMigrationBtn.disabled = true;
    startMigrationBtn.style.opacity = '0.5';
    startMigrationBtn.title = 'You don\'t have permission to start migrations';
  } else if (startMigrationBtn) {
    startMigrationBtn.disabled = false;
    startMigrationBtn.style.opacity = '';
    startMigrationBtn.title = '';
  }
  } catch (error) {
    // Silently fail - don't break the page if permission checks fail
  }
}

window.showProfile = function() {
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('wizardView').classList.add('hidden');
  document.getElementById('profileView').classList.remove('hidden');
  document.getElementById('adminView').classList.add('hidden');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const navProfile = document.getElementById('navProfile');
  if (navProfile) navProfile.classList.add('active');
  
  // Load profile data
  loadProfileData();
};

window.showAdmin = function() {
  // Check if user is admin
  if (!isAdmin()) {
    showToast('Access denied. Admin privileges required.', 'error');
    return;
  }
  
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('wizardView').classList.add('hidden');
  document.getElementById('profileView').classList.add('hidden');
  document.getElementById('adminView').classList.remove('hidden');
  
  // Update nav
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin) navAdmin.classList.add('active');
  
  // Load admin data
  loadAdminData();
};

async function loadAdminData() {
  // Load users table (now async)
  await loadUsersTable();
  
  // Update stats (getAllUsers might return a Promise)
  const users = await Promise.resolve(getAllUsers());
  const totalEl = document.getElementById('adminStatTotal');
  const adminsEl = document.getElementById('adminStatAdmins');
  const usersEl = document.getElementById('adminStatUsers');
  const viewersEl = document.getElementById('adminStatViewers');
  
  if (totalEl) totalEl.textContent = users.length || 0;
  if (adminsEl) adminsEl.textContent = users.filter(u => u.role === 'Admin').length || 0;
  if (usersEl) usersEl.textContent = users.filter(u => u.role === 'User').length || 0;
  if (viewersEl) viewersEl.textContent = users.filter(u => u.role === 'Viewer').length || 0;
}

// Dashboard stats functions
function updateDashboardStats() {
  // Get current user and their accessible projects
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  let userProjectNames = [];
  
  if (user.role === 'Admin' && hasPermission(user, 'admin')) {
    // Admins see all projects - don't filter
    userProjectNames = null; // null means show all
  } else if (user.projects && Array.isArray(user.projects)) {
    userProjectNames = user.projects;
  }
  
  // Filter migrations by user's projects
  let filteredMigrations = migrationHistory;
  if (userProjectNames !== null) {
    filteredMigrations = migrationHistory.filter(migration => {
      if (!migration.project) return false; // Exclude migrations without project
      return userProjectNames.includes(migration.project);
    });
  }
  
  const total = filteredMigrations.length;
  const successful = filteredMigrations.filter(m => m.status === 'success').length;
  const failed = filteredMigrations.filter(m => m.status === 'failed').length;
  const cancelled = filteredMigrations.filter(m => m.status === 'cancelled').length;
  const inProgress = (migrationInProgress && 
                     (userProjectNames === null || 
                      !currentMigration?.project || 
                      userProjectNames.includes(currentMigration.project))) ? 1 : 0;
  
  document.getElementById('statTotalMigrations').textContent = total;
  document.getElementById('statSuccessful').textContent = successful;
  document.getElementById('statInProgress').textContent = inProgress;
  document.getElementById('statFailed').textContent = failed;
  document.getElementById('statCancelled').textContent = cancelled;
}

function updateRecentMigrations() {
  const tableBody = document.getElementById('migrationsTableBody');
  
  if (!tableBody) return;
  
  // Get current user and their accessible projects
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  let userProjectNames = [];
  
  if (user.role === 'Admin' && hasPermission(user, 'admin')) {
    // Admins see all projects - don't filter
    userProjectNames = null; // null means show all
  } else if (user.projects && Array.isArray(user.projects)) {
    userProjectNames = user.projects;
  }
  
  // Filter migrations by user's projects
  let filteredMigrations = migrationHistory.filter(migration => {
    if (userProjectNames === null) return true; // Admin sees all
    if (!migration.project) return false; // Exclude migrations without project
    return userProjectNames.includes(migration.project);
  });
  
  // Add current migration if in progress and user has access
  if ((migrationInProgress && uploadedFile) || currentMigration) {
    // Ensure in-progress migration has execution ID
    if (currentMigration && !currentMigration.executionId) {
      currentMigration.executionId = Math.random().toString(36).substring(2, 10);
      localStorage.setItem('currentMigration', JSON.stringify(currentMigration));
    }
    
    const inProgressMigration = currentMigration || {
      fileName: uploadedFile.name,
      status: 'in-progress',
      message: 'Migration in progress...',
      timestamp: new Date().toISOString(),
      executionId: Math.random().toString(36).substring(2, 10),
      project: document.getElementById('migrationProject')?.value || 'Unassigned'
    };
    
    // Only add in-progress migration if user has access to its project
    if (userProjectNames === null || 
        !inProgressMigration.project || 
        userProjectNames.includes(inProgressMigration.project)) {
      filteredMigrations.push(inProgressMigration);
    }
  }
  
  // Sort by timestamp (newest first)
  let allMigrations = filteredMigrations.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
  
  // Ensure all migrations have execution IDs (for backward compatibility)
  let needsUpdate = false;
  migrationHistory.forEach(migration => {
    if (!migration.executionId) {
      migration.executionId = Math.random().toString(36).substring(2, 10);
      needsUpdate = true;
    }
    if (!migration.user) {
      migration.user = 'demo@iwconnect.com';
    }
  });
  
  // Update localStorage if we added execution IDs
  if (needsUpdate) {
    localStorage.setItem('migrationHistory', JSON.stringify(migrationHistory));
  }
  
  // Pagination logic
  const totalMigrations = allMigrations.length;
  const totalPages = Math.ceil(totalMigrations / pageSize);
  
  // Ensure currentPage is valid
  if (currentPage > totalPages && totalPages > 0) {
    currentPage = totalPages;
  } else if (currentPage < 1) {
    currentPage = 1;
  }
  
  // Calculate pagination slice
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMigrations = allMigrations.slice(startIndex, endIndex);
  
  // Update pagination controls
  updatePaginationControls(totalMigrations, totalPages, currentPage);
  
  if (paginatedMigrations.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <p>No migrations yet</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = paginatedMigrations.map(migration => {
    // Get SVG icon and status info based on migration status
    let iconSvg = '';
    let statusText = 'Failed';
    let statusClass = 'status-failed';
    
    if (migration.status === 'success') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      statusText = 'Completed';
      statusClass = 'status-success';
    } else if (migration.status === 'in-progress') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.3"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      statusText = 'In Progress';
      statusClass = 'status-progress';
    } else if (migration.status === 'cancelled') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
      statusText = 'Cancelled';
      statusClass = 'status-cancelled';
    } else if (migration.status === 'failed') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      statusText = 'Failed';
      statusClass = 'status-failed';
    }
    
    const date = new Date(migration.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric' 
    });
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    // Calculate duration for in-progress migrations
    let durationDisplay = '00:00:00';
    if (migration.status === 'in-progress' && migration.startTime) {
      const elapsed = Date.now() - migration.startTime;
      durationDisplay = formatDuration(elapsed);
    } else if (migration.duration) {
      durationDisplay = formatDuration(migration.duration);
    }
    
    // Get user email and execution ID (sanitize for security)
    const userEmail = sanitizeHTML(migration.user || 'demo@iwconnect.com');
    const executionId = sanitizeHTML(migration.executionId || 'N/A');
    const safeFileName = sanitizeFilename(migration.fileName);
    const projectName = sanitizeHTML(migration.project || 'Unassigned');
    
    // Action button (only for in-progress migrations)
    let actionButton = '';
    if (migration.status === 'in-progress') {
      actionButton = `<button class="btn btn-danger btn-sm" onclick="cancelMigration()">✕ Cancel</button>`;
    }
    
    return `
      <tr class="migration-row ${migration.status}">
        <td class="project-cell">
          <div class="project-name" title="${safeFileName}">${projectName}</div>
          <div class="file-name" style="font-size: 0.75rem; color: #6c757d; margin-top: 0.25rem;">${safeFileName}</div>
        </td>
        <td class="execution-id-cell">
          <div class="execution-id">${executionId}</div>
        </td>
        <td class="datetime-cell">
          <div class="datetime">${dateStr}, ${timeStr}</div>
        </td>
        <td class="duration-cell">
          <div class="duration">${durationDisplay}</div>
        </td>
        <td class="user-cell">
          <div class="user-email">${userEmail}</div>
        </td>
        <td class="status-cell">
          <span class="status-badge ${statusClass}">
            ${sanitizeHTML(statusText)}
            <span class="status-icon">${iconSvg}</span>
          </span>
        </td>
        <td class="actions-cell">
          ${actionButton}
        </td>
      </tr>
    `;
  }).join('');
}

// Pagination functions
function updatePaginationControls(totalItems, totalPages, currentPageNum) {
  const container = document.getElementById('paginationContainer');
  const info = document.getElementById('paginationInfo');
  const pagesContainer = document.getElementById('paginationPages');
  const firstBtn = document.getElementById('paginationFirst');
  const prevBtn = document.getElementById('paginationPrev');
  const nextBtn = document.getElementById('paginationNext');
  const lastBtn = document.getElementById('paginationLast');
  
  if (!container || totalItems === 0) {
    if (container) container.style.display = 'none';
    return;
  }
  
  container.style.display = 'flex';
  
  // Update info text
  const startItem = totalItems === 0 ? 0 : (currentPageNum - 1) * pageSize + 1;
  const endItem = Math.min(currentPageNum * pageSize, totalItems);
  info.textContent = `Showing ${startItem}-${endItem} of ${totalItems}`;
  
  // Update button states
  firstBtn.disabled = currentPageNum === 1;
  prevBtn.disabled = currentPageNum === 1;
  nextBtn.disabled = currentPageNum === totalPages;
  lastBtn.disabled = currentPageNum === totalPages;
  
  // Generate page numbers
  pagesContainer.innerHTML = '';
  
  // Show max 5 page numbers
  let startPage = Math.max(1, currentPageNum - 2);
  let endPage = Math.min(totalPages, currentPageNum + 2);
  
  // Adjust if we're near the start or end
  if (endPage - startPage < 4) {
    if (startPage === 1) {
      endPage = Math.min(5, totalPages);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, totalPages - 4);
    }
  }
  
  // Add first page if not in range
  if (startPage > 1) {
    const firstPageBtn = document.createElement('button');
    firstPageBtn.className = 'pagination-page';
    firstPageBtn.textContent = '1';
    firstPageBtn.onclick = () => window.goToPage(1);
    pagesContainer.appendChild(firstPageBtn);
    
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.textContent = '...';
      pagesContainer.appendChild(ellipsis);
    }
  }
  
  // Add page numbers in range
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = 'pagination-page';
    if (i === currentPageNum) {
      pageBtn.classList.add('active');
    }
    pageBtn.textContent = i;
    pageBtn.onclick = () => window.goToPage(i);
    pagesContainer.appendChild(pageBtn);
  }
  
  // Add last page if not in range
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.textContent = '...';
      pagesContainer.appendChild(ellipsis);
    }
    
    const lastPageBtn = document.createElement('button');
    lastPageBtn.className = 'pagination-page';
    lastPageBtn.textContent = totalPages;
    lastPageBtn.onclick = () => window.goToPage(totalPages);
    pagesContainer.appendChild(lastPageBtn);
  }
}

window.goToPage = function(page) {
  currentPage = page;
  updateRecentMigrations();
  // Scroll to top of table
  const tableContainer = document.querySelector('.migrations-table-container');
  if (tableContainer) {
    tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

window.goToNextPage = function() {
  if (currentPage < Math.ceil(getFilteredMigrationsCount() / pageSize)) {
    window.goToPage(currentPage + 1);
  }
};

window.goToPreviousPage = function() {
  if (currentPage > 1) {
    window.goToPage(currentPage - 1);
  }
};

window.goToLastPage = function() {
  const totalPages = Math.ceil(getFilteredMigrationsCount() / pageSize);
  if (totalPages > 0) {
    window.goToPage(totalPages);
  }
};

function getFilteredMigrationsCount() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  let userProjectNames = [];
  
  if (user.role === 'Admin' && hasPermission(user, 'admin')) {
    userProjectNames = null;
  } else if (user.projects && Array.isArray(user.projects)) {
    userProjectNames = user.projects;
  }
  
  let filteredMigrations = migrationHistory.filter(migration => {
    if (userProjectNames === null) return true;
    if (!migration.project) return false;
    return userProjectNames.includes(migration.project);
  });
  
  // Add in-progress migration if applicable
  if ((migrationInProgress && uploadedFile) || currentMigration) {
    const inProgressMigration = currentMigration || {
      fileName: uploadedFile.name,
      status: 'in-progress',
      message: 'Migration in progress...',
      timestamp: new Date().toISOString(),
      executionId: Math.random().toString(36).substring(2, 10),
      project: document.getElementById('migrationProject')?.value || 'Unassigned'
    };
    
    if (userProjectNames === null || 
        !inProgressMigration.project || 
        userProjectNames.includes(inProgressMigration.project)) {
      filteredMigrations.push(inProgressMigration);
    }
  }
  
  return filteredMigrations.length;
}

function saveMigrationToHistory(fileName, status, message = '', duration = null) {
  // Get current user info
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userEmail = user.email || 'demo@iwconnect.com';
  
  // Get project from current migration or form
  const project = currentMigration?.project || 
                  document.getElementById('migrationProject')?.value || 
                  'Unassigned';
  
  // Generate execution ID (8 chars similar to SnapLogic)
  const executionId = Math.random().toString(36).substring(2, 10);
  
  const migration = {
    fileName,
    status,
    message,
    timestamp: new Date().toISOString(),
    duration: duration, // Duration in milliseconds
    user: userEmail,
    executionId: executionId,
    project: project // Add project to migration
  };
  
  // Add new migration (don't save in-progress to history, only completed/failed)
  migrationHistory.push(migration);
  
  localStorage.setItem('migrationHistory', JSON.stringify(migrationHistory));
  
  // Clear current migration from localStorage
  localStorage.removeItem('currentMigration');
  currentMigration = null;
  
  updateDashboardStats();
  updateRecentMigrations();
}

// Format duration for display (HH:MM:SS format)
function formatDuration(ms) {
  if (!ms) return '00:00:00';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Pad with zeros
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  
  return `${hh}:${mm}:${ss}`;
}

// Start real-time dashboard updates
function startDashboardRealtimeUpdates() {
  // Clear any existing interval
  if (dashboardUpdateInterval) {
    clearInterval(dashboardUpdateInterval);
  }
  
  // Update dashboard every second while migration is in progress
  dashboardUpdateInterval = setInterval(() => {
    if (migrationInProgress || currentMigration) {
      updateRecentMigrations();
      updateDashboardStats();
    } else {
      // Stop updating if no migration is in progress
      stopDashboardRealtimeUpdates();
    }
  }, 1000);
}

// Stop real-time dashboard updates
function stopDashboardRealtimeUpdates() {
  if (dashboardUpdateInterval) {
    clearInterval(dashboardUpdateInterval);
    dashboardUpdateInterval = null;
  }
  if (migrationTimeEstimateInterval) {
    clearInterval(migrationTimeEstimateInterval);
    migrationTimeEstimateInterval = null;
  }
}

// Update migration time estimate
let migrationTimeEstimateInterval = null;
function updateMigrationTimeEstimate() {
  const estimateEl = document.getElementById('migrationTimeEstimate');
  if (!estimateEl) return;
  
  // Clear any existing interval
  if (migrationTimeEstimateInterval) {
    clearInterval(migrationTimeEstimateInterval);
  }
  
  migrationTimeEstimateInterval = setInterval(() => {
    if (!estimateEl) return;
    
    const migration = currentMigration || JSON.parse(localStorage.getItem('currentMigration') || '{}');
    if (!migration || !migration.startTime) {
      estimateEl.textContent = 'Starting migration... You can navigate away.';
      return;
    }
    
    const startTime = migration.startTime;
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000); // seconds
    
    if (elapsed < 60) {
      estimateEl.textContent = `Processing... ${elapsed} second${elapsed !== 1 ? 's' : ''} elapsed. You can navigate away.`;
    } else {
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      if (minutes < 5) {
        estimateEl.textContent = `Processing... ${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds > 0 ? seconds + ' second' + (seconds !== 1 ? 's' : '') : ''} elapsed. You can navigate away.`;
      } else {
        estimateEl.textContent = `Processing... ${minutes} minute${minutes !== 1 ? 's' : ''} elapsed. You can navigate away.`;
      }
    }
  }, 1000); // Update every second
}

// Profile functions
function loadProfileData() {
  // Get user data from session storage (set during login)
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { name: 'Demo User', email: 'demo@iwconnect.com', role: 'User' };
  
  // Get initials
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
  
  // Update profile avatar
  const userAvatar = document.getElementById('userAvatar');
  if (userAvatar) {
    if (user.avatar) {
      userAvatar.innerHTML = `<img src="${sanitizeHTML(user.avatar)}" alt="${sanitizeHTML(user.name)}" />`;
    } else {
      userAvatar.innerHTML = `<span id="userInitials">${sanitizeHTML(initials)}</span>`;
    }
  } else {
    document.getElementById('userInitials').textContent = sanitizeHTML(initials);
  }
  
  // Update profile avatar preview in account information
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  if (profileAvatarPreview) {
    if (user.avatar) {
      profileAvatarPreview.innerHTML = `<img src="${sanitizeHTML(user.avatar)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />`;
      const removeBtn = document.getElementById('btnRemoveProfileAvatar');
      if (removeBtn) removeBtn.style.display = 'block';
    } else {
      profileAvatarPreview.innerHTML = `<span id="profileAvatarInitials">${sanitizeHTML(initials)}</span>`;
      const removeBtn = document.getElementById('btnRemoveProfileAvatar');
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }
  
  // Clear any pending avatar changes when loading profile
  const profileAvatarInput = document.getElementById('profileAvatarInput');
  if (profileAvatarInput) {
    profileAvatarInput.removeAttribute('data-avatar-base64');
    profileAvatarInput.removeAttribute('data-avatar-cleared');
  }
  
  // Update profile display (sanitized for security)
  document.getElementById('profileName').textContent = sanitizeHTML(user.name);
  document.getElementById('profileEmail').textContent = sanitizeHTML(user.email);
  document.getElementById('profileRole').textContent = sanitizeHTML(user.role || 'User');
  
  document.getElementById('detailName').textContent = user.name;
  document.getElementById('detailEmail').textContent = user.email;
  document.getElementById('detailRole').textContent = user.role || 'User';
  
  // Update sidebar user card
  updateSidebarUserCard(user, initials);
  
  // Update activity stats
  const total = migrationHistory.length;
  const successful = migrationHistory.filter(m => m.status === 'success').length;
  const failed = migrationHistory.filter(m => m.status === 'failed').length;
  const lastMigration = migrationHistory.length > 0 
    ? new Date(migrationHistory[migrationHistory.length - 1].timestamp).toLocaleDateString()
    : 'Never';
  
  document.getElementById('userStatTotal').textContent = total;
  document.getElementById('userStatSuccess').textContent = successful;
  document.getElementById('userStatFailed').textContent = failed;
  document.getElementById('userStatLast').textContent = lastMigration;
  
  // Load preferences from localStorage
  const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  document.getElementById('prefEmailNotif').checked = preferences.emailNotifications !== false;
  document.getElementById('prefBrowserNotif').checked = preferences.browserNotifications !== false;
  document.getElementById('prefAutoNavigate').checked = preferences.autoNavigate !== false;
}

// Update sidebar user card
function updateSidebarUserCard(user, initials) {
  const sidebarAvatar = document.getElementById('sidebarUserAvatar');
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarRole = document.getElementById('sidebarUserRole');
  
  if (sidebarAvatar) {
    if (user.avatar) {
      sidebarAvatar.innerHTML = `<img src="${sanitizeHTML(user.avatar)}" alt="${sanitizeHTML(user.name)}" />`;
    } else {
      sidebarAvatar.textContent = sanitizeHTML(initials);
    }
  }
  if (sidebarName) {
    sidebarName.textContent = sanitizeHTML(user.name);
  }
  if (sidebarRole) {
    sidebarRole.textContent = sanitizeHTML(user.role || 'User');
  }
}

function savePreferences() {
  const preferences = {
    emailNotifications: document.getElementById('prefEmailNotif').checked,
    browserNotifications: document.getElementById('prefBrowserNotif').checked,
    autoNavigate: document.getElementById('prefAutoNavigate').checked
  };
  
  localStorage.setItem('userPreferences', JSON.stringify(preferences));
  
  // Save profile picture if uploaded
  const avatarInput = document.getElementById('profileAvatarInput');
  if (avatarInput && avatarInput.getAttribute('data-avatar-base64')) {
    const newAvatar = avatarInput.getAttribute('data-avatar-base64');
    updateUserAvatar(newAvatar);
  } else if (avatarInput && avatarInput.getAttribute('data-avatar-cleared') === 'true') {
    // Avatar was removed
    updateUserAvatar(null);
  }
  
  showToast('Preferences saved successfully!', 'success');
  
  // Request browser notification permission if enabled
  if (preferences.browserNotifications && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showToast('Browser notifications enabled', 'success');
      }
    });
  }
}

// Handle profile avatar upload
window.handleProfileAvatarUpload = function(event) {
  const file = event.target.files[0];
  if (!file) {
    // If no file selected, restore to initials
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      const preview = document.getElementById('profileAvatarPreview');
      if (preview) {
        preview.innerHTML = `<span id="profileAvatarInitials">${initials}</span>`;
      }
    }
    if (event.target) {
      event.target.removeAttribute('data-avatar-base64');
      event.target.removeAttribute('data-avatar-cleared');
    }
    const removeBtn = document.getElementById('btnRemoveProfileAvatar');
    if (removeBtn) removeBtn.style.display = 'none';
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file (JPG, PNG, or GIF)', 'error');
    event.target.value = '';
    return;
  }
  
  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image size must be less than 2MB', 'error');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const base64Image = e.target.result;
      const preview = document.getElementById('profileAvatarPreview');
      if (preview) {
        preview.innerHTML = `<img src="${base64Image}" alt="Avatar preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
      }
      // Store the base64 image in a data attribute for later retrieval
      if (event.target) {
        event.target.setAttribute('data-avatar-base64', base64Image);
        event.target.removeAttribute('data-avatar-cleared');
      }
      // Show remove button
      const removeBtn = document.getElementById('btnRemoveProfileAvatar');
      if (removeBtn) removeBtn.style.display = 'block';
    } catch (error) {
      console.error('Error processing image:', error);
      showToast('Error processing image file', 'error');
      event.target.value = '';
    }
  };
  reader.onerror = function() {
    showToast('Error reading image file. Please try again.', 'error');
    event.target.value = '';
  };
  reader.readAsDataURL(file);
};

// Remove profile avatar
window.removeProfileAvatar = function() {
  const preview = document.getElementById('profileAvatarPreview');
  const input = document.getElementById('profileAvatarInput');
  const userStr = sessionStorage.getItem('user');
  
  if (preview && userStr) {
    const user = JSON.parse(userStr);
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    preview.innerHTML = `<span id="profileAvatarInitials">${initials}</span>`;
  }
  
  if (input) {
    input.value = '';
    input.removeAttribute('data-avatar-base64');
    input.setAttribute('data-avatar-cleared', 'true');
  }
  
  const removeBtn = document.getElementById('btnRemoveProfileAvatar');
  if (removeBtn) removeBtn.style.display = 'none';
};

// Update user avatar in user data
function updateUserAvatar(avatar) {
  const userStr = sessionStorage.getItem('user');
  if (!userStr) return;
  
  const user = JSON.parse(userStr);
  const users = getUsers();
  const userIndex = users.findIndex(u => u.email === user.email);
  
  if (userIndex !== -1) {
    // Update in users array
    users[userIndex].avatar = avatar;
    saveUsers(users);
    
    // Update session storage
    user.avatar = avatar;
    sessionStorage.setItem('user', JSON.stringify(user));
    
    // Update UI
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    updateSidebarUserCard(user, initials);
    
    // Update profile avatar display
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
      if (avatar) {
        userAvatar.innerHTML = `<img src="${sanitizeHTML(avatar)}" alt="${sanitizeHTML(user.name)}" />`;
      } else {
        userAvatar.innerHTML = `<span id="userInitials">${sanitizeHTML(initials)}</span>`;
      }
    }
    
    showToast('Profile picture updated successfully!', 'success');
  }
}

// Step navigation
function goToStep(step) {
  // Validation
  if (step === 2 && !uploadedFile) {
    showToast('File Required', 'Please upload a ZIP file first.', 'warning');
    return;
  }
  if (step === 2) {
    // Populate project dropdown when entering step 2
    populateProjectDropdown();
  }
  if (step === 3) {
    const targetEnv = document.getElementById("targetEnv").value;
    const project = document.getElementById("migrationProject").value;
    if (!targetEnv) {
      showToast('Selection Required', 'Please select a target environment.', 'warning');
      return;
    }
    if (!project) {
      showToast('Selection Required', 'Please select a project.', 'warning');
      return;
    }
  }

  // Hide all steps first
  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById("step" + i);
    if (stepEl) stepEl.classList.add("hidden");
  }
  
  // Show new step
  const newStepEl = document.getElementById("step" + step);
  if (newStepEl) {
    newStepEl.classList.remove("hidden");
  }

  // Update wizard step indicators
  for (let i = 1; i <= 3; i++) {
    const wizStep = document.getElementById("wizStep" + i);
    wizStep.classList.remove("active", "completed");
    
    if (i === step) {
      wizStep.classList.add("active");
    } else if (i < step) {
      wizStep.classList.add("completed");
    }
  }

  currentStep = step;
  
  // Update summary on step 3
  if (step === 3) {
    updateSummary();
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// File upload handlers
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("uploadBox").classList.add("drag-over");
}

function handleDragLeave(e) {
  e.preventDefault();
  document.getElementById("uploadBox").classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("uploadBox").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) validateFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) validateFile(file);
}

async function validateFile(file) {
  const errorEl = document.getElementById("fileError");
  errorEl.textContent = "";

  // Check if user has upload permission
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!hasPermission(user, 'upload')) {
    errorEl.textContent = "You don't have permission to upload files. Contact your administrator.";
    return;
  }

  // Client-side validation only (no backend calls until migration starts)
  if (!file.name.toLowerCase().endsWith(".zip")) {
    errorEl.textContent = "Only .zip files are supported.";
    return;
  }

  if (file.size > CONFIG.MAX_FILE_SIZE) {
    errorEl.textContent = "File must be smaller than 100MB.";
    return;
  }

  // File is valid - backend validation will happen when migration starts
  uploadedFile = file;
  errorEl.textContent = "";
  errorEl.style.color = "";
  
  // Display file info (sanitized for security)
  document.getElementById("fileInfo").classList.remove("hidden");
  document.getElementById("fileName").textContent = sanitizeFilename(file.name);
  
  const sizeKB = file.size / 1024;
  const sizeText = sizeKB < 1024 
    ? sizeKB.toFixed(0) + " KB"
    : (sizeKB / 1024).toFixed(2) + " MB";
  document.getElementById("fileSize").textContent = sizeText;
  
  // Enable next button
  document.getElementById("next1").disabled = false;
}

// Summary update
function updateSummary() {
  document.getElementById("sumFile").textContent = uploadedFile ? uploadedFile.name : "—";
  document.getElementById("sumEnv").textContent = document.getElementById("targetEnv").value || "—";
  document.getElementById("sumNaming").textContent = document.getElementById("namingConvention").value || "—";
  const optGenerateReport = document.getElementById("optGenerateReport");
  const optSendToClient = document.getElementById("optSendToClient");
  
  const sumGenerateReport = document.getElementById("sumGenerateReport");
  const sumSendToClient = document.getElementById("sumSendToClient");
  
  if (sumGenerateReport) sumGenerateReport.textContent = optGenerateReport && optGenerateReport.checked ? "Yes" : "No";
  if (sumSendToClient) sumSendToClient.textContent = optSendToClient && optSendToClient.checked ? "Yes" : "No";
}

// Custom confirmation modal (replaces browser confirm)
window.showConfirmModal = function(title, message, onConfirm, onCancel = null) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    animation: fadeIn 0.2s ease;
  `;
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s ease;
  `;
  
  modal.innerHTML = `
    <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; color: #1f2937; font-weight: 600;">${sanitizeHTML(title)}</h3>
    <p style="margin: 0 0 1.5rem 0; color: #4b5563; line-height: 1.6; white-space: pre-line;">${sanitizeHTML(message)}</p>
    <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
      <button class="btn btn-secondary" id="confirmCancel" style="min-width: 100px;">Cancel</button>
      <button class="btn btn-danger" id="confirmOk" style="min-width: 100px;">Confirm</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Handle confirm
  const confirmBtn = modal.querySelector('#confirmOk');
  confirmBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
    if (onConfirm) onConfirm();
  });
  
  // Handle cancel
  const cancelBtn = modal.querySelector('#confirmCancel');
  const handleCancel = () => {
    document.body.removeChild(overlay);
    if (onCancel) onCancel();
  };
  cancelBtn.addEventListener('click', handleCancel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancel();
  });
  
  // Handle ESC key
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
};

// Toast notification system (with XSS protection)
function showToast(title, message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="2"/><path d="M12 16V12M12 8H12.01" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  
  // SECURITY: Sanitize title and message to prevent XSS
  const safeTitle = sanitizeHTML(title);
  const safeMessage = sanitizeHTML(message);
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${safeTitle}</div>
      <div class="toast-message">${safeMessage}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  document.body.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Dashboard migration status functions
function showDashboardMigrationStatus(fileName) {
  const dashboardStatus = document.getElementById('dashboardMigrationStatus');
  if (dashboardStatus) {
    dashboardStatus.classList.remove('hidden');
    const fileElement = document.getElementById('dashboardMigrationFile');
    if (fileElement) {
      const spanElement = fileElement.querySelector('span');
      if (spanElement) {
        spanElement.textContent = fileName;
      }
    }
  }
}

function updateDashboardMigrationProgress(percent, status) {
  const progressFill = document.getElementById('dashboardProgressFill');
  const statusText = document.getElementById('dashboardMigrationStatus');
  const percentText = document.getElementById('dashboardMigrationPercent');
  
  if (progressFill) progressFill.style.width = percent + '%';
  if (statusText) statusText.textContent = status;
  if (percentText) percentText.textContent = Math.round(percent) + '%';
  
  // Update recent migrations to show in-progress status
  updateRecentMigrations();
}

function hideDashboardMigrationStatus() {
  const dashboardStatus = document.getElementById('dashboardMigrationStatus');
  if (dashboardStatus) {
    setTimeout(() => {
      dashboardStatus.classList.add('hidden');
    }, 2000); // Keep it visible for 2 seconds after completion
  }
}

function viewMigrationDetails() {
  // Go to step 3 to see full details
  goToStep(3);
}

// Migration process using the migrationAPI class
async function startMigration() {
  // Check if user has migrate permission
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (!hasPermission(user, 'migrate')) {
    showToast('Access Denied', 'You don\'t have permission to start migrations. Contact your administrator.', 'error');
    return;
  }
  
  if (migrationInProgress) {
    showToast('Migration in progress', 'A migration is already running', 'warning');
    return;
  }
  
  if (!uploadedFile) {
    showToast('No file selected', 'Please upload a file before starting migration', 'error');
    return;
  }
  
  // Ensure clean state before starting
  migrationInProgress = true;
  currentAbortController = new AbortController(); // Create new abort controller
  
  // Get current user info (user already declared above for permission check)
  const userEmail = user.email || 'demo@iwconnect.com';
  
  // Get selected project
  const projectSelect = document.getElementById('migrationProject');
  const selectedProject = projectSelect ? projectSelect.value : 'Unassigned';
  
  if (!selectedProject || selectedProject === '') {
    showToast('Project Required', 'Please select a project before starting migration', 'error');
    return;
  }
  
  // Generate execution ID
  const executionId = Math.random().toString(36).substring(2, 10);
  
  // Save migration state to localStorage
  currentMigration = {
    fileName: uploadedFile.name,
    status: 'in-progress',
    message: 'Migration in progress...',
    timestamp: new Date().toISOString(),
    startTime: Date.now(),
    user: userEmail,
    executionId: executionId,
    project: selectedProject // Add project to current migration
  };
  localStorage.setItem('currentMigration', JSON.stringify(currentMigration));
  
  // Save file reference before resetting (needed for upload)
  const fileToUpload = uploadedFile;
  
  // Start real-time dashboard updates
  startDashboardRealtimeUpdates();
  
  // Show notification - user can navigate to Dashboard to see status
  showToast('Migration Started', 'Your migration is processing. Check the Dashboard for status updates.', 'info');
  
  // Navigate to dashboard automatically so user can see migration status
  showDashboard();
  
  // Reset wizard for next migration (after saving file reference and navigating)
  resetWizardForNewMigration();

  try {
    // Step 1: Prepare the migration data
    const progressLabel = document.getElementById("progressLabel");
    const progressFill = document.getElementById("progressFill");
    
    if (progressLabel) progressLabel.innerHTML = "Preparing migration<span class='progress-dots'></span>";
    if (progressFill) progressFill.style.width = "5%";

    const options = {
      targetEnvironment: document.getElementById("targetEnv").value,
      namingConvention: document.getElementById("namingConvention").value,
      generateReport: document.getElementById("optGenerateReport").checked,
      sendToClient: document.getElementById("optSendToClient").checked
    };

    // Step 2: Upload file and start migration
    if (progressLabel) progressLabel.innerHTML = "Uploading file to server<span class='progress-dots'></span>";
    if (progressFill) progressFill.style.width = "15%";

    const uploadResult = await migrationAPI.uploadAndMigrate(fileToUpload, options, currentAbortController.signal);
    
    // SnapLogic returns just { "message": "Success" } without a migration ID
    // So we treat the upload success as the complete migration
    if (uploadResult && (uploadResult.message === "Success" || uploadResult.success)) {
      // Upload successful - SnapLogic processes synchronously
      const progressLabel = document.getElementById("progressLabel");
      const progressFill = document.getElementById("progressFill");
      
      if (progressLabel) progressLabel.innerHTML = "Processing migration<span class='progress-dots'></span>";
      if (progressFill) progressFill.style.width = "50%";
      
      // Simulate progress for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      if (progressFill) progressFill.style.width = "75%";
      
      await new Promise(resolve => setTimeout(resolve, 800));
      if (progressFill) progressFill.style.width = "100%";
      if (progressLabel) progressLabel.textContent = "Migration complete!";
      
      // Remove loading spinner
      const spinner = document.getElementById('loadingSpinner');
      if (spinner) spinner.remove();
      
      // Create a result object from the response
      migrationResult = {
        success: true,
        message: uploadResult.message || "Migration completed successfully",
        data: uploadResult.data || uploadResult,
        convertedServices: uploadResult.convertedServices || 0,
        convertedFlows: uploadResult.convertedFlows || 0,
        conversionRate: uploadResult.conversionRate || 100,
        warningCount: uploadResult.warningCount || 0
      };
      
      // Show success notification
      showToast('Migration Complete! ✨', 'Your migration finished successfully. For details, go to Dashboard.', 'success');
      
      // Hide dashboard status after a moment
      hideDashboardMigrationStatus();
      
      // Play notification sound if possible
      try {
        new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAw+ltryxnMpBSh+zPLaizsIGGS57Oiiw==').play();
      } catch (e) {}
      
      migrationInProgress = false;
      
      // Hide cancel button when migration completes
      const cancelBtn = document.getElementById('btnCancelMigration');
      if (cancelBtn) {
        cancelBtn.classList.add('hidden');
      }
      
      // Stop real-time dashboard updates
      stopDashboardRealtimeUpdates();
      
      // Calculate migration duration
      const duration = currentMigration && currentMigration.startTime 
        ? Date.now() - currentMigration.startTime 
        : null;
      
      // Save to history
      saveMigrationToHistory(uploadedFile.name, 'success', 'Migration completed successfully', duration);
      
      // Check preferences for notifications and auto-navigate
      const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
      
      // Email notifications (would require backend service)
      if (preferences.emailNotifications !== false) {
        // Email notification would be sent here via backend service
      }
      
      // Show browser notification if enabled
      if (preferences.browserNotifications !== false && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Migration Complete! ✨', {
            body: 'Your migration finished successfully. For details, go to Dashboard.',
            icon: '/assets/logo.png',
            tag: 'migration-complete'
          });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
      
      // Migration complete - user stays on current view, notified via toast
    } else if (uploadResult.migrationId || uploadResult.id) {
      // If SnapLogic returns a migration ID, use the polling flow
      currentMigrationId = uploadResult.migrationId || uploadResult.id;
      
      // Step 3: Poll for migration status
      progressLabel.textContent = "Processing migration...";
      progressFill.style.width = "30%";

      await migrationAPI.pollMigrationStatus(currentMigrationId, (status) => {
        if (status.message) {
          progressLabel.textContent = status.message;
        }
        if (status.progress !== undefined) {
          progressFill.style.width = status.progress + "%";
        }
      });

      // Step 4: Get final results
      progressLabel.textContent = "Fetching results...";
      progressFill.style.width = "95%";

      migrationResult = await migrationAPI.getMigrationResults(currentMigrationId);
      
      progressFill.style.width = "100%";
      progressLabel.textContent = "Migration complete!";

      // Hide dashboard status after a moment
      hideDashboardMigrationStatus();
      
      // Hide cancel button when migration completes
      const cancelBtn = document.getElementById('btnCancelMigration');
      if (cancelBtn) {
        cancelBtn.classList.add('hidden');
      }
      
      // Stop real-time dashboard updates
      stopDashboardRealtimeUpdates();
      
      // Calculate migration duration
      const duration = currentMigration && currentMigration.startTime 
        ? Date.now() - currentMigration.startTime 
        : null;
      
      // Save to history
      saveMigrationToHistory(uploadedFile.name, 'success', 'Migration completed successfully', duration);
      
      // Show success toast notification
      showToast('Migration Complete! ✨', 'Your migration finished successfully. For details, go to Dashboard.', 'success');
      
      // Play notification sound if possible
      try {
        new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAw+ltryxnMpBSh+zPLaizsIGGS57Oiiw==').play();
      } catch (e) {}
      
      migrationInProgress = false;

      // Check preferences for notifications
      const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
      
      // Email notifications (would require backend service)
      if (preferences.emailNotifications !== false) {
        // Email notification would be sent here via backend service
      }
      
      // Show browser notification if enabled
      if (preferences.browserNotifications !== false && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Migration Complete! ✨', {
            body: 'Your migration finished successfully.',
            icon: '/assets/logo.png',
            tag: 'migration-complete'
          });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }

      // Migration complete - user stays on current view, notified via toast
    } else {
      throw new Error("Unexpected response from server: " + JSON.stringify(uploadResult));
    }

  } catch (error) {
    // Check if error is from user cancellation
    if (error.name === 'AbortError') {
      // Exit silently, cancelMigration() already handled everything
      return;
    }
    
    console.error("Migration failed:", error);
    // SECURITY: Sanitize error message before displaying
    const safeErrorMsg = sanitizeHTML(error.message || "An unknown error occurred");
    progressLabel.textContent = "Migration failed: " + safeErrorMsg;
    progressLabel.style.color = "#b91c1c";
    progressFill.style.width = "0%";
    
    // Remove loading spinner
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();
    
    // Hide dashboard status
    hideDashboardMigrationStatus();
    
    migrationInProgress = false;
    currentAbortController = null; // Reset abort controller
    
    // Hide cancel button when migration fails
    const cancelBtn = document.getElementById('btnCancelMigration');
    if (cancelBtn) {
      cancelBtn.classList.add('hidden');
    }
    
    // Check preferences for notifications on failure
    const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
    
    // Email notifications (would require backend service)
    if (preferences.emailNotifications !== false) {
      // Email notification would be sent here via backend service
    }
    
    // Browser notifications
    if (preferences.browserNotifications !== false && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Migration Failed ❌', {
          body: safeErrorMsg,
          icon: '/assets/logo.png',
          tag: 'migration-failed'
        });
      }
    }
    
    // Stop real-time dashboard updates
    stopDashboardRealtimeUpdates();
    
    // Calculate duration and save to history BEFORE clearing state
    const errorMsg = error.message || "An unknown error occurred";
    const fileName = uploadedFile ? uploadedFile.name : (currentMigration ? currentMigration.fileName : 'Unknown');
    
    // Calculate migration duration (get this before clearing currentMigration!)
    const duration = currentMigration && currentMigration.startTime 
      ? Date.now() - currentMigration.startTime 
      : null;
    
    // Save to history with duration
    saveMigrationToHistory(fileName, 'failed', errorMsg, duration);
    
    // NOW clear migration state
    if (localStorage.getItem('currentMigration')) {
      localStorage.removeItem('currentMigration');
      currentMigration = null;
    }
    
    // Show error notification - user stays on current view
    showToast('Migration Failed ❌', errorMsg, 'error');
  }
}


// Show migration results
function showResults() {
  // Update metrics with real data (or defaults if not provided by SnapLogic)
  document.getElementById("resServices").textContent = migrationResult.convertedServices || "N/A";
  document.getElementById("resFlows").textContent = migrationResult.convertedFlows || "N/A";
  document.getElementById("resRate").textContent = migrationResult.conversionRate ? (migrationResult.conversionRate + "%") : "N/A";
  document.getElementById("resWarnings").textContent = migrationResult.warningCount || 0;

  // Hide cancel button when migration is complete
  const cancelBtn = document.getElementById('btnCancelMigration');
  if (cancelBtn) {
    cancelBtn.classList.add('hidden');
  }

  // Show results section (called manually when user wants to view results)
  document.getElementById("resultsSection").classList.remove("hidden");
}

// Download report with real API
async function downloadReport(format) {
  if (!currentMigrationId) {
    showToast('No Results', 'No migration results available.', 'warning');
    return;
  }

  try {
    const blob = await migrationAPI.downloadReport(currentMigrationId, format);
    const filename = `migration-report-${currentMigrationId}.${format}`;
    triggerDownload(blob, filename);
  } catch (error) {
    console.error("Download failed:", error);
    showToast('Download Failed', 'Failed to download report: ' + error.message, 'error');
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Reset wizard
function resetWizard() {
  // Clear state
  uploadedFile = null;
  migrationResult = null;
  currentMigrationId = null;

  // Reset file input
  document.getElementById("fileInput").value = "";
  document.getElementById("fileInfo").classList.add("hidden");
  document.getElementById("fileError").textContent = "";
  
  // Reset progress and results
  document.getElementById("progressSection").classList.add("hidden");
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("progressFill").style.width = "0%";
  document.getElementById("progressLabel").style.color = "";

  // Reset form values
  document.getElementById("targetEnv").value = "";
  document.getElementById("namingConvention").value = "Original Names";
  const optGenerateReport = document.getElementById("optGenerateReport");
  const optSendToClient = document.getElementById("optSendToClient");
  
  if (optGenerateReport) optGenerateReport.checked = true;
  if (optSendToClient) optSendToClient.checked = true;

  // Disable next button
  document.getElementById("next1").disabled = true;

  // Go back to step 1
  goToStep(1);
}

// Modal functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Close modal when clicking outside
window.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    closeModal(e.target.id);
  }
});

// Handle contact form submission
function handleContactSubmit(event) {
  event.preventDefault();
  
  const subject = document.getElementById('contactSubject').value;
  const message = document.getElementById('contactMessage').value;
  
  // In a real app, this would send to a backend
  
  // Show success message
  showToast('Message Sent', 'Thank you! We\'ll get back to you within 24 hours.', 'success');
  
  // Close modal and reset form
  closeModal('contactModal');
  document.getElementById('contactForm').reset();
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  const hamburgerBtn = document.querySelector('.hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  
  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
      if (sidebar.classList.contains('mobile-open') && 
          !sidebar.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
      }
    });
  }
  
  // Add event listeners for navigation buttons
  const navNewMigration = document.getElementById('navNewMigration');
  const navDashboard = document.getElementById('navDashboard');
  const navProfile = document.getElementById('navProfile');
  const navLogout = document.getElementById('navLogout');
  const btnHelp = document.getElementById('btnHelp');
  const btnContactUs = document.getElementById('btnContactUs');
  const actionNewMigration = document.getElementById('actionNewMigration');
  if (navNewMigration) {
    navNewMigration.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showNewMigration();
    });
  }
  
  if (navDashboard) {
    navDashboard.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showDashboard();
    });
  }
  
  if (navProfile) {
    navProfile.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showProfile();
    });
  }
  
  // Make sidebar user card clickable to go to profile
  const sidebarUserCard = document.querySelector('.sidebar-user-card');
  if (sidebarUserCard) {
    sidebarUserCard.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showProfile();
    });
  }

  // Admin navigation
  const navAdmin = document.getElementById('navAdmin');
  if (navAdmin) {
    navAdmin.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showAdmin();
    });
  }
  
  if (navLogout) {
    navLogout.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      // Call logout function (available globally from auth.js)
      if (typeof logout === 'function') {
        logout();
      } else if (typeof window.logout === 'function') {
        window.logout();
      } else {
        // Fallback: clear storage and redirect
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("user");
        window.location.href = "login.html";
      }
    });
  }
  
  // Help and Contact buttons
  if (btnHelp) {
    btnHelp.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openModal('helpModal');
    });
  }
  
  if (btnContactUs) {
    btnContactUs.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openModal('contactModal');
    });
  }
  
  // Dashboard action card and button
  if (actionNewMigration) {
    actionNewMigration.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showNewMigration();
    });
  }
  
  const btnNewMigrationTop = document.getElementById('btnNewMigrationTop');
  if (btnNewMigrationTop) {
    btnNewMigrationTop.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.showNewMigration();
    });
  }
  
  
  // Profile page buttons
  const btnBackToDashboard = document.getElementById('btnBackToDashboard');
  const btnSavePreferences = document.getElementById('btnSavePreferences');
  
  if (btnBackToDashboard) {
    btnBackToDashboard.addEventListener('click', function(e) {
      e.preventDefault();
      window.showDashboard();
    });
  }
  
  if (btnSavePreferences) {
    btnSavePreferences.addEventListener('click', function(e) {
      e.preventDefault();
      savePreferences();
    });
  }
  
  // Load and display user info in sidebar first
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      updateSidebarUserCard(user, initials);
    } catch (e) {
      console.error('Error loading user data for sidebar:', e);
    }
  }
  
  // Initialize admin access AFTER user data is loaded (show/hide admin link based on role)
  if (typeof initializeAdminAccess === 'function') {
    initializeAdminAccess();
  }
  
  // Hide "New Migration" link for users without upload permission
  // navNewMigration is already declared above
  if (navNewMigration) {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const checkPermission = typeof hasPermission === 'function' ? hasPermission : 
                           typeof window.hasPermission === 'function' ? window.hasPermission : 
                           null;
    if (checkPermission && !checkPermission(user, 'upload')) {
      navNewMigration.style.display = 'none';
    }
  }
  
  // If there's a migration in progress from a previous session, show dashboard
  if (currentMigration && currentMigration.status === 'in-progress') {
    migrationInProgress = true;
    window.showDashboard(); // Show dashboard instead of new migration
    startDashboardRealtimeUpdates();
  } else {
    // Show New Migration as the default view
    window.showNewMigration();
  }
});
