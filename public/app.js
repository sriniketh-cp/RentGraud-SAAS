function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) {
    return;
  }

  if (input.type === 'password') {
    input.type = 'text';
    if (button) {
      button.textContent = '🙈';
    }
  } else {
    input.type = 'password';
    if (button) {
      button.textContent = '👁️';
    }
  }
}

function setAlert(message, type) {
  const alertBox = document.getElementById('alert-box');
  if (!alertBox) {
    return;
  }

  alertBox.textContent = message;
  alertBox.className = 'mb-5 px-4 py-3 rounded-lg text-sm font-medium';

  if (type === 'success') {
    alertBox.classList.add('bg-emerald-50', 'text-emerald-700', 'border', 'border-emerald-200');
  } else if (type === 'error') {
    alertBox.classList.add('bg-rose-50', 'text-rose-700', 'border', 'border-rose-200');
  } else {
    alertBox.classList.add('bg-slate-100', 'text-slate-700', 'border', 'border-slate-200');
  }

  alertBox.classList.remove('hidden');
}

function clearAlert() {
  const alertBox = document.getElementById('alert-box');
  if (alertBox) {
    alertBox.classList.add('hidden');
  }
}

function switchTab(tab) {
  const loginTab = document.getElementById('content-login');
  const signupTab = document.getElementById('content-signup');
  const loginButton = document.getElementById('tab-login');
  const signupButton = document.getElementById('tab-signup');

  if (!loginTab || !signupTab || !loginButton || !signupButton) {
    return;
  }

  clearAlert();

  const isLogin = tab === 'login';

  loginTab.classList.toggle('hidden', !isLogin);
  loginTab.classList.toggle('block', isLogin);
  signupTab.classList.toggle('hidden', isLogin);
  signupTab.classList.toggle('block', !isLogin);

  loginButton.classList.toggle('text-brand-600', isLogin);
  loginButton.classList.toggle('border-brand-600', isLogin);
  loginButton.classList.toggle('text-slate-400', !isLogin);
  loginButton.classList.toggle('border-transparent', !isLogin);

  signupButton.classList.toggle('text-brand-600', !isLogin);
  signupButton.classList.toggle('border-brand-600', !isLogin);
  signupButton.classList.toggle('text-slate-400', isLogin);
  signupButton.classList.toggle('border-transparent', isLogin);

  loginButton.setAttribute('aria-selected', String(isLogin));
  signupButton.setAttribute('aria-selected', String(!isLogin));
}

function setLoading(formPrefix, isLoading) {
  const button = document.getElementById(`btn-${formPrefix}`);
  const text = document.getElementById(`btn-${formPrefix}-text`);
  const spinner = document.getElementById(`btn-${formPrefix}-spinner`);

  if (!button || !text || !spinner) {
    return;
  }

  button.disabled = isLoading;
  text.textContent = isLoading ? 'Please wait...' : formPrefix === 'login' ? 'Log In' : 'Create Account';
  spinner.classList.toggle('hidden', !isLoading);
}

async function submitAuth(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return response.json();
}

async function handleLogin(event) {
  event.preventDefault();
  clearAlert();
  setLoading('login', true);

  try {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    const result = await submitAuth('/api/login', { email, password });

    if (!result.success) {
      setAlert(result.message || 'Login failed.', 'error');
      return;
    }

    setAlert('Login successful. Redirecting...', 'success');
    sessionStorage.setItem('rentguard_logged_in', 'true');
    window.location.href = 'reports.html';
  } catch (error) {
    setAlert('Could not reach the server.', 'error');
  } finally {
    setLoading('login', false);
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  clearAlert();
  setLoading('signup', true);

  try {
    const email = document.getElementById('signup-email')?.value.trim();
    const password = document.getElementById('signup-password')?.value;

    const result = await submitAuth('/api/signup', { email, password });

    if (!result.success) {
      setAlert(result.message || 'Signup failed.', 'error');
      return;
    }

    setAlert('Account created. You can log in now.', 'success');
    switchTab('login');
  } catch (error) {
    setAlert('Could not reach the server.', 'error');
  } finally {
    setLoading('signup', false);
  }
}

function handleGoogleSignIn() {
  setAlert('Google sign-in is not configured yet.', 'error');
}

window.togglePassword = togglePassword;
window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.handleSignUp = handleSignUp;
window.handleGoogleSignIn = handleGoogleSignIn;