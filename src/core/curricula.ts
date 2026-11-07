// School curricula: which of the app's skills each class / grade covers, so a parent can
// put a child on their school's path. Presets follow the usual order of topics in
// CBSE / NCERT and ICSE (India, Classes 1–10) and the US Common Core (K–8 and high school).
// They cover number work, operations, fractions, decimals, percentages, ratio and algebra,
// and geometry, measurement, time, money and data, plus mental-maths tricks where they help.
// A parent can add or remove any skill afterwards.

export type BoardId = 'cbse' | 'icse' | 'ccss';

export interface Grade {
  id: string;
  label: string;
  /** Usual age at the start of the year. */
  age: number;
  skills: string[];
}

export interface Board {
  id: BoardId;
  name: string;
  country: string;
  note: string;
  grades: Grade[];
}

// ── building blocks shared by the boards ─────────────────────────────────────
const COUNT_10 = ['s1.count5', 's1.count10', 's1.count10s', 's1.numeral5', 's1.numeral10', 's1.match10', 's1.zero', 's1.more', 's1.fewer', 's1.bigger10', 's1.order5', 's1.line10', 's1.onemore', 's1.oneless', 's1.tenframe', 's1.pattern'];
const ADD_SUB_10 = ['s1.add5', 's1.take5', 's1.make5', 's1.story5', 's2.add10', 's2.add0', 's2.counton', 's2.take10', 's2.sub012', 's2.subfrom10', 's2.make10'];
const NUM_100 = ['s2.count20', 's2.count50', 's2.count100', 's2.numeral20', 's2.numeral100', 's2.compare20', 's2.order3', 's2.beforeafter', 's2.teens', 's2.line20', 's2.skip10'];
const ADD_SUB_20 = ['s2.doubles5', 's2.neardoubles', 's2.add3nums', 's2.add20nb', 's2.add20b', 's2.add10to', 's2.missadd10', 's2.sub20nb', 's2.sub20b', 's2.sub10', 's2.difference', 's2.word20', 's2.equalnot', 's2.whichsign'];
const TWO_DIGIT = ['s3.tensones', 's3.expanded', 's2.compare100', 's3.a21nc', 's3.a2tens', 's3.a22nc', 's3.a21c', 's3.a22c', 's3.s21nb', 's3.s2tens', 's3.s22nb', 's3.s21b', 's3.s22b', 's3.howmanymore'];
const THREE_DIGIT = ['s3.pv3', 's3.compare3', 's3.order3d', 's3.ba1000', 's3.skip100', 's3.a31', 's3.a3tens', 's3.a3hund', 's3.a33nc', 's3.a33c', 's3.s31', 's3.s3hund', 's3.s33nb', 's3.s33b', 's3.miss100', 's3.make100', 's3.subfrom100'];
const TABLES_2_5_10 = ['s3.groups', 's3.arrays', 's3.x2', 's3.x5', 's3.x10', 's3.x2510', 's3.x10rules', 's3.share', 's3.d2', 's3.d5', 's3.d10'];
const TABLES_3_4 = ['s3.skip34', 's3.x3', 's3.x4', 's3.x2to5', 's3.d3', 's3.d4'];
const TABLES_6_10 = ['s4.x6', 's4.x7', 's4.x8', 's4.x9', 's4.xmix', 's4.d6', 's4.d7', 's4.d8', 's4.d9', 's4.dmix'];
const MULT_LONG = ['s4.m21nc', 's4.m21c', 's4.m10100', 's4.mtens', 's4.m31', 's4.m22', 's4.d21', 's4.d21r', 's4.d31', 's4.d10100', 's5.inverse'];
const FRAC_INTRO = ['s3.halfquarter', 's4.fshape', 's4.unitof', 's4.fracof'];
const FRAC_LIKE = ['s4.equiv', 's4.cmpfrac', 's4.addfrac', 's4.subfrac', 's4.mixed'];
const DEC_INTRO = ['s4.tenths', 's4.hundredths', 's4.decfrac', 's4.cmpdec', 's4.adddec', 's4.subdec'];
const FRAC_UNLIKE = ['s5.simplify', 's5.cmpunlike', 's5.addunlike', 's5.subunlike', 's5.addmixed', 's5.submixed'];
const FRAC_MULDIV = ['s5.fxwhole', 's5.fxf', 's5.wdivf', 's5.fdivf', 's5.fracqty'];
const DEC_OPS = ['s5.dec2as', 's5.decxw', 's5.decxd', 's5.decdivw', 's5.divbydec', 's5.rounddec', 's5.fracdec', 's4.dec10'];
const FACTORS = ['s4.multfac', 's4.divisible', 's5.factors', 's5.multiples', 's5.primes', 's5.primefac', 's5.hcf', 's5.lcm', 's6.hcflcmword', 's5.div46811'];
const INTEGERS_AS = ['s4.temp', 's5.numline', 's5.intadd', 's5.intsub'];
const INTEGERS_MD = ['s5.intmul', 's5.intdiv'];
const PERCENT = ['s5.pctfd', 's5.pcteasy', 's5.pctany', 's5.pcttotal', 's5.pctinc', 's6.profit', 's6.simpleint', 's5.fpword'];
const RATIO = ['s5.ratiosimp', 's5.ratioshare', 's5.unitary', 's5.recipe'];
const ALG_INTRO = ['s6.subst', 's6.liketerms', 's6.eq1', 's6.eq2'];
const ROOTS = ['s4.squares', 's5.sq20', 's6.sqrt', 's6.cubes', 's6.cbrt', 's6.estroot'];
const IDENTITIES = ['s6.expand1', 's7.sqplus', 's7.sqminus', 's7.dots', 's7.expand2', 's7.factcommon', 's7.diffsq'];
const EQUATIONS_8 = ['s6.eqboth', 's6.eqbrack', 's6.wordeq'];
const COMMERCE_8 = ['s6.pctchange', 's6.reversepct', 's6.discount', 's6.gst', 's6.compound', 's6.successive'];
const SURDS = ['s7.simpsurd', 's7.mulsurd', 's7.rationalise', 's7.fracind', 's7.recurring'];

