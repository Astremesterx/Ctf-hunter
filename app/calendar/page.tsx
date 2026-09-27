import {Catalog} from '@/components/catalog';
import {catalog} from '@/lib/store';
export const dynamic='force-dynamic';
export const metadata={title:'Event calendar'};
export default async function Page(){const data=await catalog();return <Catalog initialEvents={data.events} initialView="calendar" loadError={data.error}/>;}
