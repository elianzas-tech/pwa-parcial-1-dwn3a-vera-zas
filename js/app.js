'use strict';
/*Registro del service-worker*/
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./service-worker.js");
}


/* ===================================================================
   app.js - punto de entrada de la aplicacion.

   El index.html es solo la estructura (Bootstrap). Aca vive:
     - el modelo (Tarea, Lista, GestorListas)
     - el render del sidebar (#listas-sidebar) y del panel principal
     - crear listas (con validacion) y seleccionarlas
     - avisos con toast de Bootstrap

   El cambio de tema claro/oscuro vive aparte, en js/claro_oscuro.js.
   =================================================================== */

// Una tarea suelta.
class Tarea {
  static #ultimoId = 0;   // contador compartido para generar ids unicos

  #id;
  #descripcion;
  #completada = false;

  constructor(descripcion) {
    this.#id = ++Tarea.#ultimoId;
    this.#descripcion = descripcion;
  }

  get id() { return this.#id; }

  get descripcion() { return this.#descripcion; }
  set descripcion(valor) { this.#descripcion = valor; }

  get completada() { return this.#completada; }
  set completada(valor) { this.#completada = valor; }
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
  set nombre(valor) { this.#nombre = valor; }

  // Copia, no el array real: nadie de afuera toca las tareas sin pasar
  // por estos metodos.
  get tareas() { return [...this.#tareas]; }

  agregarTarea(descripcion) {
    this.#tareas.push(new Tarea(descripcion));
  }

  eliminarTarea(id) {
    this.#tareas = this.#tareas.filter((t) => t.id !== id);
  }

  eliminarTareas(ids) {
    this.#tareas = this.#tareas.filter((t) => !ids.includes(t.id));
  }

  alternarTarea(id) {
    const tarea = this.#tareas.find((t) => t.id === id);
    if (tarea) tarea.completada = !tarea.completada;
  }

  renombrarTarea(id, descripcion) {
    const tarea = this.#tareas.find((t) => t.id === id);
    if (tarea) tarea.descripcion = descripcion;
  }

  contarTotal() { return this.#tareas.length; }
  contarPendientes() { return this.#tareas.filter((t) => !t.completada).length; }
  contarCompletadas() { return this.#tareas.filter((t) => t.completada).length; }

  tareasFiltradas(filtro) {
    if (filtro === 'pending') return this.#tareas.filter((t) => !t.completada);
    if (filtro === 'completed') return this.#tareas.filter((t) => t.completada);
    return this.tareas;   // 'all'
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
}

// ===================================================================
// Referencias al DOM
// ===================================================================

// Sidebar
const listasSidebar = document.getElementById('listas-sidebar');
const formNuevaLista = document.getElementById('form-nueva-lista');

const entradaNuevaLista = document.getElementById('entrada-nueva-lista');
entradaNuevaLista.setAttribute('aria-invalid', 'true');
entradaNuevaLista.setAttribute('aria-describedby', 'error-nueva-lista');

const errorNuevaLista = document.getElementById('error-nueva-lista');
const btnSeleccionar = document.getElementById('btn-seleccionar-listas');
const btnEditar = document.getElementById('btn-editar-listas');
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
const contenedorFormTarea = document.getElementById('contenedor-form-tarea');
const barraSeleccionTareas = document.getElementById('barra-seleccion-tareas');
const tabs = document.querySelectorAll('.tab');
const contadores = {
  all: document.getElementById('count-all'),
  pending: document.getElementById('count-pending'),
  completed: document.getElementById('count-completed'),
};

// Toast de avisos
const toastAviso = document.getElementById('toast-aviso');
const toastAvisoTexto = document.getElementById('toast-aviso-texto');
const bsToastAviso = bootstrap.Toast.getOrCreateInstance(toastAviso);

// Modal de confirmación (borrados masivos)
const modalConfirmarEl = document.getElementById('modal-confirmar');
const bsModalConfirmar = bootstrap.Modal.getOrCreateInstance(modalConfirmarEl);
const modalConfirmarTxt = document.getElementById('modal-confirmar-texto');
const btnModalConfirmar = document.getElementById('modal-confirmar-ok');

// ===================================================================
// Estado
// ===================================================================
const gestor = new GestorListas();
let filtroActivo = 'all';

let modoEdicion = false;    // "Editar" -> aparecen los lápices
let editandoLista = null;   // id de la lista con el input de renombre abierto
let editandoTarea = null;   // id de la tarea con el input de renombre abierto

let modoSeleccion = false;             // "Seleccionar" -> checkboxes
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
  toastAvisoTexto.textContent = mensaje;
  bsToastAviso.show();
}

// Botón de lápiz (icono editar): abre el input de renombre.
function crearBotonLapiz(aria, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn p-0 border-0 flex-shrink-0';
  btn.setAttribute('aria-label', aria);
  btn.append(crearIcono('editar', 'icon-md'));
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

// Botón de tilde: confirma el renombre. Al mientras se está editando, el
// lápiz se reemplaza por este. Igual se puede confirmar clickeando afuera
// (blur del input); esto es solo el atajo por ícono.
function crearBotonConfirmar(aria, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn p-0 border-0 flex-shrink-0 fs-5 lh-1 fw-bold text-success';
  btn.setAttribute('aria-label', aria);
  btn.textContent = '✓';   // ✓ tilde suelto
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

// Input inline de renombre. Enter/blur guardan; Escape cancela; vacío cancela.
function crearInputRenombre(valorInicial, onGuardar, onCancelar) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control form-control-sm flex-grow-1';
  input.value = valorInicial;
  input.addEventListener('click', (e) => e.stopPropagation());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.dataset.cancelar = '1'; input.blur(); }
  });
  input.addEventListener('blur', () => {
    const valor = input.value.trim();
    if (input.dataset.cancelar || valor === '') onCancelar();
    else onGuardar(valor);
  });

  // Foco una vez insertado en el DOM.
  requestAnimationFrame(() => { input.focus(); input.select(); });
  return input;
}

// ===================================================================
// Selección múltiple + borrado (modo "Seleccionar")
// ===================================================================

// Abre el modal de confirmación con un mensaje y un callback para el OK.
function confirmar(mensaje, onConfirmar) {
  modalConfirmarTxt.textContent = mensaje;

  const handler = () => { bsModalConfirmar.hide(); onConfirmar(); };
  btnModalConfirmar.addEventListener('click', handler, { once: true });
  modalConfirmarEl.addEventListener('hidden.bs.modal', () => {
    btnModalConfirmar.removeEventListener('click', handler);
  }, { once: true });

  bsModalConfirmar.show();
}

// Arma la barra "Seleccionar todos / Eliminar" dentro de `contenedor`.
function renderBarraSeleccion(contenedor, { visible, todosMarcados, textTodos, onTodos, onEliminar }) {
  contenedor.replaceChildren();
  contenedor.classList.toggle('d-none', !visible);
  if (!visible) return;

  const fila = document.createElement('div');
  fila.className = 'd-flex gap-2';

  // El checkbox va dentro del <label>: clickear en cualquier parte lo tilda.
  const filaTodos = document.createElement('label');
  filaTodos.className = 'btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 flex-grow-1 text-start';

  const checkTodos = document.createElement('input');
  checkTodos.type = 'checkbox';
  checkTodos.className = 'check-custom';
  checkTodos.checked = todosMarcados;
  checkTodos.addEventListener('change', onTodos);

  filaTodos.append(checkTodos, document.createTextNode(textTodos));

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-danger btn-sm d-flex align-items-center gap-2';
  btnEliminar.append(crearIcono('eliminar', 'icon-sm'), document.createTextNode('Eliminar'));
  btnEliminar.addEventListener('click', onEliminar);

  fila.append(filaTodos, btnEliminar);
  contenedor.append(fila);
}

function toggleTodasListas() {
  const ids = gestor.listas.map((l) => l.id);
  if (listasSeleccionadas.size === ids.length) listasSeleccionadas.clear();
  else ids.forEach((id) => listasSeleccionadas.add(id));
  render();
}

function toggleTodasTareas() {
  const lista = gestor.listaActiva;
  if (!lista) return;
  const ids = lista.tareas.map((t) => t.id);
  if (ids.length > 0 && tareasSeleccionadas.size === ids.length) tareasSeleccionadas.clear();
  else ids.forEach((id) => tareasSeleccionadas.add(id));
  render();
}

function eliminarListasSeleccionadas() {
  if (listasSeleccionadas.size === 0) { mostrarAviso('No seleccionaste ninguna lista'); return; }
  const todas = listasSeleccionadas.size === gestor.listas.length;
  confirmar(
    todas ? '¿Estás seguro de que querés eliminar todas las listas?'
      : '¿Estás seguro de que querés eliminar estas listas?',
    () => {
      gestor.eliminarListas([...listasSeleccionadas]);
      listasSeleccionadas.clear();
      if (!gestor.hayListas) modoSeleccion = false;
      render();
    },
  );
}

function eliminarTareasSeleccionadas() {
  const lista = gestor.listaActiva;
  if (!lista || tareasSeleccionadas.size === 0) { mostrarAviso('No seleccionaste ninguna tarea'); return; }
  const todas = tareasSeleccionadas.size === lista.contarTotal();
  confirmar(
    todas ? '¿Estás seguro de que querés eliminar todas las tareas?'
      : '¿Estás seguro de que querés eliminar estas tareas?',
    () => {
      lista.eliminarTareas([...tareasSeleccionadas]);
      tareasSeleccionadas.clear();
      render();
    },
  );
}

// ===================================================================
// Crear lista
// ===================================================================

function limpiarErrorLista() {
  entradaNuevaLista.classList.remove('is-invalid');
  errorNuevaLista.textContent = '';
}

// Bootstrap revela el <p class="invalid-feedback"> solo cuando el input
// tiene la clase .is-invalid.
function mostrarErrorLista(mensaje) {
  errorNuevaLista.textContent = mensaje;
  entradaNuevaLista.classList.add('is-invalid');
  entradaNuevaLista.focus();
}

formNuevaLista.addEventListener('submit', (e) => {
  e.preventDefault();

  // trim(): un nombre de solo espacios queda como '' -> invalido.
  const nombre = entradaNuevaLista.value.trim();
  if (nombre === '') {
    mostrarErrorLista('El nombre de tu lista no puede quedar vacío.');
    return;
  }

  limpiarErrorLista();
  gestor.agregarLista(nombre);   // queda seleccionada sola
  entradaNuevaLista.value = '';
  render();
});

entradaNuevaLista.addEventListener('input', limpiarErrorLista);

// ===================================================================
// Agregar tarea
function crearFormTarea() {
  const form = document.createElement('form');
  form.id = 'form-nueva-tarea';
  form.className = 'mb-4';

  const label = document.createElement('label');
  label.className = 'form-label mb-1';
  label.htmlFor = 'entrada-tarea';
  label.textContent = 'Agregá una nueva tarea';

  const fila = document.createElement('div');
  fila.className = 'd-flex gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'entrada-tarea';
  input.className = 'form-control';
  input.autocomplete = 'off';
  input.ariaInvalid = true;
  input.setAttribute('aria-describedby', 'error-nueva-tarea');

  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.className = 'btn btn-primary d-flex align-items-center justify-content-center gap-2 px-3 rounded-3';

  boton.append(document.createTextNode('Añadir'), crearIcono('agregar', 'icon-lg'));

  // Mensaje de error debajo del input (la fila es d-flex, así que el <p> va
  // como hijo del form, no de la fila). Se togglea a mano con .d-none.
  const error = document.createElement('p');
  error.className = 'text-danger small mt-1 mb-0 d-none';
  error.id = 'error-nueva-tarea';
  error.textContent = 'La tarea no puede estar vacía';

  fila.append(input, boton);
  form.append(label, fila, error);

  const limpiarError = () => {
    input.classList.remove('is-invalid');
    error.classList.add('d-none');
  };

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!gestor.listaActiva) return;

    const descripcion = input.value.trim();
    if (descripcion === '') {
      input.classList.add('is-invalid');   // borde rojo
      error.classList.remove('d-none');    // muestra el mensaje
      input.focus();
      return;
    }

    limpiarError();
    gestor.listaActiva.agregarTarea(descripcion);
    input.value = '';
    render();
  });

  // Al volver a escribir, saca el error.
  input.addEventListener('input', limpiarError);

  return form;
}

const formTarea = crearFormTarea();
contenedorFormTarea.append(formTarea);

// ===================================================================
// Botones "Seleccionar" y "Editar"
// ===================================================================
btnSeleccionar.addEventListener('click', () => {
  if (!gestor.hayListas) {
    mostrarAviso('No hay listas ni tareas para seleccionar');
    return;
  }
  modoSeleccion = !modoSeleccion;
  modoEdicion = false;
  editandoLista = null;
  editandoTarea = null;
  listasSeleccionadas.clear();
  tareasSeleccionadas.clear();
  btnSeleccionar.classList.toggle('active', modoSeleccion);
  btnEditar.classList.remove('active');
  render();
});

btnEditar.addEventListener('click', () => {
  if (!gestor.hayListas) {
    mostrarAviso('No hay listas ni tareas para editar');
    return;
  }
  modoEdicion = !modoEdicion;
  modoSeleccion = false;
  editandoLista = null;
  editandoTarea = null;
  listasSeleccionadas.clear();
  tareasSeleccionadas.clear();
  btnEditar.classList.toggle('active', modoEdicion);
  btnSeleccionar.classList.remove('active');
  render();
});

// ===================================================================
// Sidebar: seleccionar una lista al clickearla
// ===================================================================
listasSidebar.addEventListener('click', (e) => {
  const boton = e.target.closest('.list-group-item');
  if (!boton) return;
  gestor.seleccionarLista(Number(boton.dataset.id));
  render();
});

// ===================================================================
// Lista de tareas: borrar (sobre la lista activa).
// Marcar/desmarcar como completada ya no pasa por acá: lo maneja el propio
// checkbox en su 'change', dentro de renderTareas().
// ===================================================================
listaTareas.addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton || !gestor.listaActiva) return;

  const id = Number(boton.dataset.id);
  if (boton.dataset.accion === 'borrar') {
    const tarea = gestor.listaActiva.tareas.find((t) => t.id === id);
    if (tarea) {
      confirmar(
        `¿Estás seguro de que querés eliminar la tarea "${tarea.descripcion}"?`,
        () => {
          gestor.listaActiva.eliminarTarea(id);
          render();
        }
      );
    }
  }
});

// ===================================================================
// Render
// ===================================================================

function actualizarTabs() {
  tabs.forEach((tab) => {
    const esActivo = tab.dataset.filter === filtroActivo;
    tab.classList.toggle('active', esActivo);
    tab.setAttribute('aria-selected', esActivo ? 'true' : 'false');
  });
}

function render() {
  actualizarTabs();
  estadoSinListas.classList.toggle('d-none', gestor.hayListas);
  renderSidebar();
  renderPanel();
}

function renderSidebar() {
  listasSidebar.replaceChildren();

  const mostrarBarraListas = modoSeleccion && gestor.hayListas;
  const todasListasMarcadas = gestor.listas.length > 0 && listasSeleccionadas.size === gestor.listas.length;
  renderBarraSeleccion(barraSeleccionListas, {
    visible: mostrarBarraListas,
    todosMarcados: todasListasMarcadas,
    textTodos: todasListasMarcadas ? 'Quitar selección' : 'Seleccionar todas',
    onTodos: toggleTodasListas,
    onEliminar: eliminarListasSeleccionadas,
  });

   gestor.listas.forEach((lista) => {
    const esActiva = lista.id === gestor.listaActiva?.id;
    const base = 'list-group-item rounded-3 border';
    const relleno = esActiva ? 'active fw-semibold' : 'bg-transparent';

    if (modoSeleccion) {
      const fila = document.createElement('li');
      fila.className = `${base} ${relleno} d-flex align-items-center gap-2`;
      fila.dataset.id = lista.id;

      const idCheck = `check-lista-${lista.id}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = idCheck;
      checkbox.className = 'check-custom';
      checkbox.checked = listasSeleccionadas.has(lista.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) listasSeleccionadas.add(lista.id);
        else listasSeleccionadas.delete(lista.id);
        render();
      });

      const nombre = document.createElement('label');
      nombre.htmlFor = idCheck;
      nombre.className = 'flex-grow-1 text-truncate';
      nombre.textContent = lista.nombre;

      fila.append(checkbox, nombre);
      listasSidebar.append(fila);
      return;
    }

    // Modo edición: fila con lápiz (o input de renombre si esta lista se
    // está editando). Es un <li>, no un <button>, para poder meter el input.
    if (modoEdicion) {
      const fila = document.createElement('li');
      fila.className = `${base} ${relleno} d-flex align-items-center gap-2`;
      fila.dataset.id = lista.id;

      if (lista.id === editandoLista) {
        const input = crearInputRenombre(
          lista.nombre,
          (valor) => { gestor.renombrarLista(lista.id, valor); editandoLista = null; render(); },
          () => { editandoLista = null; render(); },
        );
        const btnConfirmar = crearBotonConfirmar('Confirmar nombre de la lista', () => {
          const valor = input.value.trim();
          if (valor !== '') {
            gestor.renombrarLista(lista.id, valor);
          }
          editandoLista = null;
          render();
        });
        fila.append(input, btnConfirmar);
      } else {
        const nombre = document.createElement('span');
        nombre.className = 'flex-grow-1 text-truncate';
        nombre.textContent = lista.nombre;
        const lapiz = crearBotonLapiz('Editar nombre de la lista', () => {
          editandoLista = lista.id;
          editandoTarea = null;
          render();
        });
        fila.append(nombre, lapiz);
      }
      listasSidebar.append(fila);
      return;
    }

    // Modo normal: enlace que navega a la lista, dentro de su <li>.
    const item = document.createElement('li');
    item.className = 'd-flex';

    const enlace = document.createElement('a');
    enlace.href = `#lista-${lista.id}`;
    enlace.className = `${base} list-group-item-action w-100 ${relleno}`;
    enlace.dataset.id = lista.id;
    enlace.textContent = lista.nombre;
    if (esActiva) enlace.setAttribute('aria-current', 'page');

    item.append(enlace);
    listasSidebar.append(item);
  });
}

function renderPanel() {
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

  contadores.all.textContent = total;
  contadores.pending.textContent = pendientes;
  contadores.completed.textContent = completadas;

  const mostrarBarraTareas = modoSeleccion && total > 0;
  const todasTareasMarcadas = total > 0 && tareasSeleccionadas.size === total;
  renderBarraSeleccion(barraSeleccionTareas, {
    visible: mostrarBarraTareas,
    todosMarcados: todasTareasMarcadas,
    textTodos: todasTareasMarcadas ? 'Quitar selección' : 'Seleccionar todas',
    onTodos: toggleTodasTareas,
    onEliminar: eliminarTareasSeleccionadas,
  });

  renderTareas();

  // "No hay tareas para mostrar" cuando la lista existe pero el filtro
  // actual no devuelve ninguna.
  const visibles = lista ? lista.tareasFiltradas(filtroActivo).length : 0;
  estadoVacio.classList.toggle('d-none', !lista || visibles > 0);
}

// Pinta las tareas de la lista activa (ya filtradas) dentro de #lista-tareas.
// Cada fila: checkbox (marca/desmarca), texto y botón de borrar.
function renderTareas() {
  listaTareas.replaceChildren();
  const lista = gestor.listaActiva;
  if (!lista) return;

  lista.tareasFiltradas(filtroActivo).forEach((tarea) => {
    const li = document.createElement('li');
    li.className = 'list-group-item bg-body border rounded-3 d-flex align-items-center gap-3';

    if (modoSeleccion) {
      const idCheck = `check-select-tarea-${tarea.id}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = idCheck;
      checkbox.className = 'check-custom';
      checkbox.checked = tareasSeleccionadas.has(tarea.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) tareasSeleccionadas.add(tarea.id);
        else tareasSeleccionadas.delete(tarea.id);
        render();
      });
      li.append(checkbox);

      const contenido = document.createElement('label');
      contenido.htmlFor = idCheck;
      contenido.className = 'flex-grow-1';
      contenido.textContent = tarea.descripcion;
      li.append(contenido);
    } else {
      const idCheck = `check-completar-${tarea.id}`;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.id = idCheck;
      check.className = 'check-custom check-completar flex-shrink-0';
      check.checked = tarea.completada;
      check.addEventListener('change', () => {
        gestor.listaActiva.alternarTarea(tarea.id);
        render();
      });

      // Texto de la tarea, o input de renombre si esta tarea se está editando.
      let contenido;
      if (modoEdicion && tarea.id === editandoTarea) {
        const input = crearInputRenombre(
          tarea.descripcion,
          (valor) => { gestor.listaActiva.renombrarTarea(tarea.id, valor); editandoTarea = null; render(); },
          () => { editandoTarea = null; render(); },
        );
        contenido = input;
        li.append(check, contenido);

        const btnConfirmar = crearBotonConfirmar('Confirmar nombre de la tarea', () => {
          const valor = input.value.trim();
          if (valor !== '') {
            gestor.listaActiva.renombrarTarea(tarea.id, valor);
          }
          editandoTarea = null;
          render();
        });
        li.append(btnConfirmar);
      } else {
        // <label for> asociado al checkbox: clickear el texto también
        // marca/desmarca la tarea como completada.
        contenido = document.createElement('label');
        contenido.htmlFor = idCheck;
        contenido.className = 'flex-grow-1';   // sin tachado: la completada se
        contenido.textContent = tarea.descripcion;   // distingue solo por el icono
        li.append(check, contenido);

        // En modo edición, lápiz para renombrar la tarea.
        if (modoEdicion) {
          li.append(crearBotonLapiz('Editar nombre de la tarea', () => {
            editandoTarea = tarea.id;
            editandoLista = null;
            render();
          }));
        }
      }

      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.className = 'btn p-0 border-0 flex-shrink-0';
      borrar.dataset.accion = 'borrar';
      borrar.dataset.id = tarea.id;
      borrar.setAttribute('aria-label', 'Eliminar tarea');
      borrar.append(crearIcono('eliminar', 'icon-lg'));

      li.append(borrar);
    }

    listaTareas.append(li);
  });
}

// ===================================================================
// Tabs de filtro (Todas, Pendientes, Completadas)
// ===================================================================
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    filtroActivo = tab.dataset.filter;
    render();
  });
});

// ===================================================================
// Arranque
// ===================================================================
mostrarFecha();
render();