// Early number, measuring, shape, time, money and data (NCERT "Joyful Mathematics" / Math-Magic order).
const EARLY = ['s1.count3', 's1.count5s', 's1.glance3', 's1.glance5', 's1.match5', 's1.sortcount', 's1.same', 's1.back5', 's1.back10'];
const COMPARE_MEASURE = ['s1.longer', 's1.tallbig', 's1.heavier', 's1.holds'];
const SHAPES_1 = ['s1.shapename', 's1.shapesaround'];
const MEASURE_1 = ['s2.mcubes', 's2.sides', 's2.solids', 's2.growpat', 's2.tally', 's2.days', 's2.oclock', 's2.picgraph', 's2.mix10'];
const MEASURE_2 = ['s2.months', 's2.ruler', 's2.longerby', 's2.fold', 's2.calendar', 's2.shop', 's2.makeamt', 's2.turns', 's2.routes'];
const MEASURE_3 = ['s3.clock5', 's3.units', 's3.readscale', 's3.addmeas', 's3.howlong', 's3.monthdays', 's3.misssub2', 's3.faces', 's3.perim', 's3.table', 's3.plus9_11', 's3.dblhalf100', 's3.mix3'];
const MEASURE_4 = ['s3.clockmin', 's3.areasq', 's3.rightang', 's3.barscale', 's4.hms', 's4.ymwd', 's4.rectpa', 's4.bills', 's4.mirror', 's4.clock24', 's4.timetable', 's4.picgraphkey', 's4.x11trick', 's4.x25', 's4.dblhalf', 's5.compens', 's5.missingop', 's4.speed4'];
const MEASURE_5 = ['s3.parallel', 's4.lshape', 's4.volcubes', 's4.angletype', 's4.protractor', 's4.quads', 's4.nets', 's4.mapscale', 's4.unitdec', 's4.likely', 's4.translate', 's4.coords'];
const GEO_6 = ['s3.roman', 's4.angline', 's4.linegraph', 's5.circle', 's5.samearea', 's5.matchstick', 's5.betterbuy', 's6.twostep6', 's5.x999', 's5.speed5'];
const GEO_7 = ['s5.triarea', 's5.triang', 's5.parangles', 's5.congruent', 's5.rotsym', 's5.mmr', 's6.kmhms', 's6.avgmissing', 's6.ratio3', 's6.circarea', 's6.pythag', 's6.pctshort', 's6.x11any', 's6.x525125', 's6.div525'];
const GEO_8 = ['s5.polyang', 's5.pie', 's5.prob', 's5.cuboidvol', 's6.surfarea', 's6.cylvol', 's6.quadfacts', 's6.approx', 's6.sq2130', 's6.digitsum', 's7.cbrt6', 's7.avgspeed', 's6.speed6'];
const GEO_9 = ['s5.coord4', 's6.lineq', 's6.heron', 's6.circang', 's6.freqmean', 's7.sq5', 's7.sq50', 's7.sq100', 's7.base100', 's7.x11three', 's7.cross', 's7.x9comp', 's7.div71113'];
const SPRINT_7 = ['s7.sqrt4', 's7.fastfrac', 's7.pctswap', 's7.estroot7', 's7.multistep', 's7.algsprint', 's7.missingop7', 's7.speed7', 's7.grand'];
const GEO_10 = ['s7.roots', 's7.zeros', 's7.distance', 's7.tangents', 's7.trig', 's7.special', 's7.heights', 's7.ap', 's7.simtri', 's6.similar', 's7.grouped', 's7.cards', 's6.twoevents', 's7.sector', 's7.solids'];

