export function isBeforeTrack(vehicle){
  const state=vehicle?.extra?.statePosition||'';
  return state==='before_track'||state==='before_track_delayed';
}

export function inferTerminalState(vehicle,{tripStops=[]}={}){
  if(!vehicle)return null;
  if(isBeforeTrack(vehicle))return true;

  const currentSeq=Number(vehicle?.extra?.currentStopSequence);
  if(Number.isFinite(currentSeq)&&tripStops.length){
    const lastSeq=Number(tripStops.at(-1)?.sequence??tripStops.at(-1)?.s??tripStops.length);
    if(Number.isFinite(lastSeq))return currentSeq>=lastSeq?true:false;
  }

  const lastSeq=Number(vehicle?.extra?.lastStop?.sequence);
  const nextSeq=Number(vehicle?.extra?.nextStop?.sequence);
  if(vehicle.position?.source==='json'&&tripStops.length&&Number.isFinite(lastSeq)){
    const finalSeq=Number(tripStops.at(-1)?.sequence??tripStops.at(-1)?.s??tripStops.length);
    if(Number.isFinite(finalSeq)&&lastSeq>=finalSeq)return true;
    if(Number.isFinite(nextSeq)&&nextSeq>0)return false;
  }

  return null;
}

export function freshnessFromAge(ageSeconds,{staleAfter=300,hideAfter=600}={}){
  if(!Number.isFinite(ageSeconds))return 'unknown';
  if(ageSeconds>=hideAfter)return 'expired';
  if(ageSeconds>=staleAfter)return 'stale';
  return 'live';
}
