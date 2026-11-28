const $ = (id) => document.getElementById(id);
const esc = (v) => { const d = document.createElement('div'); d.textContent = v ?? ''; return d.innerHTML; };
let fotoPerfil = null;
const alertBox = $('perfilAlert');
const sidebar = document.querySelector('aside.sidebar');

function setManagerSidebar() {
    if (!sidebar) return;
    sidebar.setAttribute('aria-label', 'Menú de gerencia');
    sidebar.innerHTML = '<span class="sidebar-title">Gestión</span><a href="gerente.html" class="sidebar-link">Panel principal</a><a href="evaluar.html" class="sidebar-link">Evaluar candidatos</a><a href="contrato.html" class="sidebar-link">Contratos</a><span class="sidebar-title">Información</span><a href="reporte.html" class="sidebar-link">Reportes</a><span class="sidebar-title">Cuenta</span><a href="mi-perfil.html" class="sidebar-link profile-sidebar-link active" aria-current="page">Mi perfil</a>';
}
function setManagerHeader() {
    const nav = document.querySelector('.site-header .nav-list');
    if (nav) nav.innerHTML = '<li><a href="index.html" class="nav-link">Inicio público</a></li><li><a href="login.html" class="nav-link nav-cta">Cerrar sesión</a></li>';
}

const referrerPage = document.referrer ? new URL(document.referrer).pathname.split('/').pop() : '';
const gerenciaPages = ['gerente.html', 'evaluar.html', 'evaluacion.html', 'contrato.html'];
const savedRole = sessionStorage.getItem('sidoviRol');
const returnToGerencia = savedRole ? savedRole === 'Gerente' : sessionStorage.getItem('sidoviPanel') === 'Gerente' || gerenciaPages.includes(referrerPage);
if (returnToGerencia) { sessionStorage.setItem('sidoviPanel', 'Gerente'); setManagerSidebar(); setManagerHeader(); }
const returnLink = $('volverPanel');
if (returnLink) returnLink.href = returnToGerencia ? 'gerente.html' : 'RRHH.html';
$('menuToggle')?.addEventListener('click', () => document.querySelector('.nav-list')?.classList.toggle('open'));

function msg(text, type = '') {
    alertBox.textContent = text;
    alertBox.className = `form-alert ${type}`;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function leerFoto() {
    const f = $('fotoPerfil').files[0];
    if (!f) return Promise.resolve(null);
    if (f.size > 5 * 1024 * 1024) return Promise.reject(new Error('La foto supera el límite de 5 MB.'));
    return new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => no(new Error('No se pudo leer la foto.'));
        r.readAsDataURL(f);
    });
}

function iniciales(nombre = '') {
    return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
}
function pintarFoto(src) {
    $('fotoVista').innerHTML = src?.startsWith('data:image')
        ? `<img class="profile-photo" src="${src}" alt="Foto de perfil">`
        : `<span class="profile-placeholder">${esc(iniciales($('nombreCompleto').value))}</span>`;
}
function soloFecha(v) { return v ? String(v).slice(0, 10) : ''; }
function pintarCabecera(u) {
    $('heroNombre').textContent = u.nombre_completo || 'Mi perfil';
    $('heroRol').textContent = [u.rol, u.cargo].filter(Boolean).join(' · ');
    $('heroCorreo').textContent = u.correo || '';
}

(async () => {
    try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        const u = d.usuario || {};
        $('nombreCompleto').value = u.nombre_completo || '';
        $('tipoDocumento').value = u.tipo_documento || 'CC';
        $('numeroDocumento').value = u.numero_documento || '';
        $('fechaNacimiento').value = soloFecha(u.fecha_nacimiento);
        $('sexo').value = u.sexo || '';
        $('telefono').value = u.telefono || '';
        $('ciudad').value = u.ciudad || '';
        $('direccion').value = u.direccion || '';
        $('cargo').value = u.cargo || '';
        $('area').value = u.area || '';
        $('fechaIngreso').value = soloFecha(u.fecha_ingreso);
        $('contactoEmergencia').value = u.contacto_emergencia || '';
        $('telefonoEmergencia').value = u.telefono_emergencia || '';
        $('descripcion').value = u.descripcion || '';
        fotoPerfil = u.foto_perfil || null;
        pintarFoto(fotoPerfil);
        pintarCabecera({ ...u, rol: u.rol || d.rol });

        if (u.rol === 'Gerente') {
            sessionStorage.setItem('sidoviPanel', 'Gerente');
            setManagerSidebar();
            setManagerHeader();
            const l = $('volverPanel'); if (l) l.href = 'gerente.html';
        } else if (u.rol === 'RRHH') {
            sessionStorage.removeItem('sidoviPanel');
            const l = $('volverPanel'); if (l) l.href = 'RRHH.html';
        }
    } catch (e) { msg(e.message, 'error'); }
})();

$('fotoPerfil').addEventListener('change', async () => {
    try { fotoPerfil = await leerFoto(); pintarFoto(fotoPerfil); }
    catch (e) { msg(e.message, 'error'); }
});

$('perfilForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const r = await fetch('/api/auth/perfil', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombreCompleto: $('nombreCompleto').value.trim(),
                tipoDocumento: $('tipoDocumento').value,
                numeroDocumento: $('numeroDocumento').value.trim(),
                fechaNacimiento: $('fechaNacimiento').value,
                sexo: $('sexo').value,
                telefono: $('telefono').value.trim(),
                ciudad: $('ciudad').value.trim(),
                direccion: $('direccion').value.trim(),
                cargo: $('cargo').value.trim(),
                area: $('area').value.trim(),
                fechaIngreso: $('fechaIngreso').value,
                contactoEmergencia: $('contactoEmergencia').value.trim(),
                telefonoEmergencia: $('telefonoEmergencia').value.trim(),
                descripcion: $('descripcion').value.trim(),
                fotoPerfil
            })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        sessionStorage.setItem('sidoviUsuario', JSON.stringify(d.usuario));
        pintarCabecera(d.usuario);
        msg('Perfil guardado correctamente.');
    } catch (err) { msg(err.message, 'error'); }
});
