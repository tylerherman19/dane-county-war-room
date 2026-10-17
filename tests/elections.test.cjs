const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {filterElections,electionCycle,electionStage,officeCategory} = require('../src/lib/archive-filters.ts');
const {getPrecinctResults,getRaces} = require('../src/lib/api.ts');
const {buildWardData,wardKey} = require('../src/lib/map-data.ts');
const {assignCandidateColors} = require('../src/lib/candidate-colors.ts');
const elections = [
 {electionId:'a',electionDate:'2024-08-13T00:00:00',electionName:'2024 Partisan Primary'},
 {electionId:'b',electionDate:'2024-11-05T00:00:00',electionName:'2024 General Election'},
 {electionId:'c',electionDate:'2025-02-18T00:00:00',electionName:'2025 Spring Primary'},
 {electionId:'d',electionDate:'2025-04-01T00:00:00',electionName:'2025 Spring Election'},
 {electionId:'e',electionDate:'2025-05-01T00:00:00',electionName:'Special Primary'}
];
test('year, primary/general, cycle and text filters intersect correctly',()=>{
 const all={year:'',stage:'',cycle:'',query:''};
 assert.deepEqual(filterElections(elections,{...all,year:'2024',stage:'Primary',cycle:'Fall'}).map(e=>e.electionId),['a']);
 assert.deepEqual(filterElections(elections,{...all,stage:'General'}).map(e=>e.electionId),['b','d']);
 assert.deepEqual(filterElections(elections,{...all,year:'2025',query:'spring 04-01'}).map(e=>e.electionId),['d']);
 assert.equal(filterElections(elections,{...all,year:'2024',cycle:'Spring'}).length,0);
 assert.deepEqual(filterElections(elections,{...all,stage:'General',cycle:'Spring'}).map(e=>e.electionId),['d']);
 assert.equal(electionCycle(elections[4]),'Special');assert.equal(electionStage(elections[4]),'Primary');
});
test('offices separate courts, school, county, municipal and referendums',()=>{
 for(const [name,type,expected] of [['Justice of the Supreme Court','Other','Courts'],['Madison School Board','Other','School board & education'],['Dane County Supervisor District 1','Supervisor','County'],['Madison Alder District 7','Alder','City council'],['Village of Dane Trustee','Other','Town & village'],['Madison Referendum','Referendum','Referendums'],['Secretary of State','Other','State']])assert.equal(officeCategory({name,type}),expected);
});
test('combined precinct allocations preserve votes and expose original totals',async()=>{
 const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({PrecinctVotes:[{PrecinctName:'V DeForest Wds 1-3, 5',CandidateName:'Candidate A',TotalVotes:101,Reported:true},{PrecinctName:'V DeForest Wds 1-3, 5',CandidateName:'Candidate B',TotalVotes:50,Reported:true}]})});
 try {
  const rows=await getPrecinctResults('194','0018');
  assert.equal(rows.length,8);assert.equal(rows.reduce((s,r)=>s+r.votes,0),151);
  const wards=buildWardData(rows);const ward=wards.get(wardKey('Village of DeForest','001'));
  assert.equal(ward.total,151);assert.equal(ward.grouped,true);assert.equal(ward.candidates[0].votes,101);
  assert.equal(wards.has(wardKey('Village of DeForest','4')),false);
 }finally{global.fetch=original;}
});
test('race list removes administrative rows and preserves zero-padded IDs',async()=>{
 const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>[{RaceNumber:'0001',RaceName:'BALLOTS CAST - TOTAL'},{RaceNumber:'0018',RaceName:'REP Governor'},{RaceNumber:'0100',RaceName:'C. Madison Ref (Increase levy limit)'}]});
 try{const races=await getRaces('194');assert.equal(races.length,2);assert.equal(races[0].id,'0018');assert.equal(races[0].type,'Governor');assert.equal(races[1].type,'Referendum');assert.equal(officeCategory(races[1]),'Referendums');}finally{global.fetch=original;}
});
test('same-party candidates get distinct map colors',()=>{
 const colors=assignCandidateColors([{candidateName:'Alice',party:'Republican'},{candidateName:'Bob',party:'Republican'}]);
 assert.notDeepEqual(colors.Alice,colors.Bob);
});

