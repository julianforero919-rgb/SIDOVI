(() => {
  "use strict";

  if (document.getElementById("sidovi-ai-root")) return;

  const root = document.createElement("div");
  root.id = "sidovi-ai-root";

  root.innerHTML = `
    <button class="sidovi-ai-launcher" id="sidoviAiLauncher"
      type="button" aria-label="Abrir SIDOVI AI" aria-expanded="false">
      <span class="sidovi-ai-launcher-icon">✦</span>
      <span class="sidovi-ai-launcher-label">SIDOVI AI</span>
    </button>

    <section class="sidovi-ai-panel" id="sidoviAiPanel"
      role="dialog" aria-label="Asistente SIDOVI AI" hidden>

      <header class="sidovi-ai-header">
        <div class="sidovi-ai-brand">
          <div class="sidovi-ai-avatar">✦</div>
          <div>
            <h3>SIDOVI AI</h3>
            <p>Asistente de gestión SIDOVI</p>
          </div>
        </div>
        <button class="sidovi-ai-close" id="sidoviAiClose"
          type="button" aria-label="Cerrar asistente">×</button>
      </header>

      <div class="sidovi-ai-messages" id="sidoviAiMessages"
        aria-live="polite">
        <div class="sidovi-ai-message assistant">
          <div class="sidovi-ai-bubble">
            ¡Hola! Soy SIDOVI AI. Estoy aquí para ayudarte a consultar
            la información de tu sistema. ¿Qué deseas saber?
          </div>
          <button class="sidovi-ai-speak" type="button"
            data-speak="¡Hola! Soy SIDOVI AI. Estoy aquí para ayudarte a consultar la información de tu sistema.">
            🔊 Escuchar
          </button>
          <span class="sidovi-ai-time">Asistente</span>
        </div>
      </div>

      <div class="sidovi-ai-suggestions">
        <p>Preguntas frecuentes</p>
        <div class="sidovi-ai-suggestion-list">
          <button class="sidovi-ai-suggestion" type="button">
            ¿Qué tengo pendiente?
          </button>
          <button class="sidovi-ai-suggestion" type="button">
            ¿Hay postulaciones nuevas?
          </button>
          <button class="sidovi-ai-suggestion" type="button">
            ¿Qué procesos están programados?
          </button>
        </div>
      </div>

      <form class="sidovi-ai-composer" id="sidoviAiForm">
        <div class="sidovi-ai-input-row">
          <input class="sidovi-ai-input" id="sidoviAiInput"
            type="text" placeholder="Escribe tu pregunta..."
            autocomplete="off" maxlength="500"
            aria-label="Escribe tu pregunta" required>

          <button class="sidovi-ai-action sidovi-ai-mic"
            id="sidoviAiMic" type="button"
            aria-label="Dictar pregunta" title="Dictar pregunta">🎙</button>

          <button class="sidovi-ai-action sidovi-ai-send"
            id="sidoviAiSend" type="submit"
            aria-label="Enviar pregunta" title="Enviar">➤</button>
        </div>
        <p class="sidovi-ai-status" id="sidoviAiStatus" aria-live="polite"></p>
        <div class="sidovi-ai-footer">
          SIDOVI · Colviseg Ltda.
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(root);

  const launcher = document.getElementById("sidoviAiLauncher");
  const panel = document.getElementById("sidoviAiPanel");
  const close = document.getElementById("sidoviAiClose");
  const messages = document.getElementById("sidoviAiMessages");
  const form = document.getElementById("sidoviAiForm");
  const input = document.getElementById("sidoviAiInput");
  const mic = document.getElementById("sidoviAiMic");
  const status = document.getElementById("sidoviAiStatus");

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Cerrar SIDOVI AI");
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Abrir SIDOVI AI");
    stopRecognition();
  }

  launcher.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  close.addEventListener("click", closePanel);

  function addMessage(message, type) {
    const wrapper = document.createElement("div");
    wrapper.className = `sidovi-ai-message ${type}`;

    const bubble = document.createElement("div");
    bubble.className = "sidovi-ai-bubble";
    bubble.textContent = message;
    wrapper.appendChild(bubble);

    if (type === "assistant") {
      const speak = document.createElement("button");
      speak.type = "button";
      speak.className = "sidovi-ai-speak";
      speak.textContent = "🔊 Escuchar";
      speak.dataset.speak = message;
      wrapper.appendChild(speak);
    }

    const time = document.createElement("span");
    time.className = "sidovi-ai-time";
    time.textContent = type === "user" ? "Tú" : "SIDOVI AI";
    wrapper.appendChild(time);

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }


  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    const sendButton = document.getElementById("sidoviAiSend");

    addMessage(question, "user");
    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    status.textContent = "Consultando la información de SIDOVI...";

    try {
      const response = await fetch("/api/sidovi-ai/consulta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          pregunta: question
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
            data.error || "No fue posible consultar SIDOVI."
        );
      }

      const answer = data.respuesta ||
          "No se recibió una respuesta del sistema.";

      addMessage(answer, "assistant");
      status.textContent = "Consulta completada.";

      // Leer la respuesta automáticamente.
      speakText(answer);

    } catch (error) {
      console.error("Error de SIDOVI AI:", error);

      addMessage(
          error.message || "No fue posible conectar con SIDOVI.",
          "assistant"
      );

      status.textContent = "No se pudo completar la consulta.";

    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  });


  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    addMessage(question, "user");
    input.value = "";
    showDemoNotice();
    input.focus();
  });

  root.querySelectorAll(".sidovi-ai-suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.textContent.trim();
      input.focus();
    });
  });

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      status.textContent = "La lectura de voz no está disponible en este navegador.";
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-CO";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  }

  messages.addEventListener("click", (event) => {
    const button = event.target.closest("[data-speak]");
    if (!button) return;

    speakText(button.dataset.speak);
  });

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;

  function stopRecognition() {
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    mic.classList.remove("recording");
  }

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      mic.classList.add("recording");
      status.textContent = "Te estoy escuchando...";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      input.focus();
      status.textContent = "Pregunta reconocida. Puedes enviarla.";
    };

    recognition.onerror = () => {
      status.textContent = "No pude reconocer tu voz. Intenta nuevamente.";
      mic.classList.remove("recording");
    };

    recognition.onend = () => {
      mic.classList.remove("recording");
    };

    mic.addEventListener("click", () => {
      try {
        if (mic.classList.contains("recording")) {
          stopRecognition();
        } else {
          recognition.start();
        }
      } catch (_) {
        status.textContent = "No fue posible iniciar el micrófono.";
      }
    });
  } else {
    mic.disabled = true;
    mic.title = "El reconocimiento de voz no está disponible en este navegador";
    status.textContent = "Puedes escribir tus preguntas. El dictado no está disponible.";
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closePanel();
  });
})();
