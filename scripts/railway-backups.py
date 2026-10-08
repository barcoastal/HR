#!/usr/bin/env python3
"""
Railway volume backups for the HR project (production environment).

  python3 scripts/railway-backups.py status   # schedules + backups per volume
  python3 scripts/railway-backups.py enable   # daily+weekly+monthly on the database and file volumes, then take a first backup

Uses the Railway CLI login in ~/.railway/config.json. Prints no secrets.
"""
import json, os, sys, urllib.request

ENVIRONMENT_ID = "95102327-9c72-47c3-b850-f4061e21bd0d"  # HR project, production
VOLUMES = ("postgres-volume", "hr-volume")  # the HRIS database and the resumes on disk
KINDS = ["DAILY", "WEEKLY", "MONTHLY"]

def api(query, variables=None):
    cfg = json.load(open(os.path.expanduser("~/.railway/config.json")))
    token = cfg["user"]["accessToken"]
    req = urllib.request.Request(
        "https://backboard.railway.com/graphql/v2",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "curl/8.7.1", "Accept": "*/*"},
    )
    out = json.load(urllib.request.urlopen(req))
    if out.get("errors"):
        raise SystemExit(f"Railway API error: {out['errors'][0].get('message')}")
    return out["data"]

def instances():
    d = api("query($e: String!) { environment(id: $e) { volumeInstances { edges { node { id currentSizeMB volume { name } service { name } } } } } }", {"e": ENVIRONMENT_ID})
    return {e["node"]["volume"]["name"]: e["node"] for e in d["environment"]["volumeInstances"]["edges"]}

def status(inst):
    for name, i in inst.items():
        s = api("query($id: String!) { volumeInstanceBackupScheduleList(volumeInstanceId: $id) { kind retentionSeconds } }", {"id": i["id"]})["volumeInstanceBackupScheduleList"]
        b = api("query($id: String!) { volumeInstanceBackupList(volumeInstanceId: $id) { name createdAt expiresAt } }", {"id": i["id"]})["volumeInstanceBackupList"]
        b.sort(key=lambda x: x["createdAt"], reverse=True)
        sched = ", ".join(f"{x['kind'].lower()} (kept {round(x['retentionSeconds'] / 86400)} days)" for x in s) or "NONE"
        print(f"{name} ({i['service']['name']}, {round(i['currentSizeMB'])} MB)")
        print(f"  schedules: {sched}")
        print(f"  backups:   {len(b)}" + (f", newest {b[0]['createdAt'][:16]} expires {b[0]['expiresAt'][:10]}" if b else ""))

def enable(inst):
    for name in VOLUMES:
        i = inst[name]
        api("mutation($id: String!, $kinds: [VolumeInstanceBackupScheduleKind!]!) { volumeInstanceBackupScheduleUpdate(volumeInstanceId: $id, kinds: $kinds) }", {"id": i["id"], "kinds": KINDS})
        api("mutation($id: String!, $name: String) { volumeInstanceBackupCreate(volumeInstanceId: $id, name: $name) }", {"id": i["id"], "name": "first-backup"})
        print(f"{name}: schedules set to {', '.join(k.lower() for k in KINDS)}; first backup requested")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    inst = instances()
    if cmd == "enable":
        enable(inst)
        print("--- after")
    status(inst)
