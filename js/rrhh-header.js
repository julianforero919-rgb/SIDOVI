(() => {
  const role = sessionStorage.getItem('sidoviRol');
  const isManager = role === 'Gerente'
    || (role !== 'RRHH' && sessionStorage.getItem('sidoviPanel') === 'Gerente');
  if (isManager) return;

  const nav = document.querySelector('.site-header .nav-list');
  if (nav) {
    nav.innerHTML = '<li><a href="index.html" class="nav-link">Inicio Público</a></li><li><a href="login.html" class="nav-link nav-cta">Cerrar Sesión</a></li>';
  }

  const sidebar = document.querySelector('aside.sidebar');
  if (!sidebar) return;

  const currentPage = window.location.pathname.split('/').pop().toLowerCase();
  const sections = [
    {
      title: 'Gestión',
      links: [
        ['RRHH.html', 'Dashboard'],
        ['postulantes.html', 'Postulantes'],
        ['hojasdevida.html', 'Hojas de Vida'],
        ['agenda.html', 'Agenda'],
        ['reporte.html', 'Reportes']
      ]
    },
    {
      title: 'Configuración',
      links: [['cargos.html', 'Cargos y sedes']]
    },
    {
      title: 'Cuenta',
      links: [['mi-perfil.html', 'Mi perfil']]
    }
  ];

  sidebar.setAttribute('aria-label', 'Menú del panel');
  sidebar.replaceChildren();

  for (const section of sections) {
    const title = document.createElement('span');
    title.className = 'sidebar-title';
    title.textContent = section.title;
    sidebar.append(title);

    for (const [href, label] of section.links) {
      const link = document.createElement('a');
      link.href = href;
      link.className = `sidebar-link${href === 'mi-perfil.html' ? ' profile-sidebar-link' : ''}`;
      link.textContent = label;
      if (currentPage === href) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
      sidebar.append(link);
    }
  }
})();
