window.addEventListener('load', () => {
    // --- ELEMENTOS DEL DOM ---
    const dropArea = document.getElementById('drop-area');
    const fileElem = document.getElementById('fileElem');
    const progressBar = document.getElementById('progress-bar');
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const uploadStatus = document.getElementById('upload-status');
    const visualizeBtn = document.getElementById('visualize-btn');
    
    const viewerContainer = document.getElementById('viewer-container');
    const bandControls = document.getElementById('band-controls');
    const imageDisplayArea = document.querySelector('.image-display-area');
    const bandImage = document.getElementById('band-image');
    const bandInfo = document.getElementById('band-info');

    let uploadedFilename = null;
    let bandMetadata = {};

    // --- LÓGICA DE SUBIDA (sin cambios) ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });
    dropArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);
    fileElem.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleFiles(files) {
        if (files.length > 1) { showStatus('Solo puedes subir un archivo a la vez.', true); return; }
        const file = files[0];
        if (!file.type.includes('tiff')) { showStatus('Error: El archivo no es un .tif o .tiff válido.', true); return; }
        uploadFile(file);
    }

    function uploadFile(file) {
        const url = '/api/upload-geotiff';
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        xhr.open('POST', url, true);
        xhr.upload.addEventListener('progress', e => updateProgress(e.loaded, e.total));
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                uploadedFilename = response.filename;
                showStatus(`Archivo '${file.name}' subido con éxito.`, false);
                visualizeBtn.style.display = 'block';
                viewerContainer.style.display = 'none';
            } else {
                const error = JSON.parse(xhr.responseText);
                showStatus(`Error al subir: ${error.detail || 'Error desconocido.'}`, true);
            }
        });
        xhr.addEventListener('error', () => showStatus('Error de red al intentar subir el archivo.', true));
        formData.append('file', file);
        xhr.send(formData);
    }

    function updateProgress(loaded, total) {
        progressBar.style.display = 'block';
        progressBarFill.style.width = (total > 0 ? (loaded / total) * 100 : 0) + '%';
    }

    function showStatus(message, isError = false) {
        uploadStatus.textContent = message;
        uploadStatus.className = isError ? 'upload-status error' : 'upload-status success';
        if (!isError) setTimeout(() => { progressBar.style.display = 'none'; }, 2000);
    }

    // --- LÓGICA DE VISUALIZACIÓN DE BANDAS (CON DEPURACIÓN) ---
    visualizeBtn.addEventListener('click', () => {
        if (uploadedFilename) initializeBandViewer(uploadedFilename);
    });

    async function initializeBandViewer(filename) {
        viewerContainer.style.display = 'flex';
        viewerContainer.scrollIntoView({ behavior: 'smooth' });
        bandControls.innerHTML = '<p>Cargando información de bandas...</p>';
        imageDisplayArea.innerHTML = ''; 
        imageDisplayArea.appendChild(bandImage);
        imageDisplayArea.appendChild(bandInfo);

        try {
            const metaResponse = await fetch(`/api/geotiff-metadata/${filename}`);
            if (!metaResponse.ok) {
                const error = await metaResponse.json();
                throw new Error(error.detail || 'No se pudo cargar la información de bandas.');
            }
            bandMetadata = await metaResponse.json();
            console.log('Metadatos recibidos:', bandMetadata); // DEBUG
            bandControls.innerHTML = '';
            for (let i = 1; i <= bandMetadata.bands; i++) {
                const button = document.createElement('button');
                const bandName = bandMetadata.descriptions[i - 1] || `Banda ${i}`;
                button.innerText = bandName;
                button.dataset.bandIndex = i;
                button.addEventListener('click', () => loadBandImage(filename, i));
                bandControls.appendChild(button);
            }
            if (bandMetadata.bands > 0) {
                loadBandImage(filename, 1);
            }
        } catch (error) {
            console.error('Error al inicializar el visualizador:', error);
            bandControls.innerHTML = `<p style="color: #f87171;">Error: ${error.message}</p>`;
        }
    }

    async function loadBandImage(filename, bandIndex) {
        const buttons = bandControls.querySelectorAll('button');
        buttons.forEach(btn => btn.classList.remove('active'));
        const currentButton = bandControls.querySelector(`[data-band-index="${bandIndex}"]`);
        if(currentButton) currentButton.classList.add('active');
        
        const bandName = bandMetadata.descriptions[bandIndex - 1] || `Banda ${bandIndex}`;
        bandInfo.innerText = `Cargando ${bandName}...`;
        bandImage.style.display = 'none';
        imageDisplayArea.querySelector('.error-message')?.remove();

        console.log(`[DEBUG] Pidiendo imagen para la banda ${bandIndex}`);

        try {
            const imageUrl = `/api/geotiff-band/${filename}/${bandIndex}`;
            const response = await fetch(imageUrl);

            console.log('[DEBUG] Respuesta del servidor recibida:', response);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Respuesta de imagen no válida del servidor');
            }
            
            const imageBlob = await response.blob();
            console.log('[DEBUG] Blob de la imagen creado:', imageBlob);

            if (imageBlob.size === 0) {
                throw new Error('El servidor ha devuelto una imagen vacía (0 bytes).');
            }

            const objectURL = URL.createObjectURL(imageBlob);
            bandImage.src = objectURL;
            bandImage.style.display = 'block';

            bandImage.onload = () => {
                console.log('[DEBUG] Evento bandImage.onload disparado. La imagen debería ser visible.');
                URL.revokeObjectURL(objectURL);
                bandInfo.innerText = `Mostrando: ${bandName}`;
            };

            bandImage.onerror = () => {
                console.error('[DEBUG] Evento bandImage.onerror disparado. Hubo un error al cargar la imagen en la etiqueta <img>.');
                URL.revokeObjectURL(objectURL);
                bandInfo.innerText = `Error al cargar ${bandName}`;
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.innerHTML = `<strong>Fallo al cargar la imagen</strong><p>El navegador no pudo decodificar la imagen recibida del servidor.</p>`;
                imageDisplayArea.prepend(errorDiv);
            };

        } catch (error) {
            console.error('[DEBUG] Error en el bloque catch de loadBandImage:', error);
            bandInfo.innerText = `Error al cargar ${bandName}`;
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `<strong>Fallo al cargar la imagen</strong><p>${error.message}</p>`;
            imageDisplayArea.prepend(errorDiv);
        }
    }
});