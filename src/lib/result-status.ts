export type ResultStatus = 'interrupted'|'waiting'|'loading'|'finalized'|'updating'|'connected'|'archive';
export function getResultStatus({error,pending,checkedAt,finalized,live,validating,reporting}:{error:boolean;pending:boolean;checkedAt?:string;finalized?:boolean;live:boolean;validating?:boolean;reporting?:number}):{kind:ResultStatus;label:string} {
    if(error)return {kind:'interrupted',label:'Connection interrupted'};
    if(pending)return {kind:'waiting',label:'Awaiting results'};
    if(!checkedAt)return {kind:'loading',label:'Connecting…'};
    if(finalized)return {kind:'finalized',label:'County finalized'};
    if(live && reporting===0)return {kind:'waiting',label:'Awaiting returns'};
    if(live)return validating?{kind:'updating',label:'Updating…'}:{kind:'connected',label:'Connected · unofficial results'};
    return {kind:'archive',label:'Archived results'};
}
export function oldestCheck(stamps:(string|undefined)[]) {
    return stamps.length && stamps.every(Boolean) ? [...stamps as string[]].sort()[0] : undefined;
}
