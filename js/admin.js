// Admin User Management System

// Check if current user is admin
function isAdmin() {
  const user = sessionStorage.getItem('user');
  if (!user) return false;
  
  const userData = JSON.parse(user);
  return userData.role === 'Admin' && hasPermission(userData, 'admin');
}

// Generate project checkboxes HTML
async function generateProjectCheckboxes(selectedProjects = []) {
  try {
    let allProjects = getAllProjects();
    
    // If it's a Promise, await it
    if (allProjects && typeof allProjects.then === 'function') {
      allProjects = await allProjects;
    }
    
    // Ensure it's an array - handle various response formats
    if (!Array.isArray(allProjects)) {
      console.error('getAllProjects returned non-array:', typeof allProjects, allProjects);
      
      // Try to extract array from object
      if (allProjects && typeof allProjects === 'object') {
        if (Array.isArray(allProjects.projects)) {
          allProjects = allProjects.projects;
        } else if (Array.isArray(allProjects.data)) {
          allProjects = allProjects.data;
        } else if (Array.isArray(allProjects.results)) {
          allProjects = allProjects.results;
        }
      }
      
      // If still not an array, return error message
      if (!Array.isArray(allProjects)) {
        console.error('Could not extract projects array from:', allProjects);
        return '<p>Failed to load projects</p>';
      }
    }
    
    // Handle empty array
    if (allProjects.length === 0) {
      return '<p>No projects available</p>';
    }
    
    return allProjects.map(project => {
      // Ensure project has a name
      if (!project || !project.name) {
        console.warn('Invalid project object:', project);
        return '';
      }
      
      const isChecked = selectedProjects.includes(project.name);
      return `
        <label class="checkbox-label">
          <input type="checkbox" value="${escapeHtml(project.name)}" ${isChecked ? 'checked' : ''} />
          <span>${escapeHtml(project.name)}</span>
        </label>
      `;
    }).filter(html => html !== '').join(''); // Filter out empty strings
  } catch (error) {
    console.error('Error in generateProjectCheckboxes:', error);
    return '<p>Error loading projects: ' + error.message + '</p>';
  }
}

// Show/hide admin link based on role
function initializeAdminAccess() {
  const adminLink = document.getElementById('navAdmin');
  const adminSectionLabel = document.getElementById('adminSectionLabel');
  
  if (!adminLink) {
    console.error('Admin link not found in DOM!');
    return;
  }
  
  // Check if force show is enabled (from test page)
  const forceShow = sessionStorage.getItem('forceShowAdmin');
  if (forceShow === 'true') {
    adminLink.classList.remove('hidden');
    if (adminSectionLabel) adminSectionLabel.classList.remove('hidden');
    sessionStorage.removeItem('forceShowAdmin'); // Clear flag
    return;
  }
  
  const user = sessionStorage.getItem('user');
  
  if (!user) {
    adminLink.classList.add('hidden');
    if (adminSectionLabel) adminSectionLabel.classList.add('hidden');
    return;
  }
  
  try {
    const userData = JSON.parse(user);
    
    const hasAdminRole = userData.role === 'Admin';
    
    // If permissions are missing, try to get them from users array
    let permissions = userData.permissions;
    if (!permissions && typeof getAllUsers === 'function') {
      // Handle both sync and async getAllUsers
      Promise.resolve(getAllUsers()).then(users => {
        const fullUser = users.find(u => u.email === userData.email);
        if (fullUser && fullUser.permissions) {
          permissions = fullUser.permissions;
          // Update sessionStorage with complete user data
          const updatedUser = { ...userData, permissions: permissions };
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          userData.permissions = permissions; // Update local variable too
        }
      }).catch(() => {
        // Ignore errors in async lookup
      });
    }
    
    // Check permissions using multiple methods
    let hasAdminPermission = false;
    if (permissions && Array.isArray(permissions)) {
      hasAdminPermission = permissions.includes('admin');
    }
    
    // Also check using hasPermission function if available
    let hasPermissionCheck = false;
    if (typeof window.hasPermission === 'function') {
      hasPermissionCheck = window.hasPermission(userData, 'admin');
    } else if (typeof hasPermission === 'function') {
      hasPermissionCheck = hasPermission(userData, 'admin');
    }
    
    // Show admin link if user has Admin role
    // If permissions exist, also check for admin permission
    // If permissions don't exist, trust the role (fallback for backwards compatibility)
    const shouldShowAdmin = hasAdminRole && (
      !permissions || // No permissions defined - trust role
      hasAdminPermission || // Has admin permission
      hasPermissionCheck // hasPermission function confirms
    );
    
    if (shouldShowAdmin) {
      adminLink.classList.remove('hidden');
      if (adminSectionLabel) adminSectionLabel.classList.remove('hidden');
    } else {
      adminLink.classList.add('hidden');
      if (adminSectionLabel) adminSectionLabel.classList.add('hidden');
    }
  } catch (e) {
    console.error('Error parsing user data:', e);
    adminLink.classList.add('hidden');
    if (adminSectionLabel) adminSectionLabel.classList.add('hidden');
  }
}

