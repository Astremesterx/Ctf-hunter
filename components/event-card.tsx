'use client';
import Link from '@/components/site-link';
import { Sun,Flag,Shield,Terminal,Ghost,Cpu,Globe,MapPin,CalendarDays,Clock3,Bookmark,ArrowUpRight,ShieldCheck,TriangleAlert,Radio,Layers } from 'lucide-react';
import type { CTFEvent } from '@/lib/events';
import { formatDate,phase,verificationLabel } from '@/lib/events';
import {useProfile} from './app-provider';
import { toast } from 'sonner';
import {entryFee,prizeType,feeLabels,prizeLabels} from '@/lib/verification';
const icons={sun:Sun,flag:Flag,shield:Shield,terminal:Terminal,ghost:Ghost,cpu:Cpu};
export function EventMark({event,large=false}:{event:CTFEvent;large?:boolean}){const Icon=icons[event.mark as keyof typeof icons]||Flag;return <span className={`event-mark ${event.accent} ${large?'large':''}`}><Icon size={large?36:26} strokeWidth={1.6}/></span>}
export function VerificationBadge({event}:{event:CTFEvent}){const label=verificationLabel(event);const good=label==='Official source checked'||label==='Sources corroborated';return <span className={`verification ${good?'checked':'review'}`} title={`Last checked ${formatDate(event.checkedAt,'UTC',{year:'numeric'})}`}>{good?<ShieldCheck size={13}/>:<TriangleAlert size={13}/>}<span>{label}</span></span>}
export function EventCard({event:e,zone}:{event:CTFEvent;zone:string}){const {profile,act}=useProfile();const saved=profile.saved.includes(e.id);const status=phase(e);const dzone=e.dateOnly?'UTC':zone;const hours=e.end&&!e.dateOnly?Math.round((Date.parse(e.end)-Date.parse(e.start))/3600000):null;
return <article data-accent={e.accent} className={`event-card ${e.cancelled?'cancelled':''}`}>
 <div className="card-top"><EventMark event={e}/><span className={`mode-tag ${e.mode==='Online'?'online':e.mode==='Hybrid'?'hybrid':'onsite'}`}>{e.mode==='Online'?<Globe size={12}/>:e.mode==='Hybrid'?<Layers size={12}/>:<MapPin size={12}/>} {e.mode}</span><button className={`save-button ${saved?'saved':''}`} aria-label={`${saved?'Unsave':'Save'} ${e.title}`} aria-pressed={saved} onClick={async()=>{if(await act('save',e.id))toast.success(saved?'Removed from your radar':'Added to your radar');}}><Bookmark size={19} fill={saved?'currentColor':'none'}/></button></div>
 {e.verification==='review'&&<div className="event-countdown tentative"><TriangleAlert size={12}/>Tentative schedule · under review</div>}<p className="organizer">{e.organizer}</p><h3><Link href={`/events/${e.id}`}>{e.title}<ArrowUpRight size={19}/></Link></h3>
 <div className="card-date"><CalendarDays size={15}/><strong>{formatDate(e.start,dzone)}{e.end&&formatDate(e.end,dzone)!==formatDate(e.start,dzone)?` – ${formatDate(e.end,dzone)}`:''}</strong><span>{e.dateOnly?'Time TBA':formatDate(e.start,zone,{hour:'2-digit',minute:'2-digit'}).split(', ').pop()}</span></div>
 <div className="card-facts"><span><Terminal size={14}/>{e.format==='Not announced'?'Format TBA':e.format}</span><span>{hours?<><Clock3 size={14}/>{hours>=72&&hours%24===0?`${hours/24} days`:`${hours}h`}</>:<><MapPin size={14}/>{e.country}</>}</span></div>
 <div className="reward-strip"><span className={entryFee(e)==='free'?'free':''}>{entryFee(e)==='unknown'?'Entry fee TBA':feeLabels[entryFee(e)]}</span><span>{prizeType(e)==='unknown'?(e.prizes?'Prizes · type unconfirmed':'Prizes TBA'):prizeLabels[prizeType(e)]}</span></div><p className="card-summary">{e.summary}</p><div className="card-tags">{e.categories.length?e.categories.slice(0,3).map(c=><span key={c}>{c}</span>):<span>{e.mode==='In person'?'On-site event':'See official details'}</span>}{e.categories.length>3&&<span>+{e.categories.length-3}</span>}</div>
 <div className="card-bottom"><VerificationBadge event={e}/><span className={`registration-state ${status==='Live now'?'live':''}`}>{status==='Upcoming'?e.registration:status==='Live now'?<><Radio size={12}/>Live now</>:status}</span></div>
 </article>}
