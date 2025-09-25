# model_sh.py
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sentinelhub import SHConfig, BBox, CRS, SentinelHubRequest, DataCollection, MimeType, bbox_to_dimensions
from datetime import datetime, timedelta
import io
import json
import os
from PIL import Image

# --- CONFIGURACIÓN DE SENTINEL HUB ---
config = SHConfig()
config_path = os.path.join(os.path.dirname(__file__), 'config.json')

try:
    with open(config_path, 'r') as f:
        credentials = json.load(f)
    sh_client_id = credentials.get("sh_client_id")
    sh_client_secret = credentials.get("sh_client_secret")

    if not sh_client_id or not sh_client_secret or "AQUI" in sh_client_id:
        print("ADVERTENCIA: 'sh_client_id' o 'sh_client_secret' no están configurados en backend/config.json.")
        config = None
    else:
        config.sh_client_id = sh_client_id
        config.sh_client_secret = sh_client_secret
        print("Credenciales de Sentinel Hub cargadas correctamente desde config.json.")

except FileNotFoundError:
    print("ADVERTENCIA: No se encontró el archivo backend/config.json. Las funciones de satélite no funcionarán.")
    config = None
except Exception as e:
    print(f"Error al cargar config.json: {e}")
    config = None

# --- SERVICIO DE IMÁGENES DE SATÉLITE ---
def get_true_color_image(bbox_str: str, date_str: str, width: int, height: int, srs_str: str):
    if not config or not config.sh_client_id:
        raise ValueError("La configuración de Sentinel Hub no es válida. Revisa el archivo backend/config.json.")

    try:
        query_date = datetime.strptime(date_str, '%Y-%m-%d')
        time_interval = (query_date - timedelta(days=90), query_date)

        crs = CRS(srs_str)
        bbox_coords = [float(c) for c in bbox_str.split(',')]
        bbox = BBox(bbox=bbox_coords, crs=crs)

        # EVALSCRIPT SIMPLIFICADO Y CORREGIDO: Se elimina la función updateOutputMetadata que causaba el error.
        evalscript_mosaico_sin_nubes = '''
        //VERSION=3
        function setup() {
            return {
                input: [{
                    bands: ["B04", "B03", "B02", "SCL", "dataMask"]
                }],
                output: {
                    bands: 4,
                    sampleType: "UINT8"
                }
            };
        }

        function evaluatePixel(sample) {
            const bad_scl = [0, 1, 3, 8, 9, 10, 11];

            if (sample.dataMask === 0 || bad_scl.includes(sample.SCL)) {
                return [0, 0, 0, 0]; // Píxel transparente si no es válido
            }

            const gain = 2.5;
            return [
                gain * sample.B04 * 255,
                gain * sample.B03 * 255,
                gain * sample.B02 * 255,
                255 // Totalmente opaco
            ];
        }
        '''

        request = SentinelHubRequest(
            evalscript=evalscript_mosaico_sin_nubes,
            input_data=[
                SentinelHubRequest.input_data(
                    data_collection=DataCollection.SENTINEL2_L2A,
                    time_interval=time_interval,
                    mosaicking_order='leastCC'
                )
            ],
            responses=[SentinelHubRequest.output_response('default', MimeType.PNG)],
            bbox=bbox,
            size=(width, height),
            config=config
        )

        image_data = request.get_data()[0]
        img = Image.fromarray(image_data)
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()

    except Exception as e:
        print(f"Error al obtener la imagen de Sentinel Hub: {e}")
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()


# --- MODELOS DE PREDICCIÓN (EXISTENTES) ---

def load_model():
    X = np.random.rand(200, 2)
    y = (X[:, 0] > 0.4).astype(int)
    model = RandomForestClassifier()
    model.fit(X, y)
    return model

def get_ndvi(lat, lon, size_m=160):
    pass

def predict_forest_cover(model, lat, lon):
    pass

def predict_fire_risk(lat, lon):
    pass
