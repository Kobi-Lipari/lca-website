// domain/clubs/parishRegions.ts
//
// Which of the five regions each of Louisiana's 64 parishes is in, for Suggest
// a club and Start a club (WS09 step 30): the script that makes the place
// file (scripts/data/build-la-places.ts) gives each ZIP code area the region
// of the parish that holds the largest share of its area. It is a best guess
// for K to correct, written by these rules, taken in order:
//
//   1. a parish holding a town that migration 0072 places by name follows
//      that town (Baton Rouge and Gonzales to Baton Rouge / East Central,
//      Houma to New Orleans Metro);
//   2. a parish of an old region that 0072 moves whole follows it, where
//      there is no doubt the parish was in that old region: north of Lake
//      Pontchartrain to New Orleans Metro, the Lake Charles side to Lake
//      Charles / Southwestern, central Louisiana to Lafayette / South
//      Central, and north Louisiana staying where it is;
//   3. every other parish goes to the nearest seat's city, measured from the
//      centre of the parish to New Orleans, Baton Rouge, Lafayette and Lake
//      Charles, and to Shreveport or Monroe for North Louisiana.
//
// A parish's centre is the average of the centres of the ZIP code areas that
// lie in it, each weighed by the land it has in the parish, from the Census
// Bureau's files the script reads; the miles in the comments are straight
// lines from that centre, rounded. Each entry names its rule in its comment.
//
// Picayune's county in Mississippi is not a parish, and is kept apart: it goes
// with New Orleans Metro, as Picayune's club does (K's decision 14).
//
// Only the script and the tests read this file: no file under src/ imports it.
import { REGIONS, type Region } from './regions'

const [NEW_ORLEANS, BATON_ROUGE, LAFAYETTE, LAKE_CHARLES, NORTH] = REGIONS

/** One parish: its county code of five digits, its name and its region. */
export interface ParishRegion {
  fips: string
  name: string
  region: Region
}

