// login.js — Autenticación de usuarios
fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
document.getElementById('menuToggle')?.addEventListener('click', () => document.querySelector('.nav-list')?.classList.toggle('open'));

document.getElementById('togglePass')?.addEventListener('click', () => {
  const passInput = document.getElementById('login-pass');
  passInput.type = passInput.type === 'password' ? 'text' : 'password';
});

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('btnLogin');
const alertBox = document.getElementById('login-alert');

loginButton.addEventListener('click', async () => {
  const correo = document.getElementById('login-user').value.trim();
  const contrasena = document.getElementById('login-pass').value;
  const rolSolicitado = document.getElementById('login-rol').value;
  if (!correo || !contrasena || !rolSolicitado) {
    alertBox.textContent = 'Completa todos los campos.';
    alertBox.hidden = false;
    return;
  }
  try {
    loginButton.disabled = true;
    alertBox.hidden = true;
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena, rolSolicitado })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No fue posible iniciar sesión.');
    sessionStorage.setItem('sidoviRol', data.usuario.rol);
    sessionStorage.setItem('sidoviUsuario', JSON.stringify(data.usuario));

    loginForm.hidden = true;
    mostrarBienvenida(data.usuario);

    setTimeout(() => { window.location.href = data.usuario.rol === 'RRHH' ? 'RRHH.html' : 'gerente.html'; }, 1000);
  } catch (error) {
    alertBox.textContent = error.message;
    alertBox.hidden = false;
    loginForm.hidden = true;
    document.getElementById('loginDenied').hidden = false;
  } finally {
    loginButton.disabled = false;
  }
});

// ---------- Tarjeta de bienvenida al ingresar ----------
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function mostrarBienvenida(usuario) {
  const nombre = usuario.nombre_completo || 'usuario';
  const etiqueta = usuario.rol === 'Gerente' ? 'Panel de Gerencia' : 'Panel de Recursos Humanos';
  const iniciales = nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '•';
  let fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  fecha = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  const foto = String(usuario.foto_perfil || '').startsWith('data:image')
      ? `<img src="${escHtml(usuario.foto_perfil)}" alt="Foto de ${escHtml(nombre)}" class="welcome-photo" />`
      : `<span class="welcome-photo welcome-initials" aria-hidden="true">${escHtml(iniciales)}</span>`;

  alertBox.hidden = true;

  const pantalla = document.createElement('div');
  pantalla.className = 'welcome-screen';
  pantalla.setAttribute('role', 'status');
  pantalla.setAttribute('aria-live', 'polite');
  pantalla.innerHTML =
      '<div class="welcome-card">' +
      `${foto}` +
      `<div class="welcome-title">¡Hola, ${escHtml(nombre)}!</div>` +
      `<div class="welcome-sub">¡Qué bueno tenerte de vuelta!</div>` +
      `<div class="welcome-box"><span>${escHtml(etiqueta)}</span><strong>${escHtml(fecha)}</strong></div>` +
      `<div class="success-loader" aria-hidden="true"><span></span><span></span><span></span></div>` +
      `<div class="welcome-redirect">Entrando a tu panel...</div>` +
      '</div>';

  document.body.classList.add('welcome-open');
  document.body.appendChild(pantalla);
}

document.getElementById('btnRetry')?.addEventListener('click', () => {
  document.getElementById('loginDenied').hidden = true;
  loginForm.hidden = false;
  alertBox.hidden = true;
  document.getElementById('login-pass').value = '';
});
