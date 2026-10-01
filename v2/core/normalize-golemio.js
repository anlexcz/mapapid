import {stableVehicleId} from './identity.js';
import {canonicalOperator} from './operators.js';

export function tractionFromVehicleType(type=''){
  const t=String(type).toLowerCase();
  if(t.includes('tram'))return 'tram';
  if(t.includes('trolej'))return 'trolleybus';
  if(t.includes('bus'))return 'bus';
  if(t.includes('metro')||t.includes('subway'))return 'metro';
  if(t.includes('vlak')||t.includes('train')||t.includes('želez')||t.includes('rail'))return 'train';
  return '';
}

export function normalizeGolemio(feature,{operatorAliasMap}={}){
  const p=feature?.properties||feature||{},trip=p.trip||{},gtfs=trip.gtfs||{},cis=trip.cis||{},last=p.last_position||{},vehicleType=trip.vehicle_type||{};
  const sourceVehicleId=feature?.id??p.id??'';
  const operatorRaw=trip.agency_name?.real||trip.agency_name?.scheduled||'';
  const operator=canonicalOperator(operatorRaw,operatorAliasMap);
  const type=vehicleType.description_cs||vehicleType.description_en||vehicleType.id||'';
  const traction=tractionFromVehicleType(type);
  const fleetNumber=trip.vehicle_registration_number??'';
  const line=gtfs.route_short_name||gtfs.route_id||'';
  const order=trip.sequence_id!==null&&trip.sequence_id!==undefined&&trip.sequence_id!==''?trip.sequence_id:(cis.trip_number??'');
  return {
    id:stableVehicleId({operator,traction,fleetNumber,sourceVehicleId,line,type}),
    operator,traction,fleetNumber:String(fleetNumber??''),line:String(line??''),order,tripId:gtfs.trip_id||'',headsign:gtfs.trip_headsign||'',
    position:{lat:feature?.geometry?.coordinates?.[1]??null,lon:feature?.geometry?.coordinates?.[0]??null,bearing:last.bearing??null,observedAt:last.origin_timestamp||'',source:'json'},
    status:{freshness:'live',atTerminal:null},
    realtime:{golemioId:sourceVehicleId?String(sourceVehicleId):'',gtfsRtVehicleId:''},
    vehicle:null,
    raw:{json:feature,gtfsrt:null},
    extra:{delay:last.delay?.actual??null,lastStop:last.last_stop||null,nextStop:last.next_stop||null,statePosition:last.state_position||'',tracking:last.tracking??null,startTimestamp:trip.start_timestamp||''}
  };
}
