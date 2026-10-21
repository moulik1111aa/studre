// Every fun fact Plus can share before a level (about 2,000 when all topics are in).
// Add a topic: create <topic>.ts exporting lines(...), then list it here.
import { SPACE } from './space.ts';
import { ANIMALS } from './animals.ts';
import { OCEAN } from './ocean.ts';
import { BODY } from './body.ts';
import { PLANTS } from './plants.ts';
import { EARTH } from './earth.ts';
import { DINOSAURS } from './dinosaurs.ts';

export const FACTS: string[] = [...new Set([...SPACE, ...ANIMALS, ...OCEAN, ...BODY, ...PLANTS, ...EARTH, ...DINOSAURS])];
