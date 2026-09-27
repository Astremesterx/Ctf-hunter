import type {ComponentProps} from 'react';

// Full document navigation avoids the beta runtime's broken production RSC
// prefetch/transition path and also works before JavaScript loads.
export default function SiteLink(props: ComponentProps<'a'>) {
  return <a {...props}/>;
}
