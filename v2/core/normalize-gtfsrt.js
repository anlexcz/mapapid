import {stableVehicleId} from './identity.js';
import {canonicalOperator} from './operators.js';

export function descriptorFromVehicleId(vehicleId=''){
  if(/^service-0-/.test(vehicleId))return{operator:'Dopravní podnik hl. m. Prahy, akciová společnost',traction:'tram',type:'tramvaj'};
  if(/^service-3-/.test(vehicleId))return{operator:'Dopravní podnik hl. m. Prahy, akciová společnost',traction:'bus',type:'autobus'};
  return{operator:'',traction:'',type:''};
}

export function normalizeGtfsRt(position,{operatorAliasMap,tripAssignment}={}){
  const vehicleId=String(position?.vehicleId||position?.vehicle?.id||'');
  const descriptor=descriptorFromVehicleId(vehicleId);
  const operator=canonicalOperator(position?.operator||descriptor.operator,operatorAliasMap);
  const traction=position?.traction||descriptor.traction||'';
  const fleetNumber=String(position?.vehicleLabel||position?.vehicle?.label||((traction&&vehicleId)?vehicleId.split('-').pop():'')||'');
  const routeId=tripAssignment?.routeId||position?.routeId||position?.trip?.routeId||'';
  const line=String(routeId).replace(/^L/,'');
  const tripId=position?.tripId||position?.trip?.tripId||tripAssignment?.tripId||'';
  const type=position?.type||descriptor.type||traction;
  const ts=Number(position?.timestamp);
  return {
    id:stableVehicleId({operator,traction,fleetNumber,gtfsRtVehicleId:vehicleId,line,type}),
    operator,traction,fleetNumber,line,order:'',tripId,headsign:'',
    position:{lat:position?.latitude??position?.position?.latitude??null,lon:position?.longitude??position?.position?.longitude??null,bearing:position?.bearing??position?.position?.bearing??null,observedAt:Number.isFinite(ts)?new Date(ts*1000).toISOString():'',source:'gtfsrt'},
    status:{freshness:'retained',atTerminal:null},
    realtime:{golemioId:'',gtfsRtVehicleId:vehicleId},
    vehicle:null,
    raw:{json:null,gtfsrt:position},
    extra:{currentStopSequence:position?.currentStopSequence??null,currentStatus:position?.currentStatus??null,stopId:position?.stopId??''}
  };
}
