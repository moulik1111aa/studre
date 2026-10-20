// Brand marks. (The old staged loader with drawings is gone: the first launch now opens
// with the video in reel.ts, and later launches go straight in.)

import { plusSvg, plusFaceSvg } from './plus.ts';

/** The Study Hard mark: Plus, a chunky yellow plus sign with a face (see plus.ts). */
export const logoMark = (): string => plusSvg({ cls: 'logo-mark' });
/** Small brand mark, without the shadow. */
export const brandMark = (): string => plusFaceSvg({ cls: 'brand-mark' });
