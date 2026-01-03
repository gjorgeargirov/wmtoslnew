// Cancel Migration Functionality

// Prevent double-cancel
let isCancelling = false;

// Cancel Migration Function
window.cancelMigration = function() {
  if (isCancelling) {
    return;
  }
  
  if (!migrationInProgress) {
    return;
  }
  
  isCancelling = true;
  
  // Abort the fetch request first
  if (currentAbortController) {
    try {
      currentAbortController.abort();
    } catch (e) {
      // Silent error
    }
  }
  
  // IMMEDIATELY reset ALL migration state flags to prevent race conditions
  migrationInProgress = false;
  currentAbortController = null;
  // DON'T clear uploadedFile here - user needs to upload new file anyway
  
  // Save current migration for history before clearing
  const migrationToSave = currentMigration ? {...currentMigration} : null;
  currentMigration = null; // Clear current migration immediately
  localStorage.removeItem('currentMigration'); // Clear from storage immediately
  
  // Update UI
  const progressLabel = document.getElementById("progressLabel");
  const progressFill = document.getElementById("progressFill");
  
  if (progressLabel) {
    progressLabel.textContent = "Migration cancelled by user";
    progressLabel.style.color = "#f59e0b"; // Orange color
  }
  
  if (progressFill) {
    progressFill.style.width = "0%";
  }
  
  // Remove loading spinner
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.remove();
  
  // Stop real-time dashboard updates
  if (typeof stopDashboardRealtimeUpdates === 'function') {
    stopDashboardRealtimeUpdates();
  }
  
  // Calculate duration using saved migration
  const duration = migrationToSave && migrationToSave.startTime 
    ? Date.now() - migrationToSave.startTime 
    : null;
  
  // Update migration status to cancelled and save to history
  if (migrationToSave) {
    migrationToSave.status = 'cancelled';
    migrationToSave.message = 'Migration cancelled by user';
    migrationToSave.duration = duration;
    
    // Move to history (don't create duplicate - update existing or add new)
    const fileName = migrationToSave.fileName;
    
    // Check if this migration already exists in history (shouldn't, but let's be safe)
    const existingIndex = migrationHistory.findIndex(m => 
      m.fileName === fileName && 
      m.executionId === migrationToSave.executionId
    );
    
    if (existingIndex >= 0) {
      // Update existing entry
      migrationHistory[existingIndex] = migrationToSave;
    } else {
      // Add new entry
      migrationHistory.push(migrationToSave);
    }
    
    localStorage.setItem('migrationHistory', JSON.stringify(migrationHistory));
    
    // Update dashboard
    if (typeof updateDashboardStats === 'function') {
      updateDashboardStats();
    }
    if (typeof updateRecentMigrations === 'function') {
      updateRecentMigrations();
    }
  }
  
  // Show notification
  if (typeof showToast === 'function') {
    showToast('Migration Cancelled', 'Migration was cancelled by user', 'warning');
  }
  
  // Update all cancel buttons (both in wizard and dashboard)
  const cancelButtons = document.querySelectorAll('.btn-danger');
  cancelButtons.forEach(btn => {
    if (btn.textContent.includes('Cancel Migration') || btn.textContent.includes('Cancel')) {
      btn.disabled = true;
      btn.textContent = '✓ Cancelled';
      btn.style.background = '#9ca3af';
    }
  });
  
  // Clear file input
  const fileInput = document.getElementById('packageFile');
  if (fileInput) {
    fileInput.value = '';
  }
  
  // Hide progress and results sections
  const progressSection = document.getElementById('progressSection');
  const resultsSection = document.getElementById('resultsSection');
  const cancelBtn = document.getElementById('btnCancelMigration');
  
  if (progressSection) {
    progressSection.classList.add('hidden');
  }
  
  if (resultsSection) {
    resultsSection.classList.add('hidden');
  }
  
  // Hide cancel button when migration is cancelled
  if (cancelBtn) {
    cancelBtn.classList.add('hidden');
  }
  
  // Clear any success/error alerts
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    alert.classList.add('hidden');
  });
  
  // Reset file info display
  const fileInfo = document.getElementById('fileInfo');
  if (fileInfo) {
    fileInfo.classList.add('hidden');
  }
  
  // Disable next button on step 1
  const next1Btn = document.getElementById('next1');
  if (next1Btn) {
    next1Btn.disabled = true;
  }
  
  // Reset to step 1 if user is in wizard view
  const wizardView = document.getElementById('wizardView');
  if (wizardView && !wizardView.classList.contains('hidden')) {
    if (typeof goToStep === 'function') {
      goToStep(1);
    }
  } else {
    // If in dashboard, navigate to new migration view
    if (typeof showNewMigration === 'function') {
      setTimeout(() => {
        showNewMigration();
      }, 1000);
    }
  }
  
  // Reset cancel flag
  isCancelling = false;
};

