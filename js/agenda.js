const API = '/api';

let candidatos = [];
let entrevistas = [];
let editandoId = null;
let diaSeleccionado = null; // 'YYYY-MM-DD' o null

document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.querySelector('.nav-list')?.classList.toggle('open');
});

const esc = v => {
    const d = document.createElement('div');
    d.textContent = v ?? '';
    return d.innerHTML;
};

const fechaHora = (fecha, hora = '09:00') =>
    new Date(`${String(fecha).slice(0, 10)}T${String(hora).slice(0, 5)}`);

const formatFecha = v => {
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);

    return Number.isNaN(d.getTime())
        ? String(v || '')
        : d.toLocaleDateString('es-CO', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).toUpperCase();
};

const formatHora = v =>
    String(v || '09:00').slice(0, 5);

const showAlert = (m, t = 'error') => {
    const a = document.getElementById('agenda-alert');

    if (!a) return;

    a.textContent = m;
    a.className = `form-alert ${t}`;
    a.hidden = false;
};


/* =========================================================
   CARGAR CANDIDATOS
========================================================= */

async function loadCandidates() {
    try {
        const r = await fetch(
            `${API}/postulaciones?estado=APROBADO_RRHH`
        );

        const d = await r.json();

        if (!r.ok) {
            throw new Error(
                d.error || 'No se pudieron consultar postulaciones.'
            );
        }

        candidatos = d;

        const s = document.getElementById('ag-candidato');

        s.innerHTML =
            '<option value="" disabled selected>Seleccionar aspirante</option>';

        d.forEach(c => {
            const o = new Option(
                `${c.nombre_completo} · ${c.cargo}`,
                c.id_postulacion
            );

            o.dataset.nombre = c.nombre_completo;
            o.dataset.cargo = c.cargo;
            o.dataset.telefono = c.telefono || '';
            o.dataset.correo = c.correo || '';

            s.add(o);
        });

    } catch (e) {
        showAlert(e.message);
    }
}


/* =========================================================
   LISTA DE ENTREVISTAS (con filtro opcional por día)
========================================================= */

function renderEventList() {
    const list = document.getElementById('eventList');
    const title = document.getElementById('eventsTitle');
    const btnTodas = document.getElementById('btnVerTodas');

    if (!list) return;

    const visibles = diaSeleccionado
        ? entrevistas.filter(
            i => String(i.fecha_entrevista).slice(0, 10) === diaSeleccionado
        )
        : entrevistas;

    if (title) {
        title.textContent = diaSeleccionado
            ? `Entrevistas del ${formatFecha(diaSeleccionado)}`
            : 'Próximas Entrevistas';
    }

    if (btnTodas) btnTodas.hidden = !diaSeleccionado;

    list.innerHTML = visibles.length
        ? ''
        : `
        <div class="event-item">
          <div class="event-desc">
            ${diaSeleccionado
            ? 'No hay entrevistas programadas para este día.'
            : 'No hay entrevistas programadas.'}
          </div>
        </div>
      `;

    visibles.forEach(i => {
        const item = document.createElement('div');

        item.className = 'event-item';

        const estado = i.resultado || 'PROGRAMADA';

        item.innerHTML = `
        <div class="event-time">
          ${esc(formatFecha(i.fecha_entrevista))}
          ·
          ${esc(formatHora(i.hora_entrevista))}
          ·
          ${esc(i.modalidad || 'Presencial')}
        </div>

        <div class="event-name">
          ${esc(i.candidato || 'Candidato')}
        </div>

        <div class="event-desc">
          <strong>Cargo:</strong>
          ${esc(i.cargo || 'Sin cargo')}
          ·
          <strong>Estado:</strong>
          ${esc(estado)}
        </div>

        <div class="card-actions">
          <button
            class="btn-xs btn-xs-blue"
            data-reprogramar="${i.id_entrevista}">
            Reprogramar entrevista
          </button>
        </div>
      `;

        list.appendChild(item);
    });

    list.querySelectorAll('[data-reprogramar]').forEach(b => {
        b.addEventListener('click', () =>
            prepararReprogramacion(b.dataset.reprogramar)
        );
    });
}


/* =========================================================
   CARGAR ENTREVISTAS
========================================================= */

