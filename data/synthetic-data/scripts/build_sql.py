#!/usr/bin/env python3
"""Builds sql/schema.sql + sql/seed.sql (Postgres/Supabase) from csv/*.csv. SAMPLE data only."""
import csv
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sql"; OUT.mkdir(exist_ok=True)
PK = {"communities":"community_id","sponsors":"sponsor_id","events":"event_id","sponsor_deals":"deal_id","members":"member_id",
      "speakers":"speaker_id","organiser_contacts_C01":"contact_id","luma_guests_flat":"id"}
def typ(vals):
    vals = [v for v in vals if v != ""]
    if vals and all(v in ("True","False") for v in vals): return "boolean"
    try:
        [int(v) for v in vals]; return "integer" if vals else "text"
    except ValueError: pass
    try:
        [float(v) for v in vals]; return "double precision"
    except ValueError: return "text"
def lit(v, t):
    if v == "": return "NULL"
    if t == "boolean": return "TRUE" if v == "True" else "FALSE"
    if t in ("integer", "double precision"): return v
    return "'" + v.replace("'", "''") + "'"
schema, seed = ["-- SAMPLE / FICTIONAL hackathon demo data. Schema generated from csv/.", ""], ["-- SAMPLE / FICTIONAL seed data. Load after schema.sql.", "BEGIN;"]
for f in sorted((ROOT / "csv").glob("*.csv")):
    t = f.stem.lower()
    rows = list(csv.DictReader(open(f)))
    cols = list(rows[0].keys())
    types = {c: typ([r[c] for r in rows]) for c in cols}
    defs = [f'  "{c}" {types[c]}' + (" PRIMARY KEY" if PK.get(f.stem) == c else "") for c in cols]
    schema += [f'DROP TABLE IF EXISTS "{t}";', f'CREATE TABLE "{t}" (', ",\n".join(defs), ");", f"COMMENT ON TABLE \"{t}\" IS 'SAMPLE / FICTIONAL demo data';", ""]
    collist = ", ".join(f'"{c}"' for c in cols)
    for r in rows:
        seed.append(f'INSERT INTO "{t}" ({collist}) VALUES (' + ", ".join(lit(r[c], types[c]) for c in cols) + ");")
seed.append("COMMIT;")
(OUT / "schema.sql").write_text("\n".join(schema) + "\n")
(OUT / "seed.sql").write_text("\n".join(seed) + "\n")
print("wrote sql/schema.sql and sql/seed.sql")
