const PRE_CACHE_NOMBRE = "pre-cacahe-v1.6";
const DIN_CACHE_NOMBRE = "din-cacahe-v1.6";
const PRE_CACHE_RECURSOS = [
    //RECURSOS
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/iconos.js',
    './js/claro_oscuro.js',
    './images/check_box_completed.svg',
    './images/check_box_outline_blank.svg',
    './images/check_box_selected.svg',
    //BOOTSTRAP CDN (el JS también: sin él, app.js falla offline al usar bootstrap.Toast)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
]


/* Instalacion del service-worker*/
self.addEventListener('install', (evento) => {
    console.log('Se esta instalando el service-worker');

    evento.waitUntil(
        caches.open(PRE_CACHE_NOMBRE)
        .then(cache => {
            console.log('Cache de pre-caching abierta');
            // El return hace que waitUntil espere a que se guarden todos los recursos.
            return cache.addAll(PRE_CACHE_RECURSOS);
        })
    );
})

self.addEventListener('fetch', (evento) => {
    console.log("Se intercepto la peticion a:", evento.request.url);
    
    if (evento.request.method !== "GET") {
        return;
    }

    evento.respondWith(
        caches.match(evento.request)
        .then((respuestaCache) => {
            if (respuestaCache !== undefined) {
                console.log("El recurso se encuentra en la cache.");
                
                return respuestaCache;
            }

            console.log("El recurso no se encuentra en la cache.");
            return fetch(evento.request)
                .then(respuesta => {

                    // Si la respuesta falló (404, 500...) no se guarda.
                    if(!respuesta.ok) {
                        return respuesta;
                    }

                    return caches.open(DIN_CACHE_NOMBRE)
                        .then(cache => {
                            cache.put(evento.request, respuesta.clone())

                            return respuesta;
                        })
                });
        })
    );
}) 

/* Activacion del service-worker*/
self.addEventListener('activate', (evento) => {
    console.log('El service-worker esta activo');

    // Borra las caches de versiones anteriores. Sin esto, caches.match
    // podría seguir encontrando el app.js viejo y la app nunca se actualiza.
    evento.waitUntil(
        caches.keys()
        .then(nombres => Promise.all(
            nombres
                .filter(nombre => nombre !== PRE_CACHE_NOMBRE && nombre !== DIN_CACHE_NOMBRE)
                .map(nombre => {
                    console.log('Se borra la cache vieja:', nombre);
                    return caches.delete(nombre);
                })
        ))
    );
})