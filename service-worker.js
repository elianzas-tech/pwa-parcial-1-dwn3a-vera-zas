/* Instalacion del service-worker*/
self.addEventListener('install', () => {
    console.log('Se esta instalando el service-worker');
})

/* Activacion del service-worker*/
self.addEventListener('activate', () => {
    console.log('El service-worker esta activo');
})