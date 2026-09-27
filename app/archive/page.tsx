import {Catalog} from '@/components/catalog';
import {catalog} from '@/lib/store';
export const dynamic='force-dynamic';
export const metadata={title:'Past CTF events'};
export default async function Page(){const data=await catalog();return <Catalog initialEvents={data.events} scope="archive" loadError={data.error}/>;}
