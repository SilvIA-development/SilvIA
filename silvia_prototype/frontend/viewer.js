window.addEventListener('load', () => {
    // --- ELEMENTOS DEL DOM ---
    const viewerTitle = document.getElementById('viewer-title');
    const bandControls = document.getElementById('band-controls');
    const imageDisplayArea = document.getElementById('image-display-area');
    const panzoomScene = document.getElementById('panzoom-scene');
    const bandImage = document.getElementById('band-image');
    const bandInfo = document.getElementById('band-info');
    const errorMessageBox = document.getElementById('error-message-box');
    const uploadButton = document.getElementById('upload-button');
    const geotiffInput = document.getElementById('geotiff-input');
    const initialMessage = document.getElementById('initial-message');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressBar = document.getElementById('progress-bar');

    // --- ESTADO DE LA APLICACIÓN ---
    let currentFilename = '';
    let bandMetadata = {};
    let panzoomInstance = null;

    // --- LÓGICA DE PAN & ZOOM ---
    const initPanzoom = () => {
        if (panzoomInstance) panzoomInstance.destroy();
        panzoomInstance = Panzoom(bandImage, { maxScale: 15, minScale: 0.1, contain: 'outside', canvas: true });
        panzoomScene.addEventListener('wheel', panzoomInstance.zoomWithWheel, { passive: false });
    };

    // --- LÓGICA DE SUBIDA CON BARRA DE PROGRESO ---
    uploadButton.addEventListener('click', () => geotiffInput.click());
    geotiffInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) handleFileUpload(file);
    });

    function handleFileUpload(file) {
        resetViewerState();
        showLoading(true, `Subiendo ${file.name}...`);
        progressBarContainer.style.display = 'block'; // Mostrar barra
        progressBar.style.width = '0%';

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload-geotiff', true);

        // Listener para el progreso de la subida
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                progressBar.style.width = percentComplete + '%';
            }
        });

        // Listener para cuando la subida termina (sea éxito o error)
        xhr.onload = () => {
            progressBarContainer.style.display = 'none'; // Ocultar barra
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    initializeBandViewer(result.filename);
                } catch (e) {
                    showFatalError('Respuesta inválida del servidor.');
                }
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    showFatalError(`Fallo en la subida: ${error.detail || 'Error del servidor.'}`);
                } catch (e) {
                    showFatalError(`Fallo en la subida con código: ${xhr.status}`);
                }
            }
        };

        xhr.onerror = () => {
            progressBarContainer.style.display = 'none'; // Ocultar barra
            showFatalError('Error de red al intentar subir el archivo.');
        };

        xhr.send(formData);
    }

    // --- FUNCIÓN INTELIGENTE DE NOMBRADO DE BANDAS ---
    function getMeaningfulBandName(description, index, filename = '') {
        const desc = (description || '').toLowerCase();
        const fname = filename.toLowerCase();
        if (fname.includes('sentinel2') && fname.includes('b843')) {
            if (index === 1) return 'Infrarrojo Cercano (B8)';
            if (index === 2) return 'Roja (B4)';
            if (index === 3) return 'Verde (B3)';
        }
        if (desc.includes('red')) return `Roja`;
        if (desc.includes('green')) return `Verde`;
        if (desc.includes('blue')) return `Azul`;
        if (desc.includes('nir')) return `Infrarrojo Cercano (NIR)`;
        return description || `Banda ${index}`;
    }

    // --- LÓGICA DEL VISOR ---
    async function initializeBandViewer(filename) {
        currentFilename = filename;
        showLoading(true, 'Analizando metadatos...');

        viewerTitle.innerText = `Visor: ${filename}`;
        initialMessage.style.display = 'none';
        imageDisplayArea.style.display = 'flex';
        bandControls.style.display = 'flex';

        try {
            const metaResponse = await fetch(`/api/geotiff-metadata/${filename}`);
            if (!metaResponse.ok) throw new Error((await metaResponse.json()).detail);
            bandMetadata = await metaResponse.json();

            bandControls.innerHTML = '';
            if (bandMetadata.bands > 0) {
                bandMetadata.descriptions.forEach((desc, i) => {
                    const bandIndex = i + 1;
                    const button = document.createElement('button');
                    button.innerText = getMeaningfulBandName(desc, bandIndex, currentFilename);
                    button.dataset.bandIndex = bandIndex;
                    button.addEventListener('click', () => loadBandImage(bandIndex));
                    bandControls.appendChild(button);
                });
                await loadBandImage(1);
            } else {
                showFatalError("El archivo no contiene bandas de imagen.");
            }
        } catch (error) {
            showFatalError(`Error de inicialización: ${error.message}`);
        }
    }

    async function loadBandImage(bandIndex) {
        const bandName = getMeaningfulBandName(bandMetadata.descriptions[bandIndex - 1], bandIndex, currentFilename);
        showLoading(true, `Procesando ${bandName}...`);
        errorMessageBox.style.display = 'none';
        await new Promise(resolve => setTimeout(resolve, 50)); // Forzar renderizado del spinner

        bandControls.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        bandControls.querySelector(`[data-band-index="${bandIndex}"]`)?.classList.add('active');

        try {
            const response = await fetch(`/api/geotiff-band/${currentFilename}/${bandIndex}`);
            if (!response.ok) throw new Error((await response.json()).detail);
            const imageBlob = await response.blob();

            if (bandImage.src.startsWith('blob:')) URL.revokeObjectURL(bandImage.src);
            const objectURL = URL.createObjectURL(imageBlob);

            bandImage.onload = () => {
                bandInfo.innerText = `Mostrando: ${bandName}`;
                initPanzoom();
                showLoading(false);
            };
            bandImage.src = objectURL;

        } catch (error) {
            showImageError(`Error al solicitar ${bandName}: ${error.message}`);
        }
    }

    // --- FUNCIONES DE ESTADO Y UI ---
    const showLoading = (isLoading, message = 'Cargando...') => {
        loadingText.innerText = message;
        loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        // Ocultar siempre la barra de progreso a menos que sea una subida
        if (!message.toLowerCase().includes('subiendo')) {
            progressBarContainer.style.display = 'none';
        }
    };

    const resetViewerState = () => {
        if (panzoomInstance) panzoomInstance.destroy();
        if (bandImage.src.startsWith('blob:')) URL.revokeObjectURL(bandImage.src);
        bandImage.src = '';
        currentFilename = '';
        initialMessage.style.display = 'flex';
        imageDisplayArea.style.display = 'none';
        bandControls.style.display = 'none';
        viewerTitle.innerText = 'Visor de Bandas';
    };

    function showImageError(message) {
        showLoading(false);
        errorMessageBox.innerHTML = `<p>${message}</p>`;
        errorMessageBox.style.display = 'block';
    }

    function showFatalError(message) {
        showLoading(false);
        resetViewerState();
        initialMessage.innerHTML = `<div class="error-message-box" style="display: block; position: relative;"><strong>Error Crítico</strong><p>${message}</p></div>`;
    }
});