// Load all users in the admin panel
async function loadUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  
  // Show loading state
  tbody.innerHTML = `
    <tr class="empty-row">
      <td colspan="6">
        <div class="empty-state">
          <p>Loading users...</p>
        </div>
      </td>
    </tr>
  `;
  
  // Handle both sync (localStorage) and async (API) cases
  const users = await Promise.resolve(getAllUsers());
  
  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <p>No users found</p>
          </div>
        </td>
      </tr>
    `;
    updateUserStats([]);
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>
        <div class="user-info">
          <div class="user-avatar-small">
            ${user.avatar ? `<img src="${user.avatar}" alt="${escapeHtml(user.name)}" />` : `<span>${getInitials(user.name)}</span>`}
          </div>
          <div>
            <div class="user-name">${escapeHtml(user.name)}</div>
            <div class="user-email">${escapeHtml(user.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span></td>
      <td>${escapeHtml(user.department || 'N/A')}</td>
      <td>
        <span class="permissions-list">${user.permissions ? user.permissions.length : 0} permissions</span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="viewUser(${user.id})" title="View">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="#6b7280" stroke-width="2"/>
            </svg>
          </button>
          <button class="btn-icon" onclick="editUser(${user.id})" title="Edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Delete">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6H5H21" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 11V17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 11V17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Update user statistics
  updateUserStats(users);
}

// Update user statistics cards
function updateUserStats(users) {
  if (!users || !Array.isArray(users)) {
    users = [];
  }
  
  const totalUsers = users.length;
  const admins = users.filter(u => u.role === 'Admin').length;
  const regularUsers = users.filter(u => u.role === 'User').length;
  const viewers = users.filter(u => u.role === 'Viewer').length;
  
  const totalEl = document.getElementById('adminStatTotal');
  const adminsEl = document.getElementById('adminStatAdmins');
  const usersEl = document.getElementById('adminStatUsers');
  const viewersEl = document.getElementById('adminStatViewers');
  
  if (totalEl) totalEl.textContent = totalUsers;
  if (adminsEl) adminsEl.textContent = admins;
  if (usersEl) usersEl.textContent = regularUsers;
  if (viewersEl) viewersEl.textContent = viewers;
}

// View user details
function viewUser(userId) {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    showToast('User not found', 'error');
    return;
  }
  
  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');
  const content = document.getElementById('userModalContent');
  
  title.textContent = 'User Details';
  content.innerHTML = `
    <div class="user-details-view">
      <div class="detail-row">
        <label>Profile Picture:</label>
        <div class="user-avatar-large">
          ${user.avatar ? `<img src="${user.avatar}" alt="${escapeHtml(user.name)}" />` : `<span>${getInitials(user.name)}</span>`}
        </div>
      </div>
      <div class="detail-row">
        <label>ID:</label>
        <span>${user.id}</span>
      </div>
      <div class="detail-row">
        <label>Name:</label>
        <span>${escapeHtml(user.name)}</span>
      </div>
      <div class="detail-row">
        <label>Email:</label>
        <span>${escapeHtml(user.email)}</span>
      </div>
      <div class="detail-row">
        <label>Role:</label>
        <span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span>
      </div>
      <div class="detail-row">
        <label>Department:</label>
        <span>${escapeHtml(user.department || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <label>Projects:</label>
        <div class="permissions-grid">
          ${(user.projects && user.projects.length > 0) 
            ? user.projects.map(p => `<span class="permission-tag">${escapeHtml(p)}</span>`).join('') 
            : '<span class="permission-tag">No projects assigned</span>'}
        </div>
      </div>
      <div class="detail-row">
        <label>Permissions:</label>
        <div class="permissions-grid">
          ${user.permissions.map(p => `<span class="permission-tag">${p}</span>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal('userModal')">Close</button>
      <button class="btn btn-primary" onclick="closeModal('userModal'); editUser(${user.id})">Edit User</button>
    </div>
  `;
  
  modal.classList.remove('hidden');
}

// Edit user
async function editUser(userId) {
  const users = await Promise.resolve(getAllUsers());
  if (!Array.isArray(users)) {
    showToast('Failed to load users', 'error');
    return;
  }
  const user = users.find(u => u.id === userId);
  if (!user) {
    showToast('User not found', 'error');
    return;
  }
  
  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');
  const content = document.getElementById('userModalContent');
  
  // Generate project checkboxes first
  const projectCheckboxes = await generateProjectCheckboxes(user.projects || []);
  
  title.textContent = 'Edit User';
  content.innerHTML = `
    <form id="editUserForm" onsubmit="saveUser(event, ${user.id})">
      <div id="userFormError" class="error-message hidden" style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin-bottom: 1rem; border: 1px solid #f5c6cb;"></div>
      
      <div class="form-group">
        <label class="form-label">Name <span class="required">*</span></label>
        <input type="text" id="editUserName" class="form-control" value="${escapeHtml(user.name)}" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Email <span class="required">*</span></label>
        <input type="email" id="editUserEmail" class="form-control" value="${escapeHtml(user.email)}" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" id="editUserPassword" class="form-control" placeholder="Leave blank to keep current" />
        <small>Leave blank to keep the current password</small>
      </div>
      
      <div class="form-group">
        <label class="form-label">Role <span class="required">*</span></label>
        <select id="editUserRole" class="form-control" required onchange="updatePermissionsForRole()">
          <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
          <option value="User" ${user.role === 'User' ? 'selected' : ''}>User</option>
          <option value="Viewer" ${user.role === 'Viewer' ? 'selected' : ''}>Viewer</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Department</label>
        <input type="text" id="editUserDept" class="form-control" value="${escapeHtml(user.department || '')}" />
      </div>
      
      <div class="form-group">
        <label class="form-label">Profile Picture</label>
        <div class="avatar-upload-container">
          <div class="avatar-preview" id="editUserAvatarPreview">
            ${user.avatar ? `<img src="${user.avatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span>${getInitials(user.name)}</span>`}
          </div>
          <input type="file" id="editUserAvatar" class="form-control" accept="image/jpeg,image/jpg,image/png,image/gif" onchange="handleAvatarUpload(event, 'editUserAvatarPreview')" />
          <small>Upload a profile picture (JPG, PNG, or GIF, max 2MB)</small>
          ${user.avatar ? '<button type="button" class="btn btn-sm btn-secondary" style="margin-top: 0.5rem;" onclick="clearAvatar(\'editUserAvatarPreview\', \'editUserAvatar\')">Remove Picture</button>' : ''}
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Projects</label>
        <div id="editUserProjects" class="projects-checkboxes">
          ${projectCheckboxes}
        </div>
        <small>Select projects this user can access. Admins automatically have access to all projects.</small>
      </div>
      
      <div class="form-group">
        <label class="form-label">Permissions</label>
        <div class="permissions-checkboxes">
          <label class="checkbox-label">
            <input type="checkbox" value="upload" ${user.permissions.includes('upload') ? 'checked' : ''} />
            <span>Upload</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="migrate" ${user.permissions.includes('migrate') ? 'checked' : ''} />
            <span>Migrate</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="cancel" ${user.permissions.includes('cancel') ? 'checked' : ''} />
            <span>Cancel</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="view_history" ${user.permissions.includes('view_history') ? 'checked' : ''} />
            <span>View History</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="admin" ${user.permissions.includes('admin') ? 'checked' : ''} />
            <span>Admin</span>
          </label>
        </div>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal('userModal')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  
  modal.classList.remove('hidden');
}

// Add new user
async function addNewUser() {
  console.log('addNewUser called');
  try {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const content = document.getElementById('userModalContent');
    
    if (!modal || !title || !content) {
      console.error('Modal elements not found');
      showToast('Error: Modal elements not found', 'error');
      return;
    }
    
    console.log('Loading project checkboxes...');
    // Generate project checkboxes first
    const projectCheckboxes = await generateProjectCheckboxes([]);
    console.log('Project checkboxes loaded:', projectCheckboxes.length, 'characters');
    
    title.textContent = 'Add New User';
    content.innerHTML = `
    <form id="addUserForm" onsubmit="saveUser(event, null)">
      <div id="userFormError" class="error-message hidden" style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin-bottom: 1rem; border: 1px solid #f5c6cb;"></div>
      
      <div class="form-group">
        <label class="form-label">Name <span class="required">*</span></label>
        <input type="text" id="editUserName" class="form-control" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Email <span class="required">*</span></label>
        <input type="email" id="editUserEmail" class="form-control" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Password <span class="required">*</span></label>
        <input type="password" id="editUserPassword" class="form-control" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Role <span class="required">*</span></label>
        <select id="editUserRole" class="form-control" required onchange="updatePermissionsForRole()">
          <option value="">Select role...</option>
          <option value="Admin">Admin</option>
          <option value="User" selected>User</option>
          <option value="Viewer">Viewer</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Department</label>
        <input type="text" id="editUserDept" class="form-control" />
      </div>
      
      <div class="form-group">
        <label class="form-label">Profile Picture</label>
        <div class="avatar-upload-container">
          <div class="avatar-preview" id="addUserAvatarPreview">
            <span>No Image</span>
          </div>
          <input type="file" id="editUserAvatar" class="form-control" accept="image/jpeg,image/jpg,image/png,image/gif" onchange="handleAvatarUpload(event, 'addUserAvatarPreview')" />
          <small>Upload a profile picture (JPG, PNG, or GIF, max 2MB)</small>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Projects</label>
        <div id="editUserProjects" class="projects-checkboxes">
          ${projectCheckboxes}
        </div>
        <small>Select projects this user can access. Admins automatically have access to all projects.</small>
      </div>
      
      <div class="form-group">
        <label class="form-label">Permissions</label>
        <div class="permissions-checkboxes">
          <label class="checkbox-label">
            <input type="checkbox" value="upload" checked />
            <span>Upload</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="migrate" checked />
            <span>Migrate</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="cancel" />
            <span>Cancel</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="view_history" checked />
            <span>View History</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" value="admin" />
            <span>Admin</span>
          </label>
        </div>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal('userModal')">Cancel</button>
        <button type="submit" class="btn btn-primary">Add User</button>
      </div>
    </form>
  `;
  
    modal.classList.remove('hidden');
  } catch (error) {
    console.error('Error in addNewUser:', error);
    showToast('Failed to open add user form: ' + error.message, 'error');
  }
}

// Update permissions based on selected role
function updatePermissionsForRole() {
  const role = document.getElementById('editUserRole').value;
  const checkboxes = document.querySelectorAll('.permissions-checkboxes input[type="checkbox"]');
  
  const rolePermissions = {
    Admin: ['upload', 'migrate', 'cancel', 'view_history', 'admin'],
    User: ['upload', 'migrate', 'view_history'],
    Viewer: ['view_history']
  };
  
  const permissions = rolePermissions[role] || [];
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = permissions.includes(checkbox.value);
  });
}

// Get user initials from name
function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Clear avatar (remove picture)
window.clearAvatar = function(previewId, inputId) {
  const preview = document.getElementById(previewId);
  const input = document.getElementById(inputId);
  const nameInput = document.getElementById('editUserName');
  
  if (preview) {
    if (nameInput && nameInput.value) {
      preview.innerHTML = `<span>${getInitials(nameInput.value)}</span>`;
    } else {
      preview.innerHTML = `<span>No Image</span>`;
    }
  }
  
  if (input) {
    input.value = '';
    input.removeAttribute('data-avatar-base64');
    // Set a flag to indicate avatar should be cleared
    input.setAttribute('data-avatar-cleared', 'true');
  }
};

// Handle avatar upload and convert to base64
window.handleAvatarUpload = function(event, previewId) {
  const file = event.target.files[0];
  if (!file) {
    // If no file selected, clear the preview and data attribute
    const preview = document.getElementById(previewId);
    if (preview) {
      const nameInput = document.getElementById('editUserName');
      if (nameInput && nameInput.value) {
        preview.innerHTML = `<span>${getInitials(nameInput.value)}</span>`;
      } else {
        preview.innerHTML = `<span>No Image</span>`;
      }
    }
    if (event.target) {
      event.target.removeAttribute('data-avatar-base64');
    }
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
      const preview = document.getElementById(previewId);
      if (preview) {
        preview.innerHTML = `<img src="${base64Image}" alt="Avatar preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
      }
      // Store the base64 image in a data attribute for later retrieval
      if (event.target) {
        event.target.setAttribute('data-avatar-base64', base64Image);
      }
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

// Show error in modal form
function showFormError(message) {
  const errorDiv = document.getElementById('userFormError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    // Scroll to error
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  // Note: No toast notification - error is already visible in the modal
}

// Hide error in modal form
function hideFormError() {
  const errorDiv = document.getElementById('userFormError');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
  }
}

// Save user (add or edit)
async function saveUser(event, userId) {
  event.preventDefault();
  
  // Clear any previous errors
  hideFormError();
  
  const name = document.getElementById('editUserName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const password = document.getElementById('editUserPassword').value;
  const role = document.getElementById('editUserRole').value;
  const department = document.getElementById('editUserDept').value.trim();
  
  // Basic validation
  if (!name) {
    showFormError('Name is required');
    return;
  }
  
  if (!email) {
    showFormError('Email is required');
    return;
  }
  
  if (!role) {
    showFormError('Role is required');
    return;
  }
  
  // Get selected permissions
  const permissionCheckboxes = document.querySelectorAll('.permissions-checkboxes input[type="checkbox"]:checked');
  const permissions = Array.from(permissionCheckboxes).map(cb => cb.value);
  
  // Get selected projects
  const projectCheckboxes = document.querySelectorAll('#editUserProjects input[type="checkbox"]:checked');
  const projects = Array.from(projectCheckboxes).map(cb => cb.value);
  
  // Get avatar if uploaded
  const avatarInput = document.getElementById('editUserAvatar');
  let avatar = null;
  
  // Check if avatar was cleared
  if (avatarInput && avatarInput.getAttribute('data-avatar-cleared') === 'true') {
    avatar = null; // Explicitly clear avatar
  } else if (avatarInput && avatarInput.getAttribute('data-avatar-base64')) {
    // New avatar uploaded
    avatar = avatarInput.getAttribute('data-avatar-base64');
  } else if (userId) {
    // Keep existing avatar if not changed - need to get from API
    try {
      const users = await Promise.resolve(getAllUsers());
      if (Array.isArray(users)) {
        const existingUser = users.find(u => u.id === userId);
        if (existingUser && existingUser.avatar) {
          avatar = existingUser.avatar;
        }
      }
    } catch (error) {
      console.warn('Could not load existing user avatar:', error);
    }
  }
  
  if (userId) {
    // Edit existing user
    const userData = {
      name: name,
      email: email,
      role: role,
      department: department,
      permissions: permissions,
      projects: projects,
      avatar: avatar
    };
    
    // Only update password if provided
    if (password) {
      userData.password = password;
    }
    
    try {
      const result = await Promise.resolve(updateUser(userId, userData));
      
      if (result && result.success) {
        showToast('User updated successfully!', 'success');
        closeModal('userModal');
        loadUsersTable();
      } else {
        showFormError(result?.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showFormError('Failed to update user: ' + error.message);
    }
  } else {
    // Add new user
    if (!password) {
      showFormError('Password is required for new users');
      return;
    }
    
    // Get avatar if uploaded
    const avatarInput = document.getElementById('editUserAvatar');
    let avatar = null;
    if (avatarInput && avatarInput.getAttribute('data-avatar-base64')) {
      avatar = avatarInput.getAttribute('data-avatar-base64');
    }
    
    const userData = {
      email: email,
      password: password,
      name: name,
      role: role,
      avatar: avatar,
      department: department,
      permissions: permissions,
      projects: projects
    };
    
    try {
      const result = await Promise.resolve(addUser(userData));
      
      if (result && result.success) {
        showToast('User added successfully!', 'success');
        closeModal('userModal');
        loadUsersTable();
      } else {
        showFormError(result?.error || 'Failed to add user');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      showFormError('Failed to add user: ' + error.message);
    }
  }
}

// Delete user
async function deleteUser(userId) {
  const users = await Promise.resolve(getAllUsers());
  const user = users.find(u => u.id === userId);
  if (!user) {
    showToast('User not found', 'error');
    return;
  }
  
  // Prevent deleting yourself
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  if (currentUser.email === user.email) {
    showToast('You cannot delete your own account', 'error');
    return;
  }
  
  showConfirmModal(
    'Delete User',
    `Are you sure you want to delete user "${user.name}"?\n\nThis action cannot be undone.`,
    async () => {
      const result = await deleteUserById(userId);
    
      if (result.success) {
        showToast('User deleted successfully', 'success');
        await loadUsersTable();
      } else {
        showToast(result.error || 'Failed to delete user', 'error');
      }
    }
  );
}

// HTML escape function
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// PROJECT MANAGEMENT FUNCTIONS
// ============================================

// Switch between Users, Projects, and Migrations tabs
async function switchAdminTab(tab) {
  // Update tab buttons
  document.getElementById('adminTabUsers').classList.toggle('active', tab === 'users');
  document.getElementById('adminTabProjects').classList.toggle('active', tab === 'projects');
  document.getElementById('adminTabMigrations').classList.toggle('active', tab === 'migrations');
  
  // Show/hide tab content
  document.getElementById('adminUsersTab').classList.toggle('hidden', tab !== 'users');
  document.getElementById('adminProjectsTab').classList.toggle('hidden', tab !== 'projects');
  document.getElementById('adminMigrationsTab').classList.toggle('hidden', tab !== 'migrations');
  
  // Load data for the selected tab
  if (tab === 'users') {
    loadUsersTable();
  } else if (tab === 'projects') {
    await loadProjectsTable();
  } else if (tab === 'migrations') {
    loadMigrationsTable();
  }
}

// Load all projects in the admin panel
async function loadProjectsTable() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;
  
  const projects = await Promise.resolve(getAllProjects());
  
  if (!Array.isArray(projects) || projects.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state">
            <p>No projects found</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = projects.map(project => `
    <tr>
      <td>${project.id}</td>
      <td><strong>${escapeHtml(project.name)}</strong></td>
      <td>${escapeHtml(project.description || 'No description')}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editProject(${project.id})" title="Edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="btn-icon btn-danger" onclick="deleteProjectConfirm(${project.id})" title="Delete">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6H5H21" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 11V17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 11V17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Edit project
async function editProject(projectId) {
  const projects = await Promise.resolve(getAllProjects());
  if (!Array.isArray(projects)) {
    showToast('Failed to load projects', 'error');
    return;
  }
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    showToast('Project not found', 'error');
    return;
  }
  
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('projectModalTitle');
  const content = document.getElementById('projectModalContent');
  
  title.textContent = 'Edit Project';
  content.innerHTML = `
    <form id="editProjectForm" onsubmit="saveProject(event, ${project.id})">
      <div id="projectFormError" class="error-message hidden" style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin-bottom: 1rem; border: 1px solid #f5c6cb;"></div>
      
      <div class="form-group">
        <label class="form-label">Project Name <span class="required">*</span></label>
        <input type="text" id="editProjectName" class="form-control" value="${escapeHtml(project.name)}" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="editProjectDescription" class="form-control" rows="3">${escapeHtml(project.description || '')}</textarea>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal('projectModal')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  
  modal.classList.remove('hidden');
}

// Add new project
function addNewProject() {
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('projectModalTitle');
  const content = document.getElementById('projectModalContent');
  
  title.textContent = 'Add New Project';
  content.innerHTML = `
    <form id="addProjectForm" onsubmit="saveProject(event, null)">
      <div id="projectFormError" class="error-message hidden" style="background: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin-bottom: 1rem; border: 1px solid #f5c6cb;"></div>
      
      <div class="form-group">
        <label class="form-label">Project Name <span class="required">*</span></label>
        <input type="text" id="editProjectName" class="form-control" required />
      </div>
      
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="editProjectDescription" class="form-control" rows="3"></textarea>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal('projectModal')">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Project</button>
      </div>
    </form>
  `;
  
  modal.classList.remove('hidden');
}

// Save project (add or edit)
async function saveProject(event, projectId) {
  event.preventDefault();
  
  // Clear any previous errors
  const errorDiv = document.getElementById('projectFormError');
  if (errorDiv) {
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';
  }
  
  const name = document.getElementById('editProjectName').value.trim();
  const description = document.getElementById('editProjectDescription').value.trim();
  
  // Basic validation
  if (!name) {
    showProjectFormError('Project name is required');
    return;
  }
  
  // Check for duplicate names (excluding current project if editing)
  const allProjects = await Promise.resolve(getAllProjects());
  if (!Array.isArray(allProjects)) {
    showProjectFormError('Failed to load projects');
    return;
  }
  const duplicate = allProjects.find(p => 
    p.name.toLowerCase() === name.toLowerCase() && 
    (!projectId || p.id !== projectId)
  );
  
  if (duplicate) {
    showProjectFormError('A project with this name already exists');
    return;
  }
  
  try {
    if (projectId) {
      // Edit existing project
      const result = await Promise.resolve(updateProject(projectId, {
        name: name,
        description: description
      }));
      
      if (result && result.success) {
        showToast('Project updated successfully!', 'success');
        closeModal('projectModal');
        await loadProjectsTable();
        // Refresh project dropdowns if migration wizard is open
        if (typeof populateProjectDropdown === 'function') {
          await populateProjectDropdown();
        }
      } else {
        showProjectFormError(result?.error || 'Failed to update project');
      }
    } else {
      // Add new project
      const result = await Promise.resolve(addProject({
        name: name,
        description: description
      }));
      
      if (result && result.success) {
        showToast('Project added successfully!', 'success');
        closeModal('projectModal');
        await loadProjectsTable();
        // Refresh project dropdowns if migration wizard is open
        if (typeof populateProjectDropdown === 'function') {
          await populateProjectDropdown();
        }
      } else {
        showProjectFormError(result?.error || 'Failed to add project');
      }
    }
  } catch (error) {
    console.error('Error saving project:', error);
    showProjectFormError('Failed to save project: ' + error.message);
  }
}

// Delete project confirmation
async function deleteProjectConfirm(projectId) {
  const projects = await Promise.resolve(getAllProjects());
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    showToast('Project not found', 'error');
    return;
  }
  
  // Check if any users are assigned to this project
  const users = await Promise.resolve(getAllUsers());
  const usersWithProject = users.filter(u => 
    u.projects && u.projects.includes(project.name)
  );
  
  const confirmDelete = async () => {
    try {
      const result = await Promise.resolve(deleteProject(projectId));
      if (result && result.success) {
        // Update users who had this project assigned
        for (const user of users) {
          if (user.projects && user.projects.includes(project.name)) {
            const updatedProjects = user.projects.filter(p => p !== project.name);
            await Promise.resolve(updateUser(user.id, { projects: updatedProjects }));
          }
        }
        showToast('Project deleted successfully!', 'success');
        await loadProjectsTable();
      } else {
        showToast(result?.error || 'Failed to delete project', 'error');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast('Failed to delete project: ' + error.message, 'error');
    }
  };
  
  if (usersWithProject.length > 0) {
    const userList = usersWithProject.map(u => u.name).join(', ');
    showConfirmModal(
      'Delete Project',
      `Warning: ${usersWithProject.length} user(s) are assigned to this project: ${userList}\n\nDeleting this project will remove it from all users. Continue?`,
      confirmDelete
    );
  } else {
    showConfirmModal(
      'Delete Project',
      `Are you sure you want to delete "${project.name}"?`,
      confirmDelete
    );
  }
  
}

// Show project form error
function showProjectFormError(message) {
  const errorDiv = document.getElementById('projectFormError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

// ============================================
// MIGRATION HISTORY MANAGEMENT FUNCTIONS
// ============================================

// Load all migrations in the admin panel
function loadMigrationsTable() {
  const tbody = document.getElementById('adminMigrationsTableBody');
  if (!tbody) return;
  
  // Get migration history from localStorage
  let migrationHistory = [];
  try {
    const stored = localStorage.getItem('migrationHistory');
    if (stored) {
      migrationHistory = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading migration history:', e);
  }
  
  if (migrationHistory.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <p>No migration history found</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  // Sort by timestamp (newest first)
  const sortedMigrations = [...migrationHistory].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
  
  tbody.innerHTML = sortedMigrations.map(migration => {
    // Get SVG icon and status info based on migration status
    let statusIconSvg = '';
    let statusText = 'Failed';
    let statusClass = 'status-failed';
    
    if (migration.status === 'success') {
      statusIconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      statusText = 'Completed';
      statusClass = 'status-success';
    } else if (migration.status === 'in-progress') {
      statusIconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.3"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      statusText = 'In Progress';
      statusClass = 'status-progress';
    } else if (migration.status === 'cancelled') {
      statusIconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
      statusText = 'Cancelled';
      statusClass = 'status-cancelled';
    } else if (migration.status === 'failed') {
      statusIconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
      hour12: true
    });
    
    // Format duration
    let durationDisplay = '00:00:00';
    if (migration.duration) {
      const totalSeconds = Math.floor(migration.duration / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      durationDisplay = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    const executionId = escapeHtml(migration.executionId || 'N/A');
    const projectName = escapeHtml(migration.project || 'Unassigned');
    const fileName = escapeHtml(migration.fileName || 'Unknown');
    const userEmail = escapeHtml(migration.user || 'Unknown');
    
    return `
      <tr>
        <td><code style="font-size: 0.875rem;">${executionId}</code></td>
        <td>${projectName}</td>
        <td>${fileName}</td>
        <td>${userEmail}</td>
        <td><span class="status-badge ${statusClass}">${statusText} <span class="status-icon">${statusIconSvg}</span></span></td>
        <td>${dateStr}<br><small style="color: #6c757d;">${timeStr}</small></td>
        <td>${durationDisplay}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon btn-danger" onclick="deleteMigration('${executionId}')" title="Delete">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6H5H21" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 11V17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 11V17" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete a single migration
function deleteMigration(executionId) {
  showConfirmModal(
    'Delete Migration',
    'Are you sure you want to delete this migration record?',
    () => {
      try {
        let migrationHistory = [];
        const stored = localStorage.getItem('migrationHistory');
        if (stored) {
          migrationHistory = JSON.parse(stored);
        }
        
        // Remove migration with matching execution ID
        const initialLength = migrationHistory.length;
        migrationHistory = migrationHistory.filter(m => m.executionId !== executionId);
        
        if (migrationHistory.length < initialLength) {
          localStorage.setItem('migrationHistory', JSON.stringify(migrationHistory));
          showToast('Migration deleted successfully!', 'success');
          loadMigrationsTable();
          
          // Refresh dashboard if it's visible
          if (typeof updateRecentMigrations === 'function') {
            updateRecentMigrations();
          }
          if (typeof updateDashboardStats === 'function') {
            updateDashboardStats();
          }
        } else {
          showToast('Migration not found', 'error');
        }
      } catch (e) {
        console.error('Error deleting migration:', e);
        showToast('Failed to delete migration', 'error');
      }
    }
  );
}

// Delete all migrations
function deleteAllMigrations() {
  showConfirmModal(
    'Delete All Migrations',
    '⚠️ WARNING: This will delete ALL migration history records. This action cannot be undone!\n\nAre you absolutely sure?',
    () => {
      // Double confirmation
      showConfirmModal(
        'Final Confirmation',
        'This is your last chance. Delete ALL migration history?',
        () => {
          try {
            localStorage.removeItem('migrationHistory');
            showToast('All migration history deleted successfully!', 'success');
            loadMigrationsTable();
            
            // Refresh dashboard if it's visible
            if (typeof updateRecentMigrations === 'function') {
              updateRecentMigrations();
            }
            if (typeof updateDashboardStats === 'function') {
              updateDashboardStats();
            }
          } catch (e) {
            console.error('Error deleting all migrations:', e);
            showToast('Failed to delete migration history', 'error');
          }
        }
      );
    }
  );
}

// Make functions globally accessible
window.switchAdminTab = switchAdminTab;
window.loadProjectsTable = loadProjectsTable;
window.editProject = editProject;
window.addNewProject = addNewProject;
window.saveProject = saveProject;
window.deleteProjectConfirm = deleteProjectConfirm;
window.loadMigrationsTable = loadMigrationsTable;
window.deleteMigration = deleteMigration;
window.deleteAllMigrations = deleteAllMigrations;
window.addNewUser = addNewUser;
window.editUser = editUser;
window.saveUser = saveUser;