async function loadInterviews() {
    const list = document.getElementById('eventList');

    try {
        const r = await fetch(`${API}/entrevistas`);
        const d = await r.json();

        if (!r.ok) {
            throw new Error(
                d.error || 'No se pudieron consultar entrevistas.'
            );
        }

        entrevistas = d.sort(
            (a, b) =>
                fechaHora(
                    a.fecha_entrevista,
                    a.hora_entrevista
                ) -
                fechaHora(
                    b.fecha_entrevista,
                    b.hora_entrevista
                )
        );

        renderEventList();
        renderCalendar();

    } catch (e) {
        showAlert(e.message);
    }
}


/* =========================================================
   PREPARAR REPROGRAMACIÓN
========================================================= */

function prepararReprogramacion(id) {

    const i = entrevistas.find(
        x =>
            String(x.id_entrevista) ===
            String(id)
    );

    if (!i) return;

    editandoId = i.id_entrevista;

    const s =
        document.getElementById('ag-candidato');

    if (!s) return;

    let o = [...s.options].find(
        x =>
            String(x.value) ===
            String(i.id_postulacion)
    );

    /*
     * Si el candidato no existe en el select,
     * lo agregamos.
     */
    if (!o) {

        o = new Option(
            `${i.candidato || 'Candidato'} · ${i.cargo || 'Sin cargo'}`,
            i.id_postulacion
        );

        s.add(o);
    }

    /*
     * Siempre actualizamos los datos del candidato,
     * incluso si la opción ya existía.
     */
    o.dataset.nombre =
        i.candidato || '';

    o.dataset.cargo =
        i.cargo || '';

    o.dataset.telefono =
        i.telefono || '';

    o.dataset.correo =
        i.correo || '';

    /*
     * Seleccionar candidato.
     */
    s.value =
        String(i.id_postulacion);

    /*
     * Fecha.
     */
    document.getElementById(
        'ag-fecha'
    ).value =
        String(
            i.fecha_entrevista || ''
        ).slice(0, 10);

    /*
     * Hora.
     */
    document.getElementById(
        'ag-hora'
    ).value =
        formatHora(
            i.hora_entrevista
        );

    /*
     * Modalidad.
     */
    const modalidad =
        document.getElementById(
            'ag-modalidad'
        );

    if (modalidad) {

        modalidad.value =
            i.modalidad === 'Virtual'
                ? 'Virtual – Google Meet'
                : 'Presencial – Sede principal';
    }

    /*
     * Cambiar el texto del botón.
     */
    const btn =
        document.getElementById(
            'btnAgendar'
        );

    if (btn) {
        btn.textContent =
            'Guardar reprogramación';
    }

    /*
     * Llevar al formulario.
     */
    const fecha =
        document.getElementById(
            'ag-fecha'
        );

    if (fecha) {

        fecha.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        setTimeout(() => {
            fecha.focus();
        }, 500);
    }

    /*
     * Mostrar aviso.
     */
    showAlert(
        'Edita la nueva fecha y hora. Luego guarda la reprogramación.',
        'info'
    );
}

/* =========================================================
   CAMBIO DE CANDIDATO
========================================================= */

document
    .getElementById('ag-candidato')
    .addEventListener('change', e => {

        const o = e.target.selectedOptions[0];

        const cargo =
            document.getElementById('ag-cargo');

        if (o?.dataset.cargo) {

            const m = [...cargo.options].find(
                x =>
                    x.textContent
                        .trim()
                        .toLowerCase() ===
                    o.dataset.cargo
                        .trim()
                        .toLowerCase()
            );

            if (m) {
                cargo.value = m.value;
            }
        }
    });


/* =========================================================
   AGENDAR / REPROGRAMAR ENTREVISTA
========================================================= */

