import csv,json,zipfile,io,urllib.request,os,datetime,hashlib,shutil
URL="https://data.pid.cz/PID_GTFS.zip"; OUT="data/gtfs-index.json"; CHUNKS="data/routes"
def rows(z,name):
    with z.open(name) as f:return list(csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig")))
def canon(tid):
    p=tid.rsplit("_",1);return p[0] if len(p)==2 and len(p[1])==6 and p[1].isdigit() else tid
def dump(path,obj):
    os.makedirs(os.path.dirname(path),exist_ok=True)
    with open(path,"w",encoding="utf-8") as f:json.dump(obj,f,ensure_ascii=False,separators=(",",":"))
print("Downloading GTFS...")
blob=urllib.request.urlopen(URL,timeout=180).read()
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    route_rows=rows(z,"routes.txt"); route_names={r["route_id"]:r.get("route_short_name","") for r in route_rows}
    stop_names={r["stop_id"]:r.get("stop_name","") for r in rows(z,"stops.txt")}
    trips=rows(z,"trips.txt"); meta={t["trip_id"]:t for t in trips}
    route_trips={}
    for t in trips:route_trips.setdefault(t["route_id"],[]).append(t["trip_id"])
    details={tid:[] for tid in meta};bounds={};source_order=[];seen_order=set()
    with z.open("stop_times.txt") as f:
        for r in csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig")):
            tid=r["trip_id"]
            if tid not in details:continue
            if tid not in seen_order: source_order.append(tid); seen_order.add(tid)
            a=r.get("arrival_time","");d=r.get("departure_time","");tm=d or a
            bounds.setdefault(tid,[tm,tm])[1]=tm
            details[tid].append({"id":r["stop_id"],"n":stop_names.get(r["stop_id"],""),"a":a,"d":d,"s":int(r["stop_sequence"]),"op":r.get("trip_operation_type","")})
    wanted_shapes={t.get("shape_id","") for t in trips if t.get("shape_id")}
    shapes={sid:[] for sid in wanted_shapes}
    with z.open("shapes.txt") as f:
        for r in csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig")):
            sid=r["shape_id"]
            if sid in shapes:shapes[sid].append((int(r["shape_pt_sequence"]),round(float(r["shape_pt_lat"]),5),round(float(r["shape_pt_lon"]),5)))
    for sid in shapes:shapes[sid]=[[lat,lon] for _,lat,lon in sorted(shapes[sid])]
if os.path.isdir(CHUNKS):shutil.rmtree(CHUNKS)
os.makedirs(CHUNKS,exist_ok=True)
trip_index={};aliases={};blocks={};route_files={};sequence=[]
for rid,tids in route_trips.items():
    fn=hashlib.sha1(rid.encode()).hexdigest()[:16]+".json";route_files[rid]=fn
    used_shapes={};chunk_trips={}
    for tid in tids:
        t=meta[tid];sid=t.get("shape_id","");a,e=bounds.get(tid,["",""])
        if sid and sid in shapes:used_shapes[sid]=shapes[sid]
        chunk_trips[tid]={"line":route_names.get(rid,rid),"headsign":t.get("trip_headsign",""),"start":a,"end":e,"shape_id":sid,"stops":details[tid]}
        b=t.get("block_id","").strip()
        trip_index[tid]={"f":fn,"b":b,"l":route_names.get(rid,rid)}
        aliases.setdefault(canon(tid),tid)
        if b:blocks.setdefault(b,[]).append({"trip_id":tid,"route":route_names.get(rid,rid),"start":a,"end":e,"headsign":t.get("trip_headsign","")})
    dump(os.path.join(CHUNKS,fn),{"route_id":rid,"trips":chunk_trips,"shapes":used_shapes})
for arr in blocks.values():arr.sort(key=lambda x:x["start"])
sequence=[tid for tid in source_order if tid in trip_index]
pos={tid:i for i,tid in enumerate(sequence)}
for tid,i in pos.items(): trip_index[tid]["p"]=i
dump(OUT,{"generated":datetime.datetime.now(datetime.timezone.utc).isoformat(),"trips":trip_index,"aliases":aliases,"blocks":blocks,"sequence":sequence})
print("Wrote index",os.path.getsize(OUT),"bytes; route chunks",len(route_files),"files; largest",max(os.path.getsize(os.path.join(CHUNKS,f)) for f in route_files.values()),"bytes")