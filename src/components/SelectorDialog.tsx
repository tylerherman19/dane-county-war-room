'use client';
import { ReactNode, useEffect, useRef, useId } from 'react';
export default function SelectorDialog({open,onClose,title,children,wide=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;wide?:boolean}) {
    const ref=useRef<HTMLDialogElement>(null);
    const id=useId();
    useEffect(()=>{
        const dialog=ref.current;
        if(open && !dialog?.open) dialog?.showModal();
        if(!open && dialog?.open) dialog.close();
    },[open]);
    return <dialog ref={ref} className={`selector-dialog ${wide?'selector-wide':''}`} aria-labelledby={id} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
        <div className="selector-surface">
            <div className="selector-heading"><h2 id={id}>{title}</h2><button aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>Close ×</button></div>
            {open ? children : null}
        </div>
    </dialog>;
}
