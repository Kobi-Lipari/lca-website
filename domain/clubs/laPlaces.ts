// domain/clubs/laPlaces.ts
//
// Made by scripts/data/build-la-places.ts and committed; not to be edited by
// hand. The place file of Suggest a club and Start a club (WS09 step 30):
// 540 ZIP code areas (Louisiana's and Picayune's) and 490 town names, each
// under its region, by the index of the region in REGIONS
// (domain/clubs/regions.ts). Read by the server alone
// (functions/utils/clubs/places.ts); no file under src/ imports it.
//
// Made from these public files of the Census Bureau, from www2.census.gov:
//   2024_Gaz_zcta_national.zip: 1,013,803 bytes, sha256 7b85c04a131672f58b38a950eb82855d5fd4054f0bd9bc3f69aa28897a714e3d
//   2024_Gaz_zcta_national.txt: 6,792,182 bytes, sha256 9c2630c5b2415a2e4e6b0a86acdd16612ee89e1091f51bc6003f80498c82c43b
//   2024_gaz_place_22.txt: 98,480 bytes, sha256 338c749f1fa71e3f930a3aea58acdc265ccfc6c1892221f7f544e539fda658af
//   tab20_zcta520_county20_natl.txt: 6,821,287 bytes, sha256 3ed41278d637dc249e0323306f68be8a6c234e3090f4de88ef328dee71aeaaaf
// The ZIP code areas are of 2020, as both of the Census Bureau's 2024 files
// draw them. A ZIP code no area holds (a post office box's, one of another
// state, a mistyped one) and a town not listed here are not found.
// No town's name is left out for lying in two regions.

/** Each region's ZIP code areas, in the order of REGIONS: five-digit codes joined by spaces. */
export const ZIPS_BY_REGION: ReadonlyArray<readonly string[]> = [
  // REGIONS[0]: 122
  [
    '39466 70001 70002 70003 70005 70006 70030 70031 70032 70036 70037 70038 70039 70040 70041 70043',
    '70047 70049 70050 70051 70053 70056 70057 70058 70062 70065 70067 70068 70070 70072 70075 70076',
    '70079 70080 70082 70083 70084 70085 70087 70091 70092 70094 70112 70113 70114 70115 70116 70117',
    '70118 70119 70121 70122 70123 70124 70125 70126 70127 70128 70129 70130 70131 70139 70148 70163',
    '70301 70310 70343 70344 70345 70352 70353 70354 70355 70356 70357 70358 70359 70360 70363 70364',
    '70373 70374 70375 70377 70394 70395 70397 70401 70402 70403 70420 70422 70426 70427 70431 70433',
    '70435 70436 70437 70438 70442 70443 70444 70445 70446 70447 70448 70450 70451 70452 70454 70455',
    '70456 70457 70458 70460 70461 70463 70464 70465 70466 70471',
  ],
  // REGIONS[1]: 93
  [
    '70052 70071 70086 70090 70339 70341 70346 70372 70390 70391 70393 70441 70449 70453 70462 70706',
    '70710 70711 70712 70714 70715 70719 70721 70722 70723 70725 70726 70729 70730 70732 70733 70734',
    '70736 70737 70739 70740 70743 70744 70747 70748 70749 70752 70753 70754 70755 70756 70757 70759',
    '70760 70761 70762 70763 70764 70767 70769 70770 70772 70773 70774 70775 70776 70777 70778 70780',
    '70782 70783 70785 70786 70787 70788 70789 70791 70801 70802 70803 70805 70806 70807 70808 70809',
    '70810 70811 70812 70813 70814 70815 70816 70817 70818 70819 70820 70825 70836',
  ],
  // REGIONS[2]: 104
  [
    '70340 70342 70380 70392 70501 70503 70506 70507 70508 70510 70512 70513 70514 70515 70516 70517',
    '70518 70519 70520 70522 70523 70524 70525 70526 70528 70529 70531 70533 70534 70535 70537 70538',
    '70541 70542 70543 70544 70548 70550 70551 70552 70554 70555 70556 70558 70559 70560 70563 70570',
    '70575 70576 70577 70578 70580 70582 70583 70584 70585 70586 70589 70592 70750 71301 71302 71303',
    '71320 71322 71323 71325 71327 71328 71330 71331 71333 71339 71341 71345 71346 71350 71351 71353',
    '71355 71356 71358 71359 71360 71362 71367 71369 71405 71407 71409 71417 71423 71424 71427 71430',
    '71432 71433 71447 71454 71466 71467 71472 71485',
  ],
  // REGIONS[3]: 53
  [
    '70532 70546 70549 70581 70591 70601 70605 70607 70609 70611 70615 70629 70630 70631 70632 70633',
    '70634 70637 70638 70639 70640 70643 70644 70645 70646 70647 70648 70650 70651 70652 70653 70654',
    '70655 70656 70657 70658 70659 70660 70661 70662 70663 70665 70668 70669 71403 71438 71439 71446',
    '71459 71461 71463 71474 71475',
  ],
  // REGIONS[4]: 168
  [
    '71001 71002 71003 71004 71006 71007 71008 71009 71016 71018 71019 71021 71023 71024 71027 71028',
    '71029 71030 71031 71032 71033 71034 71037 71038 71039 71040 71043 71044 71045 71046 71047 71048',
    '71049 71051 71052 71055 71060 71061 71063 71064 71065 71066 71067 71068 71069 71070 71071 71072',
    '71073 71075 71078 71079 71082 71101 71103 71104 71105 71106 71107 71108 71109 71110 71111 71112',
    '71115 71118 71119 71129 71201 71202 71203 71209 71212 71218 71219 71220 71222 71223 71225 71226',
    '71227 71229 71230 71232 71233 71234 71235 71237 71238 71241 71242 71243 71245 71247 71250 71251',
    '71253 71254 71256 71259 71260 71261 71263 71264 71266 71268 71269 71270 71272 71275 71276 71277',
    '71279 71280 71282 71286 71291 71292 71295 71316 71326 71334 71336 71340 71342 71343 71354 71357',
    '71366 71368 71371 71373 71375 71378 71401 71404 71406 71410 71411 71414 71415 71416 71418 71419',
    '71422 71425 71426 71428 71429 71434 71435 71441 71449 71450 71452 71455 71456 71457 71462 71465',
    '71468 71469 71473 71479 71480 71483 71486 71497',
  ],
]

