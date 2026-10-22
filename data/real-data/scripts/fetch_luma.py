"""Fetch public Luma event pages (low rate: 1 request / 2 s) and extract public fields.
Only company-level/public event info is kept; host personal data is NOT stored."""
import re, json, sys, time, subprocess, pathlib
RAW = pathlib.Path(__file__).resolve().parent.parent / "raw" / "luma"
RAW.mkdir(parents=True, exist_ok=True)
def text_of(node):
    out=[]
    def w(n):
        if isinstance(n,dict):
            if n.get('type')=='text': out.append(n.get('text',''))
            for c in n.get('content',[]) or []: w(c)
            if n.get('type') in ('paragraph','heading','list_item','hard_break'): out.append('\n')
        elif isinstance(n,list):
            for c in n: w(c)
    w(node); return ''.join(out)
def fetch(url):
    slug=url.rstrip('/').split('/')[-1]
    f=RAW/f"{slug}.html"
    if not f.exists() or f.stat().st_size<5000:
        subprocess.run(["curl","-sL","-A","Mozilla/5.0 (hackathon research; low rate)","-o",str(f),url],check=False)
        time.sleep(2)
    h=f.read_text(errors='ignore')
    m=re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',h,re.S)
    if not m: return {"url":url,"error":"no data"}
    d=json.loads(m.group(1))['props']['pageProps'].get('initialData',{}).get('data',{})
    ev=d.get('event') or {}
    if not ev: return {"url":url,"error":"not an event page"}
    geo=ev.get('geo_address_info') or {}
    loc=(geo.get('localized') or {}).get('en-GB',geo)
    cal=d.get('calendar') or {}
    desc=text_of(d.get('description_mirror') or ev.get('description_mirror') or {})
    return {"url":url,"name":ev.get('name'),"start_at":ev.get('start_at'),"end_at":ev.get('end_at'),
            "calendar_name":cal.get('name'),"calendar_slug":cal.get('slug'),"calendar_personal":cal.get('is_personal'),
            "address_mode":geo.get('mode'),"venue":geo.get('address') if geo.get('mode')=='shown' else None,
            "area":loc.get('sublocality') if geo.get('mode')=='shown' else None,"city":geo.get('city') or (cal.get('location') or {}).get('city'),
            "full_address":geo.get('full_address') if geo.get('mode')=='shown' else None,
            "lat":(ev.get('coordinate') or {}).get('latitude'),"lon":(ev.get('coordinate') or {}).get('longitude'),
            "guest_count":d.get('guest_count'),
            "description":desc}
if __name__=="__main__":
    urls=[u.strip() for u in open(sys.argv[1]) if u.strip() and not u.startswith('#')]
    outp=pathlib.Path(sys.argv[2]); res=json.loads(outp.read_text()) if outp.exists() else {}
    for u in urls:
        if u in res and 'error' not in res[u]: continue
        res[u]=fetch(u); print(res[u].get('name') or res[u].get('error'), '|', res[u].get('start_at'), '|', res[u].get('calendar_name'), '|', res[u].get('area'), res[u].get('guest_count'))
    outp.write_text(json.dumps(res,indent=1,ensure_ascii=False))
