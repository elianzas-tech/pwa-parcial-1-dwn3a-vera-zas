'use strict';

/* ===================================================================
   claro_oscuro.js - cambio de tema claro / oscuro.

   - Alterna data-bs-theme en <html> (modo oscuro nativo de Bootstrap 5.3).
   - Cambia el icono del boton #btn-tema: luna en oscuro, sol en claro.
   - Persiste la eleccion en localStorage para la proxima visita.
   =================================================================== */

const raizTema  = document.documentElement; // <html>, ahi vive data-bs-theme
const btnTema   = document.getElementById('btn-tema');
const iconoTema = btnTema.querySelector('img');
const textoTema = document.getElementById('texto-tema');

function aplicarTema(tema) {
  const esOscuro = tema === 'dark';
  raizTema.setAttribute('data-bs-theme', tema);
  iconoTema.src = esOscuro ? 'images/mode_night.svg' : 'images/mode_light.svg';
  // El texto muestra el tema ACTUAL, no la accion: "Oscuro" en oscuro, "Claro" en claro.
  textoTema.textContent = esOscuro ? 'Oscuro' : 'Claro';
}

btnTema.addEventListener('click', () => {
  const actual = raizTema.getAttribute('data-bs-theme');
  const nuevo  = actual === 'dark' ? 'light' : 'dark';
  aplicarTema(nuevo);
  localStorage.setItem('tema', nuevo);
});

// Al cargar: respetar lo guardado; si no hay nada, arranca en oscuro.
aplicarTema(localStorage.getItem('tema') || 'dark');
