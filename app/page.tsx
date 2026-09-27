import { Catalog } from '@/components/catalog';
import { catalog } from '@/lib/store';
export const dynamic='force-dynamic';
export default async function Home() { const data=await catalog();return <Catalog initialEvents={data.events} loadError={data.error}/>; }
