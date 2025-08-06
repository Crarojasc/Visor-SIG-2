// Inicializar el mapa
const map = L.map('map').setView([4.598056, -74.076667], 13);

// Capa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// === Cargar GPX: solo trk, sin wpt ===
async function cargarRutaGPX() {
  try {
    const response = await fetch('ruta.gpx');
    if (!response.ok) throw new Error('No se cargó ruta.gpx');

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const geoJson = toGeoJSON.gpx(xmlDoc);

    const soloRuta = {
      type: 'FeatureCollection',
      features: geoJson.features.filter(f => f.geometry.type === 'LineString')
    };

    if (soloRuta.features.length > 0) {
      L.geoJSON(soloRuta, {
        style: { color: '#3388ff', weight: 5, opacity: 0.8 }
      }).addTo(map);

      const bounds = L.geoJSON(soloRuta).getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  } catch (error) {
    console.error('Error GPX:', error);
  }
}

// === Cargar imágenes del 1 al 9 y extraer GPS del EXIF ===
async function cargarFotosAutomaticas() {
  const totalFotos = 9;
  const group = new L.featureGroup(); // Para ajustar vista al final

  for (let i = 1; i <= totalFotos; i++) {
    const nombre = `imagen${i}.jpg`;
    const url = `Fotos/${nombre}`;

    try {
      const img = await cargarImagenConEXIF(url, nombre);
      if (img) group.addLayer(img); // Añadir al grupo para ajustar vista
    } catch (error) {
      console.warn(`❌ No se pudo procesar ${nombre}:`, error.message);
    }
  }

  // Ajustar vista a todas las fotos con GPS
  if (group.getLayers().length > 0) {
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  } else {
    console.warn('⚠️ No se encontraron fotos con datos GPS.');
  }
}

// === Cargar una imagen y leer su GPS ===
function cargarImagenConEXIF(url, nombre) {
  return new Promise((resolve) => {
    const imgElement = new Image();
    imgElement.src = url;
    imgElement.crossOrigin = 'Anonymous'; // Importante para acceder al EXIF

    imgElement.onload = function () {
      EXIF.getData(imgElement, function () {
        const lat = EXIF.getTag(this, 'GPSLatitude');
        const lon = EXIF.getTag(this, 'GPSLongitude');
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef') || 'N';
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef') || 'W';

        if (lat && lon) {
          const latDecimal = convertirGPStoDecimal(lat, latRef);
          const lonDecimal = convertirGPStoDecimal(lon, lonRef);

          // Crear marcador
          const marker = L.marker([latDecimal, lonDecimal]).addTo(map);
          marker.bindPopup(`
            <b>Foto ${nombre}</b><br>
            <img src="${url}" alt="Foto ${nombre}"
                 style="width: 300px; height: auto; border-radius: 8px; margin-top: 8px;">
          `);

          resolve(marker);
        } else {
          console.warn(`❌ ${nombre} no tiene datos GPS en EXIF`);
          resolve(null);
        }
      });
    };

    imgElement.onerror = () => {
      console.error(`❌ No se pudo cargar: ${nombre}`);
      resolve(null);
    };
  });
}

// === Convertir GPS (grados, minutos, segundos) a decimal ===
function convertirGPStoDecimal(gps, ref) {
  const [grados, minutos, segundos] = gps;
  let decimal = grados + (minutos / 60) + (segundos / 3600);
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return decimal;
}

// === Cargar todo al inicio ===
document.addEventListener('DOMContentLoaded', () => {
  cargarRutaGPX();
  cargarFotosAutomaticas();
});