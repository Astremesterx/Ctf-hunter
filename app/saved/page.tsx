import {Catalog} from '@/components/catalog';
import {catalog} from '@/lib/store';
export const dynamic='force-dynamic';
export const metadata={title:'My radar'};
export default async function Page(){const data=await catalog();return <Catalog initialEvents={data.events} scope="saved" loadError={data.error}/>;}
