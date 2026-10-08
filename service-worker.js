const PRE_CACHE_NOMBRE = "pre-cacahe-v1.6";
const DIN_CACHE_NOMBRE = "din-cacahe-v1.6";
const PRE_CACHE_RECURSOS = [
    //RECURSOS
    './',
    './index.html',
    './manifest.json',
    './favicon.svg',
    './css/styles.css',
    './js/app.js',
    './js/iconos.js',
    './js/claro_oscuro.js',
    './images/check_box_completed.svg',
    './images/check_box_outline_blank.svg',
    './images/check_box_selected.svg',
    './images/icons/icon-152.png',
    './images/icons/icon-48.png',
    './images/icons/icon-512.png',
    //BOOTSTRAP CDN
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
]


/* Instalacion del service-worker*/
self.addEventListener('install', (evento) => {
    console.log('Se esta instalando el service-worker');

    // Activa la version nueva sin esperar a que se cierren las pestañas abiertas.
    self.skipWaiting();

    evento.waitUntil(
        caches.open(PRE_CACHE_NOMBRE)
        .then(cache => {
            console.log('Cache de pre-caching abierta');
            return cache.addAll(PRE_CACHE_RECURSOS);
        })
    );
})

/* Estrategia network-first: siempre intenta traer la ultima version de la red
   y solo usa la cache cuando no hay conexion. */
self.addEventListener('fetch', (evento) => {
    console.log("Se intercepto la peticion a:", evento.request.url);

    if (evento.request.method !== "GET" || !evento.request.url.startsWith('http')) {
        return;
    }

    evento.respondWith(
        fetch(evento.request)
            .then(respuesta => {
                if (!respuesta.ok) {
                    return respuesta;
                }

                console.log("Recurso obtenido de la red, se actualiza la cache.");
                return caches.open(DIN_CACHE_NOMBRE)
                    .then(cache => {
                        cache.put(evento.request, respuesta.clone());

                        return respuesta;
                    });
            })
            .catch(() => {
                console.log("Sin conexion, se busca el recurso en la cache.");

                // Primero la cache dinamica (tiene la copia mas reciente) y despues la de pre-caching.
                return caches.open(DIN_CACHE_NOMBRE)
                    .then(cache => cache.match(evento.request))
                    .then(respuestaCache => respuestaCache || caches.match(evento.request));
            })
    );
})

/* Activacion del service-worker*/
self.addEventListener('activate', (evento) => {
    console.log('El service-worker esta activo');

    // Borra las caches de versiones anteriores y toma el control de las pestañas abiertas.
    evento.waitUntil(
        caches.keys()
        .then(nombres => Promise.all(
            nombres
                .filter(nombre => nombre !== PRE_CACHE_NOMBRE && nombre !== DIN_CACHE_NOMBRE)
                .map(nombre => caches.delete(nombre))
        ))
        .then(() => self.clients.claim())
    );
})
