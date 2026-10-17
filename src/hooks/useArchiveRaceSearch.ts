'use client';
import { useEffect, useState } from 'react';
import type { Election } from '@/lib/api';
import { ArchiveRace, searchArchiveRaces } from '@/lib/archive-search';
export function useArchiveRaceSearch(elections:Election[],query:string,enabled:boolean) {
    const [state,setState]=useState<{query:string;ids:string;rows:ArchiveRace[];done:number;failed:number;loading:boolean}>({query:'',ids:'',rows:[],done:0,failed:0,loading:false});
    const ids=elections.map(e=>`${e.electionId}:${e.lastPublished}`).join('|');
    useEffect(()=>{
        if(!enabled)return;
        const controller=new AbortController();
        const timer=setTimeout(()=>{
            setState({query,ids,rows:[],done:0,failed:0,loading:true});
            void searchArchiveRaces(elections,query,{candidateOnly:true,signal:controller.signal,onProgress:(rows,done,failed)=>setState({query,ids,rows,done,failed,loading:done<elections.length})})
                .catch(()=>{if(!controller.signal.aborted)setState(s=>({...s,loading:false,failed:s.failed+1}));});
        },250);
        return ()=>{clearTimeout(timer);controller.abort();};
        // The election list is refreshed by SWR. Stable IDs and publication revisions prevent restarting identical searches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[query,ids,enabled]);
    const current=state.query===query && state.ids===ids;
    return {rows:current?state.rows:[],done:current?state.done:0,failed:current?state.failed:0,loading:enabled && (!current || state.loading)};
}
