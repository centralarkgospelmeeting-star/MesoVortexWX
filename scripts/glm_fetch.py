#!/usr/bin/env python3
import json, sys, urllib.request, urllib.parse, xml.etree.ElementTree as ET, tempfile, os, datetime
from netCDF4 import Dataset

BUCKET = 'https://noaa-goes19.s3.amazonaws.com'
PREFIX_BASE = 'GLM-L2-LCFA'

def list_keys(prefix, max_keys=10):
    url = f"{BUCKET}/?list-type=2&prefix={urllib.parse.quote(prefix, safe='/')}&max-keys={max_keys}"
    req = urllib.request.Request(url, headers={'User-Agent':'MesoVortexWX/1.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        xml = r.read()
    root = ET.fromstring(xml)
    ns = {'s3': 'http://s3.amazonaws.com/doc/2006-03-01/'}
    keys = []
    for c in root.findall('s3:Contents', ns):
        k = c.find('s3:Key', ns)
        if k is not None and k.text:
            keys.append(k.text)
    return keys

def fetch_nc(key):
    url = f"{BUCKET}/{urllib.parse.quote(key, safe='/')}"
    req = urllib.request.Request(url, headers={'User-Agent':'MesoVortexWX/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    fd, path = tempfile.mkstemp(suffix='.nc')
    os.write(fd, data)
    os.close(fd)
    return path

def parse_flashes(path):
    ds = Dataset(path)
    try:
        lats = ds.variables['flash_lat'][:].tolist() if 'flash_lat' in ds.variables else []
        lons = ds.variables['flash_lon'][:].tolist() if 'flash_lon' in ds.variables else []
        energy = ds.variables['flash_energy'][:].tolist() if 'flash_energy' in ds.variables else [None]*len(lats)
        area = ds.variables['flash_area'][:].tolist() if 'flash_area' in ds.variables else [None]*len(lats)
        feats = []
        for i in range(min(len(lats), len(lons))):
            lat = float(lats[i]); lon = float(lons[i])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180): continue
            feats.append({
                'type':'Feature',
                'geometry':{'type':'Point','coordinates':[lon,lat]},
                'properties':{
                    'energy_j': float(energy[i]) if i < len(energy) and energy[i] is not None else None,
                    'area_km2': float(area[i]) if i < len(area) and area[i] is not None else None,
                    'source':'NOAA GOES-R GLM',
                }
            })
        return feats
    finally:
        ds.close()

def main():
    minutes = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    minutes = max(1, min(20, minutes))
    now = datetime.datetime.utcnow()
    # GLM files are every 20s; look in current and previous hour prefixes as needed
    prefixes = []
    for delta in [0, -1]:
        t = now + datetime.timedelta(hours=delta)
        doy = t.strftime('%j')
        prefixes.append(f"{PREFIX_BASE}/{t.year}/{doy}/{t.strftime('%H')}/")
    keys = []
    for p in prefixes:
        try:
            keys.extend(list_keys(p, max_keys=200))
        except Exception:
            pass
    keys = sorted(set(keys))
    # take last N files ~ 3 files per minute
    want = max(3, min(60, minutes * 3))
    keys = keys[-want:]
    features = []
    for k in keys:
        path = None
        try:
            path = fetch_nc(k)
            features.extend(parse_flashes(path))
        except Exception:
            pass
        finally:
            if path and os.path.exists(path):
                os.unlink(path)
    out = {
        'available': True,
        'source': 'NOAA GOES-R GLM (GOES-East, noaa-goes19 S3)',
        'generatedAt': datetime.datetime.utcnow().isoformat() + 'Z',
        'windowMinutes': minutes,
        'count': len(features),
        'features': {'type':'FeatureCollection','features':features},
    }
    print(json.dumps(out))

if __name__ == '__main__':
    main()
