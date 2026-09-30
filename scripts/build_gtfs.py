import csv,json,zipfile,io,urllib.request,os
URL="http://data.pid.cz/PID_GTFS.zip"
OUT="data/gtfs-index.json"
def rows(z,name):
    with z.open(name) as f:
        return list(csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig")))
print("Downloading GTFS…")
blob=urllib.request.urlopen(URL,timeout=120).read()
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    routes={r["route_id"]:r.get("route_short_name","") for r in rows(z,"routes.txt")}
    trips=rows(z,"trips.txt")
    # stop_times can be large; keep only first/last time for every trip
    bounds={}
    with z.open("stop_times.txt") as f:
        rd=csv.DictReader(io.TextIOWrapper(f,encoding="utf-8-sig"))
        for r in rd:
            tid=r["trip_id"];t=r.get("departure_time") or r.get("arrival_time") or ""
            if tid not in bounds: bounds[tid]=[t,t]
            else: bounds[tid][1]=t
    blocks={};trip_to_block={}
    for t in trips:
        b=t.get("block_id","").strip()
        if not b: continue
        tid=t["trip_id"];trip_to_block[tid]=b
        a,e=bounds.get(tid,["",""])
        blocks.setdefault(b,[]).append({"trip_id":tid,"route":routes.get(t["route_id"],t["route_id"]),"headsign":t.get("trip_headsign",""),"start":a,"end":e,"operation_type":t.get("trip_operation_type","")})
    for arr in blocks.values(): arr.sort(key=lambda x:x["start"])
os.makedirs("data",exist_ok=True)
with open(OUT,"w",encoding="utf-8") as f: json.dump({"generated":__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),"tripToBlock":trip_to_block,"blocks":blocks},f,ensure_ascii=False,separators=(",",":"))
print("Wrote",OUT,os.path.getsize(OUT),"bytes")