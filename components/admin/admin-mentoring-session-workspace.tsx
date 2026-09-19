'use client'
import {useEffect,useRef,useState} from 'react'
import {PrivateMentoringSessionManagement} from './private-mentoring-enrollment-management'
import {IntensiveMentoringSessionManagement} from './intensive-mentoring-session-management'

type Mode='private'|'intensive'
export function AdminMentoringSessionWorkspace({focusSessionId,focusEnrollmentId,focusEntity}:{focusSessionId?:string|null;focusEnrollmentId?:string|null;focusEntity?:string|null}){
 const desired:Mode=focusEntity?.startsWith('intensive_')?'intensive':'private'
 const[mode,setMode]=useState<Mode>(desired)
 const privateRef=useRef<HTMLButtonElement>(null),intensiveRef=useRef<HTMLButtonElement>(null)
 useEffect(()=>setMode(desired),[desired])
 function select(next:Mode,focus=false){setMode(next);if(focus)requestAnimationFrame(()=>{(next==='private'?privateRef:intensiveRef).current?.focus()})}
 function keydown(event:React.KeyboardEvent<HTMLButtonElement>,current:Mode){let next:Mode|null=null;if(event.key==='Home')next='private';else if(event.key==='End')next='intensive';else if(event.key==='ArrowLeft'||event.key==='ArrowRight')next=current==='private'?'intensive':'private';if(!next)return;event.preventDefault();select(next,true)}
 return <div className="mentoring-mode-panel">
  <div className="mentoring-mode-tabs" role="tablist" aria-label="Jenis mentoring">
   <button ref={privateRef} id="admin-mentoring-private-tab" type="button" role="tab" aria-selected={mode==='private'} aria-controls="admin-mentoring-private-panel" tabIndex={mode==='private'?0:-1} onKeyDown={event=>keydown(event,'private')} onClick={()=>select('private')}>Private Mentoring</button>
   <button ref={intensiveRef} id="admin-mentoring-intensive-tab" type="button" role="tab" aria-selected={mode==='intensive'} aria-controls="admin-mentoring-intensive-panel" tabIndex={mode==='intensive'?0:-1} onKeyDown={event=>keydown(event,'intensive')} onClick={()=>select('intensive')}>Intensive Mentoring</button>
  </div>
  <section id="admin-mentoring-private-panel" role="tabpanel" aria-labelledby="admin-mentoring-private-tab" hidden={mode!=='private'}>{mode==='private'?<PrivateMentoringSessionManagement focusSessionId={focusSessionId} focusEnrollmentId={focusEnrollmentId}/>:null}</section>
  <section id="admin-mentoring-intensive-panel" role="tabpanel" aria-labelledby="admin-mentoring-intensive-tab" hidden={mode!=='intensive'}>{mode==='intensive'?<IntensiveMentoringSessionManagement/>:null}</section>
 </div>
}