/** Each region's town names, in the order of REGIONS, as placeKey writes them, joined by a bar. */
export const TOWNS_BY_REGION: ReadonlyArray<readonly string[]> = [
  // REGIONS[0]: 106
  [
    'abita springs|ama|amite city|angie|arabi|avondale|barataria|bayou blue|bayou cane',
    'bayou country club|bayou gauche|belle chasse|bogalusa|boothville|bourg|boutte|bridge city|buras',
    'chackbay|chalmette|chauvin|choctaw|covington|cut off|delacroix|des allemands|destrehan|dulac',
    'eden isle|edgard|elmwood|empire|estelle|folsom|franklinton|galliano|garyville|golden meadow',
    'grand isle|gray|gretna|hahnville|hammond|harahan|harvey|houma|independence|jean lafitte',
    'jefferson|kenner|kentwood|killona|kraemer|lacombe|lafitte|lafourche crossing|laplace|larose',
    'lewisburg|lockport|lockport heights|luling|madisonville|mandeville|marrero|mathews|meraux',
    'metairie|montegut|montz|natalbany|new orleans|new orleans station|new sarpy|norco|paradis',
    'pearl river|picayune|pointe a la hache|ponchatoula|port sulphur|poydras|presquille|raceland',
    'reserve|rio|river ridge|roseland|schriever|slidell|st rose|sun|taft|tangipahoa|terrytown',
    'thibodaux|tickfaw|timberlane|triumph|varnado|venice|violet|waggaman|wallace|westwego|woodmere',
  ],
  // REGIONS[1]: 77
  [
    'addis|albany|baker|baton rouge|bayou corne|bayou goula|belle rose|brownfields|brusly|central',
    'clinton|convent|crescent|darrow|denham springs|donaldsonville|dorseyville|erwinville|fordoche',
    'french settlement|gardere|gonzales|gramercy|grand point|greensburg|grosse tete|hester|inniswold',
    'jackson|killian|labadieville|lemannville|livingston|livonia|lutcher|maringouin|melville',
    'merrydale|monticello|montpelier|moonshine|morganza|napoleonville|new roads|north vacherie',
    'norwood|oak hills place|old jefferson|paincourtville|paulina|pierre part|plaquemine',
    'pleasure bend|port allen|port vincent|prairieville|romeville|rosedale|shenandoah|slaughter',
    'sorrento|south vacherie|springfield|st francisville|st gabriel|st james|supreme|union|ventress',
    'village st george|walker|watson|welcome|westminster|white castle|wilson|zachary',
  ],
  // REGIONS[2]: 104
  [
    'abbeville|alexandria|amelia|arnaudville|baldwin|ball|basile|bayou l\'ourse|bayou vista|berwick',
    'bordelonville|boyce|branch|breaux bridge|broussard|bunkie|cade|cankton|carencro|catahoula',
    'cecilia|center point|centerville|charenton|chataignier|cheneyville|church point|colfax',
    'cottonport|creola|crowley|delcambre|deville|dry prong|duson|echo|egan|erath|estherwood|eunice',
    'evergreen|fifth ward|forest hill|franklin|georgetown|glencoe|glenmora|grand coteau|gueydan',
    'henderson|hessmer|iota|jeanerette|jordan hill|kaplan|krotz springs|lafayette|lake arthur|lawtell',
    'lebeau|lecompte|leonville|loreauville|lydia|mamou|mansura|marksville|maurice|mcnary|mermentau',
    'midland|milton|montgomery|moreauville|morgan city|morrow|morse|new iberia|opelousas|ossun',
    'palmetto|parks|patterson|perry|pine prairie|pineville|plaucheville|pollock|port barre|prospect',
    'rayne|reddell|rock hill|scott|simmesport|siracusaville|sorrel|st martinville|sunset|turkey creek',
    'ville platte|washington|woodworth|youngsville',
  ],
  // REGIONS[3]: 40
  [
    'anacoco|cameron|carlyss|dequincy|deridder|elizabeth|elton|fenton|fort polk north|fort polk south',
    'gillis|hackberry|hayes|hornbeck|iowa|jennings|kinder|lacassine|lake charles|leesville|longville',
    'merryville|moss bluff|new llano|oakdale|oberlin|oretta|pitkin|prien|reeves|roanoke|rosepine',
    'simpson|singer|starks|sugartown|sulphur|vinton|welsh|westlake',
  ],
  // REGIONS[4]: 163
  [
    'arcadia|ashland|athens|atlanta|banks springs|baskin|bastrop|bawcomville|belcher|belmont|benton',
    'bernice|bienville|blanchard|bonita|bossier city|brownsville|bryceland|calhoun|calvin|campti',
    'castor|chatham|choudrant|claiborne|clarence|clarks|clayton|collinston|columbia|converse',
    'cotton valley|coushatta|cullen|delhi|delta|dixie inn|dodson|downsville|doyline|dubach|dubberly',
    'east hodge|eastwood|edgefield|epps|eros|farmerville|ferriday|fisher|florien|forest|fort jesup',
    'frierson|gibsland|gilbert|gilliam|gloster|goldonna|good pine|grambling|grand cane|grayson',
    'greenwood|hall summit|harrisonburg|haughton|haynesville|heflin|hodge|homer|hosston|ida|jamestown',
    'jena|jonesboro|jonesville|joyce|junction city|keachi|kilbourne|lake providence|lakeshore',
    'lakeview|lillie|lisbon|logansport|longstreet|lucky|mangham|mansfield|many|marion|marthaville',
    'martin|mer rouge|midway|minden|minorca|monroe|monterey|mooringsport|mound|mount lebanon|natchez',
    'natchitoches|newellton|noble|north hodge|oak grove|oak ridge|oil city|olla|pioneer|plain dealing',
    'pleasant hill|point place|powhatan|provencal|quitman|rayville|red chute|richmond|richwood',
    'ridgecrest|ringgold|robeline|rodessa|ruston|saline|sarepta|shongaloo|shreveport|sibley',
    'sicily island|sikes|simsboro|south mansfield|spearsville|spokane|springhill|st joseph|st maurice',
    'stanley|start|sterlington|stonewall|swartz|tallulah|trout|tullos|urania|vidalia|vienna',
    'vienna bend|vivian|wallace ridge|waterproof|west monroe|winnfield|winnsboro|wisner|zwolle',
  ],
]
