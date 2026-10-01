export function keyPart(value){return String(value??'').trim().toLocaleLowerCase('cs-CZ')}

export function vehicleKey(operator,traction,fleetNumber){return [operator,traction,fleetNumber].map(keyPart).join('|')}

export function stableVehicleId({operator,traction,fleetNumber,gtfsRtVehicleId,sourceVehicleId,line,type}){
  if(operator&&traction&&String(fleetNumber??'').trim())return `vehicle:${vehicleKey(operator,traction,fleetNumber)}`
  if(gtfsRtVehicleId)return `gtfsrt:${String(gtfsRtVehicleId)}`
  if(sourceVehicleId)return `source:${keyPart(type||traction)}|${keyPart(line)}|${String(sourceVehicleId)}`
  return `unknown:${keyPart(type||traction)}|${keyPart(line)}`
}
