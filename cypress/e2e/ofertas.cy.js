
describe('Pruebas frontend del módulo Ofertas - SIDOVI', () => {

  const sedes = [
    { id_sede: 4, nombre_sede: 'Tunja' },
    { id_sede: 5, nombre_sede: 'Duitama' },
    { id_sede: 6, nombre_sede: 'Sogamoso' }
  ];

  const vacantes = [
    {
      id_vacante: 101,
      id_sede: 4,
      nombre_sede: 'Tunja',
      nombre_cargo: 'Técnico CCTV',
      titulo: 'Técnico CCTV',
      descripcion: 'Instalación de cámaras',
      requisitos: 'Bachiller',
      estado: 'ABIERTA'
    },
    {
      id_vacante: 102,
      id_sede: 5,
      nombre_sede: 'Duitama',
      nombre_cargo: 'Auxiliar de Seguridad',
      titulo: 'Auxiliar de Seguridad',
      descripcion: 'Apoyo en seguridad',
      requisitos: 'Bachiller',
      estado: 'ABIERTA'
    }
  ];

  beforeEach(() => {
    cy.intercept('GET', '**/api/sedes', {
      statusCode: 200,
      body: sedes
    }).as('obtenerSedes');

    cy.intercept('GET', '**/api/vacantes', {
      statusCode: 200,
      body: vacantes
    }).as('obtenerVacantes');

    cy.visit('http://localhost:3000/ofertas.html');

    cy.wait('@obtenerSedes');
    cy.wait('@obtenerVacantes');
  });

  // CP-FE-01: Abrir página de ofertas
  it('CP-FE-01 - Debe abrir correctamente la página de ofertas', () => {
    cy.url().should('include', 'ofertas.html');
    cy.get('#ofertasGrid').should('be.visible');
    cy.get('#sedeFiltro').should('be.visible');
  });

  // CP-FE-02: Consultar ofertas disponibles
  it('CP-FE-02 - Debe mostrar las vacantes registradas', () => {
    cy.get('.oferta-card').should('have.length', 2);

    cy.contains('.oferta-card', 'Técnico CCTV').should('be.visible');
    cy.contains('.oferta-card', 'Auxiliar de Seguridad').should('be.visible');
  });

  // CP-FE-03: Utilizar filtros de búsqueda
  it('CP-FE-03 - Debe filtrar las ofertas por sede', () => {
    cy.get('#sedeFiltro').select('4');

    cy.get('.oferta-card').should('have.length', 1);
    cy.contains('.oferta-card', 'Técnico CCTV').should('be.visible');
    cy.contains('.oferta-card', 'Auxiliar de Seguridad').should('not.exist');
  });

  // CP-FE-04: Seleccionar una oferta laboral
  it('CP-FE-04 - Debe permitir seleccionar una oferta laboral', () => {
    cy.contains('.oferta-card', 'Técnico CCTV')
      .find('a.btn')
      .should('have.attr', 'href')
      .and('include', 'postulacion.html?id_vacante=101');

    cy.contains('.oferta-card', 'Técnico CCTV')
      .find('a.btn')
      .click();

    cy.url().should('include', 'postulacion.html');
    cy.url().should('include', 'id_vacante=101');
  });

});

