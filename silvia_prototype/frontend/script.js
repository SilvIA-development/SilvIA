window.addEventListener('load', () => {
    // --- CAPTURA DE ELEMENTOS DEL DOM ---
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const datePicker = document.getElementById('date-picker');
    const infoBox = document.getElementById('info-box');
    const mapElement = document.getElementById('map');
    const loadingOverlay = document.getElementById('loading-overlay');

    let selectedDate = '';

    // --- FUNCIONES DEL OVERLAY DE CARGA ---
    const showLoading = (message) => {
        if (loadingOverlay) {
            loadingOverlay.querySelector('p').textContent = message || 'Cargando...';
            loadingOverlay.classList.remove('hidden');
        }
    };
    const hideLoading = () => {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    };

    // --- FUNCIÓN DE INICIALIZACIÓN PRINCIPAL ---
    const initializeApp = (initialDate) => {
        selectedDate = initialDate;
        if (datePicker) datePicker.value = selectedDate;
        if (infoBox) infoBox.innerHTML = 'Selecciona una fecha y explora el mapa.';

        try {
            const view = new ol.View({
                center: ol.proj.fromLonLat([-3.703790, 40.416775]),
                zoom: 6,
            });

            const satelliteSource = new ol.source.ImageWMS({
                url: '/api/satellite-image',
                params: { 'LAYERS': 'TRUE_COLOR', 'STYLES': '', 'date': selectedDate },
                ratio: 1,
                serverType: 'geoserver',
                crossOrigin: 'anonymous'
            });

            // CORREGIDO: La capa de satélite empieza no visible
            const satelliteLayer = new ol.layer.Image({ 
                source: satelliteSource, 
                opacity: 0.8, 
                visible: false 
            });

            // CORREGIDO: El overlay de carga solo se muestra si la capa es visible
            satelliteSource.on('imageloadstart', () => {
                if (satelliteLayer.getVisible()) {
                    showLoading('Cargando imagen de satélite...');
                }
            });
            satelliteSource.on('imageloadend', () => hideLoading());
            satelliteSource.on('imageloaderror', () => {
                hideLoading();
                if (infoBox) infoBox.innerHTML = '<strong>Error:</strong> No se pudo cargar la imagen. Intente con otra fecha.';
            });

            const map = new ol.Map({
                target: mapElement,
                layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }), satelliteLayer ],
                view: view,
                controls: [],
            });

            // --- MANEJADORES DE EVENTOS ---
            if (datePicker) {
                datePicker.addEventListener('change', (e) => {
                    selectedDate = e.target.value;
                    satelliteSource.getParams().date = selectedDate;
                    satelliteSource.refresh();
                });
            }
            
            document.getElementById('satellite-layer-checkbox').addEventListener('change', (e) => satelliteLayer.setVisible(e.target.checked));
            document.getElementById('satellite-opacity-slider').addEventListener('input', (e) => satelliteLayer.setOpacity(parseFloat(e.target.value)));

            map.on('singleclick', function(evt) {
                const lonLat = ol.proj.toLonLat(evt.coordinate);
                if (infoBox) infoBox.innerHTML = `<strong>Coordenadas:</strong><br>Lat: ${lonLat[1].toFixed(4)}<br>Lon: ${lonLat[0].toFixed(4)}`;
            });

            // --- COMPROBACIÓN DE ESTADO DEL BACKEND ---
            fetch('/api/status')
                .then(response => response.ok ? response.json() : Promise.reject('Status response not ok'))
                .then(data => {
                    if (statusText) statusText.textContent = 'Backend Activo';
                    if (statusDot) statusDot.style.background = 'var(--accent-color)';
                })
                .catch(error => {
                    console.error('Error fetching backend status:', error);
                    if (statusText) statusText.textContent = 'Backend Inactivo';
                });

        } catch (e) {
            console.error('Error fatal al inicializar el mapa:', e);
            if (infoBox) infoBox.innerHTML = 'Error al cargar el mapa. Revisa la consola (F12).';
        }
    };

    // --- ARRANQUE: OBTENER FECHA REAL Y LUEGO INICIALIZAR ---
    fetch('/api/today')
        .then(response => response.ok ? response.json() : Promise.reject('Server date not available'))
        .then(data => initializeApp(data.today))
        .catch(error => {
            console.warn('No se pudo obtener la fecha del servidor. Usando fecha local.', error);
            const today = new Date();
            const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            initializeApp(localDate);
        });
});