document
    .getElementById('btnAgendar')
    .addEventListener('click', async () => {

        const s =
            document.getElementById('ag-candidato');

        const o =
            s.selectedOptions[0];

        const postulacion = s.value;

        const candidate =
            o?.dataset.nombre ||
            o?.textContent ||
            '';

        const role =
            document.getElementById('ag-cargo').value;

        const date =
            document.getElementById('ag-fecha').value;

        const time =
            document.getElementById('ag-hora').value;

        const modality =
            document.getElementById('ag-modalidad').value;


        if (
            !postulacion ||
            !role ||
            !date ||
            !time
        ) {
            return showAlert(
                'Completa todos los campos requeridos.'
            );
        }


        /* -----------------------------------------
           FECHA Y HORA PARA EL MENSAJE
        ----------------------------------------- */

        const d =
            new Date(`${date}T${time}`);

        const dateText =
            d.toLocaleDateString('es-CO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

        const timeText =
            d.toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
            });


        const reprogramada =
            Boolean(editandoId);


        /* -----------------------------------------
           MENSAJE DE WHATSAPP
        ----------------------------------------- */

        const message = reprogramada

            ? `Hola ${candidate}, te informamos que por ajustes internos de la empresa tu entrevista fue reprogramada. La nueva fecha es el ${dateText} a las ${timeText}. Modalidad: ${modality}. Por favor confirma tu asistencia. Disculpa las molestias.`

            : `Hola ${candidate}, tu entrevista está programada para el ${dateText} a las ${timeText}. Modalidad: ${modality}. Por favor confirma tu asistencia.`;


        try {

            /* -----------------------------------------
               GUARDAR EN LA BASE DE DATOS
            ----------------------------------------- */

            const r = await fetch(
                reprogramada
                    ? `${API}/entrevistas/${editandoId}`
                    : `${API}/entrevistas`,
                {
                    method: reprogramada
                        ? 'PATCH'
                        : 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify(
                        reprogramada

                            ? {
                                fecha: date,
                                hora: time,
                                modalidad: modality,
                                observaciones:
                                    `Reprogramada por ajustes de la empresa. Nueva fecha: ${date} ${time}.`
                            }

                            : {
                                idPostulacion:
                                    Number(postulacion),

                                fecha: date,

                                hora: time,

                                modalidad: modality,

                                indicaciones:
                                    `Hora: ${time}. Modalidad: ${modality}.`
                            }
                    )
                }
            );


            const p = await r.json();


            if (!r.ok) {
                throw new Error(
                    p.error ||
                    'No fue posible guardar la entrevista.'
                );
            }


            /* -----------------------------------------
               MENSAJE DE CONFIRMACIÓN
            ----------------------------------------- */

            document
                .getElementById('notificationText')
                .textContent = reprogramada

                ? 'La entrevista fue reprogramada. Usa los botones para enviar el nuevo aviso al candidato.'

                : 'La entrevista fue programada. Usa los botones para enviar el aviso al candidato.';


            /* -----------------------------------------
               WHATSAPP
            ----------------------------------------- */

            const telefonoWhatsApp =
                String(
                    o?.dataset.telefono || ''
                ).replace(/\D/g, '');


            const numeroWhatsApp =
                telefonoWhatsApp.startsWith('57')

                    ? telefonoWhatsApp

                    : telefonoWhatsApp.length === 10

                        ? `57${telefonoWhatsApp}`

                        : '';


            const whatsappLink =
                document.getElementById(
                    'whatsappLink'
                );


            if (!numeroWhatsApp) {

                whatsappLink.removeAttribute('href');

                whatsappLink.onclick = () => {
                    showAlert(
                        'El candidato no tiene un número de teléfono válido para WhatsApp.'
                    );

                    return false;
                };

            } else {

                whatsappLink.href =
                    `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(message)}`;

                whatsappLink.onclick = null;
            }


            /* -----------------------------------------
               CORREO
            ----------------------------------------- */

            document
                .getElementById('emailLink')
                .href =
                `mailto:${o?.dataset.correo || ''}` +
                `?subject=${encodeURIComponent(
                    reprogramada
                        ? 'Entrevista reprogramada · Colviseg'
                        : 'Entrevista de selección · Colviseg'
                )}` +
                `&body=${encodeURIComponent(message)}`;


            /* -----------------------------------------
               MOSTRAR NOTIFICACIÓN
            ----------------------------------------- */

            document
                .getElementById('notificationCard')
                .hidden = false;


            editandoId = null;

            document
                .getElementById('btnAgendar')
                .textContent =
                'Agendar Entrevista';


            await Promise.all([
                loadCandidates(),
                loadInterviews()
            ]);

        } catch (e) {

            showAlert(e.message);

        }

    });


/* =========================================================
   CALENDARIO
========================================================= */

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const hoy = new Date();
let calAnio = hoy.getFullYear();
let calMes = hoy.getMonth();

