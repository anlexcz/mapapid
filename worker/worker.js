function readVarint(b,s){let n=0,m=1,i=s;for(;i<b.length;i++){const x=b[i];n+=(x&127)*m;if(!(x&128))return[n,i+1];m*=128;if(m>2**53)throw Error("varint too large")}throw Error("truncated varint")}
function fields(b){const out=[];for(let i=0;i<b.length;){let tag;[tag,i]=readVarint(b,i);const no=Math.floor(tag/8),wire=tag%8;if(wire===0){let v;[v,i]=readVarint(b,i);out.push([no,wire,v])}else if(wire===1){out.push([no,wire,b.slice(i,i+8)]);i+=8}else if(wire===2){let n;[n,i]=readVarint(b,i);out.push([no,wire,b.slice(i,i+n)]);i+=n}else if(wire===5){out.push([no,wire,b.slice(i,i+4)]);i+=4}else throw Error("unsupported wire "+wire)}return out}
const dec=new TextDecoder();const str=x=>x instanceof Uint8Array?dec.decode(x):"";
function one(fs,n){return fs.find(x=>x[0]===n)?.[2]}
function parseTripDescriptor(b){if(!(b instanceof Uint8Array))return null;const f=fields(b);return{tripId:str(one(f,1)),startTime:str(one(f,2)),startDate:str(one(f,3)),scheduleRelationship:one(f,4)??null,routeId:str(one(f,5)),directionId:one(f,6)??null}}
function parseVehicleDescriptor(b){if(!(b instanceof Uint8Array))return null;const f=fields(b);return{id:str(one(f,1)),label:str(one(f,2)),licensePlate:str(one(f,3))}}
function parseTripUpdate(b){const f=fields(b),trip=parseTripDescriptor(one(f,1)),vehicle=parseVehicleDescriptor(one(f,3));return{trip,vehicle,timestamp:one(f,4)??null,delay:one(f,5)??null}}
function parseVehiclePosition(b){const f=fields(b),trip=parseTripDescriptor(one(f,1)),vehicle=parseVehicleDescriptor(one(f,8));return{trip,vehicle,timestamp:one(f,5)??null,currentStopSequence:one(f,3)??null,currentStatus:one(f,4)??null,stopId:str(one(f,7))}}
function parseFeed(pb){const top=fields(pb),entities=[];for(const x of top.filter(x=>x[0]===2)){const f=fields(x[2]),id=str(one(f,1)),tu=one(f,3),vp=one(f,4);entities.push({id,tripUpdate:tu?parseTripUpdate(tu):null,vehiclePosition:vp?parseVehiclePosition(vp):null})}return entities}
function assignmentSummary(entities){const byVehicle={};for(const e of entities){const t=e.tripUpdate,id=t?.vehicle?.id,tripId=t?.trip?.tripId;if(!id||!tripId||id.endsWith("-null")||t.trip?.scheduleRelationship===3)continue;(byVehicle[id]??=[]).push({tripId,routeId:t.trip?.routeId||"",startTime:t.trip?.startTime||"",startDate:t.trip?.startDate||"",timestamp:t.timestamp??null})}const tripToVehicle={};for(const [id,trips] of Object.entries(byVehicle)){trips.sort((a,b)=>(a.startDate+a.startTime).localeCompare(b.startDate+b.startTime));for(const t of trips)tripToVehicle[t.tripId]=id}return{generatedAt:new Date().toISOString(),tripToVehicle,byVehicle}}
function debugSummary(entities){const tus=entities.filter(e=>e.tripUpdate),vps=entities.filter(e=>e.vehiclePosition),vpIds=new Set(vps.map(e=>e.vehiclePosition.vehicle?.id).filter(Boolean)),tuWithVehicle=tus.filter(e=>e.tripUpdate.vehicle?.id),tuOnly=tuWithVehicle.filter(e=>!vpIds.has(e.tripUpdate.vehicle.id)),by=new Map();for(const e of tuWithVehicle){const id=e.tripUpdate.vehicle.id;if(!by.has(id))by.set(id,[]);by.get(id).push(e.tripUpdate)}const multi=[...by].filter(([,x])=>x.length>1).map(([vehicleId,x])=>({vehicleId,trips:x.map(t=>({tripId:t.trip?.tripId,routeId:t.trip?.routeId,startTime:t.trip?.startTime,startDate:t.trip?.startDate,scheduleRelationship:t.trip?.scheduleRelationship,timestamp:t.timestamp}))}));return{generatedAt:new Date().toISOString(),counts:{entities:entities.length,tripUpdates:tus.length,vehiclePositions:vps.length,tripUpdatesWithVehicle:tuWithVehicle.length,uniqueTripUpdateVehicleIds:by.size,matchedVehicleIds:tuWithVehicle.length-tuOnly.length,tripUpdatesWithoutVehiclePosition:tuOnly.length,vehiclesWithMultipleTripUpdates:multi.length},vehiclesWithMultipleTripUpdates:multi.slice(0,100),tripUpdatesWithoutVehiclePosition:tuOnly.slice(0,100).map(e=>({entityId:e.id,vehicleId:e.tripUpdate.vehicle.id,vehicleLabel:e.tripUpdate.vehicle.label,tripId:e.tripUpdate.trip?.tripId,routeId:e.tripUpdate.trip?.routeId,startTime:e.tripUpdate.trip?.startTime,startDate:e.tripUpdate.trip?.startDate,timestamp:e.tripUpdate.timestamp}))}}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

    const incoming = new URL(request.url);
    if (incoming.pathname === "/gtfsrt-assignments") {
      try {
        const response = await fetch("https://api.golemio.cz/v2/vehiclepositions/gtfsrt/pid_feed.pb", {headers: {"X-Access-Token": env.GOLEMIO_API_KEY, "Accept": "application/x-protobuf"}});
        if (!response.ok) return new Response(JSON.stringify({error:"Golemio GTFS-RT HTTP "+response.status}), {status:response.status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
        const entities=parseFeed(new Uint8Array(await response.arrayBuffer()));
        return new Response(JSON.stringify(assignmentSummary(entities)), {headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=10"}});
      } catch (error) {
        return new Response(JSON.stringify({error:"GTFS-RT assignments error",message:error instanceof Error?error.message:String(error)}), {status:500,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
      }
    }

    if (incoming.pathname === "/gtfsrt-debug") {
      try {
        const response = await fetch("https://api.golemio.cz/v2/vehiclepositions/gtfsrt/pid_feed.pb", {
          headers: {"X-Access-Token": env.GOLEMIO_API_KEY, "Accept": "application/x-protobuf"},
        });
        if (!response.ok) return new Response(JSON.stringify({error:"Golemio GTFS-RT HTTP "+response.status}), {status:response.status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
        const entities=parseFeed(new Uint8Array(await response.arrayBuffer()));
        return new Response(JSON.stringify(debugSummary(entities)), {headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
      } catch (error) {
        return new Response(JSON.stringify({error:"GTFS-RT debug error",message:error instanceof Error?error.message:String(error)}), {status:500,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
      }
    }

    if (incoming.pathname !== "/" && incoming.pathname !== "/vehicles") return new Response("Not found", { status: 404, headers: corsHeaders });

    try {
      const upstream = new URL("https://api.golemio.cz/v2/vehiclepositions");
      incoming.searchParams.forEach((value, key) => upstream.searchParams.append(key, value));
      // Golemio defaults to only 100 records. MapaPID needs the complete PID snapshot.
      if (!upstream.searchParams.has("limit")) upstream.searchParams.set("limit", "10000");
      const response = await fetch(upstream, {
        headers: {"X-Access-Token": env.GOLEMIO_API_KEY, "Accept": "application/json"},
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {...corsHeaders,"Content-Type":response.headers.get("Content-Type")||"application/json; charset=utf-8","Cache-Control":"public, max-age=10"},
      });
    } catch (error) {
      return new Response(JSON.stringify({error:"MapaPID proxy error",message:error instanceof Error?error.message:String(error)}), {status:500,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}});
    }
  },
};
