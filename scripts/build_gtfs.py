import csv,json,zipfile,io,urllib.request,os,datetime
URL="https://data.pid.cz/PID_GTFS.zip"
OUT="data/gtfs-index.json"
def rows(z,name):
    with z.open(name) as f:return list(csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig")))
def canon(tid):
    p=tid.rsplit("_",1)
    return p[0] if len(p)==2 and len(p[1])==6 and p[1].isdigit() else tid
print("Downloading GTFS…")
blob=urllib.request.urlopen(URL,timeout=120).read()
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    routes={r["route_id"]:r.get("route_short_name","") for r in rows(z,"routes.txt")}
    stops={r["stop_id"]:r.get("stop_name","") for r in rows(z,"stops.txt")}
    trip_rows=rows(z,"trips.txt")
    trip_meta={t["trip_id"]:t for t in trip_rows}
    shape_ids={t.get("shape_id","") for t in trip_rows if t.get("shape_id")}
    shapes={sid:[] for sid in shape_ids}
    with z.open("shapes.txt") as f:
        rd=csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig"))
        for r in rd:
            sid=r["shape_id"]
            if sid in shapes: shapes[sid].append((int(r["shape_pt_sequence"]),round(float(r["shape_pt_lat"]),5),round(float(r["shape_pt_lon"]),5)))
    for sid in shapes: shapes[sid]=[[a,b] for _,a,b in sorted(shapes[sid])]
    details={tid:{"stops":[]} for tid in trip_meta};bounds={};optypes={}
    with z.open("stop_times.txt") as f:
        rd=csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig"))
        for r in rd:
            tid=r["trip_id"]
            if tid not in details: continue
            arr=r.get("arrival_time","");dep=r.get("departure_time","");tm=dep or arr
            if tid not in bounds: bounds[tid]=[tm,tm]
            else: bounds[tid][1]=tm
            if r.get("trip_operation_type"): optypes[tid]=r["trip_operation_type"]
            details[tid]["stops"].append({"stop_id":r["stop_id"],"name":stops.get(r["stop_id"],""),"arrival":arr,"departure":dep})
    blocks={};trip_to_block={};aliases={}
    for t in trip_rows:
        tid=t["trip_id"];b=t.get("block_id","").strip()
        aliases.setdefault(canon(tid),tid)
        a,e=bounds.get(tid,["",""])
        d=details[tid];d.update({"route":routes.get(t["route_id"],t["route_id"]),"headsign":t.get("trip_headsign",""),"start":a,"end":e,"shape":shapes.get(t.get("shape_id",""),[])})
        if b:
            trip_to_block[tid]=b
            blocks.setdefault(b,[]).append({"trip_id":tid,"route":d["route"],"headsign":d["headsign"],"start":a,"end":e,"operation_type":optypes.get(tid,"")})
    for arr in blocks.values():arr.sort(key=lambda x:x["start"])
os.makedirs("data",exist_ok=True)
with open(OUT,"w",encoding="utf-8") as f:json.dump({"generated":datetime.datetime.now(datetime.timezone.utc).isoformat(),"tripToBlock":trip_to_block,"tripAliases":aliases,"trips":details,"blocks":blocks},f,ensure_ascii=False,separators=(",",":"))
print("Wrote",OUT,os.path.getsize(OUT),"bytes")