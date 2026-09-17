// Handles login.html and register.html forms.

function bindPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;
  toggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    toggle.textContent = input.type === 'password' ? 'Show' : 'Hide';
  });
}

function initLoginPage() {
  if (getToken()) {
    location.href = 'dashboard.html';
    return;
  }
  bindPasswordToggle('login-password', 'login-toggle-pw');

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  document.getElementById('fill-demo')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'demo@student.com';
    document.getElementById('login-password').value = 'Demo@1234';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('visible');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    try {
      const res = await API.login({ email, password });
      setToken(res.data.token);
      setStoredUser(res.data.user);
      location.href = 'dashboard.html';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });
}

function initRegisterPage() {
  if (getToken()) {
    location.href = 'dashboard.html';
    return;
  }
  bindPasswordToggle('register-password', 'register-toggle-pw');

  const form = document.getElementById('register-form');
  const errorEl = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('visible');
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      errorEl.classList.add('visible');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    try {
      const res = await API.register({ name, email, password });
      setToken(res.data.token);
      setStoredUser(res.data.user);
      location.href = 'dashboard.html';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.add('visible');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}