const pad2 = n => String(n).padStart(2, '0');
const claveFecha = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function initCalendar() {
    const selMes = document.getElementById('calMes');
    const selAnio = document.getElementById('calAnio');

    if (!selMes || !selAnio) return;

    MESES.forEach((nombre, i) => selMes.add(new Option(nombre, i)));

    for (let y = hoy.getFullYear() - 2; y <= hoy.getFullYear() + 3; y++) {
        selAnio.add(new Option(y, y));
    }

    selMes.addEventListener('change', () => {
        calMes = Number(selMes.value);
        renderCalendar();
    });

    selAnio.addEventListener('change', () => {
        calAnio = Number(selAnio.value);
        renderCalendar();
    });

    document.getElementById('calPrev').addEventListener('click', () => {
        calMes--;
        if (calMes < 0) { calMes = 11; calAnio--; }
        renderCalendar();
    });

    document.getElementById('calNext').addEventListener('click', () => {
        calMes++;
        if (calMes > 11) { calMes = 0; calAnio++; }
        renderCalendar();
    });

    document.getElementById('calHoy').addEventListener('click', () => {
        calAnio = hoy.getFullYear();
        calMes = hoy.getMonth();
        diaSeleccionado = null;
        renderCalendar();
        renderEventList();
    });

    document.getElementById('btnVerTodas')?.addEventListener('click', () => {
        diaSeleccionado = null;
        renderCalendar();
        renderEventList();
    });

    renderCalendar();
}

function renderCalendar() {
    const cont = document.getElementById('calDays');
    const selMes = document.getElementById('calMes');
    const selAnio = document.getElementById('calAnio');

    if (!cont || !selMes || !selAnio) return;

    // Si el año navegado no está en la lista, lo agregamos
    if (![...selAnio.options].some(o => Number(o.value) === calAnio)) {
        selAnio.add(new Option(calAnio, calAnio));
        [...selAnio.options]
            .sort((a, b) => a.value - b.value)
            .forEach(o => selAnio.add(o));
    }

    selMes.value = String(calMes);
    selAnio.value = String(calAnio);

    // Conteo de entrevistas por día
    const porDia = {};
    entrevistas.forEach(i => {
        const k = String(i.fecha_entrevista).slice(0, 10);
        porDia[k] = (porDia[k] || 0) + 1;
    });

    const primerDia = new Date(calAnio, calMes, 1).getDay(); // 0 = domingo
    const diasMes = new Date(calAnio, calMes + 1, 0).getDate();
    const claveHoy = claveFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    let html = '';
    let totalMes = 0;

    for (let i = 0; i < primerDia; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    for (let d = 1; d <= diasMes; d++) {
        const k = claveFecha(calAnio, calMes, d);
        const n = porDia[k] || 0;
        totalMes += n;

        const clases = ['cal-day'];
        if (n) clases.push('has-event');
        if (k === claveHoy) clases.push('today');
        if (k === diaSeleccionado) clases.push('selected');

        const titulo = n
            ? `${d} de ${MESES[calMes]}: ${n} entrevista${n > 1 ? 's' : ''}`
            : `${d} de ${MESES[calMes]}`;

        html += `<button type="button" class="${clases.join(' ')}" data-fecha="${k}" title="${titulo}" aria-label="${titulo}">${d}</button>`;
    }

    cont.innerHTML = html;

    cont.querySelectorAll('.cal-day[data-fecha]').forEach(b => {
        b.addEventListener('click', () => {
            const k = b.dataset.fecha;

            // Clic de nuevo en el mismo día = quitar filtro
            diaSeleccionado = diaSeleccionado === k ? null : k;

            // Facilita agendar: pasa la fecha al formulario
            const inputFecha = document.getElementById('ag-fecha');
            if (inputFecha && diaSeleccionado) inputFecha.value = diaSeleccionado;

            renderCalendar();
            renderEventList();
        });
    });

    const resumen = document.getElementById('calResumen');
    if (resumen) {
        resumen.textContent = totalMes
            ? `${totalMes} entrevista${totalMes > 1 ? 's' : ''} en ${MESES[calMes].toLowerCase()}`
            : `Sin entrevistas en ${MESES[calMes].toLowerCase()}`;
    }

    document
        .getElementById('calendar')
        ?.setAttribute('aria-label', `Calendario de ${MESES[calMes]} ${calAnio}`);
}


/* =========================================================
   INICIALIZAR
========================================================= */

initCalendar();
loadCandidates();
loadInterviews();