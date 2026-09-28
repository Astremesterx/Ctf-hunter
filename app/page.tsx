import { Catalog } from '@/components/catalog';
import { seedEvents } from '@/lib/catalog-data';
export const dynamic='force-static';
export default function Home() { return <Catalog initialEvents={seedEvents}/>; }
