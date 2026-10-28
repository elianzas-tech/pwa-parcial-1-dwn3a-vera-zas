'use strict';

/* ===================================================================
   claro-oscuro.js - cambio de tema claro / oscuro.

   - Alterna data-bs-theme en <html> (modo oscuro nativo de Bootstrap 5.3).
   - Cambia el icono del boton #boton-tema: luna en oscuro, sol en claro.
   - Persiste la eleccion en localStorage para la proxima visita.
   =================================================================== */

const raizTema  = document.documentElement; // <html>, ahi vive data-bs-theme
const botonTema = document.getElementById('boton-tema');
const iconoTema = botonTema.querySelector('path');
const textoTema = document.getElementById('texto-tema');

function aplicarTema(tema) {
  const esOscuro = tema === 'dark';
  raizTema.setAttribute('data-bs-theme', tema);
  iconoTema.setAttribute('d', esOscuro ? ICONOS.modoOscuro : ICONOS.modoClaro);
  // El texto muestra el tema ACTUAL, no la accion: "Oscuro" en oscuro, "Claro" en claro.
  textoTema.textContent = esOscuro ? 'Oscuro' : 'Claro';
}

botonTema.addEventListener('click', () => {
  const actual = raizTema.getAttribute('data-bs-theme');
  const nuevo  = actual === 'dark' ? 'light' : 'dark';
  aplicarTema(nuevo);
  localStorage.setItem('tema', nuevo);
});

// Al cargar: respetar lo guardado; si no hay nada, arranca en oscuro.
aplicarTema(localStorage.getItem('tema') || 'dark');
