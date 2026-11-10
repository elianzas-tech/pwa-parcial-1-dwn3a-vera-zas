/* ===================================================================
   Compartir la lista activa
   - Como texto: usa la Web Share API (navigator.share), que abre el menú
     nativo del sistema (WhatsApp, correo, mensajes, redes sociales...).
     Si el navegador no la soporta, abre un modal con el texto, un botón
     para copiarlo y enlaces para WhatsApp, Facebook, Instagram y correo.
   - Como archivo .txt: comparte un File con navigator.share, verificando
     antes con navigator.canShare. Si no se puede, descarga el archivo.
   - Depende de "gestor" (js/app.js), por eso se carga después.
   =================================================================== */
const opcionCompartirTexto = document.getElementById('opcion-compartir-texto');
const opcionCompartirArchivo = document.getElementById('opcion-compartir-archivo');
const modalCompartir = document.getElementById('modal-compartir');
const textoModalCompartir = document.getElementById('texto-modal-compartir');
const botonCopiarCompartir = document.getElementById('boton-copiar-compartir');
const enlacesCompartir = {
  whatsapp: document.getElementById('enlace-whatsapp'),
  facebook: document.getElementById('enlace-facebook'),
  instagram: document.getElementById('enlace-instagram'),
  correo: document.getElementById('enlace-correo'),
};

// Arma el texto que se comparte: nombre de la lista, tareas y progreso.
function armarTextoLista(lista) {
  const tareas = lista.tareas;
  const lineas = tareas.map((t) => `${t.completada ? '✅' : '⬜'} ${t.descripcion}`);

  return [
    `📋 DOIT - Lista: ${lista.nombre}`,
    '',
    ...(lineas.length > 0 ? lineas : ['(sin tareas)']),
    '',
    `${lista.contarCompletadas()} de ${tareas.length} completadas`,
  ].join('\n');
}

// Alternativa sin Web Share API: completa el modal y lo muestra.
function abrirModalCompartir({ title, text }) {
  const titulo = encodeURIComponent(title);
  const texto = encodeURIComponent(text);
  // Facebook solo permite compartir un enlace, no texto: se usa el de la app.
  const enlace = encodeURIComponent(location.href);

  textoModalCompartir.value = text;
  enlacesCompartir.whatsapp.href = `https://wa.me/?text=${texto}`;
  enlacesCompartir.facebook.href = `https://www.facebook.com/sharer/sharer.php?u=${enlace}`;
  enlacesCompartir.correo.href = `mailto:?subject=${titulo}&body=${texto}`;
  // Instagram no tiene enlace para compartir texto: su href fijo abre los
  // mensajes directos y al hacer clic se copia el texto (ver más abajo).

  bootstrap.Modal.getOrCreateInstance(modalCompartir).show();
}

async function compartirLista() {
  const lista = gestor.listaActiva;
  if (!lista) return;

  // Sin "url": se comparte solo el texto de la lista, que es lo que importa.
  const datos = {
    title: `DOIT - Lista: ${lista.nombre}`,
    text: armarTextoLista(lista),
  };

  if (!navigator.share) {
    abrirModalCompartir(datos);
    return;
  }

  try {
    await navigator.share(datos);
  } catch (error) {
    // AbortError = el usuario cerró el menú sin compartir: no es un error.
    if (error.name !== 'AbortError') abrirModalCompartir(datos);
  }
}

// Nombre de archivo a partir del nombre de la lista: "Súper 2" -> "DOIT_Lista_súper-2.txt".
function nombreArchivo(lista) {
  const base = lista.nombre
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `DOIT_Lista_${base || 'sin-nombre'}.txt`;
}

// Alternativa cuando no se pueden compartir archivos: se descarga.
function descargarArchivo(archivo) {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.name;
  enlace.click();
  // Se libera después, para no cortar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function compartirArchivo() {
  const lista = gestor.listaActiva;
  if (!lista) return;

  const archivo = new File([armarTextoLista(lista)], nombreArchivo(lista), { type: 'text/plain' });
  const datos = { title: `DOIT - Lista: ${lista.nombre}`, files: [archivo] };

  // Para archivos no alcanza con navigator.share: hay que verificar
  // con canShare que el navegador acepte este tipo de archivo.
  if (!(navigator.share && navigator.canShare && navigator.canShare(datos))) {
    descargarArchivo(archivo);
    return;
  }

  try {
    await navigator.share(datos);
  } catch (error) {
    // AbortError = el usuario cerró el menú sin compartir: no es un error.
    if (error.name !== 'AbortError') descargarArchivo(archivo);
  }
}

// Copia el texto del modal. Devuelve true si se pudo copiar.
async function copiarTexto() {
  try {
    await navigator.clipboard.writeText(textoModalCompartir.value);
    return true;
  } catch {
    // Sin permiso de portapapeles: se selecciona para copiar a mano.
    textoModalCompartir.select();
    return false;
  }
}

// Botón "Copiar texto": copia y avisa en el mismo botón.
async function copiarTextoCompartir() {
  const copiado = await copiarTexto();
  botonCopiarCompartir.textContent = copiado ? '¡Copiado!' : 'Copialo con Ctrl+C';
  setTimeout(() => { botonCopiarCompartir.textContent = 'Copiar texto'; }, 2000);
}

opcionCompartirTexto.addEventListener('click', compartirLista);
opcionCompartirArchivo.addEventListener('click', compartirArchivo);
botonCopiarCompartir.addEventListener('click', copiarTextoCompartir);
// Instagram: se copia el texto y el enlace abre los mensajes directos.
enlacesCompartir.instagram.addEventListener('click', copiarTexto);
