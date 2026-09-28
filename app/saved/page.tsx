import {Catalog} from '@/components/catalog';
import {seedEvents} from '@/lib/catalog-data';
export const dynamic='force-static';
export const metadata={title:'My radar'};
export default function Page(){return <Catalog initialEvents={seedEvents} scope="saved"/>;}
