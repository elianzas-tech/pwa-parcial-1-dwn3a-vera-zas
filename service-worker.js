const PRE_CACHE_NOMBRE = "pre-cacahe-v1";
const DIN_CACHE_NOMBRE = "din-cacahe-v1";
const PRE_CACHE_RECURSOS = [
    //RECURSOS
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/claro_oscuro.js',
    './images/add.svg',
    './images/check_box_completed.svg',
    './images/check_box_outline_blank.svg',
    './images/check_box_selected.svg',
    './images/delete.svg',
    './images/edit.svg',
    './images/mode_light.svg',
    './images/mode_night.svg',
    //BOOTSTRAP CDN
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
]


/* Instalacion del service-worker*/
self.addEventListener('install', (evento) => {
    console.log('Se esta instalando el service-worker');

    evento.waitUntil(
        caches.open(PRE_CACHE_NOMBRE)
        .then(cache => {
            console.log('Cache de pre-caching abierta');
            cache.addAll(PRE_CACHE_RECURSOS);
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

                    if(respuesta.ok) {
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
self.addEventListener('activate', () => {
    console.log('El service-worker esta activo');
})