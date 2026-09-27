'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
export type Profile = { user: { name:string; id:string } | null; saved:string[]; followed:string[]; reminders:string[]; notifications:{id:string;message:string;createdAt:string;read:number}[]; isAdmin:boolean };
const initial:Profile={user:null,saved:[],followed:[],reminders:[],notifications:[],isAdmin:false};
const Context=createContext({profile:initial,ready:false,refresh:async()=>{},act:async(_type:string,_id:string):Promise<boolean>=>false});
export function AppProvider({children}:{children:React.ReactNode}) {
 const [profile,setProfile]=useState<Profile>(initial),[ready,setReady]=useState(false);
 const refresh=useCallback(async()=>{try {const res=await fetch('/api/profile');if(res.ok)setProfile(await res.json());}catch{}finally{setReady(true);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function act(type:string,id:string) { if(!profile.user){toast('Sign in to save your radar across devices.',{action:{label:'Sign in',onClick:()=>{window.location.href='/signin-with-chatgpt?return_to='+encodeURIComponent(window.location.pathname);}}});return false;} try{const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id})});const data=await r.json() as Profile & {error?:string};if(!r.ok)throw new Error(data.error||'Could not save your change.');setProfile(data);return true;}catch(err){toast.error((err as Error).message);return false;} }
 return <Context.Provider value={{profile,ready,refresh,act}}>{children}</Context.Provider>;
}
export const useProfile=()=>useContext(Context);