const uniq = (xs: string[]) => [...new Set(xs)];
const g = (id: string, label: string, age: number, ...lists: string[][]): Grade => ({ id, label, age, skills: uniq(lists.flat()) });

export const BOARDS: Board[] = [
  {
    id: 'cbse',
    name: 'CBSE / NCERT',
    country: 'India',
    note: 'Classes 1–10, following the NCERT books',
    grades: [
      g('1', 'Class 1', 6, COUNT_10, ADD_SUB_10, NUM_100, ['s2.add20nb', 's2.sub20nb', 's2.word20', 's2.coins20', 's1.pattern'], EARLY, COMPARE_MEASURE, SHAPES_1, MEASURE_1),
      g('2', 'Class 2', 7, ADD_SUB_20, ['s2.skip2', 's2.skip5', 's2.oddeven', 's2.ordinal', 's2.compare100', 's3.tensones', 's3.expanded', 's3.a21nc', 's3.a22nc', 's3.a21c', 's3.a22c', 's3.s21nb', 's3.s22nb', 's3.s21b', 's3.s22b', 's3.groups', 's3.x2', 's3.x5', 's3.x10', 's2.coins20', 's2.double20', 's2.halve20'], MEASURE_2),
      g('3', 'Class 3', 8, THREE_DIGIT, TABLES_2_5_10, TABLES_3_4, ['s3.round10', 's3.halfquarter', 's3.change100', 's3.word2step3', 's3.a3x2d'], MEASURE_3),
      g('4', 'Class 4', 9, TABLES_6_10, ['s4.x11', 's4.x12', 's4.d1112'], MULT_LONG, ['s4.a44', 's4.s44', 's4.round1000', 's4.estimate', 's4.cmpbig'], FRAC_INTRO, FRAC_LIKE, ['s4.paise', 's4.twostep', 's4.multfac'], MEASURE_4),
      g('5', 'Class 5', 10, ['s4.lakh', 's4.cmpbig', 's4.divisible'], DEC_INTRO, ['s4.dec10', 's4.equiv', 's4.mixed', 's5.simplify', 's5.addunlike', 's5.subunlike', 's5.factors', 's5.multiples', 's4.squares', 's5.pcteasy', 's5.average', 's4.bodmas0'], MEASURE_5),
      g('6', 'Class 6', 11, ['s4.lakh', 's4.cmpbig', 's4.estimate', 's5.estprod'], FACTORS, INTEGERS_AS, FRAC_UNLIKE, ['s5.dec2as', 's5.rounddec', 's5.fracdec'], RATIO, ['s6.subst', 's6.eq1', 's5.bodmas', 's5.brackets'], GEO_6),
      g('7', 'Class 7', 12, INTEGERS_MD, FRAC_MULDIV, ['s5.decxw', 's5.decxd', 's5.decdivw', 's5.divbydec'], ALG_INTRO, ['s6.pow2310', 's6.powmul', 's6.powdiv', 's6.powpow', 's6.stdform'], PERCENT, ['s5.average', 's6.rationals', 's6.negfrac'], GEO_7),
      g('8', 'Class 8', 13, ['s6.rationals', 's6.negfrac'], EQUATIONS_8, ROOTS, COMMERCE_8, IDENTITIES, ['s6.zeroneg', 's6.proportion', 's6.bodmaspow'], GEO_8),
      g('9', 'Class 9', 14, SURDS, ['s7.evalpoly', 's7.factquad', 's7.sqplus', 's7.sqminus', 's7.dots', 's7.diffsq', 's7.rearrange'], GEO_9),
      g('10', 'Class 10', 15, ['s5.primefac', 's5.hcf', 's5.lcm', 's6.hcflcmword', 's7.simul', 's7.factquad', 's7.solvequad', 's6.nth', 's7.evalpoly'], GEO_10, SPRINT_7),
    ],
  },
  {
    id: 'icse',
    name: 'ICSE',
    country: 'India',
    note: 'Classes 1–10, CISCE syllabus',
    grades: [
      g('1', 'Class 1', 6, COUNT_10, ADD_SUB_10, NUM_100, ['s2.add20nb', 's2.sub20nb', 's2.word20', 's2.ordinal', 's2.coins20'], EARLY, COMPARE_MEASURE, SHAPES_1, MEASURE_1),
      g('2', 'Class 2', 7, ADD_SUB_20, ['s2.skip2', 's2.skip5', 's2.oddeven', 's2.compare100', 's3.tensones', 's3.expanded', 's3.pv3', 's3.compare3'], TWO_DIGIT, ['s3.groups', 's3.arrays', 's3.x2', 's3.x3', 's3.x4', 's3.x5', 's3.x10', 's3.share', 's2.coins20'], MEASURE_2),
      g('3', 'Class 3', 8, THREE_DIGIT, TABLES_2_5_10, TABLES_3_4, ['s4.x6', 's4.x7', 's4.x8', 's4.x9', 's4.m21nc', 's4.m21c', 's4.d21', 's3.round10', 's3.halfquarter', 's4.fshape', 's3.change100', 's3.word2step3'], MEASURE_3),
      g('4', 'Class 4', 9, TABLES_6_10, ['s4.x11', 's4.x12', 's4.d1112'], MULT_LONG, ['s4.lakh', 's4.a44', 's4.s44', 's4.round1000', 's4.cmpbig', 's4.estimate'], FRAC_INTRO, FRAC_LIKE, ['s4.multfac', 's4.divisible', 's4.paise', 's4.bodmas0', 's4.twostep'], MEASURE_4),
      g('5', 'Class 5', 10, FRAC_UNLIKE, ['s5.fxwhole', 's5.fxf', 's5.wdivf'], DEC_INTRO, ['s4.dec10', 's5.dec2as', 's5.decxw', 's5.decdivw', 's5.factors', 's5.multiples', 's5.primes', 's5.primefac', 's5.hcf', 's5.lcm', 's5.pcteasy', 's5.pctfd', 's5.average', 's5.bodmas', 's5.unitary'], MEASURE_5),
      g('6', 'Class 6', 11, ['s5.fdivf', 's5.decxd', 's5.divbydec', 's5.rounddec', 's5.fracdec'], FACTORS, INTEGERS_AS, RATIO, ['s5.pctany', 's5.pcttotal', 's5.brackets', 's6.subst', 's6.liketerms', 's6.eq1', 's6.ineq', 's5.sq20'], GEO_6),
      g('7', 'Class 7', 12, INTEGERS_MD, ['s6.rationals', 's6.negfrac', 's5.fracqty'], PERCENT, ALG_INTRO, ['s6.pow2310', 's6.powmul', 's6.powdiv', 's6.powpow', 's6.zeroneg', 's6.ineq', 's6.proportion', 's6.sdt'], GEO_7),
      g('8', 'Class 8', 13, ROOTS, EQUATIONS_8, IDENTITIES, ['s6.compound', 's6.pctchange', 's6.discount', 's6.successive', 's6.stdform', 's6.bodmaspow', 's6.proportion', 's7.factquad'], GEO_8),
      g('9', 'Class 9', 14, SURDS, ['s7.logs', 's7.compoundn', 's7.deprec', 's7.pctchain', 's7.factquad', 's7.simul', 's7.rearrange', 's7.evalpoly', 's7.expand2', 's7.diffsq'], GEO_9),
      g('10', 'Class 10', 15, ['s6.gst', 's6.successive', 's7.pctchain', 's7.simul', 's7.solvequad', 's7.ratioadv', 's6.nth', 's7.evalpoly', 's7.factquad', 's7.rearrange'], GEO_10, SPRINT_7),
    ],
  },
  {
    id: 'ccss',
    name: 'Common Core',
    country: 'United States',
    note: 'Kindergarten to Grade 8, then high-school algebra',
    grades: [
      g('K', 'Kindergarten', 5, COUNT_10, ['s1.add3', 's1.add5', 's1.take3', 's1.take5', 's1.make5', 's1.story5', 's2.make10', 's2.count20', 's2.count100', 's2.numeral20', 's2.teens', 's2.skip10', 's2.add10', 's2.take10'], EARLY, COMPARE_MEASURE, SHAPES_1),
      g('1', 'Grade 1', 6, ADD_SUB_10, NUM_100, ADD_SUB_20, ['s2.compare100', 's3.tensones', 's3.a21nc', 's3.a2tens', 's3.a21c', 's3.s2tens', 's2.missadd20', 's2.misssub', 's2.factfamily'], MEASURE_1, ['s2.ruler', 's2.longerby', 's2.fold']),
      g('2', 'Grade 2', 7, ['s2.mix20', 's2.skip2', 's2.skip5', 's2.oddeven', 's2.coins20'], TWO_DIGIT, THREE_DIGIT, ['s3.a3x2d', 's3.arrays', 's3.groups', 's3.change100'], ['s2.months', 's2.calendar', 's2.shop', 's2.makeamt', 's2.turns', 's2.routes', 's2.tally', 's2.picgraph'], ['s3.clock5', 's3.units', 's3.readscale', 's3.addmeas', 's3.faces', 's3.plus9_11', 's3.dblhalf100', 's3.mix3']),
      g('3', 'Grade 3', 8, TABLES_2_5_10, TABLES_3_4, TABLES_6_10, ['s3.round10', 's4.round1000', 's4.mtens', 's4.fshape', 's4.unitof', 's4.equiv', 's4.cmpfrac', 's3.word2step3', 's4.twostep', 's5.inverse'], ['s3.clockmin', 's3.howlong', 's3.perim', 's3.areasq', 's3.barscale', 's3.table', 's3.misssub2', 's4.rectpa', 's4.lshape', 's4.picgraphkey', 's4.dblhalf', 's5.missingop', 's4.speed4']),
      g('4', 'Grade 4', 9, ['s4.lakh', 's4.cmpbig', 's4.a44', 's4.s44', 's4.m10100', 's4.m21nc', 's4.m21c', 's4.m31', 's4.m22', 's4.d21', 's4.d21r', 's4.d31', 's4.multfac', 's5.primes', 's5.factors', 's5.multiples'], FRAC_LIKE, ['s5.cmpunlike', 's5.fxwhole', 's4.fracof'], DEC_INTRO, ['s3.rightang', 's3.parallel', 's4.angletype', 's4.protractor', 's4.angline', 's4.quads', 's4.mirror', 's4.hms', 's4.ymwd', 's4.unitdec', 's4.linegraph', 's4.x11trick', 's4.x25', 's5.compens']),
      g('5', 'Grade 5', 10, FRAC_UNLIKE, ['s5.fxf', 's5.wdivf', 's5.fracqty'], DEC_OPS, ['s4.dec10', 's4.d10100', 's5.bodmas', 's5.brackets', 's6.pow2310'], ['s4.volcubes', 's4.coords', 's4.nets', 's5.cuboidvol', 's4.timetable', 's4.clock24', 's5.matchstick', 's5.x999', 's5.speed5']),
      g('6', 'Grade 6', 11, ['s5.fdivf', 's5.divbydec', 's5.hcf', 's5.lcm', 's6.hcflcmword'], RATIO, ['s5.pctfd', 's5.pcteasy', 's5.pctany', 's5.pcttotal', 's5.numline', 's4.temp'], ALG_INTRO.slice(0, 3), ['s6.ineq', 's6.pow2310', 's5.average'], ['s5.coord4', 's5.triarea', 's5.samearea', 's6.surfarea', 's5.betterbuy', 's5.mmr', 's6.avgmissing', 's6.kmhms', 's4.translate', 's4.mapscale', 's6.twostep6', 's6.x11any', 's6.x525125', 's6.div525']),
      g('7', 'Grade 7', 12, INTEGERS_AS.slice(2), INTEGERS_MD, ['s6.rationals', 's6.negfrac', 's6.eq2', 's6.expand1', 's6.liketerms', 's6.ineq', 's5.pctinc', 's6.pctchange', 's6.discount', 's6.simpleint', 's6.proportion', 's5.fpword'], ['s5.circle', 's6.circarea', 's5.triang', 's5.parangles', 's5.congruent', 's5.rotsym', 's5.prob', 's4.likely', 's6.twoevents', 's5.pie', 's6.ratio3', 's6.pctshort', 's6.approx', 's6.speed6']),
      g('8', 'Grade 8', 13, ['s6.powmul', 's6.powdiv', 's6.powpow', 's6.zeroneg', 's6.stdform', 's7.stdmul', 's6.sqrt', 's6.cbrt', 's6.cubes', 's6.estroot', 's7.recurring', 's6.eqboth', 's6.eqbrack', 's6.wordeq', 's7.simul', 's6.nth'], ['s5.polyang', 's6.pythag', 's6.lineq', 's6.similar', 's6.cylvol', 's6.quadfacts', 's6.freqmean', 's6.sq2130', 's6.digitsum', 's7.cbrt6', 's7.avgspeed']),
      g('HS', 'High school', 14, IDENTITIES, ['s7.factquad', 's7.solvequad', 's7.rearrange', 's7.evalpoly', 's7.simpsurd', 's7.mulsurd', 's7.rationalise', 's7.fracind', 's6.compound', 's7.compoundn', 's7.deprec', 's7.logs'], ['s7.roots', 's7.zeros', 's7.distance', 's7.tangents', 's7.trig', 's7.special', 's7.heights', 's7.ap', 's7.simtri', 's7.grouped', 's7.cards', 's7.sector', 's7.solids', 's6.heron', 's6.circang', 's7.sq5', 's7.sq50', 's7.sq100', 's7.base100', 's7.x11three', 's7.cross', 's7.x9comp', 's7.div71113'], SPRINT_7),
    ],
  },
];

export const boardById = (id: string): Board | undefined => BOARDS.find((b) => b.id === id);
export const gradeOf = (board: string, grade: string): Grade | undefined => boardById(board)?.grades.find((x) => x.id === grade);

/** The class / grade a child of this age is usually in. */
export function gradeForAge(board: Board, age: number): Grade {
  return [...board.grades].reverse().find((x) => x.age <= age) ?? board.grades[0];
}
