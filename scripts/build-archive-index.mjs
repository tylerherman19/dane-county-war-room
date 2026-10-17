// Refresh deliberately, not as a build dependency: the site must build during API outages.
import { writeFile } from 'node:fs/promises';
const base='https://api.danecounty.gov/api/v1/elections';
async function read(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.json();}
const elections=await read('/list');
const entries=[];
for(let i=0;i<elections.length;i+=4){
 await Promise.all(elections.slice(i,i+4).map(async e=>{
  const data=await read(`/electionresults/${e.ElectionId}`);
  if(!Array.isArray(data.Races))throw new Error(`Missing races: ${e.ElectionId}`);
  entries.push({id:String(e.ElectionId),published:e.LastPublished,races:data.Races.filter(r=>!/^\s*(BALLOTS CAST|REGISTERED VOTERS|STRAIGHT PARTY)/i.test(r.RaceName)).map(r=>({id:r.RaceNumber,name:r.RaceName.replace(/\s*-\s*Official Canvass\s*$/i,'').trim(),candidates:r.Candidates.map(c=>c.Name.trim())}))});
 }));
 console.log(`Indexed ${Math.min(i+4,elections.length)}/${elections.length} elections`);
}
entries.sort((a,b)=>Number(b.id)-Number(a.id));
await writeFile('public/data/archive-index.json',JSON.stringify({version:1,generatedAt:new Date().toISOString(),source:base,entries}));
