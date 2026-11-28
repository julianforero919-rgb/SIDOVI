(() => {
  "use strict";

  if (document.getElementById("sidovi-ai-root")) return;

  /* ------------------------------ constantes ------------------------------ */

  const API_CONSULTA = "/api/sidovi-ai/consulta";
  const API_ME = "/api/auth/me";
  const CLAVE_CHAT = "sidovi-ai-chat";      // sessionStorage: historial mientras dure la sesión
  const CLAVE_VOZ = "sidovi-ai-voz";        // localStorage: preferencia de lectura en voz alta
  const MAX_MENSAJES_GUARDADOS = 40;

  const SUGERENCIAS_INICIALES = {
    Gerente: ["¿Qué entrevistas tengo hoy?", "¿Qué tengo pendiente?", "¿Qué contratos están pendientes?", "¿Cómo funciona el proceso?"],
    RRHH: ["¿Qué tengo pendiente?", "¿Cuántas postulaciones están en revisión?", "¿Qué exámenes hay por verificar?", "¿Cómo funciona el proceso?"],
    _: ["¿Qué tengo pendiente?", "¿Hay postulaciones nuevas?", "¿Cómo funciona el proceso?"]
  };

  const ICONOS = {
    spark: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 20.5v-6.8l11-1.7-11-1.7V3.5L22 12 3 20.5z"/></svg>',
    volOn: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    volOff: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3zm13.6 2l2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4-2.4-2.4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    speak: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>'
  };

  /* ------------------------------ estado ---------------------------------- */

  const estado = {
    rol: null,
    nombre: "",
    historial: [],        // [{ tipo, texto, enlaces, hora }]
    sugerencias: [],      // chips de la última respuesta
    vozActiva: leerVoz(),
    soloSaludo: true,     // true mientras la conversación solo tiene el saludo
    enviando: false
  };

  function leerVoz() {
    try { return localStorage.getItem(CLAVE_VOZ) !== "off"; } catch (_) { return true; }
  }
  function guardarVoz(valor) {
    try { localStorage.setItem(CLAVE_VOZ, valor ? "on" : "off"); } catch (_) { /* sin almacenamiento */ }
  }
  function leerHistorial() {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CHAT) || "null");
      if (guardado && Array.isArray(guardado.historial)) return guardado;
    } catch (_) { /* ignorar */ }
    return null;
  }
  function guardarHistorial(abierto) {
    try {
      sessionStorage.setItem(CLAVE_CHAT, JSON.stringify({
        historial: estado.historial.slice(-MAX_MENSAJES_GUARDADOS),
        sugerencias: estado.sugerencias,
        abierto: typeof abierto === "boolean" ? abierto : !panel.hidden
      }));
    } catch (_) { /* sin almacenamiento */ }
  }

  /* ------------------------------ estructura ------------------------------ */

  const root = document.createElement("div");
  root.id = "sidovi-ai-root";
  root.innerHTML = `
    <button class="sidovi-ai-launcher" id="sidoviAiLauncher" type="button"
      aria-label="Abrir SIDOVI AI" aria-expanded="false" aria-controls="sidoviAiPanel">
      <span class="sidovi-ai-launcher-icon">${ICONOS.spark}</span>
      <span class="sidovi-ai-launcher-label">SIDOVI AI</span>
    </button>

    <section class="sidovi-ai-panel" id="sidoviAiPanel" role="dialog"
      aria-label="Asistente SIDOVI AI" hidden>

      <header class="sidovi-ai-header">
        <div class="sidovi-ai-brand">
          <div class="sidovi-ai-avatar">${ICONOS.spark}</div>
          <div>
            <h3>SIDOVI AI</h3>
            <p>Asistente de gestión SIDOVI</p>
          </div>
        </div>
        <div class="sidovi-ai-tools">
          <button class="sidovi-ai-iconbtn" id="sidoviAiVoz" type="button"></button>
          <button class="sidovi-ai-iconbtn" id="sidoviAiLimpiar" type="button"
            aria-label="Borrar conversación" title="Borrar conversación">${ICONOS.trash}</button>
          <button class="sidovi-ai-close" id="sidoviAiClose" type="button"
            aria-label="Cerrar asistente">×</button>
        </div>
      </header>

      <div class="sidovi-ai-messages" id="sidoviAiMessages" role="log"
        aria-live="polite" aria-relevant="additions"></div>

      <div class="sidovi-ai-suggestions" id="sidoviAiSuggestions">
        <div class="sidovi-ai-suggestion-list" id="sidoviAiChips"></div>
      </div>

      <form class="sidovi-ai-composer" id="sidoviAiForm">
        <div class="sidovi-ai-input-row">
          <input class="sidovi-ai-input" id="sidoviAiInput" type="text"
            placeholder="Escribe tu pregunta..." autocomplete="off"
            maxlength="500" aria-label="Escribe tu pregunta" required>
          <button class="sidovi-ai-action sidovi-ai-mic" id="sidoviAiMic" type="button"
            aria-label="Dictar pregunta" title="Dictar pregunta">${ICONOS.mic}</button>
          <button class="sidovi-ai-action sidovi-ai-send" id="sidoviAiSend" type="submit"
            aria-label="Enviar pregunta" title="Enviar">${ICONOS.send}</button>
        </div>
        <p class="sidovi-ai-status" id="sidoviAiStatus" aria-live="polite"></p>
        <div class="sidovi-ai-footer">SIDOVI · Colviseg Ltda. · Solo consulta información, no la modifica</div>
      </form>
    </section>
  `;
  document.body.appendChild(root);

  const launcher = document.getElementById("sidoviAiLauncher");
  const panel = document.getElementById("sidoviAiPanel");
  const closeBtn = document.getElementById("sidoviAiClose");
  const messages = document.getElementById("sidoviAiMessages");
  const chips = document.getElementById("sidoviAiChips");
  const form = document.getElementById("sidoviAiForm");
  const input = document.getElementById("sidoviAiInput");
  const sendBtn = document.getElementById("sidoviAiSend");
  const mic = document.getElementById("sidoviAiMic");
  const status = document.getElementById("sidoviAiStatus");
  const vozBtn = document.getElementById("sidoviAiVoz");
  const limpiarBtn = document.getElementById("sidoviAiLimpiar");

  /* ------------------------------ voz (salida) ---------------------------- */

  let vozElegida = null;

  function elegirVoz() {
    if (!("speechSynthesis" in window)) return null;
    const voces = window.speechSynthesis.getVoices().filter((v) => /^es(-|_|$)/i.test(v.lang));
    if (!voces.length) return null;
    const preferencia = ["es-CO", "es-MX", "es-US", "es-419", "es-AR", "es-ES"];
    const puntaje = (v) => {
      const idioma = preferencia.findIndex((p) => v.lang.replace("_", "-").toLowerCase() === p.toLowerCase());
      const calidad = /natural|online|google|neural|premium|enhanced/i.test(v.name) ? 10 : 0;
      return calidad + (idioma === -1 ? 0 : preferencia.length - idioma);
    };
    return voces.sort((a, b) => puntaje(b) - puntaje(a))[0];
  }

  if ("speechSynthesis" in window) {
    vozElegida = elegirVoz();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => { vozElegida = elegirVoz(); });
  }

  /** Quita símbolos que suenan mal al leerse en voz alta. */
  function textoParaVoz(texto) {
    return String(texto)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/[«»]/g, "")
      .replace(/\n+\s*[•·]\s*/g, ". ")
      .replace(/[•·]/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\.\s*\./g, ".")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hablar(texto) {
    if (!("speechSynthesis" in window)) {
      status.textContent = "La lectura en voz alta no está disponible en este navegador.";
      return;
    }
    window.speechSynthesis.cancel();
    const limpio = textoParaVoz(texto);
    if (!limpio) return;
    const habla = new SpeechSynthesisUtterance(limpio);
    habla.lang = vozElegida?.lang || "es-CO";
    if (vozElegida) habla.voice = vozElegida;
    habla.rate = 1;
    habla.pitch = 1;
    window.speechSynthesis.speak(habla);
  }

  function detenerVoz() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function pintarBotonVoz() {
    vozBtn.innerHTML = estado.vozActiva ? ICONOS.volOn : ICONOS.volOff;
    vozBtn.setAttribute("aria-pressed", String(estado.vozActiva));
    const etiqueta = estado.vozActiva ? "Silenciar respuestas en voz alta" : "Activar respuestas en voz alta";
    vozBtn.setAttribute("aria-label", etiqueta);
    vozBtn.title = etiqueta;
    vozBtn.classList.toggle("is-off", !estado.vozActiva);
  }

  vozBtn.addEventListener("click", () => {
    estado.vozActiva = !estado.vozActiva;
    guardarVoz(estado.vozActiva);
    if (!estado.vozActiva) detenerVoz();
    pintarBotonVoz();
    status.textContent = estado.vozActiva ? "Voz activada." : "Voz silenciada.";
  });

  /* ------------------------------ mensajes -------------------------------- */

  const horaActual = () => new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  function crearMensaje({ tipo, texto, enlaces, hora }) {
    const wrapper = document.createElement("div");
    wrapper.className = `sidovi-ai-message ${tipo}`;

    const bubble = document.createElement("div");
    bubble.className = "sidovi-ai-bubble";
    bubble.textContent = texto; // textContent: nunca se interpreta HTML
    wrapper.appendChild(bubble);

    if (tipo === "assistant" && Array.isArray(enlaces) && enlaces.length) {
      const fila = document.createElement("div");
      fila.className = "sidovi-ai-links";
      enlaces.forEach((e) => {
        if (!e || typeof e.url !== "string" || !/^[\w.-]+\.html$/.test(e.url)) return; // solo páginas internas
        const a = document.createElement("a");
        a.className = "sidovi-ai-link";
        a.href = e.url;
        a.textContent = e.texto || e.url;
        fila.appendChild(a);
      });
      if (fila.children.length) wrapper.appendChild(fila);
    }

    const pie = document.createElement("div");
    pie.className = "sidovi-ai-meta";

    if (tipo === "assistant") {
      const hablarBtn = document.createElement("button");
      hablarBtn.type = "button";
      hablarBtn.className = "sidovi-ai-speak";
      hablarBtn.innerHTML = `${ICONOS.speak}<span>Escuchar</span>`;
      hablarBtn.dataset.accion = "hablar";
      pie.appendChild(hablarBtn);

      const copiarBtn = document.createElement("button");
      copiarBtn.type = "button";
      copiarBtn.className = "sidovi-ai-speak";
      copiarBtn.innerHTML = `${ICONOS.copy}<span>Copiar</span>`;
      copiarBtn.dataset.accion = "copiar";
      pie.appendChild(copiarBtn);
    }

    const tiempo = document.createElement("span");
    tiempo.className = "sidovi-ai-time";
    tiempo.textContent = `${tipo === "user" ? "Tú" : "SIDOVI AI"} · ${hora || horaActual()}`;
    pie.appendChild(tiempo);
    wrapper.appendChild(pie);

    wrapper._texto = texto;
    return wrapper;
  }

  function agregarMensaje(datos, { guardar = true } = {}) {
    const completo = { ...datos, hora: datos.hora || horaActual() };
    messages.appendChild(crearMensaje(completo));
    messages.scrollTop = messages.scrollHeight;
    if (guardar) {
      estado.historial.push({ tipo: completo.tipo, texto: completo.texto, enlaces: completo.enlaces || [], hora: completo.hora });
      guardarHistorial();
    }
  }

  messages.addEventListener("click", async (event) => {
    const boton = event.target.closest("[data-accion]");
    if (!boton) return;
    const mensaje = boton.closest(".sidovi-ai-message");
    const texto = mensaje?._texto || "";
    if (boton.dataset.accion === "hablar") {
      hablar(texto);
    } else if (boton.dataset.accion === "copiar") {
      try {
        await navigator.clipboard.writeText(texto);
        status.textContent = "Respuesta copiada.";
      } catch (_) {
        status.textContent = "No se pudo copiar la respuesta.";
      }
    }
  });

  function mostrarEscribiendo() {
    const el = document.createElement("div");
    el.className = "sidovi-ai-message assistant sidovi-ai-typing";
    el.id = "sidoviAiTyping";
    el.setAttribute("aria-label", "SIDOVI AI está escribiendo");
    el.innerHTML = '<div class="sidovi-ai-bubble"><span></span><span></span><span></span></div>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }
  function ocultarEscribiendo() {
    document.getElementById("sidoviAiTyping")?.remove();
  }

  function pintarSugerencias(lista) {
    estado.sugerencias = Array.isArray(lista) ? lista.slice(0, 4) : [];
    chips.textContent = "";
    estado.sugerencias.forEach((texto) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sidovi-ai-suggestion";
      b.textContent = texto;
      b.addEventListener("click", () => enviar(texto));
      chips.appendChild(b);
    });
    document.getElementById("sidoviAiSuggestions").hidden = estado.sugerencias.length === 0;
    // Al aparecer/desaparecer las sugerencias cambia el alto del chat: se vuelve al final.
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  /* ------------------------------ envío ----------------------------------- */

  async function enviar(pregunta) {
    const texto = String(pregunta || "").trim();
    if (!texto || estado.enviando) return;

    detenerVoz();
    estado.enviando = true;
    estado.soloSaludo = false;
    agregarMensaje({ tipo: "user", texto });
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;
    pintarSugerencias([]);
    status.textContent = "Consultando la información de SIDOVI...";
    mostrarEscribiendo();

    try {
      const respuesta = await fetch(API_CONSULTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pregunta: texto })
      });

      let datos = {};
      try { datos = await respuesta.json(); } catch (_) { /* respuesta sin JSON */ }

      if (!respuesta.ok) {
        const mensajeError = respuesta.status === 401
          ? "Tu sesión expiró. Inicia sesión de nuevo para seguir consultando."
          : datos.error || "No fue posible consultar SIDOVI.";
        throw new Error(mensajeError);
      }

      const textoRespuesta = datos.respuesta || "No se recibió una respuesta del sistema.";
      ocultarEscribiendo();
      agregarMensaje({ tipo: "assistant", texto: textoRespuesta, enlaces: datos.enlaces });
      pintarSugerencias(datos.sugerencias);
      guardarHistorial();
      status.textContent = "";
      if (estado.vozActiva) hablar(textoRespuesta);
    } catch (error) {
      ocultarEscribiendo();
      agregarMensaje({ tipo: "assistant", texto: error.message || "No fue posible conectar con SIDOVI." });
      pintarSugerencias(SUGERENCIAS_INICIALES[estado.rol] || SUGERENCIAS_INICIALES._);
      status.textContent = "No se pudo completar la consulta.";
    } finally {
      estado.enviando = false;
      input.disabled = false;
      sendBtn.disabled = false;
      if (!panel.hidden) input.focus();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    enviar(input.value);
  });

  /* ------------------------------ panel ----------------------------------- */

  function abrirPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Cerrar SIDOVI AI");
    messages.scrollTop = messages.scrollHeight;
    input.focus();
    guardarHistorial(true);
  }

  function cerrarPanel({ devolverFoco = true } = {}) {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Abrir SIDOVI AI");
    detenerReconocimiento();
    detenerVoz();
    guardarHistorial(false);
    if (devolverFoco) launcher.focus();
  }

  launcher.addEventListener("click", () => (panel.hidden ? abrirPanel() : cerrarPanel()));
  closeBtn.addEventListener("click", () => cerrarPanel());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) cerrarPanel();
  });

  window.addEventListener("pagehide", detenerVoz);

  function saludoInicial() {
    const primerNombre = String(estado.nombre || "").trim().split(/\s+/)[0];
    return `¡Hola${primerNombre ? `, ${primerNombre}` : ""}! Soy SIDOVI AI. Puedo contarte cómo van las postulaciones, entrevistas, exámenes y contratos, y explicarte cómo funciona el sistema. ¿Qué deseas saber?`;
  }

  function reiniciarConversacion() {
    estado.historial = [];
    messages.textContent = "";
    estado.soloSaludo = true;
    agregarMensaje({ tipo: "assistant", texto: saludoInicial() });
    pintarSugerencias(SUGERENCIAS_INICIALES[estado.rol] || SUGERENCIAS_INICIALES._);
    guardarHistorial();
  }

  limpiarBtn.addEventListener("click", () => {
    detenerVoz();
    reiniciarConversacion();
    status.textContent = "Conversación borrada.";
  });

  /* ------------------------------ voz (entrada) --------------------------- */

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let reconocimiento = null;

  function detenerReconocimiento() {
    if (reconocimiento) {
      try { reconocimiento.stop(); } catch (_) { /* ya detenido */ }
    }
    mic.classList.remove("recording");
  }

  if (SpeechRecognition) {
    reconocimiento = new SpeechRecognition();
    reconocimiento.lang = "es-CO";
    reconocimiento.continuous = false;
    reconocimiento.interimResults = false;

    reconocimiento.onstart = () => {
      detenerVoz(); // que no se escuche a sí mismo
      mic.classList.add("recording");
      mic.setAttribute("aria-pressed", "true");
      status.textContent = "Te estoy escuchando...";
    };
    reconocimiento.onresult = (event) => {
      const dictado = event.results[0][0].transcript;
      input.value = dictado;
      enviar(dictado); // conversación manos libres: se envía solo
    };
    reconocimiento.onerror = (event) => {
      const sinPermiso = event.error === "not-allowed" || event.error === "service-not-allowed";
      status.textContent = sinPermiso
        ? "Permite el acceso al micrófono en tu navegador para dictar."
        : "No pude reconocer tu voz. Intenta nuevamente.";
      mic.classList.remove("recording");
    };
    reconocimiento.onend = () => {
      mic.classList.remove("recording");
      mic.setAttribute("aria-pressed", "false");
    };

    mic.addEventListener("click", () => {
      try {
        if (mic.classList.contains("recording")) detenerReconocimiento();
        else reconocimiento.start();
      } catch (_) {
        status.textContent = "No fue posible iniciar el micrófono.";
      }
    });
  } else {
    mic.disabled = true;
    mic.title = "El dictado por voz no está disponible en este navegador (prueba con Chrome o Edge)";
    status.textContent = "Puedes escribir tus preguntas. El dictado no está disponible en este navegador.";
  }

  /* ------------------------------ arranque -------------------------------- */

  pintarBotonVoz();

  const guardado = leerHistorial();
  if (guardado && guardado.historial.length) {
    estado.historial = guardado.historial;
    estado.soloSaludo = estado.historial.length <= 1;
    estado.historial.forEach((m) => messages.appendChild(crearMensaje(m)));
    pintarSugerencias(guardado.sugerencias);
    if (guardado.abierto) abrirPanel();
  } else {
    reiniciarConversacion();
  }

  // Rol y nombre: personalizan el saludo y las sugerencias iniciales.
  fetch(API_ME, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((datos) => {
      if (!datos) return;
      estado.rol = datos.rol || null;
      estado.nombre = datos.usuario?.nombre_completo || "";
      if (estado.soloSaludo && !estado.enviando) {
        // Solo el saludo: se rehace con el nombre y las sugerencias del rol.
        reiniciarConversacion();
      } else if (!estado.sugerencias.length) {
        pintarSugerencias(SUGERENCIAS_INICIALES[estado.rol] || SUGERENCIAS_INICIALES._);
      }
    })
    .catch(() => { /* sin sesión: se mantiene el saludo genérico */ });
})();
