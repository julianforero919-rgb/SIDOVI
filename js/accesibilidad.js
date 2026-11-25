
/* =========================================
   ACCESIBILIDAD - SIDOVI
   ========================================= */

(() => {
    "use strict";

    const CLAVE = "sidovi_accesibilidad";

    const configuracionInicial = {
        texto: "normal",
        contraste: false,
        enlaces: false
    };

    let configuracion = { ...configuracionInicial };

    // Recuperar preferencias guardadas
    try {
        const guardado = localStorage.getItem(CLAVE);

        if (guardado) {
            configuracion = {
                ...configuracionInicial,
                ...JSON.parse(guardado)
            };
        }
    } catch (error) {
        console.warn("No se pudieron recuperar las preferencias de accesibilidad.");
    }

    // Crear el botón flotante
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "accesibilidad-boton";
    boton.id = "accesibilidadBoton";
    boton.setAttribute("aria-label", "Abrir opciones de accesibilidad");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-controls", "accesibilidadPanel");
    boton.innerHTML = "♿";

    // Crear el panel
    const panel = document.createElement("section");
    panel.className = "accesibilidad-panel";
    panel.id = "accesibilidadPanel";
    panel.setAttribute("aria-label", "Opciones de accesibilidad");
    panel.hidden = true;

    panel.innerHTML = `
    <h2>Accesibilidad</h2>
    <p class="accesibilidad-descripcion">
      Personaliza la visualización de SIDOVI según tus necesidades.
    </p>

    <div class="accesibilidad-acciones">
      <button type="button" id="textoAumentar">
        A+ Aumentar texto
      </button>

      <button type="button" id="textoReducir">
        A- Reducir texto
      </button>

      <button type="button" id="contrasteToggle"
        aria-pressed="false">
        Alto contraste
      </button>

      <button type="button" id="enlacesToggle"
        aria-pressed="false">
        Resaltar enlaces
      </button>

      <button type="button" id="accesibilidadRestablecer"
        class="accesibilidad-restablecer">
        Restablecer ajustes
      </button>
    </div>
  `;

    // Insertar los elementos en la página
    document.body.appendChild(boton);
    document.body.appendChild(panel);

    // Referencias a los controles
    const aumentar = panel.querySelector("#textoAumentar");
    const reducir = panel.querySelector("#textoReducir");
    const contraste = panel.querySelector("#contrasteToggle");
    const enlaces = panel.querySelector("#enlacesToggle");
    const restablecer = panel.querySelector("#accesibilidadRestablecer");

    // Guardar preferencias
    function guardarConfiguracion() {
        try {
            localStorage.setItem(CLAVE, JSON.stringify(configuracion));
        } catch (error) {
            console.warn("No se pudieron guardar las preferencias.");
        }
    }

    // Aplicar preferencias
    function aplicarConfiguracion() {
        document.body.classList.toggle(
            "accesibilidad-texto-aumentado",
            configuracion.texto === "aumentado"
        );

        document.body.classList.toggle(
            "accesibilidad-texto-reducido",
            configuracion.texto === "reducido"
        );

        document.body.classList.toggle(
            "accesibilidad-alto-contraste",
            configuracion.contraste
        );

        document.body.classList.toggle(
            "accesibilidad-enlaces-resaltados",
            configuracion.enlaces
        );

        contraste.setAttribute(
            "aria-pressed",
            String(configuracion.contraste)
        );

        enlaces.setAttribute(
            "aria-pressed",
            String(configuracion.enlaces)
        );

        aumentar.setAttribute(
            "aria-pressed",
            String(configuracion.texto === "aumentado")
        );

        reducir.setAttribute(
            "aria-pressed",
            String(configuracion.texto === "reducido")
        );
    }

    // Abrir y cerrar el panel
    boton.addEventListener("click", () => {
        const abierto = !panel.hidden;

        panel.hidden = abierto;
        boton.setAttribute("aria-expanded", String(!abierto));

        boton.setAttribute(
            "aria-label",
            abierto
                ? "Abrir opciones de accesibilidad"
                : "Cerrar opciones de accesibilidad"
        );

        if (!abierto) {
            aumentar.focus();
        }
    });

    // Aumentar texto
    aumentar.addEventListener("click", () => {
        configuracion.texto = "aumentado";
        aplicarConfiguracion();
        guardarConfiguracion();
    });

    // Reducir texto
    reducir.addEventListener("click", () => {
        configuracion.texto = "reducido";
        aplicarConfiguracion();
        guardarConfiguracion();
    });

    // Alto contraste
    contraste.addEventListener("click", () => {
        configuracion.contraste = !configuracion.contraste;
        aplicarConfiguracion();
        guardarConfiguracion();
    });

    // Resaltar enlaces
    enlaces.addEventListener("click", () => {
        configuracion.enlaces = !configuracion.enlaces;
        aplicarConfiguracion();
        guardarConfiguracion();
    });

    // Restablecer preferencias
    restablecer.addEventListener("click", () => {
        configuracion = { ...configuracionInicial };
        aplicarConfiguracion();
        guardarConfiguracion();
    });

    // Cerrar con Escape
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && !panel.hidden) {
            panel.hidden = true;
            boton.setAttribute("aria-expanded", "false");
            boton.setAttribute(
                "aria-label",
                "Abrir opciones de accesibilidad"
            );
            boton.focus();
        }
    });

    // Aplicar las preferencias al cargar la página
    aplicarConfiguracion();
})();
