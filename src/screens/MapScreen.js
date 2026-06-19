import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  PanResponder,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOGO = require('../../assets/logo.png');
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { cachedGeocode, cachedZone, cachedSearch } from '../utils/cache';
import { getCurrentUser, logout as apiLogout, checkFavorite, toggleFavorite } from '../utils/api';
import { API_URL } from '../environments/environment';
import { D } from '../theme/index';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import BottomTabBar from '../components/BottomTabBar';
// Location removed — Tunis used as default

const DEFAULT_COORDS = { latitude: 35.0382, longitude: 9.4849 }; // Sidi Bouzid


// ─── Styles de carte disponibles ─────────────────────────────────────────────
const MAP_STYLES = [
  {
    key: 'clair',
    label: 'Normal',
    icon: 'map',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
  },
  {
    key: 'satellite',
    label: 'Satellite',
    icon: 'satellite-dish',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: [''],
    maxZoom: 19,
  },
];

// ─── Données Tunisie (gouvernorats depuis tunisia.json) ───────────────────────
import TUNISIA_DATA from '../../assets/tunisia.json';
const TUNISIA_GOVERNORATES = Object.keys(TUNISIA_DATA).sort();

// ─── Coordonnées des centres de gouvernorats ──────────────────────────────────
const GOVERNORATE_COORDS = {
  'Tunis':        { lat: 36.8065, lng: 10.1815 },
  'Ariana':       { lat: 36.8665, lng: 10.1647 },
  'Ben Arous':    { lat: 36.7474, lng: 10.2326 },
  'Manouba':      { lat: 36.8094, lng:  9.9799 },
  'Nabeul':       { lat: 36.4511, lng: 10.7357 },
  'Zaghouan':     { lat: 36.4029, lng: 10.1427 },
  'Bizerte':      { lat: 37.2744, lng:  9.8739 },
  'Béja':         { lat: 36.7254, lng:  9.1819 },
  'Jendouba':     { lat: 36.5011, lng:  8.7757 },
  'Kef':          { lat: 36.1826, lng:  8.7149 },
  'Siliana':      { lat: 36.0850, lng:  9.3708 },
  'Sousse':       { lat: 35.8283, lng: 10.6346 },
  'Monastir':     { lat: 35.7643, lng: 10.8113 },
  'Mahdia':       { lat: 35.5047, lng: 11.0622 },
  'Sfax':         { lat: 34.7399, lng: 10.7600 },
  'Kairouan':     { lat: 35.6781, lng: 10.0963 },
  'Kasserine':    { lat: 35.1676, lng:  8.8365 },
  'Sidi Bouzid':  { lat: 35.0382, lng:  9.4849 },
  'Gabès':        { lat: 33.8814, lng: 10.0982 },
  'Médenine':     { lat: 33.3550, lng: 10.5054 },
  'Tataouine':    { lat: 32.9211, lng: 10.4516 },
  'Gafsa':        { lat: 34.4250, lng:  8.7842 },
  'Tozeur':       { lat: 33.9197, lng:  8.1335 },
  'Kébili':       { lat: 33.7046, lng:  8.9690 },
};

// ─── Index de coordonnées construit depuis tunisia.json ───────────────────────
const TUNISIA_ZONE_COORDS = {};
Object.entries(TUNISIA_DATA).forEach(([gouvernorat, places]) => {
  // Indexer chaque délégation et localité
  places.forEach(place => {
    if (place.lat != null && place.lng != null) {
      const coords = { lat: place.lat, lng: place.lng };
      if (place.delegation && !TUNISIA_ZONE_COORDS[place.delegation]) {
        TUNISIA_ZONE_COORDS[place.delegation] = coords;
      }
      if (place.localite && !TUNISIA_ZONE_COORDS[place.localite]) {
        TUNISIA_ZONE_COORDS[place.localite] = coords;
      }
    }
  });
  // Indexer le gouvernorat lui-même (premier enregistrement avec coords)
  const first = places.find(p => p.lat != null && p.lng != null);
  if (first && !TUNISIA_ZONE_COORDS[gouvernorat]) {
    TUNISIA_ZONE_COORDS[gouvernorat] = { lat: first.lat, lng: first.lng };
  }
});

// ─── Cache des coordonnées par nom de zone (persiste entre renders) ───────────
const zoneCoordCache = {};
let   zoneFetchRunning = false; // garde anti-concurrent

const getZoneCoords = (name, gouvernorat) => {
  if (zoneCoordCache[name] !== undefined) return zoneCoordCache[name];

  // 1. Recherche exacte dans tunisia.json
  let coords = TUNISIA_ZONE_COORDS[name];

  // 2. Recherche insensible à la casse dans tunisia.json
  if (!coords) {
    const lowerName = name.toLowerCase();
    const key = Object.keys(TUNISIA_ZONE_COORDS).find(k => k.toLowerCase() === lowerName);
    if (key) coords = TUNISIA_ZONE_COORDS[key];
  }

  // 3. Recherche partielle dans tunisia.json
  if (!coords) {
    const lowerName = name.toLowerCase();
    const key = Object.keys(TUNISIA_ZONE_COORDS).find(
      k => k.toLowerCase().includes(lowerName) || lowerName.includes(k.toLowerCase())
    );
    if (key) coords = TUNISIA_ZONE_COORDS[key];
  }

  // 4. Fallback sur GOVERNORATE_COORDS (centres pré-définis)
  if (!coords) {
    coords = GOVERNORATE_COORDS[name];
    if (!coords && gouvernorat) coords = GOVERNORATE_COORDS[gouvernorat];
  }

  zoneCoordCache[name] = coords || null;
  return zoneCoordCache[name];
};

const ZONE_RADII = [
  { label: '500 m',  value: 500   },
  { label: '1 km',   value: 1000  },
  { label: '2 km',   value: 2000  },
  { label: '5 km',   value: 5000  },
  { label: '10 km',  value: 10000 },
];

