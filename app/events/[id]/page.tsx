import {notFound} from 'next/navigation';
import {seedEvents} from '@/lib/catalog-data';
import {EventDetail} from '@/components/event-detail';

export const dynamic='force-static';
export function generateStaticParams(){return seedEvents.map(({id})=>({id}));}
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const e=seedEvents.find(e=>e.id===id);return e?{title:e.title,description:e.summary}:{title:'Event not found'};}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const e=seedEvents.find(e=>e.id===id);if(!e)notFound();const structured=e.verification!=='review'&&!e.demo?{'@context':'https://schema.org','@type':'Event',name:e.title,description:e.summary,startDate:e.start,...(e.end?{endDate:e.end}:{}),eventStatus:e.cancelled?'https://schema.org/EventCancelled':'https://schema.org/EventScheduled',eventAttendanceMode:e.mode==='Online'?'https://schema.org/OnlineEventAttendanceMode':e.mode==='Hybrid'?'https://schema.org/MixedEventAttendanceMode':'https://schema.org/OfflineEventAttendanceMode',location:e.mode==='Online'?{'@type':'VirtualLocation',url:e.officialUrl}:{'@type':'Place',name:e.venue,address:e.venue},organizer:{'@type':'Organization',name:e.organizer,url:e.officialUrl},url:e.officialUrl}:null;return <>{structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/>}<EventDetail event={e}/></>;}
