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
 assert.deepEqual(filterElections(elections,{...all,stage:'General'}).map(e=>e.electionId),['b']);
 assert.deepEqual(filterElections(elections,{...all,year:'2025',query:'spring 04-01'}).map(e=>e.electionId),['d']);
 assert.equal(filterElections(elections,{...all,year:'2024',cycle:'Spring'}).length,0);
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
 const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>[{RaceNumber:'0001',RaceName:'BALLOTS CAST - TOTAL'},{RaceNumber:'0018',RaceName:'REP Governor'}]});
 try{const races=await getRaces('194');assert.equal(races.length,1);assert.equal(races[0].id,'0018');assert.equal(races[0].type,'Governor');}finally{global.fetch=original;}
});
test('same-party candidates get distinct map colors',()=>{
 const colors=assignCandidateColors([{candidateName:'Alice',party:'Republican'},{candidateName:'Bob',party:'Republican'}]);
 assert.notDeepEqual(colors.Alice,colors.Bob);
});