/** Louisiana's 64 parishes in the order of their county codes, each with its region and, in its comment, the rule that gave it. */
export const PARISH_REGIONS: readonly ParishRegion[] = [
  { fips: '22001', name: 'Acadia', region: LAFAYETTE }, // 3: Lafayette 24 mi, Lake Charles 48
  { fips: '22003', name: 'Allen', region: LAKE_CHARLES }, // 3: Lake Charles 39 mi, Lafayette 57
  { fips: '22005', name: 'Ascension', region: BATON_ROUGE }, // 1: Gonzales
  { fips: '22007', name: 'Assumption', region: BATON_ROUGE }, // 3: Baton Rouge 38 mi, Lafayette 62, New Orleans 68
  { fips: '22009', name: 'Avoyelles', region: LAFAYETTE }, // 2: central Louisiana (Bunkie)
  { fips: '22011', name: 'Beauregard', region: LAKE_CHARLES }, // 2: the Lake Charles side (DeRidder)
  { fips: '22013', name: 'Bienville', region: NORTH }, // 3: Shreveport 44 mi, Monroe 58
  { fips: '22015', name: 'Bossier', region: NORTH }, // 2: north Louisiana stays (with Shreveport)
  { fips: '22017', name: 'Caddo', region: NORTH }, // 2: north Louisiana stays (Shreveport)
  { fips: '22019', name: 'Calcasieu', region: LAKE_CHARLES }, // 2: the Lake Charles side (Lake Charles, Sulphur)
  { fips: '22021', name: 'Caldwell', region: NORTH }, // 3: Monroe 30 mi
  { fips: '22023', name: 'Cameron', region: LAKE_CHARLES }, // 2: the Lake Charles side
  { fips: '22025', name: 'Catahoula', region: NORTH }, // 3: Monroe 59 mi, Baton Rouge 96, Lafayette 103
  { fips: '22027', name: 'Claiborne', region: NORTH }, // 3: Shreveport 53 mi, Monroe 57
  { fips: '22029', name: 'Concordia', region: NORTH }, // 3: Monroe 76 mi, Baton Rouge 78, Lafayette 90
  { fips: '22031', name: 'De Soto', region: NORTH }, // 3: Shreveport 29 mi
  { fips: '22033', name: 'East Baton Rouge', region: BATON_ROUGE }, // 1: Baton Rouge
  { fips: '22035', name: 'East Carroll', region: NORTH }, // 3: Monroe 51 mi
  { fips: '22037', name: 'East Feliciana', region: BATON_ROUGE }, // 3: Baton Rouge 28 mi
  { fips: '22039', name: 'Evangeline', region: LAFAYETTE }, // 3: Lafayette 42 mi, Lake Charles 59
  { fips: '22041', name: 'Franklin', region: NORTH }, // 3: Monroe 35 mi
  { fips: '22043', name: 'Grant', region: LAFAYETTE }, // 2: central Louisiana (with Pineville, across the Red River); Monroe 69 mi, Lafayette 102
  { fips: '22045', name: 'Iberia', region: LAFAYETTE }, // 3: Lafayette 22 mi
  { fips: '22047', name: 'Iberville', region: BATON_ROUGE }, // 3: Baton Rouge 17 mi
  { fips: '22049', name: 'Jackson', region: NORTH }, // 3: Monroe 32 mi
  { fips: '22051', name: 'Jefferson', region: NEW_ORLEANS }, // 2: New Orleans Metro stays
  { fips: '22053', name: 'Jefferson Davis', region: LAKE_CHARLES }, // 3: Lake Charles 24 mi, Lafayette 47
  { fips: '22055', name: 'Lafayette', region: LAFAYETTE }, // 3: Lafayette 2 mi
  { fips: '22057', name: 'Lafourche', region: NEW_ORLEANS }, // 3: New Orleans 45 mi, Baton Rouge 71
  { fips: '22059', name: 'LaSalle', region: NORTH }, // 3: Monroe 56 mi, Lafayette 104
  { fips: '22061', name: 'Lincoln', region: NORTH }, // 2: north Louisiana stays (Ruston)
  { fips: '22063', name: 'Livingston', region: BATON_ROUGE }, // 3: Baton Rouge 24 mi, New Orleans 55
  { fips: '22065', name: 'Madison', region: NORTH }, // 3: Monroe 48 mi
  { fips: '22067', name: 'Morehouse', region: NORTH }, // 3: Monroe 26 mi
  { fips: '22069', name: 'Natchitoches', region: NORTH }, // 3: Shreveport 65 mi, Monroe 81, Lake Charles 106
  { fips: '22071', name: 'Orleans', region: NEW_ORLEANS }, // 2: New Orleans Metro stays
  { fips: '22073', name: 'Ouachita', region: NORTH }, // 2: north Louisiana stays (Monroe)
  { fips: '22075', name: 'Plaquemines', region: NEW_ORLEANS }, // 3: New Orleans 45 mi
  { fips: '22077', name: 'Pointe Coupee', region: BATON_ROUGE }, // 3: Baton Rouge 31 mi, Lafayette 41
  { fips: '22079', name: 'Rapides', region: LAFAYETTE }, // 2: central Louisiana (Pineville)
  { fips: '22081', name: 'Red River', region: NORTH }, // 3: Shreveport 37 mi
  { fips: '22083', name: 'Richland', region: NORTH }, // 3: Monroe 20 mi
  { fips: '22085', name: 'Sabine', region: NORTH }, // 3: Shreveport 64 mi, Lake Charles 96
  { fips: '22087', name: 'St. Bernard', region: NEW_ORLEANS }, // 2: New Orleans Metro stays
  { fips: '22089', name: 'St. Charles', region: NEW_ORLEANS }, // 3: New Orleans 29 mi, Baton Rouge 59
  { fips: '22091', name: 'St. Helena', region: BATON_ROUGE }, // 3: Baton Rouge 37 mi, New Orleans 68
  { fips: '22093', name: 'St. James', region: BATON_ROUGE }, // 3: Baton Rouge 36 mi, New Orleans 51
  { fips: '22095', name: 'St. John the Baptist', region: NEW_ORLEANS }, // 3: New Orleans 37 mi, Baton Rouge 43
  { fips: '22097', name: 'St. Landry', region: LAFAYETTE }, // 3: Lafayette 27 mi (Opelousas, as K's decision 14 has it)
  { fips: '22099', name: 'St. Martin', region: LAFAYETTE }, // 3: Lafayette 16 mi
  { fips: '22101', name: 'St. Mary', region: LAFAYETTE }, // 3: Lafayette 44 mi, Baton Rouge 48 (Morgan City, as K's decision 14 has it)
  { fips: '22103', name: 'St. Tammany', region: NEW_ORLEANS }, // 2: north of Lake Pontchartrain (Mandeville, Slidell)
  { fips: '22105', name: 'Tangipahoa', region: NEW_ORLEANS }, // 2: north of Lake Pontchartrain, on its shore; Baton Rouge 44 mi, New Orleans 50
  { fips: '22107', name: 'Tensas', region: NORTH }, // 3: Monroe 55 mi
  { fips: '22109', name: 'Terrebonne', region: NEW_ORLEANS }, // 1: Houma
  { fips: '22111', name: 'Union', region: NORTH }, // 3: Monroe 28 mi
  { fips: '22113', name: 'Vermilion', region: LAFAYETTE }, // 3: Lafayette 30 mi
  { fips: '22115', name: 'Vernon', region: LAKE_CHARLES }, // 3: Lake Charles 62 mi, Lafayette 91, Shreveport 102
  { fips: '22117', name: 'Washington', region: NEW_ORLEANS }, // 2: north of Lake Pontchartrain; New Orleans 55 mi
  { fips: '22119', name: 'Webster', region: NORTH }, // 3: Shreveport 32 mi
  { fips: '22121', name: 'West Baton Rouge', region: BATON_ROUGE }, // 3: Baton Rouge 12 mi
  { fips: '22123', name: 'West Carroll', region: NORTH }, // 3: Monroe 41 mi
  { fips: '22125', name: 'West Feliciana', region: BATON_ROUGE }, // 3: Baton Rouge 34 mi
  { fips: '22127', name: 'Winn', region: NORTH }, // 3: Monroe 52 mi, Shreveport 78, Lafayette 124
]

/** Picayune's county in Mississippi, whose ZIP code area alone the place file holds of that state. */
export const PICAYUNE_COUNTY: ParishRegion = { fips: '28109', name: 'Pearl River County, Mississippi', region: NEW_ORLEANS }

/** Picayune's ZIP code area. */
export const PICAYUNE_ZIP = '39466'