test('mixed spring elections appear in both types and recall cycles are discoverable',()=>{
 const mixed={electionDate:'2024-04-02',electionName:'2024 Spring Election & Presidential Preference Primary'};
 const earlier={electionDate:'2020-04-07',electionName:'2020 Spring & Presidential Preference Election'};
 for(const stage of ['Primary','General'])assert.equal(filterElections([mixed,earlier],{year:'',stage,cycle:'Spring',query:''}).length,2);
 assert.equal(electionCycle({electionName:'2025 DeForest Recall Primary'}),'Recall');
 assert.equal(officeCategory({name:'DEM Clerk of Circuit Court Dane County',type:'Other'}),'County');
});
test('county precinct names without Wds still join to ward geometry',async()=>{
 const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({PrecinctVotes:[{PrecinctName:'V Waunakee 6-16',CandidateName:'A',TotalVotes:373,Reported:true}]})});
 try{const rows=await getPrecinctResults('194','0018');assert.equal(rows.length,11);assert.equal(rows[0].precinctName,'Village of Waunakee');assert.equal(rows[10].wardNumber,'16');assert.equal(rows[0].sourceVotes,373);}finally{global.fetch=original;}
});
const {getArchiveBallot,searchArchiveRaces,matchesArchiveRace}=require('../src/lib/archive-search.ts');
test('archive search finds candidates across elections and retains the selected race IDs',async()=>{
 const original=global.fetch;
 const fixture=[{electionId:'search-2022',electionName:'2022 General Election',electionDate:'2022-11-08',lastPublished:''},{electionId:'search-2024',electionName:'2024 General Election',electionDate:'2024-11-05',lastPublished:''}];
 let requests=0;
 global.fetch=async url=>{requests++;return {ok:true,json:async()=>({Races:[{RaceNumber:'0018',RaceName:'Governor',Candidates:[{Name:'Tony Evers',Votes:100,Percentage:60,PartyName:'Democratic'}],TotalPrecincts:1,PrecinctsReported:1},{RaceNumber:'0100',RaceName:'C. Madison Ref (Increase levy limit)',Candidates:[{Name:'Yes',Votes:100,Percentage:57,PartyName:''}],TotalPrecincts:1,PrecinctsReported:1}]})};};
 try{
  const [a,b]=await Promise.all([getArchiveBallot(fixture[0]),getArchiveBallot(fixture[0])]);
  assert.equal(requests,1);assert.equal(a[0].candidates[0].candidateName,'Tony Evers');assert.deepEqual(a,b);
  const rows=await searchArchiveRaces(fixture,'Evers');assert.equal(rows.length,2);assert.equal(rows[0].id,'0018');assert.equal(rows[1].electionId,'search-2024');
  assert.equal((await searchArchiveRaces(fixture,'2024 Evers')).length,1);
  assert.equal(matchesArchiveRace(rows[0],'governor Tony'),true);
  assert.equal((await searchArchiveRaces(fixture,'Madison')).length,2);
  assert.equal((await searchArchiveRaces(fixture,'Evers',{candidateOnly:true})).length,2);
  assert.equal((await searchArchiveRaces(fixture,'General',{candidateOnly:true})).length,0);
  assert.equal(requests,2);
  const controller=new AbortController();controller.abort();await assert.rejects(searchArchiveRaces(fixture,'Evers',{signal:controller.signal}));
 }finally{global.fetch=original;}
});
const {getCycleElections,currentFallCycleYear}=require('../src/lib/election-cycle.ts');
test('November and partisan primary resolve independently within the same cycle',()=>{
 const primary={electionId:'194',electionName:'2026 Partisan Primary',electionDate:'2026-08-11'};
 const spring={electionId:'190',electionName:'2026 Spring Election',electionDate:'2026-04-07'};
 const older={electionId:'172',electionName:'2024 General Election',electionDate:'2024-11-05'};
 let cycle=getCycleElections([primary,spring,older],2026);
 assert.equal(cycle.PRIMARY.electionId,'194');assert.equal(cycle.NOVEMBER,undefined);
 const november={electionId:'new-id',electionName:'2026 General Election',electionDate:'2026-11-03'};
 cycle=getCycleElections([november,primary,spring,older],2026);
 assert.equal(cycle.NOVEMBER.electionId,'new-id');assert.equal(cycle.PRIMARY.electionId,'194');
 assert.equal(getCycleElections([spring,older],2026).PRIMARY,undefined);
 assert.equal(currentFallCycleYear(2026),2026);assert.equal(currentFallCycleYear(2027),2026);
});
