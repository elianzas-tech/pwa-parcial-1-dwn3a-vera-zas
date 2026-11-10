const PRE_CACHE_NOMBRE = "pre-cache-v2.8";
const DIN_CACHE_NOMBRE = "din-cache-v2.8";
const PRE_CACHE_RECURSOS = [
    //RECURSOS
    './',
    './index.html',
    './manifest.json',
    './favicon.svg',
    './css/styles.css',
    './js/app.js',
    './js/compartir.js',
    './js/iconos.js',
    './js/claro-oscuro.js',
    './imagenes/casilla-completada.svg',
    './imagenes/casilla-vacia-con-borde.svg',
    './imagenes/casilla-seleccionada.svg',
    './imagenes/iconos/icono-152.png',
    './imagenes/iconos/icono-48.png',
    './imagenes/iconos/icono-192.png',
    './imagenes/iconos/icono-maskable-512.png',
    './imagenes/iconos/icono-512.png',
    //BOOTSTRAP CDN
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
]


/* Instalacion del service-worker*/
self.addEventListener('install', (evento) => {
    console.log('Se esta instalando el service-worker');

    // Activa la version nueva sin esperar a que se cierren todas las pestanas.
    self.skipWaiting();

    evento.waitUntil(
        caches.open(PRE_CACHE_NOMBRE)
        .then(cache => {
            console.log('Cache de pre-caching abierta');
            return cache.addAll(PRE_CACHE_RECURSOS);
        })
    );
})

/* Estrategia cache-first: primero busca el recurso en la cache y, si no esta,
   lo trae de la red y lo guarda en la cache dinamica. */
self.addEventListener('fetch', (evento) => {
    console.log("Se intercepto la peticion a:", evento.request.url);

    // Solo se cachean peticiones GET http/https (no POST ni chrome-extension://).
    if (evento.request.method !== "GET" || !evento.request.url.startsWith('http')) {
        return;
    }

    evento.respondWith(
        caches.match(evento.request)
            .then(respuestaCache => {
                if (respuestaCache !== undefined) {
                    console.log("Recurso obtenido de la cache.");
                    return respuestaCache;
                }

                return fetch(evento.request)
                    .then(respuesta => {
                        // Las respuestas con error no se guardan.
                        if (!respuesta.ok) {
                            return respuesta;
                        }

                        console.log("Recurso obtenido de la red, se guarda en la cache dinamica.");
                        return caches.open(DIN_CACHE_NOMBRE)
                            .then(cache => {
                                // Se clona porque la respuesta se usa dos veces: se guarda y se devuelve.
                                cache.put(evento.request, respuesta.clone());

                                return respuesta;
                            });
                    });
            })
    );
})

/* Activacion del service-worker*/
self.addEventListener('activate', (evento) => {
    console.log('El service-worker esta activo');

    // Borra las caches de versiones anteriores para que se use la version nueva.
    evento.waitUntil(
        caches.keys()
        .then(nombres => Promise.all(
            nombres
                .filter(nombre => nombre !== PRE_CACHE_NOMBRE && nombre !== DIN_CACHE_NOMBRE)
                .map(nombre => caches.delete(nombre))
        ))
    );
})
