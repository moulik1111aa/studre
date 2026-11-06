// Names of method families (a lesson's `family`), for the report's "Ways that work" card.
export const FAMILY_NAMES: Record<string, string> = {
  add: 'Adding',
  sub: 'Taking away',
  time: 'Telling the time',
  howlong: 'How long',
  units: 'Changing units',
  perim: 'Perimeter',
  area: 'Area',
  volume: 'Volume',
  angles: 'Angles',
  coords: 'Coordinates',
  mean: 'Averages',
  prob: 'Chance',
  money: 'Money',
  calendar: 'Calendar',
};
export const familyName = (f: string): string => FAMILY_NAMES[f] ?? f.charAt(0).toUpperCase() + f.slice(1);
