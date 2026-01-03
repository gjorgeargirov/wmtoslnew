// Check authentication on page load
(function() {
  const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  const user = sessionStorage.getItem("user");

  if (!token || !user) {
    // Not authenticated, redirect to login
    window.location.href = "login.html";
    return;
  }

  // User is authenticated
  const userData = JSON.parse(user);
  
  // User is authenticated
})();

// Logout function
function logout() {
  try {
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
  } catch (error) {
    // Fallback: clear everything and redirect
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "login.html";
  }
}

// Make logout globally accessible
window.logout = logout;
