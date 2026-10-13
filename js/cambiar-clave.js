// js/cambiar-clave.js
//
// Agrega la tarjeta "Cambiar contraseña" a mi-perfil.html (debajo de la tarjeta de perfil).
// No necesitas editar el HTML salvo para incluir este script, antes de js/mi-perfil.js:
//
//   <script src="js/cambiar-clave.js"></script>
//
// Usa las clases que ya existen en tu CSS (profile-card, field, btn, btn-primary, form-alert).
// Habla con POST /api/auth/cambiar-clave (ver parches-seguridad-sidovi.md, sección 8).
(() => {
    const MIN_LARGO = 12;

    const main = document.querySelector('main.profile-editor') || document.querySelector('main');
    if (!main) return;

    const tarjeta = document.createElement('div');
    tarjeta.className = 'profile-card';
    tarjeta.id = 'cambiarClaveCard';
    tarjeta.style.marginTop = '24px';
    tarjeta.innerHTML = `
    <h2>Cambiar contraseña</h2>
    <p id="claveAviso" hidden>
      <strong>Tu contraseña es temporal.</strong> Debes cambiarla para poder usar el sistema.
    </p>
    <div id="claveAlert" class="form-alert" role="alert" aria-live="polite" hidden></div>
    <form id="claveForm" autocomplete="off">
      <div class="field">
        <label for="claveActual">Contraseña actual</label>
        <input id="claveActual" type="password" autocomplete="current-password" required>
      </div>
      <div class="field">
        <label for="claveNueva">Nueva contraseña</label>
        <input id="claveNueva" type="password" autocomplete="new-password" minlength="${MIN_LARGO}" required>
        <small>Mínimo ${MIN_LARGO} caracteres. Una frase larga de varias palabras funciona muy bien.
        No uses tu correo, "sidovi" ni "colviseg".</small>
      </div>
      <div class="field">
        <label for="claveConfirmar">Confirmar nueva contraseña</label>
        <input id="claveConfirmar" type="password" autocomplete="new-password" required>
      </div>
      <div class="field">
        <label><input id="claveMostrar" type="checkbox"> Mostrar contraseñas</label>
      </div>
      <button class="btn btn-primary" type="submit" id="claveBtn">Cambiar contraseña</button>
    </form>
  `;

    const tarjetaPerfil = main.querySelector('.profile-card');
    if (tarjetaPerfil) tarjetaPerfil.after(tarjeta);
    else main.appendChild(tarjeta);

    const form = tarjeta.querySelector('#claveForm');
    const alerta = tarjeta.querySelector('#claveAlert');
    const boton = tarjeta.querySelector('#claveBtn');
    const actual = tarjeta.querySelector('#claveActual');
    const nueva = tarjeta.querySelector('#claveNueva');
    const confirmar = tarjeta.querySelector('#claveConfirmar');
    const mostrar = tarjeta.querySelector('#claveMostrar');
    const campos = [actual, nueva, confirmar];

    const mensaje = (texto, ok = false) => {
        alerta.textContent = texto;
        alerta.style.color = ok ? '#18794E' : '#B42318';
        alerta.hidden = false;
    };

    // Si el login nos mandó aquí porque la clave es temporal, lo destacamos.
    const obligatorio = new URLSearchParams(window.location.search).get('cambiarClave') === '1';
    if (obligatorio) {
        tarjeta.querySelector('#claveAviso').hidden = false;
        tarjeta.scrollIntoView({ behavior: 'smooth', block: 'start' });
        actual.focus();
    }

    mostrar.addEventListener('change', () => {
        const tipo = mostrar.checked ? 'text' : 'password';
        campos.forEach((campo) => { campo.type = tipo; });
    });

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        alerta.hidden = true;

        if (nueva.value.length < MIN_LARGO) {
            return mensaje(`La nueva contraseña debe tener al menos ${MIN_LARGO} caracteres.`);
        }
        if (nueva.value !== confirmar.value) {
            return mensaje('La confirmación no coincide con la nueva contraseña.');
        }
        if (nueva.value === actual.value) {
            return mensaje('La nueva contraseña debe ser distinta de la actual.');
        }

        try {
            boton.disabled = true;
            const respuesta = await fetch('/api/auth/cambiar-clave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claveActual: actual.value, claveNueva: nueva.value })
            });
            const datos = await respuesta.json().catch(() => ({}));

            // Sesión vencida: volver a iniciar sesión.
            if (respuesta.status === 401 && /sesi/i.test(datos.error || '')) {
                window.location.href = 'login.html?acceso=sesion';
                return;
            }
            if (!respuesta.ok) throw new Error(datos.error || 'No fue posible cambiar la contraseña.');

            form.reset();
            mostrar.checked = false;
            campos.forEach((campo) => { campo.type = 'password'; });
            mensaje('Contraseña actualizada correctamente.', true);

            if (obligatorio) {
                const destino = sessionStorage.getItem('sidoviRol') === 'Gerente' ? 'gerente.html' : 'RRHH.html';
                setTimeout(() => { window.location.href = destino; }, 1500);
            }
        } catch (error) {
            mensaje(error.message);
        } finally {
            boton.disabled = false;
        }
    });
})();
