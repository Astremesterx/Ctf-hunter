import {env} from 'cloudflare:workers';
import {runDueSources} from '@/lib/ingestion';
import {deliverDueReminders} from '@/lib/store';
import {json,failure} from '@/lib/api';
export async function POST(req:Request){try{const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!env.JOB_TOKEN||!token)return json({error:'Unauthorized'},401);const digest=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));const [a,b]=await Promise.all([digest(token),digest(env.JOB_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)return json({error:'Unauthorized'},401);const sources=await runDueSources();await deliverDueReminders();return json({sources});}catch(e){return failure(e);}}
