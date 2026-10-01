import assert from 'node:assert/strict';
import {stableVehicleId} from '../core/identity.js';
import {buildOperatorAliasMap} from '../core/operators.js';
import {normalizeGolemio} from '../core/normalize-golemio.js';
import {normalizeGtfsRt} from '../core/normalize-gtfsrt.js';
import {mergeVehicles} from '../core/merge.js';
import {inferTerminalState,freshnessFromAge} from '../core/status.js';

const operators={
  'DP PRAHA':{
    source_name:'Dopravní podnik hl. m. Prahy',
    name:'Dopravní podnik hl. m. Prahy, akciová společnost',
    short_name:'DPP',
    aliases:['Dopravní podnik hl. m. Prahy, akciová společnost','DPP']
  }
};
const operatorAliasMap=buildOperatorAliasMap(operators);

function golemio8488(){return{
  id:'golemio-8488',
  geometry:{coordinates:[14.4537,50.13267]},
  properties:{trip:{
    agency_name:{real:'Dopravní podnik hl. m. Prahy, akciová společnost'},
    vehicle_registration_number:'8488',
    sequence_id:28,
    vehicle_type:{description_cs:'tramvaj'},
    gtfs:{route_short_name:'95',trip_id:'95_2832_260829',trip_headsign:'Vozovna Kobylisy'}
  },last_position:{origin_timestamp:'2026-10-01T00:31:00+02:00',delay:{actual:60},state_position:''}}
}}

function gtfs8488(timestamp=1790811055){return{
  vehicleId:'service-0-8488',vehicleLabel:'8488',tripId:'95_2832_260829',routeId:'L95',
  latitude:50.1326713562,longitude:14.4537000656,timestamp
}}

{
  const json=normalizeGolemio(golemio8488(),{operatorAliasMap});
  const rt=normalizeGtfsRt(gtfs8488(),{operatorAliasMap});
  assert.equal(json.id,'vehicle:dopravní podnik hl. m. prahy|tram|8488');
  assert.equal(rt.id,json.id,'JSON and GTFS-RT must resolve to the same physical vehicle ID');
  const merged=mergeVehicles([json],[rt]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].position.source,'json','JSON wins while present');
  assert.equal(merged[0].realtime.gtfsRtVehicleId,'service-0-8488');
}

{
  const rt=normalizeGtfsRt(gtfs8488(),{operatorAliasMap});
  const merged=mergeVehicles([],[rt]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].position.source,'gtfsrt');
  assert.equal(merged[0].status.freshness,'retained');
  assert.equal(merged[0].status.atTerminal,null,'GTFS-RT fallback must not imply terminal');
  assert.equal(inferTerminalState(merged[0]),null,'retained alone must never infer terminal');
}

{
  const json=normalizeGolemio(golemio8488(),{operatorAliasMap});
  const rt=normalizeGtfsRt(gtfs8488(1999999999),{operatorAliasMap});
  const merged=mergeVehicles([json],[rt]);
  assert.equal(merged[0].position.source,'json','newer GTFS-RT timestamp must not override JSON source priority');
}

{
  const json=normalizeGolemio(golemio8488(),{operatorAliasMap});
  json.extra.statePosition='before_track';
  assert.equal(inferTerminalState(json),true,'before_track is explicit terminal evidence');
}

{
  const rt=normalizeGtfsRt({...gtfs8488(),currentStopSequence:12},{operatorAliasMap});
  assert.equal(inferTerminalState(rt,{tripStops:[{s:1},{s:12}]}),true);
  assert.equal(inferTerminalState({...rt,extra:{...rt.extra,currentStopSequence:5}},{tripStops:[{s:1},{s:12}]}),false);
}

{
  assert.equal(freshnessFromAge(20),'live');
  assert.equal(freshnessFromAge(400),'stale');
  assert.equal(freshnessFromAge(700),'expired');
}

{
  const id=stableVehicleId({operator:'',traction:'metro',fleetNumber:'',gtfsRtVehicleId:'metro-abc',line:'A',type:'metro'});
  assert.equal(id,'gtfsrt:metro-abc');
}

{
  const id=stableVehicleId({operator:'ČD',traction:'train',fleetNumber:'',sourceVehicleId:'physical-set-12',line:'R9',type:'vlak'});
  assert.equal(id,'source:vlak|r9|physical-set-12');
}

console.log('MapaPID v2 core tests: OK');
