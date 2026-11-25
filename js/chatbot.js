const chatbotButton = document.getElementById("chatbotButton");
const chatbotContainer = document.getElementById("chatbotContainer");
const closeChat = document.getElementById("closeChat");
const sendButton = document.getElementById("sendButton");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const speakButton = document.getElementById("speakButton");
const micButton = document.getElementById("micButton");
const botStatus = document.getElementById("botStatus");
const quickReplies = document.getElementById("quickReplies");

/* ---------- Voz: el navegador lee las respuestas y puede dictar lo que escribes ---------- */

const VOICE_KEY = "sidovi_chat_voz";
const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let voiceEnabled = false;
try {
    voiceEnabled = localStorage.getItem(VOICE_KEY) === "on";
} catch (error) {
    voiceEnabled = false;
}

let spanishVoice = null;
let recognition = null;
let listening = false;
let lastInputWasVoice = false;

// Elige la mejor voz en español disponible en el dispositivo.
function pickSpanishVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    const preferred = ["es-CO", "es-MX", "es-US", "es-419", "es-ES"];
    for (const lang of preferred) {
        const found = voices.find((voice) => voice.lang.replace("_", "-") === lang);
        if (found) {
            spanishVoice = found;
            return;
        }
    }
    spanishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) || null;
}

if (synth) {
    pickSpanishVoice();
    synth.addEventListener?.("voiceschanged", pickSpanishVoice);
}

// Prepara el texto para que se escuche natural (sin emojis ni siglas confusas).
function textForSpeech(text) {
    return text
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
        .replace(/[«»]/g, "")
        .replace(/\bRRHH\b/g, "Recursos Humanos")
        .replace(/\bLtda\.?/g, "Limitada")
        .replace(/\bCra\./g, "Carrera")
        .replace(/#/g, "número ")
        .replace(/\s+/g, " ")
        .trim();
}

function setSpeakingState(isSpeaking) {
    botStatus?.classList.toggle("speaking", isSpeaking);
    if (botStatus) botStatus.textContent = isSpeaking ? "Hablando..." : "En línea";
}

function speak(text) {
    if (!synth || (!voiceEnabled && !lastInputWasVoice)) return;
    const clean = textForSpeech(text);
    if (!clean) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = spanishVoice ? spanishVoice.lang : "es-CO";
    if (spanishVoice) utterance.voice = spanishVoice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeakingState(true);
    utterance.onend = () => setSpeakingState(false);
    utterance.onerror = () => setSpeakingState(false);
    synth.speak(utterance);
}

function stopSpeaking() {
    if (synth) synth.cancel();
    setSpeakingState(false);
}

function refreshSpeakButton() {
    if (!speakButton) return;
    speakButton.classList.toggle("on", voiceEnabled);
    speakButton.setAttribute("aria-pressed", String(voiceEnabled));
    speakButton.title = voiceEnabled ? "Desactivar voz del asistente" : "Activar voz del asistente";
}

if (speakButton) {
    if (!synth) {
        speakButton.style.display = "none";
    } else {
        refreshSpeakButton();
        speakButton.addEventListener("click", () => {
            voiceEnabled = !voiceEnabled;
            try {
                localStorage.setItem(VOICE_KEY, voiceEnabled ? "on" : "off");
            } catch (error) {
                /* Si el navegador bloquea el almacenamiento, la voz sigue funcionando en esta sesión. */
            }
            refreshSpeakButton();
            if (voiceEnabled) {
                lastInputWasVoice = false;
                speak("Voz activada. Soy el asistente de SIDOVI.");
            } else {
                stopSpeaking();
            }
        });
    }
}

// Dictado por voz (Chrome, Edge y Safari lo soportan; Firefox no).
if (micButton) {
    if (!SpeechRecognitionAPI) {
        micButton.style.display = "none";
    } else {
        recognition = new SpeechRecognitionAPI();
        recognition.lang = "es-CO";
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => {
            listening = true;
            micButton.classList.add("listening");
            chatInput.placeholder = "Te escucho...";
        };
        recognition.onresult = (event) => {
            let transcript = "";
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            chatInput.value = transcript;
            if (event.results[event.results.length - 1].isFinal) {
                lastInputWasVoice = true;
                sendMessage();
            }
        };
        recognition.onend = () => {
            listening = false;
            micButton.classList.remove("listening");
            chatInput.placeholder = "Escribe tu mensaje...";
        };
        recognition.onerror = () => {
            listening = false;
            micButton.classList.remove("listening");
            chatInput.placeholder = "Escribe tu mensaje...";
        };

        micButton.addEventListener("click", () => {
            if (listening) {
                recognition.stop();
                return;
            }
            stopSpeaking();
            try {
                recognition.start();
            } catch (error) {
                /* Ya estaba escuchando. */
            }
        });
    }
}

/* ---------- Apertura y cierre ---------- */

chatbotButton?.addEventListener("click", () => {
    chatbotContainer.classList.add("active");
    chatbotButton.style.display = "none";
    chatInput.focus();
});

closeChat?.addEventListener("click", () => {
    chatbotContainer.classList.remove("active");
    chatbotButton.style.display = "";
    stopSpeaking();
    if (recognition && listening) recognition.stop();
});

window.addEventListener("beforeunload", stopSpeaking);

/* ---------- Mensajes ---------- */


async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    stopSpeaking();
    addMessage(message, "user-message");
    chatInput.value = "";

    const typing = addTypingIndicator();

    try {
        await new Promise(resolve => window.setTimeout(resolve, 500));

        const response = await generateResponse(message);

        typing.remove();
        addMessage(response.text, "bot-message");

        if (response.contact) addContactLink();
        if (response.vacantes?.length) addVacancyLinks(response.vacantes);

        speak(response.speech || response.text);
    } catch (error) {
        console.error("Error del asistente SIDOVI:", error);

        typing.remove();

        const errorMessage = "En este momento no puedo consultar la información solicitada. Intenta nuevamente en unos minutos o comunícate con Colviseg al (601) 756 2093.";
        addMessage(errorMessage, "bot-message");
        speak(errorMessage);
    } finally {
        lastInputWasVoice = false;
    }
}


