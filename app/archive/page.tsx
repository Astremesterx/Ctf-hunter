import {Catalog} from '@/components/catalog';
import {seedEvents} from '@/lib/catalog-data';
export const dynamic='force-static';
export const metadata={title:'Past CTF events'};
export default function Page(){return <Catalog initialEvents={seedEvents} scope="archive"/>;}
