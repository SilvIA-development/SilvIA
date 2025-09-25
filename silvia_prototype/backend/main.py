# main.py
from fastapi import FastAPI, HTTPException, Request, Response, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os
from datetime import date
import rasterio
from rasterio.enums import Resampling # <-- Importante para el remuestreo
import numpy as np
import imageio
from io import BytesIO
import shutil

# Importar la función que realmente funciona y su configuración
from model_sh import get_true_color_image, config as sh_config

# --- CONFIGURACIÓN Y DIRECTORIOS ---
b_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(b_dir, "..", "frontend")
uploads_dir = os.path.join(b_dir, "uploads")
os.makedirs(uploads_dir, exist_ok=True)

app = FastAPI()

# --- ENDPOINTS DE LA API GeoTIFF ---

@app.post("/api/upload-geotiff")
async def upload_geotiff(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.tif', '.tiff')):
        raise HTTPException(status_code=400, detail="Formato de archivo no válido. Solo se admiten .tif y .tiff")

    filepath = os.path.join(uploads_dir, file.filename)
    
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo guardar el archivo: {e}")
    finally:
        file.file.close()

    return JSONResponse(content={"filename": file.filename, "detail": "Archivo subido con éxito"})

@app.get("/api/geotiff-metadata/{filename}")
async def get_geotiff_metadata(filename: str):
    filepath = os.path.join(uploads_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    try:
        with rasterio.open(filepath) as src:
            return {
                "bands": src.count,
                "descriptions": [src.descriptions[i] or f"Banda {i+1}" for i in range(src.count)],
                "width": src.width,
                "height": src.height
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer los metadatos del GeoTIFF: {e}")

@app.get("/api/geotiff-band/{filename}/{band_index}")
async def get_geotiff_band(filename: str, band_index: int):
    filepath = os.path.join(uploads_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    try:
        with rasterio.open(filepath) as src:
            if not (1 <= band_index <= src.count):
                raise HTTPException(status_code=400, detail="Índice de banda fuera de rango")

            # --- LA SOLUCIÓN: Leer una versión reducida --- #
            MAX_DIM = 2048  # Previsualización de 2048px en el lado más largo

            if src.width > src.height:
                out_width = MAX_DIM
                out_height = int((src.height / src.width) * MAX_DIM)
            else:
                out_height = MAX_DIM
                out_width = int((src.width / src.height) * MAX_DIM)

            # Lee los datos remuestreados para no agotar la memoria RAM
            band_data = src.read(
                band_index,
                out_shape=(out_height, out_width),
                resampling=Resampling.bilinear
            )
            # --- FIN DE LA SOLUCIÓN ---

            min_val, max_val = np.nanmin(band_data), np.nanmax(band_data)
            if max_val > min_val:
                band_data = (band_data - min_val) / (max_val - min_val) * 255
            else:
                band_data = np.zeros_like(band_data)
            
            band_data = band_data.astype(np.uint8)

            with BytesIO() as buffer:
                imageio.imwrite(buffer, band_data, format='PNG')
                buffer.seek(0)
                return Response(content=buffer.read(), media_type="image/png")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar la banda del GeoTIFF: {e}")

# --- ENDPOINTS DE LA API SENTINEL HUB (RESTAURADOS) ---

@app.get("/api/satellite-image")
async def serve_satellite_image(request: Request):
    query_params = request.query_params
    if not sh_config or not sh_config.sh_client_id:
        raise HTTPException(status_code=500, detail="Configuración de Sentinel Hub no válida.")

    try:
        image_bytes = get_true_color_image(
            bbox_str=query_params.get("BBOX"),
            date_str=query_params.get("date") or date.today().isoformat(),
            width=int(query_params.get("WIDTH")),
            height=int(query_params.get("HEIGHT")),
            srs_str=query_params.get("CRS") or query_params.get("SRS")
        )
        return Response(content=image_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/today")
def get_today():
    return {"today": date.today().isoformat()}

@app.get("/api/status")
def get_status():
    return {"status": "active"}

# --- SERVIR PÁGINAS HTML Y ARCHIVOS ESTÁTICOS ---

@app.get("/")
async def read_main_page():
    return FileResponse(os.path.join(frontend_dir, 'index.html'))

@app.get("/silvia.html")
async def read_silvia_page():
    return FileResponse(os.path.join(frontend_dir, 'silvia.html'))

@app.get("/viewer.html")
async def read_viewer_page():
    return FileResponse(os.path.join(frontend_dir, 'viewer.html'))

app.mount("/static", StaticFiles(directory=frontend_dir), name="static")
