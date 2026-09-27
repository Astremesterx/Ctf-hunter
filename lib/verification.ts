import {isSafeUrl, type CTFEvent, type Evidence} from './events';

const WEEK = 7 * 86400000;
export const feeLabels = {free:'Free',paid:'Paid',unknown:'Not announced'};
export const prizeLabels = {cash:'Cash prizes','non-cash':'Non-cash rewards',mixed:'Cash + rewards',none:'No prizes confirmed',unknown:'Not announced'};
const canonical = (field:string,value:string) => ['start','end'].includes(field) && value.includes('T') && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : value.trim().toLowerCase().replace(/\s+/g,' ');
export function validEvidence(e:Evidence,now=Date.now()) {
  const time=Date.parse(e.checkedAt);
  return isSafeUrl(e.url) && !!e.value.trim() && Number.isFinite(time) && time<=now;
}
export function matchingProof(e:CTFEvent,field:string,value:string,now=Date.now()) {
  return e.evidence.some(p=>p.kind==='official'&&p.field===field&&validEvidence(p,now)&&canonical(field,p.value)===canonical(field,value));
}
export function entryFee(e:CTFEvent) {
  if(e.entryFee&&e.entryFee!=='unknown'&&matchingProof(e,'entryFee',e.entryFee))return e.entryFee;
  // Legacy records only qualify as free with explicit source evidence.
  return e.cost==='Free'&&matchingProof(e,'cost','Free')?'free':'unknown';
}
export function prizeType(e:CTFEvent) {
  return e.prizeType&&e.prizeType!=='unknown'&&matchingProof(e,'prizeType',e.prizeType)?e.prizeType:'unknown';
}
export function matchesFee(e:CTFEvent,label:string){return label==='All'||feeLabels[entryFee(e)]===label;}
export function matchesPrize(e:CTFEvent,label:string){const kind=prizeType(e);return label==='All'||(label==='Cash prizes'?(kind==='cash'||kind==='mixed'):label==='Any announced prizes'?!!e.prizes&&kind!=='none':prizeLabels[kind]===label);}
export function verificationChecks(e:CTFEvent,now=Date.now()) {
  const fields=['title','start','mode',...(e.end?['end']:[])];
  const covered=fields.every(f=>matchingProof(e,f,String(e[f as keyof CTFEvent]),now));
  const fresh=fields.every(f=>e.evidence.some(p=>p.field===f&&p.kind==='official'&&validEvidence(p,now)&&canonical(f,p.value)===canonical(f,String(e[f as keyof CTFEvent]))&&now-Date.parse(p.checkedAt)<=WEEK));
  // Evidence values are normalized facts, not arbitrary quotations.
  const checkedFields=[...fields,'entryFee','prizeType'];
  const conflicts=checkedFields.filter(f=>new Set(e.evidence.filter(p=>p.field===f&&validEvidence(p,now)).map(p=>canonical(f,p.value))).size>1);
  return {covered,fresh,conflicts,validDates:e.evidence.every(p=>validEvidence(p,now)),checks:[
    {label:'Official evidence matches the name, schedule and mode',ok:covered},
    {label:'Core facts checked within the past seven days',ok:fresh},
    {label:'No conflicting core facts in recorded evidence',ok:conflicts.length===0},
    {label:'Evidence URLs and check timestamps are valid',ok:e.evidence.length>0&&e.evidence.every(p=>validEvidence(p,now))},
    {label:'Entry fee confirmed by an organizer source',ok:entryFee(e)!=='unknown'},
    {label:'Prize type confirmed by an organizer source',ok:prizeType(e)!=='unknown'},
  ]};
}
export function publicationIssues(e:CTFEvent,now=Date.now()) {
  const checks=verificationChecks(e,now),issues:string[]=[];
  if(!checks.validDates)issues.push('Evidence must have public HTTPS URLs and valid check timestamps that are not in the future.');
  if(e.verification!=='review'){
    if(!checks.covered)issues.push('Matching official evidence is required for the event name, schedule and participation mode.');
    if(!checks.fresh)issues.push('Recheck every core fact before publishing: evidence must be at most seven days old.');
    if(checks.conflicts.length)issues.push('Resolve conflicting evidence for '+checks.conflicts.join(', ')+'.');
  }
  for(const field of ['entryFee','prizeType'] as const)if(e[field]&&e[field]!=='unknown'&&!matchingProof(e,field,e[field]!,now))issues.push('Matching official evidence is required for '+field+'.');
  return issues;
}