// ─── Globe 3D HTML ────────────────────────────────────────────────────────────
const buildGlobeHTML = (lat, lng, styleKey = 'satellite') => {
  const gs = MAP_STYLES.find(s => s.key === styleKey) || MAP_STYLES.find(s => s.key === 'satellite');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#00010a;overflow:hidden}
canvas{display:block}
#loader{
  position:fixed;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px;
  background:radial-gradient(ellipse at 50% 60%,#060d2a 0%,#00010a 70%);
  transition:opacity .5s ease;z-index:10;
}
#loader.out{opacity:0;pointer-events:none}
.spinner{
  width:42px;height:42px;
  border:2.5px solid rgba(91,110,245,0.25);
  border-top-color:#5B6EF5;
  border-radius:50%;
  animation:spin .85s cubic-bezier(.4,0,.2,1) infinite;
}
.loader-label{color:rgba(255,255,255,.45);font-family:-apple-system,sans-serif;font-size:13px;letter-spacing:.6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="loader"><div class="spinner"></div><span class="loader-label">Chargement du globe…</span></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" crossorigin="anonymous"></script>
<script>
var _threeReady = typeof THREE !== 'undefined';
function _onThreeReady() { document.getElementById('loader').classList.add('out'); setTimeout(initGlobe, 80); }
if (_threeReady) { _onThreeReady(); }
else { document.querySelector('script[src*="three"]').addEventListener('load', _onThreeReady); }

function initGlobe() {
  var W = window.innerWidth, H = window.innerHeight;
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, W/H, 0.01, 1000);
  camera.position.z = 2.6;

  var renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance', alpha:false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x00010a);
  document.body.appendChild(renderer.domElement);

  var minZ = 0.85, maxZ = 5.0;

  // ── Étoiles en 3 couches (petit / moyen / brillant) ─────────────────────
  function starLayer(n, size, opacity) {
    var p = new Float32Array(n * 3);
    for (var i = 0; i < p.length; i++) p[i] = (Math.random() - .5) * 480;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      color:0xffffff, size:size, transparent:true, opacity:opacity, sizeAttenuation:true
    }));
  }
  scene.add(starLayer(4500, 0.22, 0.55));
  scene.add(starLayer(1000, 0.48, 0.35));
  scene.add(starLayer(180,  0.85, 0.22));

  // ── Texture satellite ────────────────────────────────────────────────────
  var ZOOM=3, TILE_N=8, TILE_SZ=128, TEX_SZ=1024;
  var tc = document.createElement('canvas');
  tc.width = tc.height = TEX_SZ;
  var ctx = tc.getContext('2d');
  ctx.fillStyle = '#0d2240'; ctx.fillRect(0,0,TEX_SZ,TEX_SZ);
  var mapTex = new THREE.CanvasTexture(tc);
  mapTex.generateMipmaps = true;
  mapTex.minFilter = THREE.LinearMipmapLinearFilter;
  mapTex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  var SERVERS = ${JSON.stringify(gs.subdomains)};
  var BASE_URL = '${gs.url}';

  function tileUrl(x,y) {
    var s = SERVERS.length > 1 ? SERVERS[x % SERVERS.length] : (SERVERS[0] || '');
    return BASE_URL.replace('{s}',s).replace('{z}',ZOOM).replace('{x}',x).replace('{y}',y).replace('{r}','');
  }
  function loadTiles() {
    ctx.fillStyle='#0d2240'; ctx.fillRect(0,0,TEX_SZ,TEX_SZ);
    var tiles=[]; for(var tx=0;tx<TILE_N;tx++) for(var ty=0;ty<TILE_N;ty++) tiles.push([tx,ty]);
    var B=6, idx=0;
    function batch() {
      var b=tiles.slice(idx,idx+B); idx+=B; if(!b.length) return;
      var done=0;
      b.forEach(function(t){
        var img=new Image(); img.crossOrigin='anonymous'; img.src=tileUrl(t[0],t[1]);
        img.onload=function(){ ctx.drawImage(img,t[0]*TILE_SZ,t[1]*TILE_SZ,TILE_SZ,TILE_SZ); mapTex.needsUpdate=true; if(++done===b.length) batch(); };
        img.onerror=function(){ if(++done===b.length) batch(); };
      });
    }
    batch();
  }
  loadTiles();

  // ── Globe ────────────────────────────────────────────────────────────────
  var globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 42, 42),
    new THREE.MeshPhongMaterial({ map:mapTex, specular:new THREE.Color(0x0a1833), shininess:14 })
  );
  scene.add(globe);

  // Halo atmosphérique interne
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.725, 32, 32),
    new THREE.MeshBasicMaterial({ color:0x1a5cdd, transparent:true, opacity:0.07, side:THREE.BackSide })
  ));
  // Glow externe
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.80, 32, 32),
    new THREE.MeshBasicMaterial({ color:0x2244aa, transparent:true, opacity:0.03, side:THREE.BackSide })
  ));

  // ── Lumières ─────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x223355, 0.85));
  var sun = new THREE.DirectionalLight(0xfff6e8, 1.35);
  sun.position.set(5,3,4); scene.add(sun);
  var fill = new THREE.DirectionalLight(0x112244, 0.35);
  fill.position.set(-4,-2,-3); scene.add(fill);

  function orientTo(lat, lng) {
    globe.rotation.y = -(lng+180)*Math.PI/180;
    globe.rotation.x = -lat*Math.PI/180*0.6;
  }
  orientTo(${lat}, ${lng});

  // ── Touch (drag + pinch + inertie) ───────────────────────────────────────
  var autoRotate=true, rotSpeed=0.0014;
  var dragging=false, lastX=0, lastY=0, lastPinchDist=0;
  var velX=0, velY=0, autoTimer=null, switchSent=false;

  renderer.domElement.addEventListener('touchstart', function(e){
    if(autoTimer) clearTimeout(autoTimer);
    autoRotate=false; switchSent=false; velX=0; velY=0;
    if(e.touches.length===1){ dragging=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; }
    else if(e.touches.length===2){
      dragging=false;
      lastPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    }
  },{passive:true});

  renderer.domElement.addEventListener('touchmove', function(e){
    e.preventDefault();
    if(e.touches.length===1 && dragging){
      var dx=e.touches[0].clientX-lastX, dy=e.touches[0].clientY-lastY;
      globe.rotation.y+=dx*0.006; globe.rotation.x+=dy*0.006;
      globe.rotation.x=Math.max(-1.3,Math.min(1.3,globe.rotation.x));
      velX=dx*0.004; velY=dy*0.004;
      lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    } else if(e.touches.length===2){
      var dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      camera.position.z=Math.max(minZ,Math.min(maxZ, camera.position.z+(lastPinchDist-dist)*0.009));
      lastPinchDist=dist;
      if(camera.position.z<=minZ+0.03 && !switchSent){
        switchSent=true;
        var cLng=-(globe.rotation.y*180/Math.PI)-180;
        var cLat=-(globe.rotation.x/0.6)*180/Math.PI;
        window.ReactNativeWebView.postMessage('SWITCH_TO_MAP:'+cLat.toFixed(5)+':'+cLng.toFixed(5));
      }
    }
  },{passive:false});

  renderer.domElement.addEventListener('touchend', function(){
    dragging=false;
    autoTimer=setTimeout(function(){ autoRotate=true; velX=0; velY=0; }, 3500);
  },{passive:true});

  window.centerGlobe = function(lat,lng){ orientTo(lat,lng); };
  window.reloadStyle = function(url,srv){ BASE_URL=url; SERVERS=srv; loadTiles(); };
  window.orientTo    = function(lat,lng){ orientTo(lat,lng); };

  // ── Boucle de rendu (~60 fps, inertie post-swipe) ────────────────────────
  var lastFrame=0;
  function animate(ts){
    requestAnimationFrame(animate);
    if(ts-lastFrame < 14) return;
    lastFrame=ts;
    if(!dragging){
      globe.rotation.y+=velX; globe.rotation.x+=velY;
      globe.rotation.x=Math.max(-1.3,Math.min(1.3,globe.rotation.x));
      velX*=0.90; velY*=0.90;
      if(Math.abs(velX)<0.0001) velX=0;
      if(Math.abs(velY)<0.0001) velY=0;
    }
    if(autoRotate) globe.rotation.y+=rotSpeed;
    renderer.render(scene,camera);
  }
  requestAnimationFrame(animate);

  window.addEventListener('resize',function(){
    W=window.innerWidth; H=window.innerHeight;
    camera.aspect=W/H; camera.updateProjectionMatrix(); renderer.setSize(W,H);
  });

  window.ReactNativeWebView.postMessage('READY');
}
</script>
</body>
</html>`;
};

// ─── Carte 2D Leaflet ─────────────────────────────────────────────────────────
const buildMapHTML = (lat, lng, pickMode = false, zoneRadius = 1000, styleKey = 'clair') => {
  const style = MAP_STYLES.find(s => s.key === styleKey) || MAP_STYLES[0];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}

/* ── Marqueur pulsé (points zone) ── */
@keyframes dot-pulse {
  0%   { box-shadow:0 0 0 0   rgba(59,126,246,.65), 0 2px 10px rgba(0,0,0,.3); }
  70%  { box-shadow:0 0 0 10px rgba(59,126,246,.0),  0 2px 10px rgba(0,0,0,.3); }
  100% { box-shadow:0 0 0 0   rgba(59,126,246,.0),  0 2px 10px rgba(0,0,0,.3); }
}
.dot-pulse {
  width:13px;height:13px;border-radius:50%;
  background:#3B7EF6;border:2.5px solid #1A6CE8;
  animation:dot-pulse 2s ease-out infinite;
  cursor:pointer;transition:transform .15s;
  display:flex;align-items:center;justify-content:center;
}
.dot-pulse:active{transform:scale(1.4)}
.dot-inner {
  width:5px;height:5px;border-radius:50%;
  background:rgba(255,255,255,0.85);
  pointer-events:none;
}

/* ── Tooltip dark ── */
.leaflet-tooltip {
  background:rgba(12,14,28,.88) !important;
  border:1px solid rgba(255,255,255,.1) !important;
  border-radius:10px !important;
  color:#e2e8f0 !important;
  font-size:12px !important;
  padding:7px 11px !important;
  box-shadow:0 4px 20px rgba(0,0,0,.45) !important;
  backdrop-filter:blur(6px);
}
.leaflet-tooltip::before{display:none!important}

/* ── Cercle de zone animé ── */
@keyframes circle-dash {
  to { stroke-dashoffset: -30; }
}
.zone-circle-path {
  animation: circle-dash 2.5s linear infinite;
}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
window.onerror = function(msg, src, line) {
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage('JS_ERROR:' + msg + ' @' + src + ':' + line);
};
var map = L.map('map', {
  center:[${lat},${lng}], zoom:8,
  zoomControl:false, attributionControl:false,
  preferCanvas:true,
  zoomAnimationThreshold:4,
});

var tileLayer = L.tileLayer('${style.url}', {
  subdomains:${JSON.stringify(style.subdomains)},
  maxZoom:${style.maxZoom}, minZoom:1,
  keepBuffer:4, updateWhenIdle:false,
  detectRetina:true, crossOrigin:true,
}).addTo(map);

window.centerOnUser = function(lat,lng) {
  map.setView([lat,lng], map.getZoom(), { animate:true, duration:0.6 });
};

// ── Réinitialiser le fond de carte sans remount ────────────────────────────────
window.reloadStyle = function(url, subdomains, maxZoom) {
  map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(url, {
    subdomains: subdomains || ['a','b','c'],
    maxZoom: maxZoom || 19, minZoom:1,
    keepBuffer:4, updateWhenIdle:false,
    detectRetina:true, crossOrigin:true,
  }).addTo(map);
};

// ── Cercle de zone ─────────────────────────────────────────────────────────────
var isPickMode = ${pickMode ? 'true' : 'false'};
var zoneCircle = L.circle([${lat},${lng}], {
  radius: ${zoneRadius},
  color:'#34C759', fillColor:'#34C759',
  fillOpacity: isPickMode ? 0.10 : 0.07,
  weight: isPickMode ? 2.5 : 2,
  dashArray:'8,5',
  opacity: isPickMode ? 1 : 0,
}).addTo(map);

// Animer les tirets du cercle via SVG classe après ajout
setTimeout(function(){
  var paths = document.querySelectorAll('.leaflet-overlay-pane path');
  paths.forEach(function(p){ p.classList.add('zone-circle-path'); });
}, 200);

window.showZoneCircle = function(show) {
  zoneCircle.setStyle({ opacity:show?1:0, fillOpacity:show?0.10:0 });
};

window.snapZoneToPoint = function(lat, lng, radius, zoneName) {
  zoneCircle.setLatLng([lat,lng]);
  zoneCircle.setRadius(radius||1000);
  zoneCircle.setStyle({ opacity:1, fillOpacity:0.12, color:'#34C759', fillColor:'#34C759' });
  map.flyTo([lat,lng], 13, { animate:true, duration:1.0, easeLinearity:0.3 });
  window.ReactNativeWebView.postMessage('ZONE_SNAP:'+lat.toFixed(5)+':'+lng.toFixed(5)+':'+(zoneName||''));
};

window.updateZoneCircle = function(lat, lng, radius) {
  zoneCircle.setLatLng([lat,lng]);
  zoneCircle.setRadius(radius);
};

map.on('moveend', function() {
  var c = map.getCenter();
  window.ReactNativeWebView.postMessage('MAP_CENTER:'+c.lat.toFixed(6)+':'+c.lng.toFixed(6));
  if (isPickMode) zoneCircle.setLatLng([c.lat,c.lng]);
});
map.on('zoomend', function() {
  var z = map.getZoom();
  if (z <= 2) window.ReactNativeWebView.postMessage('SWITCH_TO_GLOBE');
  window.ReactNativeWebView.postMessage('MAP_ZOOM:'+z);
});

// ── Points verts — CLIQUABLES avec animation pulse ────────────────────────────
var zoneDotLayer = L.layerGroup().addTo(map);
window.addZoneDots = function(dots) {
  zoneDotLayer.clearLayers();
  dots.forEach(function(d) {
    var icon = L.divIcon({
      className:'',
      html:'<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">' +
           '<div class="dot-pulse"><div class="dot-inner"></div></div></div>',
      iconSize:[36,36], iconAnchor:[18,18],
    });
    var m = L.marker([d.lat,d.lng], { icon:icon });
    m.bindTooltip(
      '<b style="font-size:13px">' + d.name + '</b><br/>' +
      '<span style="color:#3B7EF6;font-size:11px">● ' + d.local + ' local</span>' +
      '&nbsp;&nbsp;<span style="color:#60a5fa;font-size:11px">● ' + d.duo + ' duo</span>',
      { direction:'top', offset:[0,-17], permanent:false }
    );
    m.on('click', function(){ window.snapZoneToPoint(d.lat,d.lng,1000,d.name); });
    zoneDotLayer.addLayer(m);
  });
};

// Pre-populate governorate dots immediately — no async injection needed for initial display
addZoneDots(${JSON.stringify(
  Object.entries(GOVERNORATE_COORDS).map(([name, c]) => ({ name, lat: c.lat, lng: c.lng, local: 0, duo: 0 }))
)});

// ── Icônes SVG par catégorie — Zones admin ────────────────────────────────────
function normCat(s) {
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
}
var ZONE_ICONS = {
  hotel:      { color:'#8B5CF6', svg:'<rect fill="currentColor" x="2" y="16" width="20" height="3" rx="1.5"/><rect fill="currentColor" x="2" y="5" width="3" height="13" rx="1.5"/><rect fill="currentColor" x="5" y="10" width="17" height="9" rx="2"/><rect fill="currentColor" x="6" y="7" width="5" height="5" rx="1"/><rect fill="currentColor" x="13" y="7" width="5" height="5" rx="1"/>' },
  sante:      { color:'#EF4444', svg:'<rect fill="currentColor" x="10" y="3" width="4" height="18" rx="2"/><rect fill="currentColor" x="3" y="10" width="18" height="4" rx="2"/>' },
  universite: { color:'#3B7EF6', svg:'<polygon fill="currentColor" points="12,4 23,9.5 12,15 1,9.5"/><path fill="currentColor" d="M6,13L6,18Q6,21 12,21Q18,21 18,18L18,13L12,16Z"/>' },
  restaurant: { color:'#F59E0B', svg:'<rect fill="currentColor" x="6" y="3" width="1.5" height="8" rx=".75"/><rect fill="currentColor" x="8" y="3" width="1.5" height="8" rx=".75"/><rect fill="currentColor" x="10" y="3" width="1.5" height="8" rx=".75"/><rect fill="currentColor" x="7.5" y="11" width="2" height="10" rx="1"/><path fill="currentColor" d="M15,3L18,3Q20,5 20,9L15,9Z"/><rect fill="currentColor" x="15" y="9" width="2.5" height="12" rx="1.25"/>' },
  commerce:   { color:'#14B8A6', svg:'<path fill="currentColor" d="M2,10L5,3L19,3L22,10Z"/><rect fill="currentColor" x="3" y="10" width="18" height="12" rx="1"/>' },
  parc:       { color:'#22C55E', svg:'<path fill="currentColor" d="M12,2L22,16L17,16L17,21L7,21L7,16L2,16Z"/>' },
  musee:      { color:'#D97706', svg:'<polygon fill="currentColor" points="1,9 23,9 12,3"/><rect fill="currentColor" x="2" y="9" width="3" height="11"/><rect fill="currentColor" x="7.5" y="9" width="3" height="11"/><rect fill="currentColor" x="13.5" y="9" width="3" height="11"/><rect fill="currentColor" x="19" y="9" width="3" height="11"/><rect fill="currentColor" x="1" y="20" width="22" height="3" rx="1"/>' },
  sport:      { color:'#6366F1', svg:'<rect fill="currentColor" x="1" y="9" width="4" height="6" rx="1.5"/><rect fill="currentColor" x="19" y="9" width="4" height="6" rx="1.5"/><rect fill="currentColor" x="2.5" y="7" width="3" height="10" rx="1"/><rect fill="currentColor" x="18.5" y="7" width="3" height="10" rx="1"/><rect fill="currentColor" x="5.5" y="11" width="13" height="2" rx="1"/>' },
  autre:      { color:'#6B7280', svg:'<circle fill="currentColor" cx="5" cy="12" r="2.5"/><circle fill="currentColor" cx="12" cy="12" r="2.5"/><circle fill="currentColor" cx="19" cy="12" r="2.5"/>' },
};

var adminZoneLayer = L.layerGroup().addTo(map);
window.addAdminZones = function(zones) {
  adminZoneLayer.clearLayers();
  zones.forEach(function(z) {
    var cfg = ZONE_ICONS[normCat(z.categorie)] || ZONE_ICONS['autre'];
    var html =
      '<div style="width:28px;height:28px;border-radius:50%;' +
      'background:' + cfg.color + '22;border:2px solid ' + cfg.color + ';' +
      'display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.28);cursor:pointer;">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="' + cfg.color + '">' +
      cfg.svg + '</svg></div>';
    var icon = L.divIcon({ className:'', html:html, iconSize:[28,28], iconAnchor:[14,14] });
    var m = L.marker([z.lat,z.lng], { icon:icon });
    var tip = '<b>' + z.name + '</b>';
    if (z.categorie) tip += '<br/><span style="color:' + cfg.color + ';font-size:11px">&#9679; ' + z.categorie + '</span>';
    m.bindTooltip(tip, { direction:'top', offset:[0,-20] });
    m.on('click', function(){
      window.ReactNativeWebView.postMessage('ADMIN_ZONE:'+z.lat.toFixed(5)+':'+z.lng.toFixed(5)+':'+(z.name||''));
    });
    adminZoneLayer.addLayer(m);
  });
};

window.ReactNativeWebView.postMessage('READY');
</script>
</body>
</html>`;
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function MapScreen() {
  const navigation = useNavigation();
  const route      = useRoute ? useRoute() : { params: {} };
  const { t }      = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const pickMode   = route?.params?.pickMode === true; // mode sélection zone

  // ── Radio Garden : snap vers une zone depuis LocalScreen ──────────────────
  // Quand LocalScreen appelle navigation.navigate('Map', { snapToZone: {name, lat, lng} })
  // on fait glisser le cercle vers ces coords avec une animation fluide
  const snapToZone = route?.params?.snapToZone || null;

  const [userCoords, setUserCoords] = useState(DEFAULT_COORDS);
  const [mode, setMode] = useState('map');
  const [mapCenter, setMapCenter] = useState(null);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [pubResults,  setPubResults]  = useState([]);
  const [pubLoading,  setPubLoading]  = useState(false);
  const pubSearchTimer = useRef(null);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [modeView,  setModeView]  = useState('local'); // 'local' | 'duo'
  const [mapStyle,  setMapStyle]  = useState('clair');
  const [pickedCenter, setPickedCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(8);

  const [refreshingDots, setRefreshingDots] = useState(false);
  const pullAnim   = useRef(new Animated.Value(0)).current;
  const pullActive = useRef(false);

  // ── Zone Circle (pickMode) ────────────────────────────────────────────────
  const [zoneRadius,       setZoneRadius]       = useState(1000);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [selectedGov,      setSelectedGov]      = useState('');
  const [selectedDeleg,    setSelectedDeleg]    = useState('');
  const [selectedLocale,   setSelectedLocale]   = useState('');
  const [showGovPicker,    setShowGovPicker]    = useState(false);
  const [showDelegPicker,  setShowDelegPicker]  = useState(false);
  const [showLocalePicker, setShowLocalePicker] = useState(false);
  const [detectedZone, setDetectedZone] = useState(''); // gouvernorat détecté par position
  const [zoneCounts,   setZoneCounts]   = useState({ local: 0, duo: 0 });
  const [zoneDots,     setZoneDots]     = useState([]); // tous les points verts chargés
  const snapTimer = useRef(null);

  const delegations = selectedGov ? [...new Set((TUNISIA_DATA[selectedGov] || []).map(e => e.delegation))].sort() : [];
  const locales = selectedGov && selectedDeleg ? (TUNISIA_DATA[selectedGov] || []).filter(e => e.delegation === selectedDeleg).map(e => e.localite).sort() : [];

  // Détecte le gouvernorat via Nominatim reverse geocode (avec cache)
  const detectZoneFromCoords = async (lat, lng) => {
    try {
      const zone = await cachedZone(lat, lng, async (la, lo) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=fr&zoom=8`,
          { headers: { 'User-Agent': 'ByMap/1.0' } }
        );
        const data = await res.json();

        // En Tunisie, Nominatim renvoie "Gouvernorat de Sidi Bouzid" dans state
        let raw =
          data.address?.county  ||
          data.address?.state   ||
          data.address?.region  ||
          data.address?.city    ||
          '';

        // Nettoie les préfixes arabes/français courants
        raw = raw
          .replace(/^gouvernorat\s+de\s+/i, '')
          .replace(/^wilaya\s+de\s+/i, '')
          .trim();

        // Cherche la correspondance exacte ou partielle dans les clés tunisia.json
        const match = TUNISIA_GOVERNORATES.find(g =>
          g.toLowerCase() === raw.toLowerCase()
        ) || TUNISIA_GOVERNORATES.find(g =>
          raw.toLowerCase().includes(g.toLowerCase()) ||
          g.toLowerCase().includes(raw.toLowerCase())
        );

        return match || raw || '—';
      });

      setDetectedZone(zone);
      cityBarZoneRef.current = zone || cityBarZoneRef.current;
      if (zone && zone !== '—') fetchZoneCounts(zone);
    } catch {
      setDetectedZone('—');
    }
  };

  const fetchZoneCounts = async (zone) => {
    try {
      // Resolve parent gouvernorat for sub-zones (e.g. "Lessouda" → "Sidi Bouzid")
      const zn = zone?.toLowerCase() || '';
      const match = adminZonesRef.current.find(z => z.name?.toLowerCase() === zn);
      const queryVille = match?.gouvernorat || zone;
      const isSubZone  = !!match?.gouvernorat;

      const [rLocal, rDuo] = await Promise.all([
        fetch(`${API_URL}/publications?ville=${encodeURIComponent(queryVille)}&mode=local&limit=200`),
        fetch(`${API_URL}/publications?ville=${encodeURIComponent(queryVille)}&mode=duo&limit=200`),
      ]);
      const [dLocal, dDuo] = await Promise.all([rLocal.json(), rDuo.json()]);

      const filterByZone = (pubs) => {
        if (!isSubZone) return pubs?.length ?? 0;
        return (pubs || []).filter(p => {
          const loc = p.localisation || {};
          return (
            (loc.gouvernorat && loc.gouvernorat.toLowerCase() === zn) ||
            (loc.delegation  && loc.delegation.toLowerCase()  === zn)
          );
        }).length;
      };

      setZoneCounts({
        local: filterByZone(dLocal.publications),
        duo:   filterByZone(dDuo.publications),
      });
    } catch {
      setZoneCounts({ local: 0, duo: 0 });
    }
  };

  const injectDots = (dots) => {
    setZoneDots(dots);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`addZoneDots(${JSON.stringify(dots)}); true;`);
    }
  };

  const governorateFallback = () =>
    Object.entries(GOVERNORATE_COORDS).map(([name, c]) => ({
      name, lat: c.lat, lng: c.lng, local: 0, duo: 0,
    }));

  const fetchAndInjectZoneDots = async () => {
    if (zoneFetchRunning) return;
    zoneFetchRunning = true;
    setRefreshingDots(true);
    try {
      const res  = await fetch(`${API_URL}/publications/zone-dots`);
      const data = await res.json();
      const zones = data.zones || [];

      const dots = [];
      for (const z of zones) {
        const coords = getZoneCoords(z.name, z.gouvernorat);
        if (coords) dots.push({ name: z.name, lat: coords.lat, lng: coords.lng, local: z.local, duo: z.duo });
      }

      // If API returns no zones, fall back to governorate centers
      injectDots(dots.length > 0 ? dots : governorateFallback());
    } catch (e) {
      console.error('[ZONE DOTS]', e);
      // API unreachable — still show governorate centers
      injectDots(governorateFallback());
    } finally {
      zoneFetchRunning = false;
      setRefreshingDots(false);
    }
  };

  const fetchAndInjectAdminZones = async () => {
    try {
      const res  = await fetch(`${API_URL}/zones`);
      const data = await res.json();
      const zones = (data.zones || []).filter(z => z.lat != null && z.lng != null);
      adminZonesRef.current = data.zones || []; // cache all zones (with gouvernorat) for parent lookup
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`addAdminZones(${JSON.stringify(zones)}); true;`);
      }
    } catch (e) {
      console.error('[ADMIN ZONES]', e);
    }
  };

  const webViewRef = useRef(null);
  const adminZonesRef = useRef([]); // cached from /zones, used for parent-zone lookups
  const locationSubscription = useRef(null);
  const isFollowing = useRef(true);
  const menuAnim  = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;
  const backBtnAnim = useRef(new Animated.Value(1)).current;

  // ── Radio Garden Joystick ─────────────────────────────────────────────────
  const RG_RADIUS    = 70; // rayon du grand cercle (moitié du diamètre 140)
  const joystickPan  = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [cityName,   setCityName]   = useState('Tunis — Ariana');
  const [isFavorite, setIsFavorite] = useState(false);
  const geocodeTimer  = useRef(null);
  const detectTimer   = useRef(null);
  const moveInterval  = useRef(null);
  const currentCenter = useRef(null);
  const joystickDelta = useRef({ dx: 0, dy: 0, active: false });

  // Ref pour la zone courante (évite la stale closure dans PanResponder)
  const cityBarZoneRef = useRef(detectedZone || cityName);

  // Animation clignotante de la flèche ↑
  const arrowAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // PanResponder : glisser vers le haut → ouvrir Local
  const cityBarPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy < -8,
      onPanResponderRelease: (_, { dy }) => {
        if (dy < -40) {
          navigation.navigate('Local', { zone: cityBarZoneRef.current });
        }
      },
    })
  ).current;

  const reverseGeocode = async (lat, lng) => {
    try {
      const city = await cachedGeocode(lat, lng, async (la, lo) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=fr`,
          { headers: { 'User-Agent': 'ByMap/1.0' } }
        );
        const data = await res.json();
        return (
          data.address?.city    ||
          data.address?.town    ||
          data.address?.village ||
          data.address?.county  ||
          data.display_name?.split(',')[0] || null
        );
      });
      if (city) { setCityName(city); cityBarZoneRef.current = city; }
    } catch {}
  };

  // Mouvement continu pendant que le pouce est tenu
  const startContinuousMove = () => {
    if (moveInterval.current) return;
    moveInterval.current = setInterval(() => {
      if (!joystickDelta.current.active || !webViewRef.current) return;
      const { dx, dy } = joystickDelta.current;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) return;
      const norm  = dist / RG_RADIUS; // 0..1
      const speed = 0.00015 * norm * norm; // accélération quadratique
      const angle = Math.atan2(dy, dx);
      const dlat  = -Math.sin(angle) * speed;
      const dlng  =  Math.cos(angle) * speed;
      webViewRef.current.injectJavaScript(
        `map.panTo([map.getCenter().lat+${dlat},map.getCenter().lng+${dlng}],{animate:false});true;`
      );
    }, 16); // ~60fps
  };

  const stopContinuousMove = () => {
    if (moveInterval.current) { clearInterval(moveInterval.current); moveInterval.current = null; }
    joystickDelta.current.active = false;
  };

  const joystickResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        joystickPan.setOffset({ x: joystickPan.x._value, y: joystickPan.y._value });
        joystickPan.setValue({ x: 0, y: 0 });
        joystickDelta.current.active = true;
        startContinuousMove();
      },
      onPanResponderMove: (_, gs) => {
        // Clamp pouce dans le cercle
        const dist  = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);
        const clamp = Math.min(dist, RG_RADIUS);
        const angle = Math.atan2(gs.dy, gs.dx);
        const cx = clamp * Math.cos(angle);
        const cy = clamp * Math.sin(angle);
        joystickPan.setValue({ x: cx, y: cy });
        joystickDelta.current = { dx: cx, dy: cy, active: true };

        // Geocodage différé
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        geocodeTimer.current = setTimeout(() => {
          if (currentCenter.current)
            reverseGeocode(currentCenter.current.latitude, currentCenter.current.longitude);
        }, 600);
      },
      onPanResponderRelease: () => {
        joystickPan.flattenOffset();
        Animated.spring(joystickPan, {
          toValue: { x: 0, y: 0 },
          tension: 120, friction: 7,
          useNativeDriver: false,
        }).start();
        stopContinuousMove();
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      },
    })
  ).current;


  // Recharge le user connecté à chaque fois qu'on revient sur la Map
  useFocusEffect(
    React.useCallback(() => {
      getCurrentUser().then(setCurrentUser);
    }, [])
  );

  // Shine sweep on cityBar — loops every ~4s
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4000),
        Animated.timing(shineAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Radio Garden : glisse le cercle vers la zone cliquée depuis LocalScreen
  // Déclenché quand snapToZone change (navigation.navigate('Map', { snapToZone }))
  useEffect(() => {
    if (!snapToZone) return;
    const { lat, lng, name } = snapToZone;
    if (!lat || !lng) return;

    const newCenter = { latitude: lat, longitude: lng };

    // 1. Basculer en mode carte si on est en globe
    if (mode !== 'map') {
      setMode('map');
      setReady(false);
    }
    // 2. Mettre à jour le centre — la carte va se recharger sur ces coords
    setMapCenter(newCenter);
    setPickedCenter(newCenter);
    currentCenter.current = newCenter;

    // 3. Quand la carte est prête, injecter le recentrage fluide + cercle
    //    (géré dans l'effect [ready] ci-dessous via mapCenter)
  }, [snapToZone]);

  // ── Vérifier si la zone affichée est en favoris ──────────────────────────────
  useEffect(() => {
    const zoneName = snapToZone?.name || detectedZone || cityName;
    if (!zoneName || !currentUser) { setIsFavorite(false); return; }
    checkFavorite(zoneName).then(setIsFavorite).catch(() => setIsFavorite(false));
  }, [snapToZone, detectedZone, cityName, currentUser]);

  // 4. Dès que la carte est prête ET qu'on a un snapToZone, on centre + cercle
  useEffect(() => {
    if (!ready || !webViewRef.current || !snapToZone) return;
    const { lat, lng, name } = snapToZone;
    // flyTo + déplacer le cercle vert en une seule commande JS
    webViewRef.current.injectJavaScript(
      `window.snapZoneToPoint(${lat}, ${lng}, 1000, '${(name || '').replace(/'/g, '')}'); true;`
    );
  }, [ready, snapToZone]);

  // Géolocalisation désactivée — Tunis affiché par défaut

  useEffect(() => {
    if (!ready || !userCoords || !webViewRef.current) return;
    if (mode === 'globe') {
      webViewRef.current.injectJavaScript(`centerGlobe(${userCoords.latitude},${userCoords.longitude}); true;`);
    } else {
      if (isFollowing.current) {
        webViewRef.current.injectJavaScript(`centerOnUser(${userCoords.latitude},${userCoords.longitude}); true;`);
      }
    }
  }, [userCoords, ready]);

  // startLocationTracking supprimé

  // Injecter les points quand la carte est prête
  useEffect(() => {
    if (!ready || mode !== 'map') return;
    // Inject cached dots immediately so map reloads don't leave the map blank
    if (zoneDots.length > 0 && webViewRef.current) {
      webViewRef.current.injectJavaScript(`addZoneDots(${JSON.stringify(zoneDots)}); true;`);
    }
    fetchAndInjectZoneDots();
    fetchAndInjectAdminZones();
  }, [ready, mode]);

  // Pull-to-refresh : glisser vers le bas depuis le haut de la carte
  const fetchDotsRef = useRef(null);
  useEffect(() => { fetchDotsRef.current = fetchAndInjectZoneDots; });


  const pullResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && gs.moveY < 140 && !pullActive.current,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) pullAnim.setValue(Math.min(gs.dy * 0.5, 50));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50) {
          pullActive.current = true;
          fetchDotsRef.current?.().finally(() => { pullActive.current = false; });
        }
        Animated.spring(pullAnim, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  // Mise à jour du cercle de zone quand le rayon change
  useEffect(() => {
    if (!ready || !webViewRef.current || mode !== 'map' || !pickMode) return;
    const c = pickedCenter || mapCenter || coords;
    webViewRef.current.injectJavaScript(
      `updateZoneCircle(${c.latitude},${c.longitude},${zoneRadius}); true;`
    );
  }, [zoneRadius, ready]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSuggestions([]); setPubResults([]); setPubLoading(false); return; }

    // Nominatim (lieux)
    if (query.length >= 3) {
      cachedSearch(query, async (q) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=4&accept-language=fr`,
          { headers: { 'User-Agent': 'ByMap/1.0' } }
        );
        return res.json();
      }).then(data => setSuggestions(data || [])).catch(() => setSuggestions([]));
    }

    // Publications (debounced)
    if (pubSearchTimer.current) clearTimeout(pubSearchTimer.current);
    setPubLoading(true);
    pubSearchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API_URL}/publications?search=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        setPubResults(data.publications || []);
      } catch { setPubResults([]); }
      finally { setPubLoading(false); }
    }, 400);
  };

  const goToPlace = (place) => {
    const lat  = parseFloat(place.lat);
    const lng  = parseFloat(place.lon);
    const name = place.display_name.split(',')[0];
    setSearchQuery(name);
    setSuggestions([]);
    setPubResults([]);
    Keyboard.dismiss();
    // Snap the map + circle to this location, then open the zone screen
    setMapCenter({ latitude: lat, longitude: lng });
    setPickedCenter({ latitude: lat, longitude: lng });
    currentCenter.current = { latitude: lat, longitude: lng };
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.snapZoneToPoint(${lat}, ${lng}, 1000, '${name.replace(/'/g, '')}'); true;`
      );
    }
    navigation.navigate('Local', { zone: name });
  };

  const toggleMenu = () => {
    const toValue = menuOpen ? 0 : 1;
    setMenuOpen(!menuOpen);
    Animated.spring(menuAnim, { toValue, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const onMessage = (e) => {
    const msg = e.nativeEvent.data;
    if (msg === 'READY') {
      setReady(true);
      // Déclenche la détection de zone dès l'ouverture de la carte
      if (pickMode) {
        const c = pickedCenter || mapCenter || DEFAULT_COORDS;
        detectZoneFromCoords(c.latitude, c.longitude);
      }
      return;
    }
    if (msg.startsWith('JS_ERROR:')) { console.error('[WebView]', msg); return; }
    // ── Clic sur point bleu — zone admin ─────────────────────────────────
    if (msg.startsWith('ADMIN_ZONE:')) {
      const raw  = msg.slice('ADMIN_ZONE:'.length);
      const sep1 = raw.indexOf(':');
      const sep2 = raw.indexOf(':', sep1 + 1);
      const zoneName = sep2 >= 0 ? raw.slice(sep2 + 1) : '';
      if (zoneName) navigation.navigate('Local', { zone: zoneName });
      return;
    }
    // ── Radio Garden : clic sur point vert dans la carte Leaflet ──────────
    if (msg.startsWith('ZONE_SNAP:')) {
      // Format: "ZONE_SNAP:lat:lng:zoneName" — lat et lng sont numériques
      const raw   = msg.slice('ZONE_SNAP:'.length);        // "lat:lng:zoneName"
      const sep1  = raw.indexOf(':');
      const sep2  = raw.indexOf(':', sep1 + 1);
      const snapLat  = parseFloat(raw.slice(0, sep1));
      const snapLng  = parseFloat(raw.slice(sep1 + 1, sep2 >= 0 ? sep2 : undefined));
      const snapName = sep2 >= 0 ? raw.slice(sep2 + 1) : '';
      if (!isNaN(snapLat) && !isNaN(snapLng)) {
        const newCenter = { latitude: snapLat, longitude: snapLng };
        setMapCenter(newCenter);
        setPickedCenter(newCenter);
        currentCenter.current = newCenter;
        // Naviguer vers Local avec cette zone (le cercle reste affiché sur Map)
        navigation.navigate('Local', { zone: snapName });
      }
      return;
    }
    if (msg.startsWith('SWITCH_TO_MAP:')) {
      const parts = msg.split(':');
      setMapCenter({ latitude: parseFloat(parts[1]), longitude: parseFloat(parts[2]) });
      setReady(false);
      setMode('map');
      return;
    }
    if (msg === 'SWITCH_TO_GLOBE') { setReady(false); setMode('globe'); return; }
    if (msg.startsWith('MAP_ZOOM:')) { setMapZoom(parseInt(msg.split(':')[1], 10)); return; }
    if (msg.startsWith('MAP_CENTER:')) {
      const parts = msg.split(':');
      const c = { latitude: parseFloat(parts[1]), longitude: parseFloat(parts[2]) };
      setPickedCenter(c);
      currentCenter.current = c;
      if (detectTimer.current) clearTimeout(detectTimer.current);
      detectTimer.current = setTimeout(() => detectZoneFromCoords(c.latitude, c.longitude), 700);
    }
  };

  const centerOnUser = () => {
    isFollowing.current = true;
    if (!ready || !userCoords || !webViewRef.current) return;
    const fn = mode === 'globe'
      ? `centerGlobe(${userCoords.latitude},${userCoords.longitude})`
      : `centerOnUser(${userCoords.latitude},${userCoords.longitude})`;
    webViewRef.current.injectJavaScript(`${fn}; true;`);
  };

  const resetMapView = () => {
    webViewRef.current?.injectJavaScript(
      `map.setView([${DEFAULT_COORDS.latitude},${DEFAULT_COORDS.longitude}],7);true;`
    );
  };

  useEffect(() => {
    Animated.timing(backBtnAnim, {
      toValue: mapZoom > 7 ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [mapZoom]);

  const coords = userCoords || DEFAULT_COORDS;
  const center = mapCenter || coords;

  // Reconstruire le HTML seulement quand les paramètres structurels changent
  const globeHtml = useMemo(
    () => buildGlobeHTML(coords.latitude, coords.longitude, mapStyle),
    [coords.latitude, coords.longitude, mapStyle]
  );
  const mapHtml = useMemo(
    () => buildMapHTML(center.latitude, center.longitude, pickMode, zoneRadius, mapStyle),
    // mapStyle inclus pour le premier chargement — les changements suivants passent par reloadStyle
    [center.latitude, center.longitude, pickMode, zoneRadius, mapStyle]
  );
  const html = mode === 'globe' ? globeHtml : mapHtml;

  return (
    <View style={styles.container}>

      {/* ── Carte / Globe ── */}
      <WebView
        key={mode + '-' + mapStyle}
        ref={webViewRef}
        style={styles.map}
        source={{ html }}
        onMessage={onMessage}
        onTouchStart={() => { isFollowing.current = false; }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        setSupportMultipleWindows={false}
      />

      {/* ── Pull-to-refresh overlay (haut de la carte) ── */}
      {mode === 'map' && !pickMode && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, zIndex: 5 }}
          {...pullResponder.panHandlers}
        >
          <Animated.View style={{
            alignSelf: 'center',
            marginTop: 8,
            transform: [{ translateY: pullAnim }],
            opacity: pullAnim.interpolate({ inputRange: [0, 40], outputRange: [0, 1] }),
          }}>
            {refreshingDots
              ? <ActivityIndicator color="#34C759" size="small" />
              : <Text style={{ color: '#34C759', fontSize: 18, fontWeight: '700' }}>↓</Text>
            }
          </Animated.View>
        </View>
      )}

      {/* Overlay chargement */}
      {!ready && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      )}

      {/* ── Header : Logo + Recherche + Menu ── */}
      <SafeAreaView style={styles.headerOverlay}>
        {/* Barre principale */}
        <View style={styles.headerBar}>

          {/* Bouton retour zoom — apparaît quand zoomé */}
          <Animated.View style={{
            overflow: 'hidden',
            opacity: backBtnAnim,
            width: backBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 42] }),
          }}>
            <TouchableOpacity style={styles.backZoomBtn} onPress={resetMapView} activeOpacity={0.8}>
              <FontAwesome6 name="arrow-left" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>

          {/* Champ de recherche */}
          <View style={styles.searchBox}>
            <FontAwesome6 name="magnifying-glass" size={13} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('map.searchPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
              onSubmitEditing={() => suggestions.length > 0 && goToPlace(suggestions[0])}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); setPubResults([]); }}>
                <FontAwesome6 name="xmark" size={13} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Bouton menu hamburger */}
          <TouchableOpacity style={styles.menuBtn} onPress={toggleMenu} activeOpacity={0.8}>
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 14 }]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>

        {/* ── Résultats combinés (lieux + posts) ── */}
        {(suggestions.length > 0 || pubResults.length > 0 || pubLoading) && (
          <View style={styles.suggestionsBox}>

            {/* Section Lieux */}
            {suggestions.length > 0 && (
              <>
                <View style={styles.resultSectionHeader}>
                  <FontAwesome6 name="map-location-dot" size={10} color="#9CA3AF" />
                  <Text style={styles.resultSectionTitle}>Lieux</Text>
                </View>
                {suggestions.map((item, i) => (
                  <TouchableOpacity
                    key={'place-' + i}
                    style={[styles.suggestionRow, styles.suggestionBorder]}
                    onPress={() => goToPlace(item)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome6 name="location-dot" size={15} color="#2DBD7E" />
                    <View style={styles.suggestionTexts}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>{item.display_name.split(',')[0]}</Text>
                      <Text style={styles.suggestionSub} numberOfLines={1}>{item.display_name.split(',').slice(1, 3).join(', ')}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Section Posts */}
            {(pubResults.length > 0 || pubLoading) && (
              <>
                <View style={styles.resultSectionHeader}>
                  <FontAwesome6 name="newspaper" size={10} color="#9CA3AF" />
                  <Text style={styles.resultSectionTitle}>Publications</Text>
                  {pubLoading && <ActivityIndicator size="small" color="#9CA3AF" style={{ marginLeft: 4 }} />}
                </View>
                {pubResults.map((pub, i) => {
                  const loc = pub.localisation?.gouvernorat || pub.localisation?.ville
                    || pub.localisationDebut?.gouvernorat || pub.localisationDebut?.ville || '';
                  const thumb = pub.medias?.[0]?.url;
                  return (
                    <TouchableOpacity
                      key={'pub-' + (pub._id || i)}
                      style={[styles.suggestionRow, i < pubResults.length - 1 && styles.suggestionBorder]}
                      onPress={() => { navigation.navigate('PublicationDetail', { id: pub._id }); setSearchQuery(''); setSuggestions([]); setPubResults([]); Keyboard.dismiss(); }}
                      activeOpacity={0.7}
                    >
                      {thumb
                        ? <Image source={{ uri: thumb }} style={styles.pubResultThumb} />
                        : <View style={[styles.pubResultThumb, { backgroundColor: 'rgba(45,189,126,0.12)', justifyContent: 'center', alignItems: 'center' }]}>
                            <FontAwesome6 name="image" size={14} color="#2DBD7E" />
                          </View>
                      }
                      <View style={styles.suggestionTexts}>
                        <Text style={styles.suggestionTitle} numberOfLines={2}>{pub.description || '—'}</Text>
                        {loc ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}><FontAwesome6 name="location-dot" size={11} color="#9CA3AF" /><Text style={styles.suggestionSub} numberOfLines={1}>{loc}</Text></View> : null}
                      </View>
                      <View style={[styles.pubResultModeBadge, { backgroundColor: pub.mode === 'duo' ? 'rgba(59,126,246,0.15)' : 'rgba(45,189,126,0.15)' }]}>
                        <Text style={[styles.pubResultModeText, { color: pub.mode === 'duo' ? '#3B7EF6' : '#2DBD7E' }]}>
                          {pub.mode === 'duo' ? 'DUO' : 'LOCAL'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── Bandeau nom de zone ── */}
        {!menuOpen && suggestions.length === 0 && mode === 'map' && (
          <View style={styles.zoneBanner}>
            <Text style={styles.zoneBannerName} numberOfLines={1}>
              {snapToZone?.name || detectedZone || cityName || '…'}
            </Text>
            {currentUser && (
              <TouchableOpacity
                style={styles.zoneFavBtn}
                onPress={async () => {
                  const zoneName = snapToZone?.name || detectedZone || cityName;
                  if (!zoneName) return;
                  // Résoudre les coordonnées : snapToZone > getZoneCoords > null
                  const resolved = snapToZone?.lat
                    ? { lat: snapToZone.lat, lng: snapToZone.lng }
                    : (getZoneCoords(zoneName) ?? { lat: null, lng: null });
                  try {
                    const next = await toggleFavorite(zoneName, resolved.lat, resolved.lng);
                    setIsFavorite(next);
                  } catch (_) {}
                }}
              >
                <FontAwesome6
                  name="heart"
                  size={18}
                  color={isFavorite ? '#FF4C6A' : 'rgba(255,255,255,0.5)'}
                  solid={isFavorite}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Suggestions de recherche */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionBorder]}
                onPress={() => goToPlace(item)}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="location-dot" size={15} color="#2DBD7E" />
                <View style={styles.suggestionTexts}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                  <Text style={styles.suggestionSub} numberOfLines={1}>
                    {item.display_name.split(',').slice(1, 3).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Menu déroulant */}
        {menuOpen && (
          <>
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { zIndex: 90 }]}
              onPress={() => setMenuOpen(false)}
              activeOpacity={1}
            />
          <Animated.View style={[
            styles.menuDropdown,
            {
              opacity: menuAnim,
              transform: [{
                translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
              }],
            },
          ]}>

            {/* ── Carte pays Tunisia ── */}
            <TouchableOpacity
              style={styles.countryCard}
              activeOpacity={0.8}
              onPress={() => { setMenuOpen(false); navigation.navigate('Duo', { zone: detectedZone || cityName || '' }); }}
            >
              <View style={styles.countryBadge}>
                <Text style={styles.countryCode}>TN</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.countryName}>Tunisia</Text>
                <Text style={styles.countryMode}>{t('map.international')}</Text>
                {(detectedZone && detectedZone !== '—') ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                    <FontAwesome6 name="location-dot" size={11} color="#2DBD7E" />
                    <Text style={styles.countryZone} numberOfLines={1}>{detectedZone}</Text>
                  </View>
                ) : null}
              </View>
              <FontAwesome6 name="chevron-right" size={12} color="#2DBD7E" />
            </TouchableOpacity>

            <View style={styles.menuSep} />

            {/* ── Profil utilisateur connecté ── */}
            {currentUser ? (
              <>
                <View style={styles.menuUserRow}>
                  <FontAwesome6 name="circle-user" size={32} color="#9CA3AF" />
                  <View>
                    <Text style={styles.menuUserName}>
                      {currentUser.prenom || ''} {currentUser.nom || ''}
                    </Text>
                    <Text style={styles.menuUserEmail} numberOfLines={1}>
                      {currentUser.email || currentUser.phone || ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.menuSep} />
              </>
            ) : null}

            {/* ── Sélecteur de style de carte ── */}
            <View style={styles.menuStyleSection}>
              <Text style={styles.menuStyleTitle}>{t('map.mapStyle')}</Text>
              <View style={styles.menuStyleGrid}>
                {MAP_STYLES.map(s => {
                  const active = mapStyle === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.menuStyleBtn, active && styles.menuStyleBtnActive]}
                      onPress={() => { setMapStyle(s.key); setReady(false); }}
                      activeOpacity={0.75}
                    >
                      <FontAwesome6 name={s.icon} size={13} color={active ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.menuStyleLabel, active && styles.menuStyleLabelActive]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.menuSep} />

            {currentUser && (
              <>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => { setMenuOpen(false); navigation.navigate('Favorites'); }}
                  activeOpacity={0.8}
                >
                  <FontAwesome6 name="heart" size={18} color="#FF4C6A" solid />
                  <Text style={styles.menuRowText}>{t('map.myFavorites')}</Text>
                </TouchableOpacity>
                <View style={styles.menuSep} />
              </>
            )}

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setMenuOpen(false)}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="globe" size={18} color="#6B7280" />
              <Text style={styles.menuRowText}>{t('map.language')}</Text>
            </TouchableOpacity>

            <View style={styles.menuSep} />

            <TouchableOpacity style={styles.menuRow} onPress={toggleTheme} activeOpacity={0.8}>
              <FontAwesome6 name={isDark ? 'sun' : 'moon'} size={18} color={isDark ? '#F59E0B' : '#6B7280'} />
              <Text style={styles.menuRowText}>{isDark ? 'Mode clair' : 'Mode sombre'}</Text>
              <View style={{ flex: 1 }} />
              <View style={[styles.themeTogglePill, isDark && styles.themeTogglePillOn]}>
                <View style={[styles.themeToggleThumb, isDark && styles.themeToggleThumbOn]} />
              </View>
            </TouchableOpacity>

            <View style={styles.menuSep} />

            {currentUser ? (
              <TouchableOpacity
                style={styles.menuRow}
                onPress={async () => {
                  setMenuOpen(false);
                  await apiLogout();
                  setCurrentUser(null);
                }}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="right-from-bracket" size={18} color="#FF3B30" />
                <Text style={[styles.menuRowText, { color: '#FF3B30' }]}>{t('map.disconnect')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => { setMenuOpen(false); navigation.navigate('Login'); }}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="lock" size={18} color="#6B7280" />
                <Text style={styles.menuRowText}>{t('map.loginRegister')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.menuSep} />

            <TouchableOpacity style={styles.menuRow} onPress={() => setMenuOpen(false)}>
              <FontAwesome6 name="circle-info" size={18} color="#6B7280" />
              <Text style={styles.menuRowText}>{t('map.about')}</Text>
            </TouchableOpacity>
          </Animated.View>
          </>
        )}
      </SafeAreaView>

      {/* Erreur GPS */}
      {errorMsg && (
        <View style={[styles.errorBadge, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <FontAwesome6 name="triangle-exclamation" size={12} color={D.white} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* ── Crosshair centré (mode carte normal) ── */}
      {!pickMode && mode === 'map' && (
        <View pointerEvents="box-none" style={styles.centerCircleWrap}>
          <TouchableOpacity
            style={styles.centerZoneClickable}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('Local', { zone: detectedZone || cityName })}
          >
            {/* Cercle */}
            <View style={styles.centerCircle} />
            {/* Point central 
            <View style={styles.centerDot} />*/}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Mode sélection zone (depuis Admin) ── */}
      {pickMode && mode === 'map' && (
        <>
          {/* ── Cercle blanc centré sur la carte ── */}
          <View pointerEvents="none" style={pickStyles.circleWrap}>
            <View style={pickStyles.circleOuter} />
            {/* Nom de la zone affiché juste sous le cercle */}
            <View style={pickStyles.zoneLabelWrap}>
              <Text style={pickStyles.zoneLabelText} numberOfLines={1}>
                {detectedZone || '…'}
              </Text>
            </View>
          </View>

          {/* Bandeau haut */}
          <View style={pickStyles.topBanner}>
            <TouchableOpacity style={pickStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <FontAwesome6 name="arrow-left" size={13} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={pickStyles.backText}>Retour</Text>
            </TouchableOpacity>
            <Text style={pickStyles.hint}>{t('map.pickModeHint')}</Text>
          </View>


        </>
      )}

      {/* ── Barre ville + compteurs (au-dessus de la tab bar) ── */}
      {!pickMode && mode === 'map' && (
        <View style={styles.cityBarWrap}>
          {/* 3 flèches clignotantes */}
          <TouchableOpacity
            style={styles.cityBarArrowRow}
            onPress={() => navigation.navigate('Local', { zone: cityBarZoneRef.current })}
            activeOpacity={0.7}
          >
            <Animated.View style={{ opacity: arrowAnim }}>
              <FontAwesome6 name="angle-up" size={16} color="#2DBD7E" />
            </Animated.View>
            <Animated.View style={{ opacity: arrowAnim }}>
              <FontAwesome6 name="angles-up" size={16} color="#2DBD7E" />
            </Animated.View>
            <Animated.View style={{ opacity: arrowAnim }}>
              <FontAwesome6 name="angle-up" size={16} color="#2DBD7E" />
            </Animated.View>
          </TouchableOpacity>

          {/* Barre ville + compteurs — cliquable */}
          <TouchableOpacity
            style={styles.cityBar}
            onPress={() => navigation.navigate('Local', { zone: cityBarZoneRef.current })}
            activeOpacity={0.8}
            {...cityBarPan.panHandlers}
          >
            <View style={styles.cityBarRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                <FontAwesome6 name="location-dot" size={12} color="#2DBD7E" />
                <Text style={styles.cityBarName} numberOfLines={1}>
                  {snapToZone?.name || detectedZone || cityName || '…'}
                </Text>
              </View>
              <View style={styles.cityBarCounts}>
                <View style={styles.cityBarChip}>
                  <View style={[styles.cityBarPill, { backgroundColor: 'rgba(45,189,126,0.12)' }]}>
                    <Text style={[styles.cityBarNum, { color: '#2DBD7E' }]}>{zoneCounts.local}</Text>
                    <Text style={[styles.cityBarLabel, { color: '#2DBD7E' }]}>{t('common.local')}</Text>
                  </View>
                </View>
                <View style={styles.cityBarDivider} />
                <View style={styles.cityBarChip}>
                  <View style={[styles.cityBarPill, { backgroundColor: 'rgba(59,126,246,0.10)' }]}>
                    <Text style={[styles.cityBarNum, { color: '#3B7EF6' }]}>{zoneCounts.duo}</Text>
                    <Text style={[styles.cityBarLabel, { color: '#3B7EF6' }]}>{t('common.duo')}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 20 }]} pointerEvents="none">
              <Animated.View
                style={[styles.cityBarShine, {
                  opacity: shineAnim,
                  transform: [{ translateX: shineAnim.interpolate({ inputRange: [0, 1], outputRange: [-120, 400] }) }],
                }]}
              />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom Tab Bar ── */}
      {!pickMode && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <BottomTabBar activeTab="map" navigation={navigation} isAuthenticated={!!currentUser} />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000005',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { fontSize: 18, color: '#ffffff', fontWeight: '600' },

  // ── Header ────────────────────────────────────────────────────────────────
  headerOverlay: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 12,
    gap: 8,
  },
  logoBox: {
    backgroundColor: 'rgba(108,114,203,0.92)',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  logoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  searchIcon: { fontSize: 13 },
  searchInput: {
    flex: 1,
    color: '#1A1A2E',
    fontSize: 14,
    padding: 0,
    margin: 0,
  },
  clearBtn: {
    color: '#9CA3AF',
    fontSize: 13,
    paddingHorizontal: 2,
  },
  backZoomBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#3B7EF6',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B7EF6', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 6,
  },
  menuBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#2DBD7E',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#2DBD7E', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 6,
  },
  menuLine: {
    width: 20,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },

  // ── Bandeau zone sous la recherche ──────────────────────────────────────
  zoneBanner: {
    alignSelf: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(10,10,22,0.75)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: D.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoneFavBtn: {
    padding: 2,
  },
  zoneBannerName: {
    color: D.white,
    fontSize: 22,
    fontWeight: '1000',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // ── Suggestions ─────────────────────────────────────────────────────────
  suggestionsBox: {
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionIcon: { fontSize: 15 },
  suggestionTexts: { flex: 1 },
  suggestionTitle: { color: '#1A1A2E', fontSize: 14, fontWeight: '600' },
  suggestionSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },

  // ── En-têtes de section dans les résultats ──────────────────────────────
  resultSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  resultSectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Résultats post search ────────────────────────────────────────────────
  pubResultThumb: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
  pubResultModeBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  pubResultModeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // ── Menu déroulant ───────────────────────────────────────────────────────
  menuDropdown: {
    marginHorizontal: 12,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuRowText: { color: '#1A1A2E', fontSize: 15, fontWeight: '500' },
  menuUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuUserAvatar: { fontSize: 28 },
  menuUserName: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '700',
  },
  menuUserEmail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    maxWidth: 180,
  },
  menuSep: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },

  // ── Carte pays Tunisia ───────────────────────────────────────────────────
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'rgba(45,189,126,0.06)',
  },
  countryBadge: {
    width: 42, height: 42, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#2DBD7E',
    backgroundColor: 'rgba(45,189,126,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  countryCode: {
    fontSize: 15, fontWeight: '900',
    color: '#2DBD7E', letterSpacing: 0.5,
  },
  countryName: {
    fontSize: 14, fontWeight: '700', color: '#1A1A2E',
  },
  countryMode: {
    fontSize: 11, fontWeight: '600',
    color: '#3B7EF6', marginTop: 2,
  },
  countryZone: {
    fontSize: 11, fontWeight: '500',
    color: '#2DBD7E', marginTop: 3,
  },

  // ── Erreur ───────────────────────────────────────────────────────────────
  errorBadge: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(200,60,60,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  errorText: { color: D.white, fontSize: 12, fontWeight: '600' },

  // ── Footer zone ──────────────────────────────────────────────────────────
  zoneFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: 'rgba(10,10,22,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  zoneFooterIcon: { fontSize: 16 },
  zoneFooterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  // ── Balles de style ──────────────────────────────────────────────────────
  ballsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 14,
  },
  ballWrapper: { alignItems: 'center', gap: 5 },
  ball: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  ballActive: {
    width: 66, height: 66, borderRadius: 33,
    borderWidth: 3, borderColor: 'white',
    elevation: 12, shadowOpacity: 0.5, shadowRadius: 10,
  },
  ballEmoji: { fontSize: 24 },
  ballLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  ballLabelActive: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  ballDot: { width: 6, height: 6, borderRadius: 3 },

  // ── FAB centrer ──────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: 160, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(108,114,203,0.95)',
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  fabText: { fontSize: 22 },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
    backgroundColor: '#ffffff',
  },
  footerBtnActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 1.5,
    textDecorationLine: 'none',
  },
  footerBtnTextActive: {
    color: '#ffffff',
  },

  // ── Cercle centré (mode carte normal) ──────────────────────────────────
  centerCircleWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  centerZoneClickable: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  crosshairH: {
    position: 'absolute',
    width: 30,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1.5,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  centerCircle: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#3B7EF6',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  centerDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  centerZoneLabelWrap: {
    position: 'absolute',
    top: '55%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  centerZoneLabelText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  centerZoneCountsText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
    opacity: 0.95,
  },

  // ── Attribution ──────────────────────────────────────────────────────────
  attribution: {
    position: 'absolute', bottom: 8, left: 12, pointerEvents: 'none',
  },
  attributionText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },

  // ── Sélecteur style carte dans le menu ───────────────────────────────────
  menuStyleSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuStyleTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  menuStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuStyleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  menuStyleBtnActive: {
    backgroundColor: D.blue,
    borderColor: D.blue,
  },
  menuStyleIcon: { fontSize: 14 },
  menuStyleLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  menuStyleLabelActive: {
    color: '#ffffff',
  },

  // ── Barre ville + compteurs au-dessus de la tab bar ─────────────────────
  cityBarWrap: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 88 : 72,
    left: 12,
    right: 12,
  },
  cityBarArrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  cityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  cityBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  cityBarName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginRight: 10,
  },
  cityBarCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityBarChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cityBarNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  cityBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  cityBarDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E5E7EB',
  },

});
// ─── Styles mode sélection zone ───────────────────────────────────────────────
const pickStyles = StyleSheet.create({

  // ── Cercle blanc centré ───────────────────────────────────────────────────
  circleWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleOuter: {
    width: '70%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#3B7EF6',
    borderStyle: 'solid',
    backgroundColor: 'transparent',
  },

  // Nom de la zone flottant juste sous le cercle
  zoneLabelWrap: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  zoneLabelText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  // ── Bandeau haut ─────────────────────────────────────────────────────────
  topBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(10,10,30,0.82)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  backText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  hint: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },

  // ── Footer panel ─────────────────────────────────────────────────────────
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8,10,28,0.96)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },

  // ── Carte de zone ────────────────────────────────────────────────────────
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 14,
  },
  zoneCardLeft: { flex: 1, gap: 3 },
  zoneCardTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  zoneCardName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  zoneCardCoords: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  zoneCardDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  zoneCardDotActive: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },

  // ── Bouton Indexer ───────────────────────────────────────────────────────
  indexBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  indexBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    elevation: 0,
  },
  indexBtnIcon: { fontSize: 18 },
  indexBtnText: {
    color: '#0a0a1e',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // ── Theme toggle pill ─────────────────────────────────────────────────────
  themeTogglePill: {
    width: 38, height: 22, borderRadius: 11,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  themeTogglePillOn: { backgroundColor: '#3B7EF6' },
  themeToggleThumb: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  themeToggleThumbOn: { alignSelf: 'flex-end' },

  // ── cityBar shine overlay ─────────────────────────────────────────────────
  cityBarShine: {
    position: 'absolute', top: 0, bottom: 0, width: 80,
    backgroundColor: 'rgba(255,255,255,0.45)',
    transform: [{ skewX: '-20deg' }],
  },
});
// ─── Styles Radio Garden Joystick ────────────────────────────────────────────
const RG_SIZE = 140; // diamètre du grand cercle
const rgStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 170,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  outerRing: {
    width: RG_SIZE,
    height: RG_SIZE,
    borderRadius: RG_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  innerRing: {
    position: 'absolute',
    width: RG_SIZE * 0.45,
    height: RG_SIZE * 0.45,
    borderRadius: RG_SIZE * 0.225,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lineH: {
    position: 'absolute',
    width: RG_SIZE - 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  lineV: {
    position: 'absolute',
    width: 1,
    height: RG_SIZE - 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30,144,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  thumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
});