// The seven frame sizes. Source: Bike Insights' listing of the Specialized Tarmac SL7 frameset, model year 2022
// (the chart the original size-56 build used, GEOMETRY.md section 1). Millimetres and degrees, as published.
// Fork length (366 mm) and chainstay (410 mm) are the same in every size.
export const SOURCES = {
  geometry: { label: 'Bike Insights, Specialized Tarmac SL7 frameset (2022), all sizes', url: 'https://bikeinsights.com/bikes/5c670d973584300017e37aa3-specialized-bicycles-tarmac?build=sl7-frameset&version=2022' },
  height: { label: 'Bike Mart, Tarmac SL7 size chart ("sizing to be used as a reference only")', url: 'https://www.bikemart.com/collections/non-electric-adult-bikes/products/tarmac-sl7-sport-performance-road-bikes' },
  saddle: { label: 'LeMond method: saddle height = inseam × 0.883', url: null },
};

const ROWS = [
  //  size stack reach seatTube ett  headTube headAngle seatAngle bbDrop wheelbase frontCenter forkOffset trail standover   heightCm
  [44, 491, 369, 435, 496,  93, 70.5,  75.5, 74,  970, 572, 47.2, 69.3, 723, [142, 155]],
  [49, 504, 378, 447, 509, 102, 71.75, 75.5, 74,  973, 574, 47.4, 61.2, 735, [155, 163]],
  [52, 517, 383, 458, 531, 113, 72.5,  74,   74,  975, 577, 46.8, 57.2, 746, [163, 170]],
  [54, 534, 387, 475, 541, 131, 73,    74,   72,  978, 579, 44.1, 56.9, 768, [170, 175]],
  [56, 555, 398, 496, 563, 151, 73.5,  73.5, 72,  991, 592, 44.4, 53.5, 786, [175, 180]],
  [58, 581, 405, 517, 577, 178, 73.5,  73.5, 72, 1006, 606, 44.7, 53.2, 808, [180, 188]],
  [61, 602, 411, 547, 595, 198, 74,    73,   72, 1013, 613, 44.6, 50.2, 834, [188, 196]],
];

// The model's own constants for every size: 700c wheel on a 26 mm tyre, 366 mm fork, 410 mm chainstay.
const COMMON = { chainstay: 410, axleToCrown: 366, tyreWidth: 26, tyreOD: 674, bsd: 622 };

export const SIZES = ROWS.map(([size, stack, reach, seatTube, ett, headTube, headAngle, seatAngle, bbDrop, wheelbase, frontCenter, forkOffset, trail, standover, heightCm]) =>
  ({ size, stack, reach, seatTube, ett, headTube, headAngle, seatAngle, bbDrop, wheelbase, frontCenter, forkOffset, trail, standover, heightCm, ...COMMON }));
export const BY_SIZE = Object.fromEntries(SIZES.map(s => [s.size, s]));

// Saddle height (BB to saddle top, along the seat tube). Without a rider, every size carries the size 56's exposed
// post: 725 mm saddle height on its 496 mm seat tube, so seat tube + 229 mm. With an inseam, LeMond's 0.883.
export const EXPOSED_POST = 229;
export const saddleHeight = (chart, inseamCm = null) => (inseamCm ? Math.round(inseamCm * 10 * 0.883) : chart.seatTube + EXPOSED_POST);

/** Sizes whose reference height range contains h (cm). At a shared boundary both are returned: a fitting decides. */
export function sizesForHeight(h) {
  return SIZES.filter(s => h >= s.heightCm[0] && h <= s.heightCm[1]).map(s => s.size);
}
