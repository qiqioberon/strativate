'use client'
import {useEffect,useRef,useState} from 'react'
import {IntensiveMentoringEngagements} from './intensive-mentoring-engagements'
import {PrivateMentoringSessions} from './private-mentoring-sessions'
import type {IntensiveEngagementView} from '@/lib/intensive-mentoring/types'
import type {PrivateMentoringSessionFocusView,PrivateMentoringSessionView} from '@/lib/private-mentoring/types'

type Mode='private'|'intensive'

export function MentoringWorkspace({privateSessions,intensiveEngagements,sessionFocuses,focusSessionId,focusEnrollmentId,initialMode='private'}:{privateSessions:PrivateMentoringSessionView[];intensiveEngagements:IntensiveEngagementView[];sessionFocuses:PrivateMentoringSessionFocusView[];focusSessionId?:string|null;focusEnrollmentId?:string|null;initialMode?:Mode}){
 const[mode,setMode]=useState<Mode>(initialMode)
 const privateRef=useRef<HTMLButtonElement>(null),intensiveRef=useRef<HTMLButtonElement>(null)
 useEffect(()=>setMode(initialMode),[initialMode])
 const privateCount=new Set(privateSessions.map(item=>item.enrollmentId)).size
 function select(next:Mode,focus=false){setMode(next);if(focus)requestAnimationFrame(()=>{(next==='private'?privateRef:intensiveRef).current?.focus()})}
 function keydown(event:React.KeyboardEvent<HTMLButtonElement>,current:Mode){let next:Mode|null=null;if(event.key==='Home')next='private';else if(event.key==='End')next='intensive';else if(event.key==='ArrowLeft'||event.key==='ArrowRight')next=current==='private'?'intensive':'private';if(!next)return;event.preventDefault();select(next,true)}
 return <div className="mentoring-mode-panel">
  <div className="mentoring-mode-tabs" role="tablist" aria-label="Jenis mentoring">
   <button ref={privateRef} id="mentoring-private-tab" type="button" role="tab" aria-selected={mode==='private'} aria-controls="mentoring-private-panel" tabIndex={mode==='private'?0:-1} onKeyDown={event=>keydown(event,'private')} onClick={()=>select('private')}>Private Mentoring ({privateCount})</button>
   <button ref={intensiveRef} id="mentoring-intensive-tab" type="button" role="tab" aria-selected={mode==='intensive'} aria-controls="mentoring-intensive-panel" tabIndex={mode==='intensive'?0:-1} onKeyDown={event=>keydown(event,'intensive')} onClick={()=>select('intensive')}>Intensive Mentoring ({intensiveEngagements.length})</button>
  </div>
  {mode==='private'?<div id="mentoring-private-panel" role="tabpanel" aria-labelledby="mentoring-private-tab"><PrivateMentoringSessions sessions={privateSessions} sessionFocuses={sessionFocuses} focusSessionId={focusSessionId} focusEnrollmentId={focusEnrollmentId}/></div>:<div id="mentoring-intensive-panel" role="tabpanel" aria-labelledby="mentoring-intensive-tab"><IntensiveMentoringEngagements engagements={intensiveEngagements} sessionFocuses={sessionFocuses}/></div>}
 </div>
}
