'use client';
import {createContext,useCallback,useContext,useEffect,useState} from 'react';

export type Profile={user:{name:string;id:string}|null;saved:string[];followed:string[];reminders:string[];notifications:{id:string;message:string;createdAt:string;read:number}[];isAdmin:boolean};
const STORAGE_KEY='signalctf.profile.v1';
const initial:Profile={user:{name:'Local radar',id:'browser'},saved:[],followed:[],reminders:[],notifications:[],isAdmin:false};
type ContextValue={profile:Profile;ready:boolean;refresh:()=>Promise<void>;act:(type:string,id:string)=>Promise<boolean>};
const Context=createContext<ContextValue>({profile:initial,ready:false,refresh:async()=>{},act:async()=>false});

function readProfile():Profile{
 try{const saved=localStorage.getItem(STORAGE_KEY);return saved?{...initial,...JSON.parse(saved),user:initial.user,isAdmin:false}:initial;}catch{return initial;}
}
export function AppProvider({children}:{children:React.ReactNode}){
 const [profile,setProfile]=useState<Profile>(initial),[ready,setReady]=useState(false);
 const refresh=useCallback(async()=>{setProfile(readProfile());setReady(true);},[]);
 useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer);},[refresh]);
 async function act(type:string,id:string){
  setProfile(current=>{
   const next={...current};
   if(type==='save')next.saved=current.saved.includes(id)?current.saved.filter(v=>v!==id):[...current.saved,id];
   if(type==='follow')next.followed=current.followed.includes(id)?current.followed.filter(v=>v!==id):[...current.followed,id];
   if(type==='reminder')next.reminders=current.reminders.includes(id)?current.reminders.filter(v=>v!==id):[...current.reminders,id];
   if(type==='read-notifications')next.notifications=current.notifications.map(n=>({...n,read:1}));
   try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...next,user:undefined,isAdmin:undefined}));}catch{}
   return next;
  });
  return true;
 }
 return <Context.Provider value={{profile,ready,refresh,act}}>{children}</Context.Provider>;
}
export const useProfile=()=>useContext(Context);
