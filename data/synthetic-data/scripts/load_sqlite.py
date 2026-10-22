#!/usr/bin/env python3
"""Tier 0 loader: builds sample.db (SQLite) from sql/schema.sql + sql/seed.sql. Usage: python3 scripts/load_sqlite.py [out.db]"""
import sqlite3, sys, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
db = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "sample.db"
if db.exists(): db.unlink()
schema = (ROOT / "sql" / "schema.sql").read_text()
schema = re.sub(r"COMMENT ON TABLE[^;]*;", "", schema)          # SQLite has no COMMENT
schema = schema.replace("double precision", "REAL")
con = sqlite3.connect(db)
con.executescript(schema)
con.executescript((ROOT / "sql" / "seed.sql").read_text())
for (t,) in con.execute("select name from sqlite_master where type='table' order by name"):
    print(f"{t}: {con.execute(f'select count(*) from \"{t}\"').fetchone()[0]} rows")
con.close(); print("loaded", db)
