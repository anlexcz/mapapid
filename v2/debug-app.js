import {buildOperatorAliasMap} from './core/operators.js';
import {normalizeGolemio} from './core/normalize-golemio.js';
import {normalizeGtfsRt} from './core/normalize-gtfsrt.js';
import {mergeVehicles} from './core/merge.js';
import {deriveStatus} from './core/status.js';

const C=window.MAPAPID_CONFIG||{};
const map=L.map('map',{zoomControl:true}).setView([50.0755,14.4378],12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);

const markers=new Map();
let vehicles=[];
let operatorAliasMap=new Map();
let refreshInFlight=false;
const $=id=>document.getElementById(id);

function markerClass(v){
  const status=deriveStatus(v);
  if(status.atTerminal===true)return'terminal';
  return status.freshness||'live';
}

function markerHtml(v){
  const label=v.line||v.fleetNumber||'?';
  return `<div class="v2-marker ${markerClass(v)}">${escapeHtml(label)}</div>`;
}

function renderMarkers(){
  const visible=new Set();
  for(const v of vehicles){
    const lat=Number(v.position?.lat),lon=Number(v.position?.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const id=String(v.id),html=markerHtml(v),key=`${lat}|${lon}|${html}`;
    visible.add(id);
    let marker=markers.get(id);
    if(!marker){
      marker=L.marker([lat,lon],{icon:L.divIcon({className:'',html,iconSize:[30,30]})}).addTo(map);
      marker.on('click',()=>openDebug(id));
      marker._v2key=key;
      markers.set(id,marker);
    }else{
      if(marker._v2key!==key){
        marker.setLatLng([lat,lon]);
        marker.setIcon(L.divIcon({className:'',html,iconSize:[30,30]}));
        marker._v2key=key;
      }
    }
  }
  for(const [id,marker] of markers){
    if(!visible.has(id)){marker.remove();markers.delete(id)}
  }
}

function debugView(v){
  const status=deriveStatus(v);
  return {
    id:v.id,
    operator:v.operator,
    traction:v.traction,
    fleetNumber:v.fleetNumber,
    line:v.line,
    order:v.order,
    tripId:v.tripId,
    headsign:v.headsign,
    position:v.position,
    status,
    realtime:v.realtime,
    extra:v.extra,
    vehicleDbMatch:Boolean(v.vehicle),
    rawSources:{json:Boolean(v.raw?.json),gtfsrt:Boolean(v.raw?.gtfsrt)}
  };
}

function openDebug(id){
  const v=vehicles.find(x=>String(x.id)===String(id));
  if(!v)return;
  $('debugPanel').hidden=false;
  $('debugTitle').textContent=`${v.line||'?'} · ${v.fleetNumber||v.id}`;
  $('debugBody').textContent=JSON.stringify(debugView(v),null,2);
}
$('debugClose').onclick=()=>$('debugPanel').hidden=true;
$('refresh').onclick=()=>load();

function assignmentFor(assignments,position){
  const list=assignments.byVehicle?.[position.vehicleId]||[];
  return list.find(x=>x.tripId===position.tripId)||list[0]||null;
}

async function loadOperators(){
  const r=await fetch('../data/operators.json',{cache:'no-store'});
  if(!r.ok)throw new Error(`operators HTTP ${r.status}`);
  operatorAliasMap=buildOperatorAliasMap(await r.json());
}

async function fetchRealtime(){
  const base=C.realtimeProxyUrl;
  if(!base)throw new Error('Chybí realtimeProxyUrl v config.js');
  const vehicleUrl=new URL(base,location.href).href;
  const assignmentsUrl=new URL('/gtfsrt-assignments',vehicleUrl).href;
  const [jsonResponse,assignResponse]=await Promise.all([
    fetch(vehicleUrl,{cache:'no-store'}),
    fetch(assignmentsUrl,{cache:'no-store'})
  ]);
  if(!jsonResponse.ok)throw new Error(`JSON realtime HTTP ${jsonResponse.status}`);
  if(!assignResponse.ok)throw new Error(`GTFS-RT HTTP ${assignResponse.status}`);
  const json=await jsonResponse.json();
  const assignments=await assignResponse.json();
  const jsonVehicles=(json.features||json||[]).map(x=>normalizeGolemio(x,{operatorAliasMap}));
  const rtVehicles=Object.values(assignments.positions||{}).map(p=>normalizeGtfsRt(p,{operatorAliasMap,tripAssignment:assignmentFor(assignments,p)}));
  return mergeVehicles(jsonVehicles,rtVehicles);
}

async function load(){
  if(refreshInFlight)return;
  refreshInFlight=true;
  $('status').textContent='Načítám realtime…';
  try{
    if(!operatorAliasMap.size)await loadOperators();
    vehicles=await fetchRealtime();
    renderMarkers();
    const jsonCount=vehicles.filter(v=>v.position?.source==='json').length;
    const rtCount=vehicles.filter(v=>v.position?.source==='gtfsrt').length;
    $('status').textContent=`${vehicles.length} vozidel · JSON ${jsonCount} · GTFS-RT fallback ${rtCount} · ${new Date().toLocaleTimeString('cs-CZ')}`;
  }catch(error){
    console.error(error);
    $('status').textContent=`Chyba: ${error.message}`;
  }finally{
    refreshInFlight=false;
  }
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

load();
setInterval(load,30000);
