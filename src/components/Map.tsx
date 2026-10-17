'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import useSWR from 'swr';
import manifest from '@/lib/boundary-manifest.json';
import { selectBoundary,boundaryIsReference,sameBoundary } from '@/lib/boundaries';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import type { ResultsMapProps } from './MapWrapper';
import { buildWardData, wardKey, WardData } from '@/lib/map-data';
import { assignCandidateColors } from '@/lib/candidate-colors';

type WardProps = {NAME:string;WardNumber:string};
type WardFeatures = FeatureCollection<Geometry,WardProps>;
const bounds:L.LatLngBoundsExpression = [[42.84,-89.85],[43.31,-89.0]];
function Camera({data,selectedWard,fitKey,wards}: {data:WardFeatures;selectedWard:ResultsMapProps['selectedWard'];fitKey:string;wards:ReturnType<typeof buildWardData>}) {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    },[map]);
    const coverage = [...wards.keys()].sort().join(';');
    useEffect(() => {
        const layer = L.geoJSON(data, {filter:f => wards.has(wardKey(f.properties.NAME,f.properties.WardNumber))});
        const target = layer.getBounds();
        if (target.isValid()) map.fitBounds(target,{padding:[24,24],maxZoom:13});
        else map.fitBounds(bounds);
        // Refit only when selection changes, never when a live poll refreshes data.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[data,fitKey,map,coverage]);
    useEffect(() => {
        if (!selectedWard) return;
        const layer = L.geoJSON(data,{filter:f => wardKey(f.properties.NAME,f.properties.WardNumber) === wardKey(selectedWard.name,selectedWard.num)});
        if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(),{padding:[36,36],maxZoom:14});
    },[data,selectedWard,map]);
    return null;
}
function ResetMap(){const map=useMap();return <button className="map-reset" onClick={()=>map.fitBounds(bounds)}>Fit county</button>;}
function popup(feature: Feature<Geometry,WardProps>, ward:WardData|undefined, shift?:{from:number;to:number}) {
    // Build DOM nodes with textContent, never interpolate county-provided names into HTML.
    const root=document.createElement('div');root.className='ward-popup';
    const title=document.createElement('strong');title.textContent=`${feature.properties.NAME} · Ward ${feature.properties.WardNumber}`;root.append(title);
    const note=document.createElement('p');note.textContent=ward?.grouped ? `Combined totals for ${ward.source}. Individual ward counts are unavailable.` : ward ? (ward.reported ? 'Reported precinct results' : 'Not yet reported') : 'No matching results for this ward in the selected race.';root.append(note);
    if(shift){const p=document.createElement('p');p.textContent=`Candidate share: ${shift.from.toFixed(1)}% → ${shift.to.toFixed(1)}% (${(shift.to-shift.from).toFixed(1)} points)`;root.append(p);}
    for(const c of ward?.candidates ?? []) {const row=document.createElement('p');row.textContent=`${c.name}: ${c.votes.toLocaleString()} (${ward?.total ? (100*c.votes/ward.total).toFixed(1) : '0.0'}%)`;root.append(row);}
    return root;
}
export default function ElectionMap({electionDate,comparisonDate,comparisonRows,precinctResults,isLoading,selectedWard,raceResult,focusedCandidate,onCandidateReset,fitKey,onSelectWard,trendsMode,shiftByWard,shiftLabel}: ResultsMapProps) {
    const snapshot=selectBoundary(manifest.snapshots,electionDate);
    const previousSnapshot=trendsMode?selectBoundary(manifest.snapshots,comparisonDate):undefined;
    const loadGeometry=async (file:string):Promise<WardFeatures>=>{const r=await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH||''}${file}`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Boundaries unavailable');const d=await r.json();if(d.type!=='FeatureCollection'||!d.features?.length)throw new Error('Invalid boundaries');return d;};
    const {data,error:geoError,mutate:retryGeometry}=useSWR<WardFeatures>(snapshot?.file??null,loadGeometry,{revalidateOnFocus:false});
    const {data:previousData}=useSWR<WardFeatures>(trendsMode&&comparisonDate?previousSnapshot?.file??null:null,loadGeometry,{revalidateOnFocus:false});
    const [tileError,setTileError]=useState(false);
    const [basemap,setBasemap]=useState(true);
    const [layer,setLayer]=useState<'winner'|'margin'>('winner');
    const geoRef=useRef<L.GeoJSON>(null);
    const wards=useMemo(()=>buildWardData(precinctResults),[precinctResults]);
    const colors=useMemo(()=>assignCandidateColors(raceResult?.candidates ?? []),[raceResult]);
    const shifts=useMemo(()=>{
        const sourceGeometry=new Map(previousData?.features.map(f=>[wardKey(f.properties.NAME,f.properties.WardNumber),f.geometry]));
        const previousWards=buildWardData(comparisonRows??[]);
        const same=new Set(data?.features.filter(f=>{const key=wardKey(f.properties.NAME,f.properties.WardNumber);const old=sourceGeometry.get(key);return old&&sameBoundary(old,f.geometry)&&!wards.get(key)?.grouped&&!previousWards.get(key)?.grouped;}).map(f=>wardKey(f.properties.NAME,f.properties.WardNumber)));
        return new Map(Object.entries(shiftByWard??{}).map(([k,v])=>[k.toLowerCase(),v] as const).filter(([k])=>same.has(k)));
    },[shiftByWard,data,previousData,comparisonRows,wards]);
    function style(feature?:Feature<Geometry,WardProps>):L.PathOptions {
        const key=feature ? wardKey(feature.properties.NAME,feature.properties.WardNumber) : '';
        const ward=wards.get(key); let fill='#d2d9df', opacity=.24;
        const shift=shifts.get(key);
        if(trendsMode && shift){fill=shift.to>=shift.from?'#207b6b':'#b15b42';opacity=.25+Math.min(Math.abs(shift.to-shift.from)/20,1)*.6;}
        else if(!trendsMode && ward && ward.total>0){
            const leader=ward.candidates[0], runner=ward.candidates[1];
            const candidate=focusedCandidate ?? leader.name;
            const color=colors[candidate];
            fill=color ? `hsl(${color.h},${color.s}%,${color.l}%)` : '#64748b';
            const share=(ward.candidates.find(c=>c.name===candidate)?.votes ?? 0)/ward.total;
            opacity=focusedCandidate ? .12+share*.76 : layer==='margin' ? .25+((leader.votes-(runner?.votes ?? 0))/ward.total)*.6 : .62;
        }
        const active=selectedWard && key===wardKey(selectedWard.name,selectedWard.num);
        return {fillColor:fill,fillOpacity:opacity,color:active?'#102c46':'#60798b',weight:active?3:.65,opacity:.8};
    }
    useEffect(()=>{geoRef.current?.setStyle(style);});
    const geometryKeys=useMemo(()=>new Set(data?.features.map(f=>wardKey(f.properties.NAME,f.properties.WardNumber))),[data]);
    const unmatched=[...wards].filter(([k])=>!geometryKeys.has(k)).map(([,w])=>w);
    const matched=wards.size-unmatched.length;
    const unmatchedSources=[...new Set(unmatched.map(w=>w.source))];
    return <div className="election-map">
        <div className="map-toolbar">
            {trendsMode ? <span>{shiftLabel ?? 'Search a candidate in Trends to compare two elections.'}</span> : <label>Map shading<select value={layer} onChange={e=>setLayer(e.target.value as 'winner'|'margin')}><option value="winner">Leading candidate</option><option value="margin">Winning margin</option></select></label>}
            <label className="basemap-toggle"><input type="checkbox" checked={basemap} onChange={e=>setBasemap(e.target.checked)} />Street map</label>
            {focusedCandidate && <button onClick={onCandidateReset}>Clear {focusedCandidate}</button>}
        </div>
        {(geoError||!snapshot) && <div className="map-notice" role="alert">Ward boundaries could not load. <button onClick={()=>void retryGeometry()}>Retry boundaries</button></div>}
        {tileError && basemap && <div className="map-notice" role="status">Street tiles are unavailable. Ward results still work. <button onClick={()=>setBasemap(false)}>Hide street map</button></div>}
        <div className="map-canvas">
            <MapContainer bounds={bounds} zoomControl={true} scrollWheelZoom={true}>
                {basemap && <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    eventHandlers={{tileerror:()=>setTileError(true)}} />}
                {data && <><GeoJSON key={`${snapshot?.id}|${fitKey}|${shifts.size}|${precinctResults.length}|${JSON.stringify(precinctResults.map(r=>[r.votes,r.reported]))}|${JSON.stringify(shiftByWard)}`} ref={geoRef} data={data} style={style}
                    onEachFeature={(f,l)=>{const feature=f as Feature<Geometry,WardProps>;const key=wardKey(feature.properties.NAME,feature.properties.WardNumber);
                        const content=()=>popup(feature,wards.get(key),shifts.get(key));
                        if(window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                            l.bindTooltip(content,{sticky:true,direction:'auto',opacity:1,className:'ward-hover-card',offset:[14,0]});
                            // Hover previews do not select a ward or move the camera.
                        } else {
                            l.bindPopup(content,{maxWidth:300});
                            l.on('click',()=>onSelectWard({name:feature.properties.NAME,num:String(feature.properties.WardNumber)}));
                        }
                    }} /><Camera data={data} selectedWard={selectedWard} fitKey={fitKey} wards={wards}/></>}
                <ResetMap/>
            </MapContainer>
            {isLoading && <div className="map-loading" role="status">Loading results…</div>}
        </div>
        <footer className="map-footer">
            <div className="map-legend">{trendsMode ? <><span><i style={{background:'#207b6b'}}/>Gained share</span><span><i style={{background:'#b15b42'}}/>Lost share</span></> : (raceResult?.candidates ?? []).map(c=>{const color=colors[c.candidateName];return <span key={c.candidateName}><i style={{background:color?`hsl(${color.h},${color.s}%,${color.l}%)`:'#64748b'}}/>{c.candidateName}</span>;})}<span><i style={{background:'#d2d9df'}}/>No matching data</span></div>
            <p>{data ? `${matched} of ${wards.size} result wards matched.` : geoError ? 'Boundaries unavailable.' : 'Loading ward boundaries…'} {snapshot && <a href={snapshot.source} target="_blank" rel="noreferrer">Boundaries: {snapshot.label} ↗</a>}{snapshot && boundaryIsReference(snapshot,electionDate) ? ' · Reference snapshot; election-date boundaries are unavailable.':''} Grouped precinct totals cover multiple wards.</p>
            {data && unmatchedSources.length>0 && <details className="boundary-coverage"><summary>{unmatchedSources.length} precincts have results without matching boundaries</summary><p>These totals remain in the race results. They are not assigned to another ward.</p><ul>{unmatchedSources.map(source=><li key={source}>{source}</li>)}</ul></details>}
            {trendsMode && shiftByWard && <p>Share changes shown for {shifts.size} wards with identical boundaries and individual ward totals. Changed boundaries and combined precincts are excluded.</p>}
        </footer>
    </div>;
}
