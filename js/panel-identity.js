(async () => {
    const el = document.getElementById('panelIdentity');
    const loader = document.getElementById('panelLoader');
    document.body.classList.add('panel-loading');

    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    if (!el) {
        if (loader) {
            document.body.classList.add('panel-ready');
            setTimeout(() => loader.remove(), 250);
        }
        return;
    }

    try {
        const r = await fetch('/api/auth/me');
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Sesión no disponible');

        const u = d.usuario || {};
        const nombre = u.nombre_completo || 'usuario';
        const foto = u.foto_perfil?.startsWith('data:image')
            ? `<img src="${esc(u.foto_perfil)}" alt="Foto de ${esc(nombre)}" class="panel-user-photo" />`
            : '';
        // Nota: aquí solo se actualiza el bloque de bienvenida (#panelIdentity).
        // El título de la página (#panelTitle) NO se toca: debe conservar
        // el nombre del panel ("Dashboard · Recursos Humanos"), no el
        // nombre del usuario logueado.
        el.innerHTML = `${foto}<span><strong>Hola, ${esc(u.nombre_completo || '')}. ¡Qué bueno tenerte de vuelta!</strong></span>`;
    } catch (e) {
        el.innerHTML = '<span><strong>Bienvenido</strong></span>';
    } finally {
        document.body.classList.remove('panel-loading');
        document.body.classList.add('panel-ready');
        if (loader) {
            setTimeout(() => loader.remove(), 250);
        }
    }
})();
