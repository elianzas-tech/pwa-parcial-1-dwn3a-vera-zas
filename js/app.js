'use strict';
/*Registro del service-worker*/
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./service-worker.js");
}


/* ===================================================================
   app.js - punto de entrada de la aplicacion.

   El index.html es solo la estructura (Bootstrap). Aca vive:
     - el modelo (Tarea, Lista, GestorListas)
     - el renderizado de la barra lateral (#listas-barra-lateral) y del panel principal
     - crear listas (con validacion) y seleccionarlas
     - avisos con toast de Bootstrap

   El cambio de tema claro/oscuro vive aparte, en js/claro-oscuro.js.
   =================================================================== */

// Una tarea suelta.
class Tarea {
  #id;
  #descripcion;
  #completada = false;

  constructor(descripcion) {
    this.#id = crypto.randomUUID();
    this.#descripcion = descripcion;
  }

  get id() { return this.#id; }

  get descripcion() { return this.#descripcion; }
  set descripcion(valor) { this.#descripcion = valor; }

  get completada() { return this.#completada; }
  set completada(valor) { this.#completada = valor; }
  
  alternarCompletada() {
    this.completada = !this.completada; 
  }

  renombrarDescripcion(nuevaDescripcion) {
    this.descripcion = nuevaDescripcion; 
  }
}

// Una lista, con sus tareas adentro.
class Lista {
  static #ultimoId = 0;

  #id;
  #nombre;
  #tareas = [];

  constructor(nombre) {
    this.#id = ++Lista.#ultimoId;
    this.#nombre = nombre;
  }

  get id() { return this.#id; }
  get nombre() { return this.#nombre; }
  get tareas() { return [...this.#tareas]; }

  set nombre(valor) { this.#nombre = valor; }

  agregarTarea(descripcion) {
    this.#tareas.push(new Tarea(descripcion));
  }

  eliminarTareas(ids) {
    this.#tareas = this.#tareas.filter((t) => !ids.includes(t.id));
  }

  // Vuelve a un estado anterior de las tareas ("Deshacer"). 
  restaurarTareas(tareas) {
    const nuevas = this.#tareas.filter((t) => !tareas.includes(t));
    this.#tareas = [...tareas, ...nuevas];
  }

  alternarTarea(id) {
    const tarea = this.#tareas.find((t) => t.id === id);
    if (tarea) tarea.alternarCompletada();
  }

  renombrarTarea(id, descripcion) {
    const tarea = this.#tareas.find((t) => t.id === id);
    if (tarea) tarea.renombrarDescripcion(descripcion);
  }

  contarTotal() { return this.#tareas.length; }
  contarPendientes() { return this.#tareas.filter((t) => !t.completada).length; }
  contarCompletadas() { return this.#tareas.filter((t) => t.completada).length; }

  tareasFiltradas(filtro) {
    if (filtro === 'pendientes') return this.#tareas.filter((t) => !t.completada);
    if (filtro === 'completadas') return this.#tareas.filter((t) => t.completada);
    return this.tareas;   // 'todas'
  }
}

// El gestor: junta todas las listas y sabe cual esta activa.
class GestorListas {
  #listas = [];
  #idListaActiva = null;

  get listas() { return [...this.#listas]; }
  get hayListas() { return this.#listas.length > 0; }

  get listaActiva() {
    return this.#listas.find((l) => l.id === this.#idListaActiva) ?? null;
  }

  agregarLista(nombre) {
    const lista = new Lista(nombre);
    this.#listas.push(lista);
    this.#idListaActiva = lista.id;   // la nueva queda seleccionada
    return lista;
  }

  seleccionarLista(id) {
    if (this.#listas.some((l) => l.id === id)) this.#idListaActiva = id;
  }

  renombrarLista(id, nombre) {
    const lista = this.#listas.find((l) => l.id === id);
    if (lista) lista.nombre = nombre;
  }

  eliminarLista(id) {
    this.#listas = this.#listas.filter((l) => l.id !== id);
    if (this.#idListaActiva === id) {
      this.#idListaActiva = this.#listas[0]?.id ?? null;
    }
  }

  eliminarListas(ids) {
    this.#listas = this.#listas.filter((l) => !ids.includes(l.id));
    if (!this.#listas.some((l) => l.id === this.#idListaActiva)) {
      this.#idListaActiva = this.#listas[0]?.id ?? null;
    }
  }

  // Vuelve a un estado anterior de las listas ("Deshacer"), incluida la
  // lista activa. Las listas creadas después de ese estado se conservan al final.
  restaurarListas(listas, idActiva) {
    const nuevas = this.#listas.filter((l) => !listas.includes(l));
    this.#listas = [...listas, ...nuevas];
    this.#idListaActiva = idActiva;
  }
}

// ===================================================================
// Referencias al DOM
// ===================================================================

// Barra lateral
const listasBarraLateral = document.getElementById('listas-barra-lateral');
const formularioNuevaLista = document.getElementById('formulario-nueva-lista');

const entradaNuevaLista = document.getElementById('entrada-nueva-lista');
entradaNuevaLista.setAttribute('aria-invalid', 'true');
entradaNuevaLista.setAttribute('aria-describedby', 'error-nueva-lista');

const errorNuevaLista = document.getElementById('error-nueva-lista');
const botonSeleccionarListas = document.getElementById('boton-seleccionar-listas');
const botonSeleccionarTareas = document.getElementById('boton-seleccionar-tareas');
const botonEditar = document.getElementById('boton-editar-listas');
const barraSeleccionListas = document.getElementById('barra-seleccion-listas');

// Panel principal
const encabezadoLista = document.getElementById('encabezado-lista');

// Título de la lista activa y fecha: los crea el JS y los mete en #encabezado-lista.
const tituloLista = document.createElement('h3');
tituloLista.className = 'h4 fw-bold mb-1';

const fechaActual = document.createElement('p');
fechaActual.className = 'small text-body-secondary mb-0';

const seccionTareas = document.getElementById('seccion-tareas');
const listaTareas = document.getElementById('lista-tareas');
const estadoSinListas = document.getElementById('estado-sin-listas');
const estadoVacio = document.getElementById('estado-vacio');
const contenedorFormularioTarea = document.getElementById('contenedor-formulario-tarea');
const barraSeleccionTareas = document.getElementById('barra-seleccion-tareas');
const pestanas = document.querySelectorAll('.pestana');
const contadores = {
  todas: document.getElementById('contador-todas'),
  pendientes: document.getElementById('contador-pendientes'),
  completadas: document.getElementById('contador-completadas'),
};

// Toast de avisos
const elementoAviso = document.getElementById('notificacion-aviso');
const textoAviso = document.getElementById('notificacion-aviso-texto');
const notificacionAviso = bootstrap.Toast.getOrCreateInstance(elementoAviso);

// Toast de "Deshacer" (eliminar tareas y listas)
const elementoDeshacer = document.getElementById('notificacion-deshacer');
const textoDeshacer = document.getElementById('notificacion-deshacer-texto');
const botonDeshacer = document.getElementById('notificacion-deshacer-boton');
const notificacionDeshacer = bootstrap.Toast.getOrCreateInstance(elementoDeshacer);

// ===================================================================
// Estado
// ===================================================================
const gestor = new GestorListas();
let filtroActivo = 'todas';

let modoEdicion = false;    // "Editar" 
let editandoLista = null;   // id de la lista con el input de renombre abierto
let editandoTarea = null;   // id de la tarea con el input de renombre abierto

// Cada zona tiene su propio selector: se pueden usar por separado.
let modoSeleccionListas = false;       // "Seleccionar" de la barra lateral
let modoSeleccionTareas = false;       // "Seleccionar" del panel 
const listasSeleccionadas = new Set(); // ids de listas tildadas
const tareasSeleccionadas = new Set(); // ids de tareas tildadas

function mostrarFecha() {
  const hoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  fechaActual.textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
  encabezadoLista.append(fechaActual);
}

function mostrarAviso(mensaje) {
  textoAviso.textContent = mensaje;
  notificacionAviso.show();
}

// Mientras el toast está abierto, los borrados del mismo origen se agrupan
// en un lote: el texto suma la cantidad y "Deshacer" los devuelve todos.
let lote = null; // { origen, cantidad, restaurar }

botonDeshacer.addEventListener('click', () => {
  if (!lote) return;
  lote.restaurar();
  lote = null;
  notificacionDeshacer.hide();
  renderizar();
});

// Al cerrarse el toast (solo o con la X) el lote termina.
elementoDeshacer.addEventListener('hidden.bs.toast', () => { lote = null; });

// Suma un borrado al lote abierto, o abre uno nuevo si cambió el origen.
function avisarBorrado(origen, restaurar, nombres, palabra) {
  if (!lote || lote.origen !== origen) {
    lote = { origen, cantidad: 0, restaurar };
  }
  lote.cantidad += nombres.length;

  const Palabra = palabra.charAt(0).toUpperCase() + palabra.slice(1);
  textoDeshacer.textContent = lote.cantidad === 1
    ? `${Palabra} "${nombres[0]}" eliminada`
    : `${lote.cantidad} ${palabra}s eliminadas`;
  notificacionDeshacer.show();
}

function eliminarTareasConDeshacer(lista, ids) {
  const borradas = lista.tareas.filter((t) => ids.includes(t.id));
  if (borradas.length === 0) return;

  const anteriores = lista.tareas;
  lista.eliminarTareas(ids);
  renderizar();

  avisarBorrado(lista, () => lista.restaurarTareas(anteriores),
    borradas.map((t) => t.descripcion), 'tarea');
}

function eliminarListasConDeshacer(ids) {
  const borradas = gestor.listas.filter((l) => ids.includes(l.id));
  if (borradas.length === 0) return;

  const anteriores = gestor.listas; 
  const idActiva = gestor.listaActiva?.id ?? null;
  gestor.eliminarListas(ids);
  if (!gestor.hayListas) modoSeleccionListas = false;
  // Si cambió la lista activa, las tareas tildadas eran de la anterior.
  if (gestor.listaActiva?.id !== idActiva) tareasSeleccionadas.clear();
  renderizar();

  avisarBorrado(gestor, () => gestor.restaurarListas(anteriores, idActiva),
    borradas.map((l) => l.nombre), 'lista');
}


// Botón de lápiz (icono editar): abre el input de renombre.
function crearBotonLapiz(aria, alHacerClic) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn p-0 border-0 flex-shrink-0';
  boton.setAttribute('aria-label', aria);
  boton.append(crearIcono('editar', 'icono-md'));
  boton.addEventListener('click', (e) => { e.stopPropagation(); alHacerClic(); });
  return boton;
}

// Botón de tilde: confirma el renombre.
function crearBotonConfirmar(aria, alHacerClic) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn p-0 border-0 flex-shrink-0 fs-5 lh-1 fw-bold text-success';
  boton.setAttribute('aria-label', aria);
  boton.textContent = '✓';
  boton.addEventListener('click', (e) => { e.stopPropagation(); alHacerClic(); });
  return boton;
}

// Input inline de renombre. Enter/blur guardan; Escape cancela; vacío cancela.
function crearEntradaRenombre(valorInicial, alGuardar, alCancelar) {
  const label = document.createElement('label');
  label.className = 'form-label d-none';
  label.htmlFor = 'editar-texto';
  label.textContent = 'Edita el texto';

  const entrada = document.createElement('input');
  entrada.type = 'text';
  entrada.id = 'editar-texto';
  entrada.className = 'form-control form-control-sm flex-grow-1';
  entrada.value = valorInicial;
  entrada.addEventListener('click', (e) => e.stopPropagation());

  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); entrada.blur(); }
    if (e.key === 'Escape') { entrada.dataset.cancelar = '1'; entrada.blur(); }
  });
  entrada.addEventListener('blur', () => {
    const valor = entrada.value.trim();
    if (entrada.dataset.cancelar || valor === ''){
      alCancelar();
    } else { 
      alGuardar(valor); 
    }
  });

  // Foco una vez insertado en el DOM.
  requestAnimationFrame(() => { entrada.focus(); entrada.select(); });
  return entrada;
}

// ===================================================================
// Selección múltiple + borrado (modo "Seleccionar")
// ===================================================================

// Arma la barra "Seleccionar todos / Eliminar" dentro de `contenedor`.
function renderizarBarraSeleccion(contenedor, { visible, todosMarcados, textoTodos, alTodos, alEliminar }) {
  contenedor.replaceChildren();
  contenedor.classList.toggle('d-none', !visible);
  if (!visible) return;

  const fila = document.createElement('div');
  fila.className = 'd-flex gap-2';

  // El checkbox va dentro del <label>: clickear en cualquier parte lo tilda.
  const filaTodos = document.createElement('label');
  filaTodos.className = 'btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 flex-grow-1 text-start';

  const casillaTodos = document.createElement('input');
  casillaTodos.type = 'checkbox';
  casillaTodos.className = 'casilla-personalizada';
  casillaTodos.checked = todosMarcados;
  casillaTodos.addEventListener('change', alTodos);

  filaTodos.append(casillaTodos, document.createTextNode(textoTodos));

  const botonEliminar = document.createElement('button');
  botonEliminar.type = 'button';
  botonEliminar.className = 'btn btn-danger btn-sm d-flex align-items-center gap-2';
  botonEliminar.append(crearIcono('eliminar', 'icono-sm'), document.createTextNode('Eliminar'));
  botonEliminar.addEventListener('click', alEliminar);

  fila.append(filaTodos, botonEliminar);
  contenedor.append(fila);
}

function alternarTodasListas() {
  const ids = gestor.listas.map((l) => l.id);
  if (listasSeleccionadas.size === ids.length){
    listasSeleccionadas.clear();
  } else {
    ids.forEach((id) => listasSeleccionadas.add(id));
  }
  renderizar();
}

function alternarTodasTareas() {
  const lista = gestor.listaActiva;
  if (!lista) return;
  const ids = lista.tareas.map((t) => t.id);
  if (ids.length > 0 && tareasSeleccionadas.size === ids.length){
    tareasSeleccionadas.clear();
  } else {
    ids.forEach((id) => tareasSeleccionadas.add(id));
  } 
  renderizar();
}

function eliminarListasSeleccionadas() {
  if (listasSeleccionadas.size === 0) { mostrarAviso('No seleccionaste ninguna lista'); return; }
  const ids = [...listasSeleccionadas];
  listasSeleccionadas.clear();
  eliminarListasConDeshacer(ids);
}

function eliminarTareasSeleccionadas() {
  const lista = gestor.listaActiva;
  if (!lista || tareasSeleccionadas.size === 0) { mostrarAviso('No seleccionaste ninguna tarea'); return; }
  const ids = [...tareasSeleccionadas];
  tareasSeleccionadas.clear();
  eliminarTareasConDeshacer(lista, ids);
}

// ===================================================================
// Crear lista
// ===================================================================

function limpiarErrorLista() {
  entradaNuevaLista.classList.remove('is-invalid');
  errorNuevaLista.textContent = '';
}

function mostrarErrorLista(mensaje) {
  errorNuevaLista.textContent = mensaje;
  entradaNuevaLista.classList.add('is-invalid');
  entradaNuevaLista.focus();
}

formularioNuevaLista.addEventListener('submit', (e) => {
  e.preventDefault();

  const nombre = entradaNuevaLista.value.trim();
  if (nombre === '') {
    mostrarErrorLista('El nombre de tu lista no puede quedar vacío.');
    return;
  }

  limpiarErrorLista();
  gestor.agregarLista(nombre);  
  entradaNuevaLista.value = '';
  renderizar();
});

entradaNuevaLista.addEventListener('input', limpiarErrorLista);

// ===================================================================
// Agregar tarea
function crearFormularioTarea() {
  const formulario = document.createElement('form');
  formulario.id = 'formulario-nueva-tarea';
  formulario.className = 'mb-4';

  const etiqueta = document.createElement('label');
  etiqueta.className = 'form-label mb-1';
  etiqueta.htmlFor = 'entrada-tarea';
  etiqueta.textContent = 'Agregá una nueva tarea';

  const fila = document.createElement('div');
  fila.className = 'd-flex gap-2';

  const entrada = document.createElement('input');
  entrada.type = 'text';
  entrada.id = 'entrada-tarea';
  entrada.className = 'form-control';
  entrada.autocomplete = 'off';
  entrada.ariaInvalid = true;
  entrada.setAttribute('aria-describedby', 'error-nueva-tarea');

  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.className = 'btn btn-primary d-flex align-items-center justify-content-center gap-2 px-3 rounded-3';

  boton.append(document.createTextNode('Añadir'), crearIcono('agregar', 'icono-lg'));

  const error = document.createElement('p');
  error.className = 'text-danger small mt-1 mb-0 d-none';
  error.id = 'error-nueva-tarea';
  error.textContent = 'La tarea no puede estar vacía';

  fila.append(entrada, boton);
  formulario.append(etiqueta, fila, error);

  const limpiarError = () => {
    entrada.classList.remove('is-invalid');
    error.classList.add('d-none');
  };

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!gestor.listaActiva) return;

    const descripcion = entrada.value.trim();
    if (descripcion === '') {
      entrada.classList.add('is-invalid');
      error.classList.remove('d-none');
      entrada.focus();
      return;
    }

    limpiarError();
    gestor.listaActiva.agregarTarea(descripcion);
    entrada.value = '';
    renderizar();
  });

  // Al volver a escribir, saca el error.
  entrada.addEventListener('input', limpiarError);

  return formulario;
}

const formularioTarea = crearFormularioTarea();
contenedorFormularioTarea.append(formularioTarea);

// ===================================================================
// Botones "Seleccionar" y "Editar"
// ===================================================================
botonSeleccionarListas.addEventListener('click', () => {
  if (!modoSeleccionListas && !gestor.hayListas) {
    mostrarAviso('No hay listas para seleccionar');
    return;
  }
  modoSeleccionListas = !modoSeleccionListas;
  modoEdicion = false;
  editandoLista = null;
  editandoTarea = null;
  listasSeleccionadas.clear();
  renderizar();
});

botonSeleccionarTareas.addEventListener('click', () => {
  if (!modoSeleccionTareas && !gestor.listaActiva?.contarTotal()) {
    mostrarAviso('No hay tareas para seleccionar');
    return;
  }
  modoSeleccionTareas = !modoSeleccionTareas;
  modoEdicion = false;
  editandoLista = null;
  editandoTarea = null;
  tareasSeleccionadas.clear();
  renderizar();
});

botonEditar.addEventListener('click', () => {
  if (!gestor.hayListas) {
    mostrarAviso('No hay listas ni tareas para editar');
    return;
  }
  modoEdicion = !modoEdicion;
  modoSeleccionListas = false;
  modoSeleccionTareas = false;
  editandoLista = null;
  editandoTarea = null;
  listasSeleccionadas.clear();
  tareasSeleccionadas.clear();
  renderizar();
});

// ===================================================================
// Barra lateral: abrir una lista al clickearla
// ===================================================================
listasBarraLateral.addEventListener('click', (e) => {
  if (modoSeleccionListas) return;
  const boton = e.target.closest('.list-group-item');
  if (!boton) return;
  gestor.seleccionarLista(Number(boton.dataset.id));
  tareasSeleccionadas.clear();
  renderizar();
});

// ===================================================================
// Lista de tareas: borrar (sobre la lista activa).
// ===================================================================
listaTareas.addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton || !gestor.listaActiva) return;

  const id = boton.dataset.id;
  if (boton.dataset.accion === 'borrar') {
    eliminarTareasConDeshacer(gestor.listaActiva, [id]);
  }
});

// ===================================================================
// Renderizado
// ===================================================================

function actualizarPestanas() {
  pestanas.forEach((pestana) => {
    const esActivo = pestana.dataset.filtro === filtroActivo;
    pestana.classList.toggle('active', esActivo);
    pestana.setAttribute('aria-selected', esActivo ? 'true' : 'false');
  });
}

function actualizarBotonesModo() {
  [
    [botonSeleccionarListas, modoSeleccionListas],
    [botonSeleccionarTareas, modoSeleccionTareas],
    [botonEditar, modoEdicion],
  ].forEach(([boton, activo]) => {
    boton.classList.toggle('active', activo);
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
  });
}

function renderizar() {
  actualizarPestanas();
  actualizarBotonesModo();
  estadoSinListas.classList.toggle('d-none', gestor.hayListas);
  renderizarBarraLateral();
  renderizarPanel();
}

function renderizarBarraLateral() {
  listasBarraLateral.replaceChildren();

  const mostrarBarraListas = modoSeleccionListas && gestor.hayListas;
  const todasListasMarcadas = gestor.listas.length > 0 && listasSeleccionadas.size === gestor.listas.length;
  renderizarBarraSeleccion(barraSeleccionListas, {
    visible: mostrarBarraListas,
    todosMarcados: todasListasMarcadas,
    textoTodos: todasListasMarcadas ? 'Quitar selección' : 'Seleccionar todas',
    alTodos: alternarTodasListas,
    alEliminar: eliminarListasSeleccionadas,
  });

   gestor.listas.forEach((lista) => {
    const esActiva = lista.id === gestor.listaActiva?.id;
    const base = 'list-group-item rounded-3 border';
    const relleno = esActiva ? 'active fw-semibold' : 'bg-transparent';

    if (modoSeleccionListas) {
      const fila = document.createElement('li');
      fila.className = `${base} ${relleno} d-flex align-items-center gap-2`;
      fila.dataset.id = lista.id;

      const idCasilla = `casilla-lista-${lista.id}`;
      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.id = idCasilla;
      casilla.className = 'casilla-personalizada';
      casilla.checked = listasSeleccionadas.has(lista.id);
      casilla.addEventListener('change', () => {
        if (casilla.checked) listasSeleccionadas.add(lista.id);
        else listasSeleccionadas.delete(lista.id);
        renderizar();
      });

      const nombre = document.createElement('label');
      nombre.htmlFor = idCasilla;
      nombre.className = 'flex-grow-1 text-truncate';
      nombre.textContent = lista.nombre;

      fila.append(casilla, nombre);
      listasBarraLateral.append(fila);
      return;
    }

    // Modo edición
    if (modoEdicion) {
      const fila = document.createElement('li');
      fila.className = `${base} ${relleno} d-flex align-items-center gap-2`;
      fila.dataset.id = lista.id;

      if (lista.id === editandoLista) {
        const entrada = crearEntradaRenombre(
          lista.nombre,
          (valor) => { gestor.renombrarLista(lista.id, valor); editandoLista = null; renderizar(); },
          () => { editandoLista = null; renderizar(); },
        );
        const botonConfirmar = crearBotonConfirmar('Confirmar nombre de la lista', () => {
          const valor = entrada.value.trim();
          if (valor !== '') {
            gestor.renombrarLista(lista.id, valor);
          }
          editandoLista = null;
          renderizar();
        });
        fila.append(entrada, botonConfirmar);
      } else {
        const nombre = document.createElement('span');
        nombre.className = 'flex-grow-1 text-truncate';
        nombre.textContent = lista.nombre;
        const lapiz = crearBotonLapiz('Editar nombre de la lista', () => {
          editandoLista = lista.id;
          editandoTarea = null;
          renderizar();
        });
        fila.append(nombre, lapiz);
      }
      listasBarraLateral.append(fila);
      return;
    }

    // Modo normal
    const elemento = document.createElement('li');
    elemento.className = 'd-flex';

    const enlace = document.createElement('a');
    enlace.href = `#lista-${lista.id}`;
    enlace.className = `${base} list-group-item-action w-100 ${relleno}`;
    enlace.dataset.id = lista.id;
    enlace.textContent = lista.nombre;
    if (esActiva) enlace.setAttribute('aria-current', 'page');

    elemento.append(enlace);
    listasBarraLateral.append(elemento);
  });
}

function renderizarPanel() {
  const lista = gestor.listaActiva;

  // La sección de tareas (filtros, form y lista) solo aparece si hay una lista activa.
  seccionTareas.classList.toggle('d-none', !lista);

  // El título solo existe en la página si hay una lista activa.
  if (lista) {
    tituloLista.textContent = lista.nombre;
    encabezadoLista.prepend(tituloLista);
  } else {
    tituloLista.remove();
  }

  const total = lista ? lista.contarTotal() : 0;
  const pendientes = lista ? lista.contarPendientes() : 0;
  const completadas = lista ? lista.contarCompletadas() : 0;

  contadores.todas.textContent = total;
  contadores.pendientes.textContent = pendientes;
  contadores.completadas.textContent = completadas;

  const mostrarBarraTareas = modoSeleccionTareas && total > 0;
  const todasTareasMarcadas = total > 0 && tareasSeleccionadas.size === total;
  renderizarBarraSeleccion(barraSeleccionTareas, {
    visible: mostrarBarraTareas,
    todosMarcados: todasTareasMarcadas,
    textoTodos: todasTareasMarcadas ? 'Quitar selección' : 'Seleccionar todas',
    alTodos: alternarTodasTareas,
    alEliminar: eliminarTareasSeleccionadas,
  });

  renderizarTareas();

  // "No hay tareas para mostrar"
  const visibles = lista ? lista.tareasFiltradas(filtroActivo).length : 0;
  estadoVacio.classList.toggle('d-none', !lista || visibles > 0);
}

function renderizarTareas() {
  listaTareas.replaceChildren();
  const lista = gestor.listaActiva;
  if (!lista) return;

  lista.tareasFiltradas(filtroActivo).forEach((tarea) => {
    const li = document.createElement('li');
    li.className = 'list-group-item bg-body border rounded-3 d-flex align-items-center gap-3';

    if (modoSeleccionTareas) {
      const idCasilla = `casilla-seleccion-tarea-${tarea.id}`;
      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.id = idCasilla;
      casilla.className = 'casilla-personalizada';
      casilla.checked = tareasSeleccionadas.has(tarea.id);
      casilla.addEventListener('change', () => {
        if (casilla.checked) tareasSeleccionadas.add(tarea.id);
        else tareasSeleccionadas.delete(tarea.id);
        renderizar();
      });
      li.append(casilla);

      const contenido = document.createElement('label');
      contenido.htmlFor = idCasilla;
      contenido.className = 'flex-grow-1';
      contenido.textContent = tarea.descripcion;
      li.append(contenido);
    } else {
      const idCasilla = `casilla-completar-${tarea.id}`;
      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.id = idCasilla;
      casilla.className = 'casilla-personalizada casilla-completar flex-shrink-0';
      casilla.checked = tarea.completada;
      casilla.addEventListener('change', () => {
        gestor.listaActiva.alternarTarea(tarea.id);
        renderizar();
      });

      // Texto de la tarea, o entrada de renombre si esta tarea se está editando.
      let contenido;
      if (modoEdicion && tarea.id === editandoTarea) {
        const entrada = crearEntradaRenombre(
          tarea.descripcion,
          (valor) => { gestor.listaActiva.renombrarTarea(tarea.id, valor); editandoTarea = null; renderizar(); },
          () => { editandoTarea = null; renderizar(); },
        );
        contenido = entrada;
        li.append(casilla, contenido);

        const botonConfirmar = crearBotonConfirmar('Confirmar nombre de la tarea', () => {
          const valor = entrada.value.trim();
          if (valor !== '') {
            gestor.listaActiva.renombrarTarea(tarea.id, valor);
          }
          editandoTarea = null;
          renderizar();
        });
        li.append(botonConfirmar);
      } else {
        contenido = document.createElement('label');
        contenido.htmlFor = idCasilla;
        contenido.className = 'flex-grow-1';  
        contenido.textContent = tarea.descripcion;   
        li.append(casilla, contenido);

        if (modoEdicion) {
          li.append(crearBotonLapiz('Editar nombre de la tarea', () => {
            editandoTarea = tarea.id;
            editandoLista = null;
            renderizar();
          }));
        }
      }

      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.className = 'btn p-0 border-0 flex-shrink-0';
      borrar.dataset.accion = 'borrar';
      borrar.dataset.id = tarea.id;
      borrar.setAttribute('aria-label', 'Eliminar tarea');
      borrar.append(crearIcono('eliminar', 'icono-lg'));

      li.append(borrar);
    }

    listaTareas.append(li);
  });
}

// ===================================================================
// Pestañas de filtro (Todas, Pendientes, Completadas)
// ===================================================================
pestanas.forEach((pestana) => {
  pestana.addEventListener('click', () => {
    filtroActivo = pestana.dataset.filtro;
    renderizar();
  });
});

// ===================================================================
// Arranque
// ===================================================================
mostrarFecha();
renderizar();

// ===================================================================
// Instalación de la PWA
// ===================================================================
const botonInstalar = document.querySelector('#instalador');
let eventoInstalacion = null;

window.addEventListener('beforeinstallprompt', (evento) => {
  // Evita el aviso automático del navegador; usamos nuestro botón.
  evento.preventDefault();
  eventoInstalacion = evento;
  botonInstalar.hidden = false;
});

// El click se registra una sola vez, fuera del evento.
botonInstalar.addEventListener('click', async () => {
  if (!eventoInstalacion) return;

  // Se oculta antes de abrir el diálogo para que no haya un segundo click.
  botonInstalar.hidden = true;

  // prompt() solo puede usarse una vez por evento.
  const evento = eventoInstalacion;
  eventoInstalacion = null;

  await evento.prompt();
  await evento.userChoice;
});

// Si la app se instala (desde el botón o desde el menú del navegador), el botón no vuelve.
window.addEventListener('appinstalled', () => {
  eventoInstalacion = null;
  botonInstalar.hidden = true;
});
