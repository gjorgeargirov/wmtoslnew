// Handle login form submission
function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember").checked;
  const errorEl = document.getElementById("errorMessage");
  const loginBtn = event.target.querySelector(".login-btn");

  // Clear previous errors
  errorEl.classList.add("hidden");
  errorEl.textContent = "";

  // Basic validation
  if (!email || !password) {
    showError("Please enter both email and password.");
    return;
  }

  // Add loading state
  loginBtn.classList.add("loading");
  loginBtn.textContent = "";

  // Simulate API call
  setTimeout(() => {
    // Authenticate user (uses users.js)
    const authResult = authenticateUser(email, password);
    
    if (authResult.success) {
      // Store auth token (in real app, use secure httpOnly cookies)
      if (remember) {
        localStorage.setItem("authToken", authResult.token);
        // Save email for auto-fill (not password for security)
        localStorage.setItem("rememberedEmail", email);
      } else {
        sessionStorage.setItem("authToken", authResult.token);
        // Clear remembered email if not checked
        localStorage.removeItem("rememberedEmail");
      }

      // Store user info
      sessionStorage.setItem("user", JSON.stringify(authResult.user));

      // Redirect to main app
      window.location.href = "index.html";
    } else {
      // Show error
      loginBtn.classList.remove("loading");
      loginBtn.textContent = "Sign In";
      showError(authResult.error || "Invalid email or password. Please try again.");
    }
  }, 1500);
}

// Handle SSO login
function handleSSO(provider) {
  // SSO is not implemented in this demo version
  // Show error message instead of logging in
  showError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} SSO login is not available. Please use email and password to sign in.`);
  
  // In a production app, this would redirect to the SSO provider:
  // window.location.href = `https://${provider}-sso-provider.com/oauth/authorize?...`;
}

// Show error message
function showError(message) {
  const errorEl = document.getElementById("errorMessage");
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

// Handle forgot password
function handleForgotPassword(event) {
  event.preventDefault();
  showError("Password reset is not available. Please contact your administrator at admin.wmtosl@iwconnect.com to reset your password or create an account.");
}

// Check if already logged in and load remembered email
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  if (token) {
    // Already logged in, redirect to main app
    window.location.href = "index.html";
  } else {
    // Load remembered email if available
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    if (rememberedEmail) {
      const emailInput = document.getElementById("email");
      if (emailInput) {
        emailInput.value = rememberedEmail;
        // Check the remember me checkbox
        const rememberCheckbox = document.getElementById("remember");
        if (rememberCheckbox) {
          rememberCheckbox.checked = true;
        }
      }
    }
  }
});
