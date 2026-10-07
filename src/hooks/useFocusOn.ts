import { useEffect } from 'react';
import type { Detection } from '@/types';
import { useApp } from '@/store/AppStore';

/** Publishes the position of the selected detection to the header coordinate readout. */
export function useFocusOn(d: Detection | null | undefined) {
  const { setFocus } = useApp();
  useEffect(() => {
    if (d) setFocus({ latitude: d.latitude, longitude: d.longitude, depth: d.depth, label: d.id });
  }, [d, setFocus]);
}
