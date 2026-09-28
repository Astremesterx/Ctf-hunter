import {Catalog} from '@/components/catalog';
import {seedEvents} from '@/lib/catalog-data';
export const dynamic='force-static';
export const metadata={title:'Event calendar'};
export default function Page(){return <Catalog initialEvents={seedEvents} initialView="calendar"/>;}
