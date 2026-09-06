'use strict';

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

  listasFiltradas(filtro) {
    if (filtro === 'pending') {
      return this.#listas.filter((l) => l.contarPendientes() > 0);
    }
    if (filtro === 'completed') {
      return this.#listas.filter((l) => l.contarCompletadas() > 0);
    }
    return this.listas; // 'all'
  }

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
const errorNuevaLista = document.getElementById('error-nueva-lista');
const btnSeleccionar = document.getElementById('btn-seleccionar-listas');
const btnEditar = document.getElementById('btn-editar-listas');
const barraSeleccionListas = document.getElementById('barra-seleccion-listas');

// Panel principal
const tituloLista = document.getElementById('titulo-lista-actual');
const fechaActual = document.getElementById('fecha-actual');
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
}

function mostrarAviso(mensaje) {
  toastAvisoTexto.textContent = mensaje;
  bsToastAviso.show();
}

// Botón de lápiz (edit.svg): abre el input de renombre.
function crearBotonLapiz(aria, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn p-0 border-0 flex-shrink-0';
  btn.setAttribute('aria-label', aria);
  const img = document.createElement('img');
  img.src = 'images/edit.svg';
  img.alt = '';
  img.width = 18;
  img.height = 18;
  btn.append(img);
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

  const btnTodos = document.createElement('button');
  btnTodos.type = 'button';
  btnTodos.className = 'btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 flex-grow-1';
  const imgTodos = document.createElement('img');
  imgTodos.src = todosMarcados ? 'images/check_box_selected.svg' : 'images/check_box_outline_blank.svg';
  imgTodos.alt = ''; imgTodos.width = 16; imgTodos.height = 16;
  btnTodos.append(imgTodos, document.createTextNode(textTodos));
  btnTodos.addEventListener('click', onTodos);

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-danger btn-sm d-flex align-items-center gap-2';
  const imgDel = document.createElement('img');
  imgDel.src = 'images/delete.svg';
  imgDel.alt = ''; imgDel.width = 16; imgDel.height = 16;
  btnEliminar.append(imgDel, document.createTextNode('Eliminar'));
  btnEliminar.addEventListener('click', onEliminar);

  fila.append(btnTodos, btnEliminar);
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
  form.className = 'mb-4 d-none';

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

  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.className = 'btn btn-primary d-flex align-items-center justify-content-center px-3 rounded-3';
  boton.setAttribute('aria-label', 'Agregar tarea');

  const icono = document.createElement('img');
  icono.src = 'images/add.svg';
  icono.alt = '';
  icono.width = 20;
  icono.height = 20;
  boton.append(icono);

  // Mensaje de error debajo del input (la fila es d-flex, así que el <p> va
  // como hijo del form, no de la fila). Se togglea a mano con .d-none.
  const error = document.createElement('p');
  error.className = 'text-danger small mt-1 mb-0 d-none';
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
  filtroActivo = 'all';
  render();
});

// ===================================================================
// Lista de tareas: marcar/desmarcar y borrar (sobre la lista activa)
// ===================================================================
listaTareas.addEventListener('click', (e) => {
  const boton = e.target.closest('button[data-accion]');
  if (!boton || !gestor.listaActiva) return;

  const id = Number(boton.dataset.id);
  if (boton.dataset.accion === 'alternar') {
    gestor.listaActiva.alternarTarea(id);
    render();
  }
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
    onEliminar: eliminarListasSeleccionadas
  });

  gestor.listasFiltradas(filtroActivo).forEach((lista) => {
    const esActiva = lista.id === gestor.listaActiva?.id;
    const base = 'list-group-item rounded-3 border';
    const relleno = esActiva ? 'active fw-semibold' : 'bg-transparent';

    if (modoSeleccion) {
      const fila = document.createElement('div');
      fila.className = `${base} ${relleno} d-flex align-items-center gap-2`;
      fila.dataset.id = lista.id;

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'btn p-0 border-0 flex-shrink-0';
      const selectIcon = document.createElement('img');
      const estaSeleccionada = listasSeleccionadas.has(lista.id);
      selectIcon.src = estaSeleccionada ? 'images/check_box_selected.svg' : 'images/check_box_outline_blank.svg';
      selectIcon.alt = '';
      selectIcon.width = 22;
      selectIcon.height = 22;
      selectBtn.append(selectIcon);
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (estaSeleccionada) {
          listasSeleccionadas.delete(lista.id);
        } else {
          listasSeleccionadas.add(lista.id);
        }
        render();
      });

      const nombre = document.createElement('span');
      nombre.className = 'flex-grow-1 text-truncate';
      nombre.textContent = lista.nombre;

      fila.append(selectBtn, nombre);
      listasSidebar.append(fila);
      return;
    }

    // Modo edición: fila con lápiz (o input de renombre si esta lista se
    // está editando). Es un <div>, no un <button>, para poder meter el input.
    if (modoEdicion) {
      const fila = document.createElement('div');
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

    // Modo normal: botón que selecciona la lista al clickearlo.
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `${base} list-group-item-action text-start ${relleno}`;
    boton.dataset.id = lista.id;
    boton.textContent = lista.nombre;
    listasSidebar.append(boton);
  });
}

function renderPanel() {
  const lista = gestor.listaActiva;

  // El form de agregar tarea solo aparece si hay una lista activa.
  formTarea.classList.toggle('d-none', !lista);

  tituloLista.textContent = lista ? lista.nombre : '';

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
    onEliminar: eliminarTareasSeleccionadas
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
      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'btn p-0 border-0 flex-shrink-0';
      const selectIcon = document.createElement('img');
      const estaSeleccionada = tareasSeleccionadas.has(tarea.id);
      selectIcon.src = estaSeleccionada ? 'images/check_box_selected.svg' : 'images/check_box_outline_blank.svg';
      selectIcon.alt = '';
      selectIcon.width = 22;
      selectIcon.height = 22;
      selectBtn.append(selectIcon);
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (estaSeleccionada) {
          tareasSeleccionadas.delete(tarea.id);
        } else {
          tareasSeleccionadas.add(tarea.id);
        }
        render();
      });
      li.append(selectBtn);

      const contenido = document.createElement('span');
      contenido.className = 'flex-grow-1';
      contenido.textContent = tarea.descripcion;
      li.append(contenido);
    } else {
      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'btn p-0 border-0 flex-shrink-0';
      check.dataset.accion = 'alternar';
      check.dataset.id = tarea.id;
      check.setAttribute('aria-label', tarea.completada ? 'Marcar como pendiente' : 'Marcar como completada');
      const iconoCheck = document.createElement('img');
      iconoCheck.src = tarea.completada ? 'images/check_box_completed.svg' : 'images/check_box_outline_blank.svg';
      iconoCheck.alt = '';
      iconoCheck.width = 22;
      iconoCheck.height = 22;
      check.append(iconoCheck);

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
        contenido = document.createElement('span');
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
      const iconoBorrar = document.createElement('img');
      iconoBorrar.src = 'images/delete.svg';
      iconoBorrar.alt = '';
      iconoBorrar.width = 20;
      iconoBorrar.height = 20;
      borrar.append(iconoBorrar);

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