function addMessage(text, className) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", className);

    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    messageDiv.appendChild(paragraph);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const typing = document.createElement("div");
    typing.classList.add("message", "bot-message", "typing");
    typing.setAttribute("aria-label", "El asistente está escribiendo");
    typing.innerHTML = "<i></i><i></i><i></i>";
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typing;
}


async function generateResponse(message) {
    const text = message.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    // Errores o inconvenientes
    if (/\b(error|falla|fallo|problema|no funciona|no me deja|no puedo|no carga|no guarda|no se guarda)\b/.test(text)) {
        return {
            text: "Siento que estés teniendo este inconveniente. El equipo de Colviseg puede ayudarte directamente en el (601) 756 2093.",
            contact: true
        };
    }

    // Saludos
    if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(text)) {
        return {
            text: "¡Hola! Soy el asistente virtual de SIDOVI. Estoy aquí para orientarte sobre vacantes, postulaciones, documentos, entrevistas y el proceso de selección. ¿En qué puedo ayudarte?"
        };
    }

    // Consulta de vacantes reales en PostgreSQL
    if (/\b(oferta|ofertas|vacante|vacantes|empleo|trabajo|puestos disponibles)\b/.test(text)) {
        const response = await fetch("/api/vacantes-publicas", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("No fue posible consultar las vacantes.");
        }

        const vacantes = await response.json();

        if (!Array.isArray(vacantes) || vacantes.length === 0) {
            return {
                text: "En este momento no tenemos vacantes activas publicadas en SIDOVI. Te recomendamos consultar nuevamente más adelante, ya que las oportunidades laborales pueden actualizarse."
            };
        }

        const disponibles = vacantes.slice(0, 5);

        const detalles = disponibles.map((v, index) => {
            const cargo = v.nombre_cargo || "Cargo por definir";
            const sede = v.nombre_sede || "Sede no especificada";
            const descripcion = v.descripcion || v.descripcion_cargo || "";
            const requisitos = v.requisitos || "";
            const turnos = v.turnos || "";

            let detalle = `${index + 1}. ${cargo}\nSede: ${sede}`;

            if (turnos.trim()) {
                detalle += `\nTurnos: ${turnos}`;
            }

            if (descripcion.trim()) {
                detalle += `\nDescripción: ${descripcion}`;
            }

            if (requisitos.trim()) {
                detalle += `\nRequisitos: ${requisitos}`;
            }

            return detalle;
        });

        const texto = `¡Claro! Estas son las vacantes activas que aparecen actualmente en SIDOVI:\n\n${detalles.join("\n\n")}\n\nSelecciona el botón de la vacante que te interese para conocer cómo postularte.`;

        return {
            text: texto,
            speech: `Actualmente aparecen ${vacantes.length} vacantes activas en SIDOVI. Te mostraré los cargos y sus sedes para que puedas revisar las oportunidades disponibles.`,
            vacantes: disponibles
        };
    }

    // Postulaciones
    if (/\b(postular|postularme|postularse|postulacion|postulaciones|inscribirme|inscripcion|inscribirse|aplicar|aplicarme|aplicacion)\b/.test(text)) {
        return {
            text: "Para postularte, ingresa a la sección de Ofertas, selecciona la vacante que te interese y pulsa el botón Postularme. Completa tus datos personales, diligencia la información solicitada, adjunta los documentos requeridos y envía tu solicitud. Después, el equipo de selección revisará tu perfil."
        };
    }

    // Documentos y hoja de vida
    if (/\b(hoja de vida|hv|documentos|documentacion|certificados)\b/.test(text)) {
        return {
            text: "Para participar en una convocatoria, prepara tu hoja de vida actualizada y los documentos de soporte que solicite la vacante. Según el cargo, pueden requerirse certificados de estudio, experiencia laboral y otros documentos. Verifica que los archivos sean legibles y que la información esté completa."
        };
    }

    // Entrevistas
    if (/\b(entrevista|entrevistas|cita|agenda)\b/.test(text)) {
        return {
            text: "Si tu perfil avanza en el proceso de selección, el equipo de Colviseg te informará la fecha, hora y modalidad de la entrevista. Esta puede realizarse de manera presencial, virtual o telefónica. Revisa los datos de contacto que registraste en tu postulación.",
            contact: true
        };
    }

    // Exámenes y contratación
    if (/\b(examen|examenes|medico|medicos|contrato|contratacion|seleccion|proceso)\b/.test(text)) {
        return {
            text: "El proceso de selección puede incluir varias etapas: revisión de la hoja de vida y la postulación, entrevista, exámenes médicos y gestión del contrato cuando corresponda. Avanzar a una etapa no garantiza la contratación. El equipo de selección te comunicará las instrucciones y los resultados."
        };
    }

    // Acceso al sistema
    if (/\b(login|iniciar sesion|ingresar|contrasena|cuenta|acceso)\b/.test(text)) {
        return {
            text: "El acceso interno a SIDOVI está destinado al personal autorizado de Recursos Humanos y Gerencia. Si eres aspirante, puedes consultar las vacantes y realizar tu postulación desde las secciones públicas del sistema. Si tienes problemas con tu cuenta interna, comunícate con Colviseg al (601) 756 2093.",
            contact: true
        };
    }

    // Perfil y datos personales
    if (/\b(perfil|actualizar datos|datos personales|corregir datos)\b/.test(text)) {
        return {
            text: "Si necesitas corregir o actualizar los datos de una postulación, comunícate con el equipo de selección de Colviseg para recibir orientación. Puedes llamar al (601) 756 2093.",
            contact: true
        };
    }

    // Información general
    if (/\b(rrhh|recursos humanos|gerencia|dashboard|sistema|sidovi|colviseg|empresa)\b/.test(text)) {
        return {
            text: "SIDOVI es el Sistema de Información para la Documentación y Vinculación de Personal de Colviseg Ltda. Permite consultar vacantes y gestionar postulaciones. También cuenta con módulos internos para Recursos Humanos y Gerencia, que apoyan las etapas de selección y vinculación."
        };
    }

    // Agradecimientos
    if (/\b(gracias|listo|entendi|entendido)\b/.test(text)) {
        return {
            text: "¡Con mucho gusto! Estoy aquí para ayudarte. Si tienes otra pregunta sobre las vacantes o tu postulación, puedes escribirme."
        };
    }

    return {
        text: "Puedo ayudarte con información sobre vacantes disponibles, requisitos, postulaciones, hojas de vida, entrevistas, exámenes y contratación. ¿Sobre cuál de estos temas deseas consultar?",
        contact: false
    };
}


function addVacancyLinks(vacantes) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "bot-message");

    vacantes.forEach((vacante) => {
        if (!vacante.id_vacante) return;

        const link = document.createElement("a");

        link.href = `postulacion.html?id_vacante=${encodeURIComponent(vacante.id_vacante)}`;
        link.className = "chatbot-contact-link";
        link.textContent = `Postularme: ${vacante.nombre_cargo || "Ver vacante"}`;
        link.style.display = "block";
        link.style.marginTop = "8px";

        messageDiv.appendChild(link);
    });

    if (messageDiv.children.length > 0) {
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}


function addContactLink() {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "bot-message");

    const link = document.createElement("a");
    link.href = "tel:+576017562093";
    link.className = "chatbot-contact-link";
    link.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
        "<span>Llamar a Colviseg</span>";
    messageDiv.appendChild(link);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton?.addEventListener("click", () => {
    lastInputWasVoice = false;
    sendMessage();
});

chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        lastInputWasVoice = false;
        sendMessage();
    }
});

// Preguntas rápidas: envían el texto del botón como si lo escribiera la persona.
quickReplies?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-question]");
    if (!button) return;
    chatInput.value = button.dataset.question;
    lastInputWasVoice = false;
    sendMessage();
});
