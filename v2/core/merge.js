function clone(value){return value==null?value:structuredClone(value)}

export function mergeVehicle(jsonVehicle,gtfsRtVehicle){
  if(jsonVehicle&&gtfsRtVehicle){
    const out=clone(jsonVehicle);
    out.realtime={...(jsonVehicle.realtime||{}),gtfsRtVehicleId:gtfsRtVehicle.realtime?.gtfsRtVehicleId||jsonVehicle.realtime?.gtfsRtVehicleId||''};
    out.raw={json:jsonVehicle.raw?.json??null,gtfsrt:gtfsRtVehicle.raw?.gtfsrt??null};
    if(!out.tripId&&gtfsRtVehicle.tripId)out.tripId=gtfsRtVehicle.tripId;
    return out;
  }
  return clone(jsonVehicle||gtfsRtVehicle);
}

export function mergeVehicles(jsonVehicles=[],gtfsRtVehicles=[]){
  const jsonById=new Map(jsonVehicles.map(v=>[String(v.id),v]));
  const gtfsById=new Map(gtfsRtVehicles.map(v=>[String(v.id),v]));
  const ids=new Set([...jsonById.keys(),...gtfsById.keys()]);
  const result=[];
  for(const id of ids)result.push(mergeVehicle(jsonById.get(id),gtfsById.get(id)));
  return result;
}
