/* =========================================
   ACCESIBILIDAD - SIDOVI
   Panel lateral flotante y preferencias persistentes
   ========================================= */

(() => {
    "use strict";

    const CLAVE = "sidovi_accesibilidad";

    const configuracionInicial = {
        texto: "normal",
        contraste: false,
        enlaces: false,
        grises: false,
        negativo: false,
        iluminado: false,
        elementos: false
    };

    let configuracion = { ...configuracionInicial };

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

    const crearBoton = (id, texto, clase = "") => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.id = id;
        boton.textContent = texto;
        if (clase) boton.className = clase;
        return boton;
    };

    const boton = crearBoton("accesibilidadBoton", "♿", "accesibilidad-boton");
    boton.setAttribute("aria-label", "Abrir opciones de accesibilidad");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-controls", "accesibilidadPanel");

    const panel = document.createElement("section");
    panel.className = "accesibilidad-panel";
    panel.id = "accesibilidadPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "accesibilidadTitulo");
    panel.setAttribute("aria-hidden", "true");

    panel.innerHTML = `
        <div class="accesibilidad-encabezado">
            <h2 id="accesibilidadTitulo">Accesibilidad</h2>
        </div>
        <p class="accesibilidad-descripcion">
            Personaliza la visualización de SIDOVI según tus necesidades.
        </p>

        <p class="accesibilidad-seccion-titulo">Tamaño del contenido</p>
        <div class="accesibilidad-acciones">
            <button type="button" id="textoAumentar" aria-pressed="false">A+ Aumentar texto</button>
            <button type="button" id="textoReducir" aria-pressed="false">A− Reducir texto</button>
            <button type="button" id="elementosToggle" aria-pressed="false">⤢ Escalar elementos</button>
        </div>

        <p class="accesibilidad-seccion-titulo">Colores y contraste</p>
        <div class="accesibilidad-acciones">
            <button type="button" id="grisesToggle" aria-pressed="false">◐ Escala de grises</button>
            <button type="button" id="contrasteToggle" aria-pressed="false">◑ Alto contraste</button>
            <button type="button" id="negativoToggle" aria-pressed="false">◒ Contraste negativo</button>
            <button type="button" id="iluminadoToggle" aria-pressed="false">☼ Fondo iluminado</button>
            <button type="button" id="enlacesToggle" aria-pressed="false">↗ Resaltar enlaces</button>
        </div>

        <div class="accesibilidad-acciones" style="margin-top:15px">
            <button type="button" id="accesibilidadRestablecer" class="accesibilidad-restablecer">
                Restablecer ajustes
            </button>
        </div>
    `;

    const cerrar = crearBoton("accesibilidadCerrar", "×", "accesibilidad-cerrar");
    cerrar.setAttribute("aria-label", "Cerrar opciones de accesibilidad");
    panel.querySelector(".accesibilidad-encabezado").appendChild(cerrar);

    document.body.appendChild(boton);
    document.body.appendChild(panel);

    const controles = {
        aumentar: panel.querySelector("#textoAumentar"),
        reducir: panel.querySelector("#textoReducir"),
        contraste: panel.querySelector("#contrasteToggle"),
        enlaces: panel.querySelector("#enlacesToggle"),
        grises: panel.querySelector("#grisesToggle"),
        negativo: panel.querySelector("#negativoToggle"),
        iluminado: panel.querySelector("#iluminadoToggle"),
        elementos: panel.querySelector("#elementosToggle"),
        restablecer: panel.querySelector("#accesibilidadRestablecer")
    };

    function guardarConfiguracion() {
        try {
            localStorage.setItem(CLAVE, JSON.stringify(configuracion));
        } catch (error) {
            console.warn("No se pudieron guardar las preferencias de accesibilidad.");
        }
    }

    function actualizarEstadoBotones() {
        const estados = {
            aumentar: configuracion.texto === "aumentado",
            reducir: configuracion.texto === "reducido",
            contraste: configuracion.contraste,
            enlaces: configuracion.enlaces,
            grises: configuracion.grises,
            negativo: configuracion.negativo,
            iluminado: configuracion.iluminado,
            elementos: configuracion.elementos
        };

        Object.entries(estados).forEach(([clave, activo]) => {
            controles[clave].setAttribute("aria-pressed", String(Boolean(activo)));
        });
    }

    function aplicarConfiguracion() {
        const clases = {
            "accesibilidad-texto-aumentado": configuracion.texto === "aumentado",
            "accesibilidad-texto-reducido": configuracion.texto === "reducido",
            "accesibilidad-alto-contraste": configuracion.contraste,
            "accesibilidad-enlaces-resaltados": configuracion.enlaces,
            "accesibilidad-escala-grises": configuracion.grises,
            "accesibilidad-contraste-negativo": configuracion.negativo,
            "accesibilidad-fondo-iluminado": configuracion.iluminado,
            "accesibilidad-elementos-escalados": configuracion.elementos
        };

        Object.entries(clases).forEach(([clase, activo]) => {
            document.body.classList.toggle(clase, Boolean(activo));
        });

        actualizarEstadoBotones();
    }

    function guardarYAplicar() {
        aplicarConfiguracion();
        guardarConfiguracion();
    }

    function abrirPanel() {
        panel.setAttribute("aria-hidden", "false");
        boton.setAttribute("aria-expanded", "true");
        boton.setAttribute("aria-label", "Cerrar opciones de accesibilidad");
        controles.aumentar.focus();
    }

    function cerrarPanel(devolverFoco = true) {
        panel.setAttribute("aria-hidden", "true");
        boton.setAttribute("aria-expanded", "false");
        boton.setAttribute("aria-label", "Abrir opciones de accesibilidad");
        if (devolverFoco) boton.focus();
    }

    boton.addEventListener("click", () => {
        const abierto = panel.getAttribute("aria-hidden") === "false";
        if (abierto) cerrarPanel(false);
        else abrirPanel();
    });

    cerrar.addEventListener("click", () => cerrarPanel());

    controles.aumentar.addEventListener("click", () => {
        configuracion.texto = "aumentado";
        guardarYAplicar();
    });

    controles.reducir.addEventListener("click", () => {
        configuracion.texto = "reducido";
        guardarYAplicar();
    });

    const alternar = (clave) => {
        configuracion[clave] = !configuracion[clave];
        guardarYAplicar();
    };

    controles.contraste.addEventListener("click", () => alternar("contraste"));
    controles.enlaces.addEventListener("click", () => alternar("enlaces"));
    controles.grises.addEventListener("click", () => alternar("grises"));
    controles.negativo.addEventListener("click", () => alternar("negativo"));
    controles.iluminado.addEventListener("click", () => alternar("iluminado"));
    controles.elementos.addEventListener("click", () => alternar("elementos"));

    controles.restablecer.addEventListener("click", () => {
        configuracion = { ...configuracionInicial };
        guardarYAplicar();
    });

    document.addEventListener("keydown", (evento) => {
        const abierto = panel.getAttribute("aria-hidden") === "false";
        if (!abierto) return;

        if (evento.key === "Escape") {
            cerrarPanel();
            return;
        }

        if (evento.key === "Tab") {
            const elementos = Array.from(
                panel.querySelectorAll("button:not([disabled])")
            );
            const primero = elementos[0];
            const ultimo = elementos[elementos.length - 1];

            if (evento.shiftKey && document.activeElement === primero) {
                evento.preventDefault();
                ultimo.focus();
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primero.focus();
            }
        }
    });

    document.addEventListener("pointerdown", (evento) => {
        const abierto = panel.getAttribute("aria-hidden") === "false";
        if (abierto && !panel.contains(evento.target) && !boton.contains(evento.target)) {
            cerrarPanel(false);
        }
    });

    aplicarConfiguracion();
})();
