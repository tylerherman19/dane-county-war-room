"""Pin Dane County ward snapshots. Requires: pip install pyshp pyproj shapely fiona.
Run explicitly; production builds use committed data and do not require GIS availability.
"""
import json,io,zipfile,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
import shapefile
import fiona
from shapely.ops import unary_union
import tempfile
from shapely.geometry import shape,mapping
from pyproj import CRS,Transformer
OUT=Path('public/data/boundaries');OUT.mkdir(parents=True,exist_ok=True)
PREFIX={'C':'City of ','T':'Town of ','V':'Village of '}
def read(url):
    with urllib.request.urlopen(url,timeout=60) as r:return r.read()
def coords(value,transform=None):
    if isinstance(value[0],(int,float)):
        a,b=transform.transform(*value[:2]) if transform else value[:2]
        return [round(a,6),round(b,6)]
    return [coords(v,transform) for v in value]
def feature(geo,p,ward):
    return {'type':'Feature','geometry':{'type':geo['type'],'coordinates':geo['coordinates']},'properties':{'NAME':PREFIX[p['CTV'].strip()]+p['MCD_NAME'].strip().title(),'WardNumber':str(ward).strip().lstrip('0') or '0'}}
def save(id,date,label,source,features):
    if len(features)<350:raise ValueError(f'Incomplete snapshot {id}: {len(features)}')
    groups={}
    for f in features:
        key=(f['properties']['NAME'],f['properties']['WardNumber'])
        geometry=shape(f['geometry'])
        if not geometry.is_valid:geometry=geometry.buffer(0)
        groups.setdefault(key,[]).append(geometry)
    features=[{'type':'Feature','properties':{'NAME':key[0],'WardNumber':key[1]},'geometry':mapping(unary_union(parts))} for key,parts in groups.items()]
    for f in features:
        f['geometry']=mapping(shape(f['geometry']).simplify(0.00001,preserve_topology=True))
        f['geometry']['coordinates']=coords(f['geometry']['coordinates'])
    path=OUT/(id+'.geojson');path.write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
    print(id,len(features),path.stat().st_size,flush=True)
    return {'id':id,'date':date,'label':label,'file':'/data/boundaries/'+id+'.geojson','source':source}
def fromzip(year,season):
    name=f'WI_MunicipalWards_{season}_{year}'
    source='https://web.s3.wisc.edu/rml-gisdata/'+name+'.zip'
    cache=Path('/tmp/'+name+'.zip')
    z=zipfile.ZipFile(cache if cache.exists() else io.BytesIO(read(source)))
    if not any(n.lower().endswith('.shp') for n in z.namelist()):
        with tempfile.TemporaryDirectory() as directory:
            z.extractall(directory)
            gdb=next(Path(directory).rglob('*.gdb'))
            with fiona.open(gdb) as records:
                project=Transformer.from_crs(records.crs,4326,always_xy=True)
                features=[]
                for item in records:
                    p=dict(item['properties'])
                    if p.get('CNTY_NAME','').lower()!='dane':continue
                    geo=dict(item['geometry']);geo['coordinates']=coords(geo['coordinates'],project)
                    ward=p.get('WARDID') or p.get('WardID') or p.get('WARD_ID')
                    features.append(feature(geo,p,ward))
                return save(f'{year}-01',f'{year}-01-01',f'January {year} · LTSB',source,features)
    shp=next(n for n in z.namelist() if n.endswith('.shp'))
    root=shp[:-4]
    r=shapefile.Reader(shp=io.BytesIO(z.read(root+'.shp')),shx=io.BytesIO(z.read(root+'.shx')),dbf=io.BytesIO(z.read(root+'.dbf')))
    project=Transformer.from_crs(CRS.from_wkt(z.read(root+'.prj').decode()),4326,always_xy=True)
    features=[]
    for index,record in enumerate(r.iterRecords()):
        p=record.as_dict()
        if str(p.get('CNTY_FIPS','')) not in ('55025','025') and p.get('CNTY_NAME','').lower()!='dane':continue
        ward=p.get('WARDID') or p.get('WardID') or p.get('WARD_ID')
        if not ward:raise ValueError(f'Ward field missing: {p.keys()}')
        geo=r.shape(index).__geo_interface__;geo['coordinates']=coords(geo['coordinates'],project)
        features.append(feature(geo,p,ward))
    month='01' if season=='Spring' else '07'
    return save(f'{year}-{month}',f'{year}-{month}-01',f'{"January" if season=="Spring" else "July"} {year} · LTSB',source,features)
def arcgis(id,date,label,service,ward):
    source='https://services1.arcgis.com/FDsAtKBk8Hy4cAH0/arcgis/rest/services/'+service+'/FeatureServer/0'
    query=urllib.parse.urlencode({'f':'geojson','where':"CNTY_NAME='Dane'",'returnGeometry':'true','outFields':f'MCD_NAME,CTV,{ward}','outSR':4326,'geometryPrecision':6,'resultRecordCount':2000})
    cache=Path('/tmp/arcgis-wards-'+id+'.json')
    if not cache.exists():cache.write_bytes(read(source+'/query?'+query))
    d=json.loads(cache.read_text())
    if d.get('exceededTransferLimit'):raise ValueError('Truncated boundary response')
    return save(id,date,label,source,[feature(f['geometry'],f['properties'],f['properties'][ward]) for f in d['features']])
# Each collection is a dated geometry source, not its redistributed election-vote estimates.
snapshots=[]
sources=[(2018,'Fall'),(2019,'Spring'),(2020,'Spring'),(2021,'Spring'),(2022,'Spring'),(2023,'Spring'),(2023,'Fall'),(2024,'Spring'),(2024,'Fall'),(2025,'Spring'),(2025,'Fall')]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:snapshots=list(pool.map(lambda args:fromzip(*args),sources))
snapshots.extend([
 arcgis('2011','2011-12-01','2011 wards · LTSB reference','2012_to_2018_Election_Data_with_2011_Wards','WARD_ID'),
 arcgis('2020-07','2020-07-01','July 2020 · LTSB','2012_to_2020_Election_Data_with_2020_Wards','STR_WARDS'),
 arcgis('2022-07','2022-07-01','July 2022 · LTSB','2022_Election_Data_wtih_2022_Wards','WARDID'),
 arcgis('2026-01','2026-01-01','January 2026 · LTSB','WI_Municipal_Wards_January','WARDID'),
 arcgis('2026-07','2026-07-01','July 2026 · LTSB','WI_Municipal_Wards_July','WARDID'),
])
manifest={'snapshots':sorted(snapshots,key=lambda s:s['date'])}
Path('src/lib/boundary-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
