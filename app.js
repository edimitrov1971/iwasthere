const map = L.map('map').setView([42.7, 25.3], 7);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const pinIcon = (color) => L.divIcon({
  className: 'pin',
  html: `<svg width="32" height="44" viewBox="0 0 32 44"><path d="M16 0C7.2 0 0 7 0 15.6 0 27 16 44 16 44s16-17 16-28.4C32 7 24.8 0 16 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="6" fill="#fff"/></svg>`,
  iconSize: [32, 44], iconAnchor: [16, 44]
});

const KEY = 'here-pos';
let hereMarker = null, whereMarker = null, line = null;
const msgEl = document.getElementById('msg');
let msgTimer;

function say(text, ms = 5000) {
  msgEl.textContent = text;
  msgEl.hidden = false;
  clearTimeout(msgTimer);
  if (ms) msgTimer = setTimeout(() => { msgEl.hidden = true; }, ms);
}

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Няма GPS поддръжка.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve([p.coords.latitude, p.coords.longitude]),
      e => reject(new Error(e.code === 1 ? 'Разрешете достъпа до локацията.' : 'Не може да се определи локацията.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

function setHere(pos) {
  if (hereMarker) hereMarker.setLatLng(pos);
  else hereMarker = L.marker(pos, { icon: pinIcon('#dc2626') }).addTo(map).bindPopup('Here');
}

function clearWhere() {
  if (whereMarker) { map.removeLayer(whereMarker); whereMarker = null; }
  if (line) { map.removeLayer(line); line = null; }
}

function fmt(m) {
  return m < 1000 ? Math.round(m) + ' м' : (m / 1000).toFixed(2) + ' км';
}

document.getElementById('here').onclick = async () => {
  say('Търся локация…', 0);
  try {
    const pos = await locate();
    localStorage.setItem(KEY, JSON.stringify(pos));
    setHere(pos);
    stopTracking();
    clearWhere();
    map.setView(pos, 17);
    say('Позицията е запазена.', 2500);
  } catch (e) { say(e.message); }
};

const whereBtn = document.getElementById('where');
let watchId = null, lastPos = null, heading = 0, firstFix = true;

const whereIcon = (deg) => L.divIcon({
  className: 'pin',
  html: `<svg width="32" height="44" viewBox="0 0 32 44"><path d="M16 0C7.2 0 0 7 0 15.6 0 27 16 44 16 44s16-17 16-28.4C32 7 24.8 0 16 0z" fill="#2563eb" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="6" fill="#fff"/></svg>` +
    `<svg class="arrow" style="transform:rotate(${deg}deg)" width="40" height="40" viewBox="0 0 40 40"><path d="M20 2L32 30 20 23 8 30z" fill="#16a34a" stroke="#fff" stroke-width="2"/></svg>`,
  iconSize: [32, 44], iconAnchor: [16, 44]
});

function bearing(a, b) {
  const r = Math.PI / 180, dl = (b[1] - a[1]) * r;
  const y = Math.sin(dl) * Math.cos(b[0] * r);
  const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos(dl);
  return (Math.atan2(y, x) / r + 360) % 360;
}

function stopTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null; lastPos = null;
  whereBtn.textContent = 'Where';
}

function onFix(p) {
  const pos = [p.coords.latitude, p.coords.longitude];
  if (typeof p.coords.heading === 'number' && !isNaN(p.coords.heading) && p.coords.speed > 0.5) {
    heading = p.coords.heading;
  } else if (lastPos && map.distance(lastPos, pos) > 3) {
    heading = bearing(lastPos, pos);
  }
  if (!lastPos || map.distance(lastPos, pos) > 3) lastPos = pos;
  if (whereMarker) { whereMarker.setLatLng(pos); whereMarker.setIcon(whereIcon(heading)); }
  else whereMarker = L.marker(pos, { icon: whereIcon(heading) }).addTo(map).bindPopup('Where');
  const h = hereMarker.getLatLng();
  if (line) line.setLatLngs([h, pos]);
  else line = L.polyline([h, pos], { color: '#111827', weight: 4 }).addTo(map);
  if (firstFix) {
    map.fitBounds(L.latLngBounds([h, pos]), { padding: [60, 60], maxZoom: 19 });
    firstFix = false;
  }
  say('Разстояние: ' + fmt(map.distance(h, pos)), 0);
}

whereBtn.onclick = () => {
  if (watchId !== null) { stopTracking(); say('Следенето е спряно.', 2000); return; }
  if (!hereMarker) return say('Първо натиснете Here.');
  if (!navigator.geolocation) return say('Няма GPS поддръжка.');
  whereBtn.textContent = '🔍';
  firstFix = true;
  say('Търся локация…', 0);
  watchId = navigator.geolocation.watchPosition(onFix, e => {
    stopTracking();
    say(e.code === 1 ? 'Разрешете достъпа до локацията.' : 'Не може да се определи локацията.');
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
};

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) { setHere(saved); map.setView(saved, 16); }
} catch (e) {}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
