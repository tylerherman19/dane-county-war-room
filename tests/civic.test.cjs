const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] ??= (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {CIVIC_RACES,parseCivicRace,displayName,orderedCandidates,totalVotes,isStale,CIVIC_STALE_MS} = require('../src/lib/civic-api.ts');

const payload = (over={}) => ({election_name:'Wisconsin Governor',election_date:'2026-11-03T05:00:00.000Z',polls_close:'2026-11-04T02:00:00.000Z',percent_reporting:0,test_data:false,last_updated:'2026-10-30T18:31:59.280Z',
 candidates:[{name:'David Crowley',party:'Democratic',votes:0,percent:0,winner:false},{name:'Tom Tiffany',party:'Republican',votes:0,percent:0,winner:false}],
 region_results:{dane:{name:'Dane',percent_reporting:0,candidates:[{name:'David Crowley',votes:0},{name:'Tom Tiffany',votes:0}]}},...over});

test('exactly the 15 requested races: 4 statewide, 8 assembly, 3 senate, no Lt. Governor race',()=>{
 assert.equal(CIVIC_RACES.length,15);
 assert.deepEqual(['STATEWIDE','ASSEMBLY','SENATE'].map(g=>CIVIC_RACES.filter(r=>r.group===g).length),[4,8,3]);
 assert.equal(new Set(CIVIC_RACES.map(r=>r.id)).size,15);
 assert.ok(!CIVIC_RACES.some(r=>/^lt/i.test(r.label)));
});
test('governor shows full tickets and abbreviated names map to official names',()=>{
 assert.equal(displayName(87491,'David Crowley'),'David Crowley / Sarah Godlewski');
 assert.equal(displayName(87491,'Tom Tiffany'),'Tom Tiffany / David Varnam');
 assert.equal(displayName(87494,'Yee Xiong'),'Yee Leng Xiong');
 assert.equal(displayName(87494,'John Leiber'),'John S. Leiber');
 assert.equal(displayName(87492,'Josh Kaul'),'Josh Kaul');
});
test('zero-vote payload keeps API order and implies no leader; winner only from explicit flag',()=>{
 const r=parseCivicRace(payload());
 assert.equal(totalVotes(r),0);
 assert.deepEqual(orderedCandidates(r).map(c=>c.name),['David Crowley','Tom Tiffany']);
 assert.ok(!r.candidates.some(c=>c.winner));
 const live=parseCivicRace(payload({percent_reporting:40,candidates:[{name:'David Crowley',party:'Democratic',votes:10},{name:'Tom Tiffany',party:'Republican',votes:20}]}));
 assert.equal(orderedCandidates(live)[0].name,'Tom Tiffany');
 assert.ok(!live.candidates.some(c=>c.winner),'leading is not winning');
 assert.equal(parseCivicRace(payload({candidates:[{name:'A',votes:1,winner:true}]})).candidates[0].winner,true);
 assert.equal(r.regions[0].name,'Dane');
});
test('malformed or wrong-election payloads are rejected rather than shown',()=>{
 assert.throws(()=>parseCivicRace(null));
 assert.throws(()=>parseCivicRace(payload({election_date:'2024-11-05T05:00:00.000Z'})));
 assert.throws(()=>parseCivicRace(payload({candidates:[]})));
 assert.throws(()=>parseCivicRace(payload({candidates:[{name:'X',votes:'12'}]})));
 assert.equal(parseCivicRace(payload({test_data:true})).testData,true);
});
test('stale only after 5 minutes without a successful fetch',()=>{
 assert.equal(isStale(undefined,Date.now()),false);
 assert.equal(isStale(0,CIVIC_STALE_MS),false);
 assert.equal(isStale(0,CIVIC_STALE_MS+1),true);
});
