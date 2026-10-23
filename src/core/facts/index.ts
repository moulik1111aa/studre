// Every fun fact Plus can share before a level (about 2,000 when all topics are in).
// Add a topic: create <topic>.ts exporting lines(...), then list it here.
import { SPACE } from './space.ts';
import { ANIMALS } from './animals.ts';
import { OCEAN } from './ocean.ts';
import { BODY } from './body.ts';
import { PLANTS } from './plants.ts';
import { EARTH } from './earth.ts';
import { DINOSAURS } from './dinosaurs.ts';
import { SCIENCE } from './science.ts';
import { INVENTIONS } from './inventions.ts';
import { FOOD } from './food.ts';
import { WORLD } from './world.ts';
import { NUMBERS } from './numbers.ts';
import { HISTORY } from './history.ts';
import { CRITTERS } from './critters.ts';
import { SPORTS } from './sports.ts';

export const FACTS: string[] = [
  ...new Set([...SPACE, ...ANIMALS, ...OCEAN, ...BODY, ...PLANTS, ...EARTH, ...DINOSAURS, ...SCIENCE, ...INVENTIONS, ...FOOD, ...WORLD, ...NUMBERS, ...HISTORY, ...CRITTERS, ...SPORTS]),
];
