
describe('Pruebas del módulo de Ofertas - SIDOVI', () => {

  test('Debe existir un título para la oferta', () => {
    const oferta = {
      titulo: 'Vigilante Diurno'
    };

    expect(oferta.titulo).toBeTruthy();
  });

  test('Debe existir una descripción de la oferta', () => {
    const oferta = {
      descripcion: 'Se requiere personal de vigilancia'
    };

    expect(oferta.descripcion).toBeTruthy();
  });

  test('La oferta debe tener un estado válido', () => {
    const oferta = {
      estado: 'ACTIVA'
    };

    expect(['ACTIVA', 'INACTIVA', 'CERRADA'])
      .toContain(oferta.estado);
  });

  test('El salario no debe ser negativo', () => {
    const oferta = {
      salario: 1300000
    };

    expect(oferta.salario).toBeGreaterThanOrEqual(0);
  });

});
