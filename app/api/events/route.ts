import {catalog} from '@/lib/store';
import {json} from '@/lib/api';
export async function GET(){const data=await catalog();return json(data);}
