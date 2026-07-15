import "dotenv/config";

import { db } from "../server/db";

import {
  masterProducts,
} from "../shared/backend/schema";

import {
  eq,
  isNull,
} from "drizzle-orm";





// ======================================================
// CONFIG
// ======================================================

const DRY_RUN = false;

// false = केवल खाली search_group भरना
// true = पहले से भरे हुए भी overwrite करना
const FORCE_UPDATE = false;

// रिपोर्ट में कितने unmatched products दिखाने हैं
const MAX_UNMATCHED_TO_PRINT = 100;





// ======================================================
// SEARCH GROUP RULES
// ======================================================

const RULES = [

{
  searchGroup: "tea",
  keywords: [
    "tea","chai","tata tea","red label","taj mahal",
    "wagh bakri","society","tetley","lipton","tea powder"
  ]
},

{
  searchGroup: "coffee",
  keywords: [
    "coffee","bru","nescafe","continental","levista",
    "instant coffee","filter coffee"
  ]
},

{
  searchGroup: "milk",
  keywords: [
    "milk","dairy milk","amul milk","mother dairy",
    "saras","milk packet","toned milk","full cream milk"
  ]
},

{
  searchGroup: "curd",
  keywords: [
    "curd","dahi","yogurt","yoghurt","amul curd",
    "mother dairy curd"
  ]
},

{
  searchGroup: "ghee",
  keywords: [
    "ghee","desi ghee","amul ghee","gowardhan",
    "patanjali ghee","mother dairy ghee"
  ]
},

{
  searchGroup: "butter",
  keywords: [
    "butter","amul butter","salted butter",
    "unsalted butter"
  ]
},

{
  searchGroup: "paneer",
  keywords: [
    "paneer","fresh paneer","amul paneer"
  ]
},

{
  searchGroup: "cheese",
  keywords: [
    "cheese","cheddar","mozzarella",
    "processed cheese","amul cheese"
  ]
},

{
  searchGroup: "rice",
  keywords: [
    "rice","basmati","chawal","india gate",
    "daawat","fortune rice","sona masoori"
  ]
},

{
  searchGroup: "atta",
  keywords: [
    "atta","chakki","wheat flour",
    "aashirvaad","ashirwad",
    "fortune atta"
  ]
},

{
  searchGroup: "maida",
  keywords: [
    "maida","refined flour"
  ]
},

{
  searchGroup: "besan",
  keywords: [
    "besan","gram flour"
  ]
},

{
  searchGroup: "suji",
  keywords: [
    "suji","sooji","rava","semolina"
  ]
},

{
  searchGroup: "poha",
  keywords: [
    "poha","flattened rice"
  ]
},

{
  searchGroup: "salt",
  keywords: [
    "salt","namak","tata salt",
    "sendha namak","rock salt"
  ]
},

{
  searchGroup: "sugar",
  keywords: [
    "sugar","chini","cheeni"
  ]
},

{
  searchGroup: "jaggery",
  keywords: [
    "jaggery","gur","gud"
  ]
},

{
  searchGroup: "oil",
  keywords: [
    "oil","refined oil","mustard oil",
    "sunflower oil","soyabean oil",
    "groundnut oil","fortune oil","dhara"
  ]
},

{
  searchGroup: "spices",
  keywords: [
    "masala","spice","turmeric","haldi",
    "red chilli","mirch","coriander",
    "dhania","jeera","cumin",
    "garam masala","everest","mdh","catch"
  ]
},

{
  searchGroup: "biscuits",
  keywords: [
    "biscuit","biscuits",
    "parle","parle g","good day",
    "oreo","bourbon","hide & seek",
    "marie","britannia"
  ]
},

{
  searchGroup: "chips",
  keywords: [
    "chips","lays","kurkure",
    "uncle chips","doritos"
  ]
},

{
  searchGroup: "namkeen",
  keywords: [
    "namkeen","bhujia","mixture",
    "sev","haldiram","bikaji"
  ]
},

{
  searchGroup: "noodles",
  keywords: [
    "noodles","maggi","yippee",
    "top ramen"
  ]
},

{
  searchGroup: "pasta",
  keywords: [
    "pasta","macaroni","penne",
    "fusilli"
  ]
},

{
  searchGroup: "ketchup",
  keywords: [
    "ketchup","tomato ketchup",
    "tomato sauce"
  ]
},

{
  searchGroup: "jam",
  keywords: [
    "jam","mixed fruit jam",
    "kissan jam"
  ]
},

{
  searchGroup: "honey",
  keywords: [
    "honey","dabur honey",
    "patanjali honey"
  ]
},
// ======= Tea & Coffee =======
  {
    group: "tea",
    keywords: [
      "tea", "chai", "green tea", "black tea", "leaf tea",
      "dust tea", "tea bag", "masala tea", "ginger tea"
    ],
  },
  {
    group: "coffee",
    keywords: [
      "coffee", "instant coffee", "filter coffee",
      "cold coffee", "espresso", "cappuccino"
    ],
  },

  // ======= Sugar & Salt =======
  {
    group: "sugar",
    keywords: [
      "sugar", "chini", "brown sugar", "organic sugar",
      "mishri", "boora"
    ],
  },
  {
    group: "salt",
    keywords: [
      "salt", "namak", "rock salt", "sendha namak",
      "iodized salt", "black salt"
    ],
  },

  // ======= Flour =======
  {
    group: "atta",
    keywords: [
      "atta", "wheat flour", "chakki atta",
      "multigrain atta"
    ],
  },
  {
    group: "maida",
    keywords: [
      "maida", "refined flour"
    ],
  },
  {
    group: "besan",
    keywords: [
      "besan", "gram flour"
    ],
  },
  {
    group: "sooji",
    keywords: [
      "sooji", "suji", "semolina", "rava"
    ],
  },

  // ======= Rice =======
  {
    group: "rice",
    keywords: [
      "rice", "basmati", "sella", "kolam",
      "sona masoori", "steam rice"
    ],
  },

  // ======= Pulses =======
  {
    group: "toor dal",
    keywords: [
      "toor dal", "arhar dal", "tur dal"
    ],
  },
  {
    group: "moong dal",
    keywords: [
      "moong dal", "green gram", "yellow moong"
    ],
  },
  {
    group: "urad dal",
    keywords: [
      "urad dal", "black gram"
    ],
  },
  {
    group: "masoor dal",
    keywords: [
      "masoor dal", "red lentil"
    ],
  },
  {
    group: "chana dal",
    keywords: [
      "chana dal", "split bengal gram"
    ],
  },

  // ======= Edible Oils =======
  {
    group: "mustard oil",
    keywords: [
      "mustard oil", "sarso oil", "sarson oil"
    ],
  },
  {
    group: "soyabean oil",
    keywords: [
      "soyabean oil", "soybean oil"
    ],
  },
  {
    group: "sunflower oil",
    keywords: [
      "sunflower oil"
    ],
  },
  {
    group: "groundnut oil",
    keywords: [
      "groundnut oil", "peanut oil"
    ],
  },
  {
    group: "olive oil",
    keywords: [
      "olive oil"
    ],
  },
  // =========================
  // BISCUITS
  // =========================

  {
    searchGroup: "biscuits",
    keywords: [
      "biscuit",
      "biscuits",
      "cookie",
      "cookies",
      "parle g",
      "good day",
      "marie",
      "bourbon",
      "oreo",
      "hide and seek",
      "hide & seek",
      "50-50",
      "monaco",
      "krackjack",
      "treat",
      "milk bikis"
    ]
  },

  // =========================
  // CHOCOLATE
  // =========================

  {
    searchGroup: "chocolate",
    keywords: [
      "chocolate",
      "dairy milk",
      "5 star",
      "kitkat",
      "munch",
      "perk",
      "snickers",
      "mars",
      "bournville",
      "fuse",
      "milkybar"
    ]
  },

  // =========================
  // NAMKEEN
  // =========================

  {
    searchGroup: "namkeen",
    keywords: [
      "namkeen",
      "bhujia",
      "sev",
      "mixture",
      "mix namkeen",
      "moong dal",
      "kachori",
      "mathri",
      "haldiram",
      "bikaji"
    ]
  },

  // =========================
  // CHIPS
  // =========================

  {
    searchGroup: "chips",
    keywords: [
      "chips",
      "lays",
      "kurkure",
      "doritos",
      "uncle chips",
      "bingo",
      "potato chips"
    ]
  },

  // =========================
  // NOODLES
  // =========================

  {
    searchGroup: "noodles",
    keywords: [
      "noodles",
      "maggi",
      "yippee",
      "top ramen",
      "cup noodles",
      "instant noodles"
    ]
  },

  // =========================
  // PASTA
  // =========================

  {
    searchGroup: "pasta",
    keywords: [
      "pasta",
      "macaroni",
      "penne",
      "fusilli",
      "spaghetti"
    ]
  },

  // =========================
  // SAUCE
  // =========================

  {
    searchGroup: "tomato sauce",
    keywords: [
      "tomato sauce",
      "ketchup",
      "tomato ketchup",
      "pizza sauce"
    ]
  },

  // =========================
  // JAM
  // =========================

  {
    searchGroup: "jam",
    keywords: [
      "jam",
      "mixed fruit jam",
      "strawberry jam",
      "pineapple jam",
      "kissan jam"
    ]
  },

  // =========================
  // HONEY
  // =========================

  {
    searchGroup: "honey",
    keywords: [
      "honey",
      "organic honey",
      "dabur honey",
      "patanjali honey"
    ]
  },

  // =========================
  // PICKLE
  // =========================

  {
    searchGroup: "pickle",
    keywords: [
      "pickle",
      "achar",
      "mango pickle",
      "lemon pickle",
      "mixed pickle"
    ]
  },

  // =========================
  // PAPAD
  // =========================

  {
    searchGroup: "papad",
    keywords: [
      "papad",
      "papadum",
      "urad papad",
      "moong papad"
    ]
  },

  // =========================
  // SPICES
  // =========================

  {
    searchGroup: "spices",
    keywords: [
      "masala",
      "haldi",
      "turmeric",
      "mirchi",
      "red chilli",
      "coriander",
      "dhania",
      "jeera",
      "cumin",
      "garam masala",
      "kitchen king",
      "chaat masala",
      "black pepper"
    ]
  },

  // =========================
  // DRY FRUITS
  // =========================

  {
    searchGroup: "dry fruits",
    keywords: [
      "almond",
      "badam",
      "cashew",
      "kaju",
      "raisin",
      "kishmish",
      "pista",
      "walnut",
      "akhrot",
      "dry fruits"
    ]
  },

  // =========================
  // SOFT DRINK
  // =========================

  {
    searchGroup: "soft drinks",
    keywords: [
      "coca cola",
      "coke",
      "pepsi",
      "sprite",
      "thumbs up",
      "fanta",
      "limca",
      "mountain dew",
      "soft drink"
    ]
  },

  // =========================
  // JUICE
  // =========================

  {
    searchGroup: "juice",
    keywords: [
      "juice",
      "real juice",
      "tropicana",
      "b natural",
      "mixed fruit juice",
      "orange juice",
      "mango juice"
    ]
  },
  // ==========================
// TOOTHPASTE
// ==========================

{
  searchGroup: "toothpaste",
  keywords: [
    "toothpaste",
    "paste",
    "colgate",
    "closeup",
    "pepsodent",
    "sensodyne",
    "dabur red",
    "meswak",
    "oral b toothpaste"
  ]
},

// ==========================
// TOOTHBRUSH
// ==========================

{
  searchGroup: "toothbrush",
  keywords: [
    "toothbrush",
    "tooth brush",
    "brush",
    "oral b",
    "colgate brush",
    "sensodyne brush"
  ]
},

// ==========================
// MOUTHWASH
// ==========================

{
  searchGroup: "mouthwash",
  keywords: [
    "mouthwash",
    "mouth wash",
    "listerine"
  ]
},

// ==========================
// SOAP
// ==========================

{
  searchGroup: "soap",
  keywords: [
    "soap",
    "bathing soap",
    "lux",
    "lifebuoy",
    "dove",
    "santoor",
    "medimix",
    "cinthol",
    "hamam",
    "dettol soap",
    "pears",
    "fiama"
  ]
},

// ==========================
// HANDWASH
// ==========================

{
  searchGroup: "handwash",
  keywords: [
    "handwash",
    "hand wash",
    "liquid handwash",
    "lifebuoy handwash",
    "dettol handwash",
    "savlon handwash"
  ]
},

// ==========================
// SHAMPOO
// ==========================

{
  searchGroup: "shampoo",
  keywords: [
    "shampoo",
    "clinic plus",
    "sunsilk",
    "head and shoulders",
    "head & shoulders",
    "pantene",
    "tresemme",
    "dove shampoo",
    "loreal shampoo"
  ]
},

// ==========================
// HAIR OIL
// ==========================

{
  searchGroup: "hair oil",
  keywords: [
    "hair oil",
    "parachute",
    "navratna",
    "indulekha",
    "almond oil",
    "coconut oil hair",
    "amla oil",
    "bajaj almond"
  ]
},

// ==========================
// HAIR CONDITIONER
// ==========================

{
  searchGroup: "conditioner",
  keywords: [
    "conditioner",
    "hair conditioner",
    "dove conditioner",
    "pantene conditioner",
    "tresemme conditioner"
  ]
},

// ==========================
// FACE WASH
// ==========================

{
  searchGroup: "face wash",
  keywords: [
    "face wash",
    "clean and clear",
    "clean & clear",
    "himalaya face wash",
    "ponds face wash",
    "garnier face wash"
  ]
},

// ==========================
// FACE CREAM
// ==========================

{
  searchGroup: "face cream",
  keywords: [
    "face cream",
    "ponds cream",
    "fair and lovely",
    "fair & lovely",
    "glow and lovely",
    "glow & lovely",
    "nivea cream",
    "boroplus",
    "vicco"
  ]
},

// ==========================
// TALCUM POWDER
// ==========================

{
  searchGroup: "talcum powder",
  keywords: [
    "powder",
    "talcum",
    "ponds powder",
    "nycil",
    "dermicool"
  ]
},

// ==========================
// DEODORANT
// ==========================

{
  searchGroup: "deodorant",
  keywords: [
    "deodorant",
    "deo",
    "body spray",
    "axe",
    "fogg",
    "engage",
    "wild stone",
    "nivea deo"
  ]
},

// ==========================
// PERFUME
// ==========================

{
  searchGroup: "perfume",
  keywords: [
    "perfume",
    "fragrance",
    "eau de parfum",
    "eau de toilette"
  ]
},

// ==========================
// SANITARY PAD
// ==========================

{
  searchGroup: "sanitary pad",
  keywords: [
    "sanitary pad",
    "pad",
    "whisper",
    "stayfree",
    "sofy"
  ]
},

// ==========================
// DIAPER
// ==========================

{
  searchGroup: "diaper",
  keywords: [
    "diaper",
    "diapers",
    "pampers",
    "mamy poko",
    "huggies"
  ]
},

// ==========================
// TISSUE
// ==========================

{
  searchGroup: "tissue",
  keywords: [
    "tissue",
    "facial tissue",
    "toilet tissue",
    "paper napkin",
    "napkin"
  ]
},
// ==========================
// DETERGENT POWDER
// ==========================

{
  searchGroup: "detergent powder",
  keywords: [
    "detergent",
    "washing powder",
    "surf excel",
    "surf",
    "rin",
    "wheel",
    "ghadi",
    "tide",
    "nirma"
  ]
},

// ==========================
// DETERGENT LIQUID
// ==========================

{
  searchGroup: "detergent liquid",
  keywords: [
    "liquid detergent",
    "washing liquid",
    "surf excel liquid",
    "ariel liquid",
    "tide liquid"
  ]
},

// ==========================
// FABRIC CONDITIONER
// ==========================

{
  searchGroup: "fabric conditioner",
  keywords: [
    "fabric conditioner",
    "comfort",
    "fabric softener"
  ]
},

// ==========================
// DISHWASH BAR
// ==========================

{
  searchGroup: "dishwash bar",
  keywords: [
    "dishwash bar",
    "dish bar",
    "vim bar",
    "exo bar"
  ]
},

// ==========================
// DISHWASH LIQUID
// ==========================

{
  searchGroup: "dishwash liquid",
  keywords: [
    "dishwash liquid",
    "dish washing liquid",
    "vim liquid",
    "pril",
    "exo liquid"
  ]
},

// ==========================
// TOILET CLEANER
// ==========================

{
  searchGroup: "toilet cleaner",
  keywords: [
    "toilet cleaner",
    "harpic",
    "toilet cleaning liquid"
  ]
},

// ==========================
// FLOOR CLEANER
// ==========================

{
  searchGroup: "floor cleaner",
  keywords: [
    "floor cleaner",
    "lizol",
    "floor cleaning liquid"
  ]
},

// ==========================
// PHENYL
// ==========================

{
  searchGroup: "phenyl",
  keywords: [
    "phenyl",
    "white phenyl",
    "black phenyl"
  ]
},

// ==========================
// GLASS CLEANER
// ==========================

{
  searchGroup: "glass cleaner",
  keywords: [
    "glass cleaner",
    "colin",
    "window cleaner"
  ]
},

// ==========================
// BLEACH
// ==========================

{
  searchGroup: "bleach",
  keywords: [
    "bleach",
    "bleaching powder",
    "bleach liquid"
  ]
},

// ==========================
// AIR FRESHENER
// ==========================

{
  searchGroup: "air freshener",
  keywords: [
    "air freshener",
    "odonil",
    "room freshener",
    "air spray"
  ]
},

// ==========================
// MOSQUITO REPELLENT
// ==========================

{
  searchGroup: "mosquito repellent",
  keywords: [
    "mosquito repellent",
    "good knight",
    "goodknight",
    "all out",
    "allout",
    "hit",
    "mosquito coil",
    "mosquito refill"
  ]
},

// ==========================
// GARBAGE BAG
// ==========================

{
  searchGroup: "garbage bag",
  keywords: [
    "garbage bag",
    "dustbin bag",
    "trash bag"
  ]
},

// ==========================
// ALUMINIUM FOIL
// ==========================

{
  searchGroup: "aluminium foil",
  keywords: [
    "aluminium foil",
    "aluminum foil",
    "foil paper"
  ]
},

// ==========================
// CLING FILM
// ==========================

{
  searchGroup: "cling film",
  keywords: [
    "cling film",
    "food wrap",
    "plastic wrap"
  ]
},

// ==========================
// TISSUE PAPER
// ==========================

{
  searchGroup: "tissue paper",
  keywords: [
    "tissue paper",
    "facial tissue",
    "kitchen tissue",
    "paper towel"
  ]
},

// ==========================
// TOILET PAPER
// ==========================

{
  searchGroup: "toilet paper",
  keywords: [
    "toilet paper",
    "toilet roll",
    "bathroom tissue"
  ]
},

// ==========================
// SCRUBBER
// ==========================

{
  searchGroup: "scrubber",
  keywords: [
    "scrubber",
    "steel scrubber",
    "dish scrubber",
    "scotch brite"
  ]
},

// ==========================
// MOP
// ==========================

{
  searchGroup: "mop",
  keywords: [
    "mop",
    "floor mop",
    "spin mop"
  ]
},

// ==========================
// BROOM
// ==========================

{
  searchGroup: "broom",
  keywords: [
    "broom",
    "jhadu",
    "plastic broom",
    "grass broom"
  ]
},
// ==========================
// MILK
// ==========================

{
  searchGroup: "milk",
  keywords: [
    "milk",
    "amul milk",
    "mother dairy milk",
    "saras milk",
    "verka milk",
    "nandini milk",
    "aavin milk"
  ]
},

// ==========================
// CURD
// ==========================

{
  searchGroup: "curd",
  keywords: [
    "curd",
    "dahi",
    "yogurt",
    "amul curd",
    "mother dairy curd"
  ]
},

// ==========================
// BUTTERMILK
// ==========================

{
  searchGroup: "buttermilk",
  keywords: [
    "buttermilk",
    "chaas",
    "masala chaas"
  ]
},

// ==========================
// LASSI
// ==========================

{
  searchGroup: "lassi",
  keywords: [
    "lassi",
    "sweet lassi",
    "salted lassi"
  ]
},

// ==========================
// PANEER
// ==========================

{
  searchGroup: "paneer",
  keywords: [
    "paneer",
    "cottage cheese",
    "amul paneer"
  ]
},

// ==========================
// CHEESE
// ==========================

{
  searchGroup: "cheese",
  keywords: [
    "cheese",
    "cheese slice",
    "cheese cube",
    "amul cheese",
    "britannia cheese"
  ]
},

// ==========================
// BUTTER
// ==========================

{
  searchGroup: "butter",
  keywords: [
    "butter",
    "amul butter",
    "salted butter",
    "unsalted butter"
  ]
},

// ==========================
// GHEE
// ==========================

{
  searchGroup: "ghee",
  keywords: [
    "ghee",
    "desi ghee",
    "amul ghee",
    "gowardhan ghee",
    "mother dairy ghee"
  ]
},

// ==========================
// CREAM
// ==========================

{
  searchGroup: "cream",
  keywords: [
    "cream",
    "fresh cream",
    "amul cream"
  ]
},

// ==========================
// EGGS
// ==========================

{
  searchGroup: "egg",
  keywords: [
    "egg",
    "eggs",
    "brown egg",
    "white egg"
  ]
},

// ==========================
// BREAD
// ==========================

{
  searchGroup: "bread",
  keywords: [
    "bread",
    "brown bread",
    "white bread",
    "milk bread",
    "britannia bread",
    "modern bread"
  ]
},

// ==========================
// BUN
// ==========================

{
  searchGroup: "bun",
  keywords: [
    "bun",
    "burger bun",
    "pav",
    "ladi pav"
  ]
},

// ==========================
// CAKE
// ==========================

{
  searchGroup: "cake",
  keywords: [
    "cake",
    "cup cake",
    "plum cake",
    "fruit cake"
  ]
},

// ==========================
// RUSK
// ==========================

{
  searchGroup: "rusk",
  keywords: [
    "rusk",
    "toast",
    "milk rusk",
    "britannia rusk"
  ]
},

// ==========================
// PIZZA BASE
// ==========================

{
  searchGroup: "pizza base",
  keywords: [
    "pizza base",
    "pizza bread"
  ]
},

// ==========================
// FROZEN PEAS
// ==========================

{
  searchGroup: "frozen peas",
  keywords: [
    "frozen peas",
    "green peas frozen"
  ]
},

// ==========================
// FROZEN VEG
// ==========================

{
  searchGroup: "frozen vegetables",
  keywords: [
    "frozen vegetables",
    "mixed vegetables frozen",
    "frozen veg"
  ]
},

// ==========================
// FROZEN FRENCH FRIES
// ==========================

{
  searchGroup: "french fries",
  keywords: [
    "french fries",
    "frozen fries"
  ]
},

// ==========================
// ICE CREAM
// ==========================

{
  searchGroup: "ice cream",
  keywords: [
    "ice cream",
    "amul ice cream",
    "kwality walls",
    "havmor",
    "vadilal",
    "mother dairy ice cream"
  ]
},
// ==========================
// SOFT DRINK
// ==========================

{
  searchGroup: "soft drink",
  keywords: [
    "soft drink",
    "cold drink",
    "coca cola",
    "coke",
    "pepsi",
    "sprite",
    "thumbs up",
    "thums up",
    "fanta",
    "7up",
    "mirinda",
    "mountain dew",
    "limca"
  ]
},

// ==========================
// JUICE
// ==========================

{
  searchGroup: "juice",
  keywords: [
    "juice",
    "real juice",
    "tropicana",
    "b natural",
    "paper boat juice",
    "mixed fruit juice",
    "orange juice",
    "apple juice",
    "mango juice"
  ]
},

// ==========================
// ENERGY DRINK
// ==========================

{
  searchGroup: "energy drink",
  keywords: [
    "energy drink",
    "red bull",
    "sting",
    "monster",
    "gatorade",
    "electral drink"
  ]
},

// ==========================
// WATER
// ==========================

{
  searchGroup: "water",
  keywords: [
    "water",
    "mineral water",
    "bisleri",
    "kinley",
    "aquafina",
    "bailley"
  ]
},

// ==========================
// BABY DIAPER
// ==========================

{
  searchGroup: "baby diaper",
  keywords: [
    "baby diaper",
    "diaper",
    "diapers",
    "pampers",
    "mamy poko",
    "huggies"
  ]
},

// ==========================
// BABY WIPES
// ==========================

{
  searchGroup: "baby wipes",
  keywords: [
    "baby wipes",
    "wet wipes",
    "himalaya wipes",
    "johnsons wipes"
  ]
},

// ==========================
// BABY SOAP
// ==========================

{
  searchGroup: "baby soap",
  keywords: [
    "baby soap",
    "johnsons baby soap",
    "himalaya baby soap"
  ]
},

// ==========================
// BABY SHAMPOO
// ==========================

{
  searchGroup: "baby shampoo",
  keywords: [
    "baby shampoo",
    "johnsons baby shampoo",
    "himalaya baby shampoo"
  ]
},

// ==========================
// BABY OIL
// ==========================

{
  searchGroup: "baby oil",
  keywords: [
    "baby oil",
    "johnsons baby oil",
    "himalaya baby oil"
  ]
},

// ==========================
// BABY POWDER
// ==========================

{
  searchGroup: "baby powder",
  keywords: [
    "baby powder",
    "johnsons baby powder"
  ]
},

// ==========================
// BABY FOOD
// ==========================

{
  searchGroup: "baby food",
  keywords: [
    "baby food",
    "cerelac",
    "farex",
    "nestum"
  ]
},

// ==========================
// DOG FOOD
// ==========================

{
  searchGroup: "dog food",
  keywords: [
    "dog food",
    "pedigree",
    "drools",
    "royal canin dog"
  ]
},

// ==========================
// CAT FOOD
// ==========================

{
  searchGroup: "cat food",
  keywords: [
    "cat food",
    "whiskas",
    "me o",
    "royal canin cat"
  ]
},

// ==========================
// NOTEBOOK
// ==========================

{
  searchGroup: "notebook",
  keywords: [
    "notebook",
    "copy",
    "classmate notebook",
    "long notebook"
  ]
},

// ==========================
// PEN
// ==========================

{
  searchGroup: "pen",
  keywords: [
    "pen",
    "ball pen",
    "gel pen",
    "trimax",
    "cello",
    "reynolds"
  ]
},

// ==========================
// PENCIL
// ==========================

{
  searchGroup: "pencil",
  keywords: [
    "pencil",
    "apsara",
    "nataraj pencil"
  ]
},

// ==========================
// ERASER
// ==========================

{
  searchGroup: "eraser",
  keywords: [
    "eraser",
    "rubber",
    "eraser rubber"
  ]
},

// ==========================
// SHARPENER
// ==========================

{
  searchGroup: "sharpener",
  keywords: [
    "sharpener",
    "pencil sharpener"
  ]
},

// ==========================
// TAPE
// ==========================

{
  searchGroup: "tape",
  keywords: [
    "tape",
    "cello tape",
    "packing tape"
  ]
},

// ==========================
// BATTERY
// ==========================

{
  searchGroup: "battery",
  keywords: [
    "battery",
    "aa battery",
    "aaa battery",
    "duracell",
    "eveready"
  ]
},

// ==========================
// MATCHBOX
// ==========================

{
  searchGroup: "matchbox",
  keywords: [
    "matchbox",
    "matches"
  ]
},

// ==========================
// CANDLE
// ==========================

{
  searchGroup: "candle",
  keywords: [
    "candle",
    "wax candle"
  ]
},

// ==========================
// GAS LIGHTER
// ==========================

{
  searchGroup: "gas lighter",
  keywords: [
    "gas lighter",
    "kitchen lighter"
  ]
},

// ==========================
// STEEL WOOL
// ==========================

{
  searchGroup: "steel wool",
  keywords: [
    "steel wool",
    "steel scrub",
    "steel scrubber"
  ]
},
// ==========================
// SMARTPHONE
// ==========================

{
  searchGroup: "smartphone",
  keywords: [
    "mobile",
    "smartphone",
    "phone",
    "android phone",
    "iphone",
    "samsung phone",
    "realme",
    "redmi",
    "mi phone",
    "vivo",
    "oppo",
    "oneplus",
    "motorola",
    "nothing phone",
    "iqoo",
    "tecno",
    "infinix",
    "lava"
  ]
},

// ==========================
// FEATURE PHONE
// ==========================

{
  searchGroup: "feature phone",
  keywords: [
    "feature phone",
    "keypad phone",
    "nokia phone",
    "itel phone"
  ]
},

// ==========================
// TABLET
// ==========================

{
  searchGroup: "tablet",
  keywords: [
    "tablet",
    "ipad",
    "galaxy tab",
    "lenovo tab",
    "xiaomi pad"
  ]
},

// ==========================
// SMART WATCH
// ==========================

{
  searchGroup: "smartwatch",
  keywords: [
    "smartwatch",
    "smart watch",
    "watch",
    "noise watch",
    "boat watch",
    "fire boltt",
    "fire-boltt",
    "amazfit",
    "fastrack smartwatch"
  ]
},

// ==========================
// FITNESS BAND
// ==========================

{
  searchGroup: "fitness band",
  keywords: [
    "fitness band",
    "smart band",
    "mi band",
    "honor band"
  ]
},

// ==========================
// POWER BANK
// ==========================

{
  searchGroup: "power bank",
  keywords: [
    "power bank",
    "powerbank",
    "mi power bank",
    "ambrane power bank"
  ]
},

// ==========================
// CHARGER
// ==========================

{
  searchGroup: "charger",
  keywords: [
    "charger",
    "mobile charger",
    "fast charger",
    "usb charger",
    "pd charger",
    "adapter"
  ]
},

// ==========================
// USB CABLE
// ==========================

{
  searchGroup: "usb cable",
  keywords: [
    "usb cable",
    "charging cable",
    "type c cable",
    "usb c cable",
    "micro usb cable",
    "lightning cable"
  ]
},

// ==========================
// EARPHONE
// ==========================

{
  searchGroup: "earphone",
  keywords: [
    "earphone",
    "earphones",
    "wired earphone",
    "handsfree",
    "headset"
  ]
},

// ==========================
// TWS EARBUDS
// ==========================

{
  searchGroup: "tws earbuds",
  keywords: [
    "earbuds",
    "tws",
    "wireless earbuds",
    "boat airdopes",
    "realme buds",
    "oneplus buds",
    "noise buds"
  ]
},

// ==========================
// HEADPHONE
// ==========================

{
  searchGroup: "headphone",
  keywords: [
    "headphone",
    "wireless headphone",
    "bluetooth headphone",
    "over ear headphone"
  ]
},

// ==========================
// BLUETOOTH SPEAKER
// ==========================

{
  searchGroup: "bluetooth speaker",
  keywords: [
    "speaker",
    "bluetooth speaker",
    "portable speaker",
    "jbl speaker",
    "boat speaker",
    "sony speaker"
  ]
},

// ==========================
// MEMORY CARD
// ==========================

{
  searchGroup: "memory card",
  keywords: [
    "memory card",
    "sd card",
    "micro sd",
    "sandisk",
    "kingston"
  ]
},

// ==========================
// PEN DRIVE
// ==========================

{
  searchGroup: "pen drive",
  keywords: [
    "pen drive",
    "pendrive",
    "usb drive",
    "flash drive"
  ]
},

// ==========================
// HARD DISK
// ==========================

{
  searchGroup: "hard disk",
  keywords: [
    "hard disk",
    "external hard disk",
    "external hdd",
    "ssd",
    "portable ssd"
  ]
},

// ==========================
// MOBILE COVER
// ==========================

{
  searchGroup: "mobile cover",
  keywords: [
    "mobile cover",
    "phone cover",
    "back cover",
    "case",
    "phone case"
  ]
},

// ==========================
// SCREEN GUARD
// ==========================

{
  searchGroup: "screen guard",
  keywords: [
    "screen guard",
    "tempered glass",
    "screen protector"
  ]
},

// ==========================
// LAPTOP
// ==========================

{
  searchGroup: "laptop",
  keywords: [
    "laptop",
    "notebook pc",
    "hp laptop",
    "dell laptop",
    "lenovo laptop",
    "asus laptop",
    "acer laptop"
  ]
},

// ==========================
// KEYBOARD
// ==========================

{
  searchGroup: "keyboard",
  keywords: [
    "keyboard",
    "wireless keyboard",
    "mechanical keyboard"
  ]
},

// ==========================
// MOUSE
// ==========================

{
  searchGroup: "mouse",
  keywords: [
    "mouse",
    "wireless mouse",
    "gaming mouse",
    "optical mouse"
  ]
},
// ==========================
// APPLE
// ==========================

{
  searchGroup: "apple",
  keywords: [
    "apple",
    "shimla apple",
    "red apple",
    "green apple",
    "kashmir apple"
  ]
},

// ==========================
// BANANA
// ==========================

{
  searchGroup: "banana",
  keywords: [
    "banana",
    "kela",
    "yelakki banana",
    "robusta banana"
  ]
},

// ==========================
// MANGO
// ==========================

{
  searchGroup: "mango",
  keywords: [
    "mango",
    "aam",
    "alphonso",
    "kesar mango",
    "dasheri",
    "langra",
    "chausa",
    "badami mango"
  ]
},

// ==========================
// ORANGE
// ==========================

{
  searchGroup: "orange",
  keywords: [
    "orange",
    "santra",
    "nagpur orange",
    "mandarin"
  ]
},

// ==========================
// GRAPES
// ==========================

{
  searchGroup: "grapes",
  keywords: [
    "grapes",
    "angoor",
    "green grapes",
    "black grapes"
  ]
},

// ==========================
// POMEGRANATE
// ==========================

{
  searchGroup: "pomegranate",
  keywords: [
    "pomegranate",
    "anar"
  ]
},

// ==========================
// PAPAYA
// ==========================

{
  searchGroup: "papaya",
  keywords: [
    "papaya",
    "papita"
  ]
},

// ==========================
// GUAVA
// ==========================

{
  searchGroup: "guava",
  keywords: [
    "guava",
    "amrud"
  ]
},

// ==========================
// WATERMELON
// ==========================

{
  searchGroup: "watermelon",
  keywords: [
    "watermelon",
    "tarbooj"
  ]
},

// ==========================
// MUSKMELON
// ==========================

{
  searchGroup: "muskmelon",
  keywords: [
    "muskmelon",
    "kharbooja"
  ]
},

// ==========================
// LEMON
// ==========================

{
  searchGroup: "lemon",
  keywords: [
    "lemon",
    "nimbu",
    "lime"
  ]
},

// ==========================
// COCONUT
// ==========================

{
  searchGroup: "coconut",
  keywords: [
    "coconut",
    "nariyal",
    "dry coconut"
  ]
},

// ==========================
// ONION
// ==========================

{
  searchGroup: "onion",
  keywords: [
    "onion",
    "pyaz",
    "red onion",
    "white onion"
  ]
},

// ==========================
// POTATO
// ==========================

{
  searchGroup: "potato",
  keywords: [
    "potato",
    "aloo"
  ]
},

// ==========================
// TOMATO
// ==========================

{
  searchGroup: "tomato",
  keywords: [
    "tomato",
    "tamatar"
  ]
},

// ==========================
// GARLIC
// ==========================

{
  searchGroup: "garlic",
  keywords: [
    "garlic",
    "lahsun"
  ]
},

// ==========================
// GINGER
// ==========================

{
  searchGroup: "ginger",
  keywords: [
    "ginger",
    "adrak"
  ]
},

// ==========================
// GREEN CHILLI
// ==========================

{
  searchGroup: "green chilli",
  keywords: [
    "green chilli",
    "hari mirch"
  ]
},

// ==========================
// CORIANDER
// ==========================

{
  searchGroup: "coriander",
  keywords: [
    "coriander",
    "dhaniya",
    "coriander leaves"
  ]
},

// ==========================
// MINT
// ==========================

{
  searchGroup: "mint",
  keywords: [
    "mint",
    "pudina"
  ]
},

// ==========================
// CAULIFLOWER
// ==========================

{
  searchGroup: "cauliflower",
  keywords: [
    "cauliflower",
    "gobhi",
    "phool gobhi"
  ]
},

// ==========================
// CABBAGE
// ==========================

{
  searchGroup: "cabbage",
  keywords: [
    "cabbage",
    "patta gobhi"
  ]
},

// ==========================
// BRINJAL
// ==========================

{
  searchGroup: "brinjal",
  keywords: [
    "brinjal",
    "baingan",
    "eggplant"
  ]
},

// ==========================
// OKRA
// ==========================

{
  searchGroup: "okra",
  keywords: [
    "okra",
    "bhindi",
    "lady finger"
  ]
},

// ==========================
// CAPSICUM
// ==========================

{
  searchGroup: "capsicum",
  keywords: [
    "capsicum",
    "shimla mirch",
    "green capsicum",
    "red capsicum",
    "yellow capsicum"
  ]
},

// ==========================
// CUCUMBER
// ==========================

{
  searchGroup: "cucumber",
  keywords: [
    "cucumber",
    "kheera"
  ]
},

// ==========================
// CARROT
// ==========================

{
  searchGroup: "carrot",
  keywords: [
    "carrot",
    "gajar"
  ]
},

// ==========================
// RADISH
// ==========================

{
  searchGroup: "radish",
  keywords: [
    "radish",
    "mooli"
  ]
},

// ==========================
// BEETROOT
// ==========================

{
  searchGroup: "beetroot",
  keywords: [
    "beetroot",
    "chukandar"
  ]
},
// ==========================
// MILK
// ==========================

{
  searchGroup: "milk",
  keywords: [
    "milk",
    "doodh",
    "cow milk",
    "buffalo milk",
    "toned milk",
    "double toned milk",
    "full cream milk",
    "skimmed milk"
  ]
},

// ==========================
// CURD
// ==========================

{
  searchGroup: "curd",
  keywords: [
    "curd",
    "dahi",
    "yogurt",
    "yoghurt"
  ]
},

// ==========================
// PANEER
// ==========================

{
  searchGroup: "paneer",
  keywords: [
    "paneer",
    "cottage cheese"
  ]
},

// ==========================
// CHEESE
// ==========================

{
  searchGroup: "cheese",
  keywords: [
    "cheese",
    "cheese slice",
    "cheese cubes",
    "cheddar",
    "mozzarella",
    "processed cheese"
  ]
},

// ==========================
// BUTTER
// ==========================

{
  searchGroup: "butter",
  keywords: [
    "butter",
    "salted butter",
    "unsalted butter"
  ]
},

// ==========================
// GHEE
// ==========================

{
  searchGroup: "ghee",
  keywords: [
    "ghee",
    "desi ghee",
    "clarified butter"
  ]
},

// ==========================
// CREAM
// ==========================

{
  searchGroup: "cream",
  keywords: [
    "cream",
    "fresh cream",
    "whipping cream"
  ]
},

// ==========================
// BUTTERMILK
// ==========================

{
  searchGroup: "buttermilk",
  keywords: [
    "buttermilk",
    "chaas",
    "masala chaas"
  ]
},

// ==========================
// LASSI
// ==========================

{
  searchGroup: "lassi",
  keywords: [
    "lassi",
    "sweet lassi",
    "salted lassi"
  ]
},

// ==========================
// FLAVOURED MILK
// ==========================

{
  searchGroup: "flavoured milk",
  keywords: [
    "flavoured milk",
    "flavored milk",
    "chocolate milk",
    "badam milk"
  ]
},

// ==========================
// BREAD
// ==========================

{
  searchGroup: "bread",
  keywords: [
    "bread",
    "white bread",
    "brown bread",
    "whole wheat bread",
    "sandwich bread"
  ]
},

// ==========================
// BUN
// ==========================

{
  searchGroup: "bun",
  keywords: [
    "bun",
    "burger bun",
    "cream bun"
  ]
},

// ==========================
// PAV
// ==========================

{
  searchGroup: "pav",
  keywords: [
    "pav",
    "ladi pav",
    "bread pav"
  ]
},

// ==========================
// RUSK
// ==========================

{
  searchGroup: "rusk",
  keywords: [
    "rusk",
    "toast",
    "milk rusk"
  ]
},

// ==========================
// CAKE
// ==========================

{
  searchGroup: "cake",
  keywords: [
    "cake",
    "cup cake",
    "fruit cake",
    "plum cake",
    "sponge cake"
  ]
},

// ==========================
// MUFFIN
// ==========================

{
  searchGroup: "muffin",
  keywords: [
    "muffin",
    "cup muffin"
  ]
},

// ==========================
// CROISSANT
// ==========================

{
  searchGroup: "croissant",
  keywords: [
    "croissant"
  ]
},

// ==========================
// DONUT
// ==========================

{
  searchGroup: "donut",
  keywords: [
    "donut",
    "doughnut"
  ]
},

// ==========================
// PIZZA BASE
// ==========================

{
  searchGroup: "pizza base",
  keywords: [
    "pizza base",
    "pizza bread"
  ]
},

// ==========================
// GARLIC BREAD
// ==========================

{
  searchGroup: "garlic bread",
  keywords: [
    "garlic bread"
  ]
},

// ==========================
// EGGS
// ==========================

{
  searchGroup: "egg",
  keywords: [
    "egg",
    "eggs",
    "white egg",
    "brown egg"
  ]
},
// ==========================
// LADDU
// ==========================

{
  searchGroup: "laddu",
  keywords: [
    "laddu",
    "ladoo",
    "besan laddu",
    "boondi laddu",
    "motichoor laddu",
    "atta laddu",
    "coconut laddu",
    "dry fruit laddu"
  ]
},

// ==========================
// BARFI
// ==========================

{
  searchGroup: "barfi",
  keywords: [
    "barfi",
    "burfi",
    "milk barfi",
    "kaju barfi",
    "coconut barfi",
    "pista barfi",
    "chocolate barfi"
  ]
},

// ==========================
// KAJU KATLI
// ==========================

{
  searchGroup: "kaju katli",
  keywords: [
    "kaju katli",
    "kaju barfi",
    "cashew sweet"
  ]
},

// ==========================
// GULAB JAMUN
// ==========================

{
  searchGroup: "gulab jamun",
  keywords: [
    "gulab jamun",
    "gulabjamun"
  ]
},

// ==========================
// RASGULLA
// ==========================

{
  searchGroup: "rasgulla",
  keywords: [
    "rasgulla",
    "rasgola"
  ]
},

// ==========================
// RASMALAI
// ==========================

{
  searchGroup: "rasmalai",
  keywords: [
    "rasmalai",
    "ras malai"
  ]
},

// ==========================
// SOAN PAPDI
// ==========================

{
  searchGroup: "soan papdi",
  keywords: [
    "soan papdi",
    "sohan papdi"
  ]
},

// ==========================
// PEDA
// ==========================

{
  searchGroup: "peda",
  keywords: [
    "peda",
    "mathura peda",
    "doodh peda"
  ]
},

// ==========================
// HALWA
// ==========================

{
  searchGroup: "halwa",
  keywords: [
    "halwa",
    "sooji halwa",
    "atta halwa",
    "gajar halwa",
    "moong dal halwa"
  ]
},

// ==========================
// JALEBI
// ==========================

{
  searchGroup: "jalebi",
  keywords: [
    "jalebi",
    "jalebi"
  ]
},

// ==========================
// IMARTI
// ==========================

{
  searchGroup: "imarti",
  keywords: [
    "imarti",
    "jangiri"
  ]
},

// ==========================
// BALUSHAHI
// ==========================

{
  searchGroup: "balushahi",
  keywords: [
    "balushahi",
    "balu shahi"
  ]
},

// ==========================
// CHAM CHAM
// ==========================

{
  searchGroup: "cham cham",
  keywords: [
    "cham cham",
    "chomchom"
  ]
},

// ==========================
// MALPUA
// ==========================

{
  searchGroup: "malpua",
  keywords: [
    "malpua"
  ]
},

// ==========================
// KHEER
// ==========================

{
  searchGroup: "kheer",
  keywords: [
    "kheer",
    "rice kheer",
    "payasam"
  ]
},

// ==========================
// RABDI
// ==========================

{
  searchGroup: "rabdi",
  keywords: [
    "rabdi",
    "rabri"
  ]
},

// ==========================
// MYSORE PAK
// ==========================

{
  searchGroup: "mysore pak",
  keywords: [
    "mysore pak",
    "mysorepak"
  ]
},

// ==========================
// CHIKKI
// ==========================

{
  searchGroup: "chikki",
  keywords: [
    "chikki",
    "groundnut chikki",
    "peanut chikki",
    "til chikki"
  ]
},

// ==========================
// GHEWAR
// ==========================

{
  searchGroup: "ghewar",
  keywords: [
    "ghewar",
    "ghevar"
  ]
},

// ==========================
// SWEETS
// ==========================

{
  searchGroup: "indian sweets",
  keywords: [
    "sweet",
    "sweets",
    "mithai",
    "indian sweets",
    "dessert"
  ]
},
// ==========================
// PAIN RELIEF
// ==========================

{
  searchGroup: "pain relief",
  keywords: [
    "pain relief",
    "pain killer",
    "body pain",
    "headache medicine",
    "muscle pain"
  ]
},

// ==========================
// FEVER MEDICINE
// ==========================

{
  searchGroup: "fever medicine",
  keywords: [
    "fever medicine",
    "fever",
    "temperature medicine"
  ]
},

// ==========================
// COUGH SYRUP
// ==========================

{
  searchGroup: "cough syrup",
  keywords: [
    "cough syrup",
    "cough medicine",
    "dry cough",
    "wet cough"
  ]
},

// ==========================
// COLD MEDICINE
// ==========================

{
  searchGroup: "cold medicine",
  keywords: [
    "cold medicine",
    "common cold",
    "cold tablet"
  ]
},

// ==========================
// DIGESTIVE
// ==========================

{
  searchGroup: "digestive",
  keywords: [
    "digestive",
    "digestion",
    "acidity",
    "gas relief",
    "indigestion"
  ]
},

// ==========================
// ANTACID
// ==========================

{
  searchGroup: "antacid",
  keywords: [
    "antacid",
    "acidity relief",
    "heartburn"
  ]
},

// ==========================
// ORS
// ==========================

{
  searchGroup: "ors",
  keywords: [
    "ors",
    "oral rehydration salts",
    "electrolyte"
  ]
},

// ==========================
// GLUCOSE
// ==========================

{
  searchGroup: "glucose",
  keywords: [
    "glucose",
    "energy powder",
    "dextrose"
  ]
},

// ==========================
// MULTIVITAMIN
// ==========================

{
  searchGroup: "multivitamin",
  keywords: [
    "multivitamin",
    "vitamin tablet",
    "daily vitamin"
  ]
},

// ==========================
// VITAMIN C
// ==========================

{
  searchGroup: "vitamin c",
  keywords: [
    "vitamin c",
    "ascorbic acid"
  ]
},

// ==========================
// CALCIUM
// ==========================

{
  searchGroup: "calcium supplement",
  keywords: [
    "calcium",
    "calcium tablet",
    "bone health"
  ]
},

// ==========================
// PROTEIN POWDER
// ==========================

{
  searchGroup: "protein powder",
  keywords: [
    "protein powder",
    "whey protein",
    "mass gainer",
    "protein supplement"
  ]
},

// ==========================
// HERBAL SUPPLEMENT
// ==========================

{
  searchGroup: "herbal supplement",
  keywords: [
    "ashwagandha",
    "giloy",
    "tulsi",
    "herbal supplement"
  ]
},

// ==========================
// BANDAGE
// ==========================

{
  searchGroup: "bandage",
  keywords: [
    "bandage",
    "band aid",
    "adhesive bandage"
  ]
},

// ==========================
// COTTON
// ==========================

{
  searchGroup: "cotton",
  keywords: [
    "cotton",
    "medical cotton"
  ]
},

// ==========================
// GAUZE
// ==========================

{
  searchGroup: "gauze",
  keywords: [
    "gauze",
    "gauze pad",
    "dressing pad"
  ]
},

// ==========================
// ANTISEPTIC
// ==========================

{
  searchGroup: "antiseptic",
  keywords: [
    "antiseptic",
    "antiseptic liquid",
    "wound cleaner"
  ]
},

// ==========================
// HAND SANITIZER
// ==========================

{
  searchGroup: "hand sanitizer",
  keywords: [
    "hand sanitizer",
    "sanitizer",
    "hand rub"
  ]
},

// ==========================
// FACE MASK
// ==========================

{
  searchGroup: "face mask",
  keywords: [
    "face mask",
    "surgical mask",
    "n95 mask"
  ]
},

// ==========================
// THERMOMETER
// ==========================

{
  searchGroup: "thermometer",
  keywords: [
    "thermometer",
    "digital thermometer"
  ]
},

// ==========================
// BLOOD PRESSURE MONITOR
// ==========================

{
  searchGroup: "bp monitor",
  keywords: [
    "bp monitor",
    "blood pressure monitor",
    "blood pressure machine"
  ]
},

// ==========================
// GLUCOMETER
// ==========================

{
  searchGroup: "glucometer",
  keywords: [
    "glucometer",
    "glucose meter",
    "sugar testing machine"
  ]
},

// ==========================
// OXIMETER
// ==========================

{
  searchGroup: "pulse oximeter",
  keywords: [
    "pulse oximeter",
    "oximeter",
    "spo2 meter"
  ]
},

// ==========================
// ADULT DIAPER
// ==========================

{
  searchGroup: "adult diaper",
  keywords: [
    "adult diaper",
    "adult diapers",
    "elder care diaper"
  ]
},

// ==========================
// HEALTH DRINK
// ==========================

{
  searchGroup: "health drink",
  keywords: [
    "health drink",
    "horlicks",
    "boost",
    "bournvita",
    "complan",
    "protinex"
  ]
},
// ==========================
// PIZZA
// ==========================

{
  searchGroup: "pizza",
  keywords: [
    "pizza",
    "veg pizza",
    "cheese pizza",
    "margherita",
    "farmhouse pizza",
    "paneer pizza"
  ]
},

// ==========================
// BURGER
// ==========================

{
  searchGroup: "burger",
  keywords: [
    "burger",
    "veg burger",
    "cheese burger",
    "paneer burger",
    "aloo burger"
  ]
},

// ==========================
// SANDWICH
// ==========================

{
  searchGroup: "sandwich",
  keywords: [
    "sandwich",
    "veg sandwich",
    "grilled sandwich",
    "cheese sandwich"
  ]
},

// ==========================
// PASTA
// ==========================

{
  searchGroup: "pasta",
  keywords: [
    "pasta",
    "white sauce pasta",
    "red sauce pasta",
    "alfredo pasta"
  ]
},

// ==========================
// NOODLES
// ==========================

{
  searchGroup: "noodles",
  keywords: [
    "noodles",
    "hakka noodles",
    "veg noodles",
    "chowmein"
  ]
},

// ==========================
// MOMOS
// ==========================

{
  searchGroup: "momos",
  keywords: [
    "momos",
    "veg momos",
    "fried momos",
    "steam momos"
  ]
},

// ==========================
// CHAAT
// ==========================

{
  searchGroup: "chaat",
  keywords: [
    "chaat",
    "aloo tikki",
    "papdi chaat",
    "raj kachori",
    "tokri chaat"
  ]
},

// ==========================
// PANI PURI
// ==========================

{
  searchGroup: "pani puri",
  keywords: [
    "pani puri",
    "golgappa",
    "puchka",
    "gupchup"
  ]
},

// ==========================
// SAMOSA
// ==========================

{
  searchGroup: "samosa",
  keywords: [
    "samosa",
    "aloo samosa",
    "mini samosa"
  ]
},

// ==========================
// KACHORI
// ==========================

{
  searchGroup: "kachori",
  keywords: [
    "kachori",
    "pyaz kachori",
    "dal kachori"
  ]
},

// ==========================
// DHOKLA
// ==========================

{
  searchGroup: "dhokla",
  keywords: [
    "dhokla",
    "khaman",
    "khaman dhokla"
  ]
},

// ==========================
// POHA
// ==========================

{
  searchGroup: "poha",
  keywords: [
    "poha",
    "kanda poha"
  ]
},

// ==========================
// IDLI
// ==========================

{
  searchGroup: "idli",
  keywords: [
    "idli",
    "rava idli"
  ]
},

// ==========================
// DOSA
// ==========================

{
  searchGroup: "dosa",
  keywords: [
    "dosa",
    "masala dosa",
    "plain dosa",
    "paper dosa"
  ]
},

// ==========================
// UTTAPAM
// ==========================

{
  searchGroup: "uttapam",
  keywords: [
    "uttapam",
    "onion uttapam"
  ]
},

// ==========================
// PAV BHAJI
// ==========================

{
  searchGroup: "pav bhaji",
  keywords: [
    "pav bhaji"
  ]
},

// ==========================
// CHOLE BHATURE
// ==========================

{
  searchGroup: "chole bhature",
  keywords: [
    "chole bhature",
    "chhole bhature"
  ]
},

// ==========================
// DAL RICE
// ==========================

{
  searchGroup: "dal rice",
  keywords: [
    "dal rice",
    "dal chawal",
    "dal rice combo"
  ]
},

// ==========================
// BIRYANI
// ==========================

{
  searchGroup: "biryani",
  keywords: [
    "biryani",
    "veg biryani",
    "paneer biryani",
    "dum biryani"
  ]
},

// ==========================
// FRIED RICE
// ==========================

{
  searchGroup: "fried rice",
  keywords: [
    "fried rice",
    "veg fried rice",
    "schezwan fried rice"
  ]
},

// ==========================
// THALI
// ==========================

{
  searchGroup: "thali",
  keywords: [
    "thali",
    "veg thali",
    "special thali",
    "mini thali"
  ]
},

// ==========================
// ROTI
// ==========================

{
  searchGroup: "roti",
  keywords: [
    "roti",
    "chapati",
    "tandoori roti"
  ]
},

// ==========================
// NAAN
// ==========================

{
  searchGroup: "naan",
  keywords: [
    "naan",
    "butter naan",
    "garlic naan"
  ]
},

// ==========================
// PARATHA
// ==========================

{
  searchGroup: "paratha",
  keywords: [
    "paratha",
    "aloo paratha",
    "paneer paratha",
    "gobi paratha",
    "lachha paratha"
  ]
},

// ==========================
// TEA
// ==========================

{
  searchGroup: "tea",
  keywords: [
    "tea",
    "chai",
    "masala chai",
    "ginger tea"
  ]
},

// ==========================
// COFFEE
// ==========================

{
  searchGroup: "coffee",
  keywords: [
    "coffee",
    "cold coffee",
    "hot coffee",
    "cappuccino"
  ]
},

// ==========================
// SHAKE
// ==========================

{
  searchGroup: "shake",
  keywords: [
    "shake",
    "milkshake",
    "oreo shake",
    "mango shake",
    "banana shake"
  ]
},

// ==========================
// LASSI
// ==========================

{
  searchGroup: "restaurant lassi",
  keywords: [
    "lassi",
    "sweet lassi",
    "salted lassi"
  ]
},
// ==========================
// SHAMPOO
// ==========================

{
  searchGroup: "shampoo",
  keywords: [
    "shampoo",
    "hair shampoo",
    "anti dandruff shampoo",
    "herbal shampoo",
    "protein shampoo"
  ]
},

// ==========================
// CONDITIONER
// ==========================

{
  searchGroup: "conditioner",
  keywords: [
    "conditioner",
    "hair conditioner"
  ]
},

// ==========================
// HAIR OIL
// ==========================

{
  searchGroup: "hair oil",
  keywords: [
    "hair oil",
    "coconut oil",
    "amla oil",
    "onion oil",
    "almond oil"
  ]
},

// ==========================
// HAIR SERUM
// ==========================

{
  searchGroup: "hair serum",
  keywords: [
    "hair serum",
    "serum"
  ]
},

// ==========================
// HAIR COLOR
// ==========================

{
  searchGroup: "hair color",
  keywords: [
    "hair color",
    "hair dye",
    "mehndi",
    "henna"
  ]
},

// ==========================
// FACE WASH
// ==========================

{
  searchGroup: "face wash",
  keywords: [
    "face wash",
    "facial cleanser",
    "cleanser"
  ]
},

// ==========================
// FACE CREAM
// ==========================

{
  searchGroup: "face cream",
  keywords: [
    "face cream",
    "fairness cream",
    "moisturizer",
    "skin cream"
  ]
},

// ==========================
// FACE SERUM
// ==========================

{
  searchGroup: "face serum",
  keywords: [
    "face serum",
    "vitamin c serum",
    "niacinamide serum"
  ]
},

// ==========================
// SUNSCREEN
// ==========================

{
  searchGroup: "sunscreen",
  keywords: [
    "sunscreen",
    "sun cream",
    "spf cream"
  ]
},

// ==========================
// LIP BALM
// ==========================

{
  searchGroup: "lip balm",
  keywords: [
    "lip balm",
    "lip care"
  ]
},

// ==========================
// LIPSTICK
// ==========================

{
  searchGroup: "lipstick",
  keywords: [
    "lipstick",
    "matte lipstick",
    "liquid lipstick"
  ]
},

// ==========================
// FOUNDATION
// ==========================

{
  searchGroup: "foundation",
  keywords: [
    "foundation",
    "liquid foundation",
    "makeup foundation"
  ]
},

// ==========================
// COMPACT POWDER
// ==========================

{
  searchGroup: "compact powder",
  keywords: [
    "compact",
    "compact powder",
    "face powder"
  ]
},

// ==========================
// KAJAL
// ==========================

{
  searchGroup: "kajal",
  keywords: [
    "kajal",
    "eye kajal",
    "kohl"
  ]
},

// ==========================
// EYELINER
// ==========================

{
  searchGroup: "eyeliner",
  keywords: [
    "eyeliner",
    "eye liner"
  ]
},

// ==========================
// MASCARA
// ==========================

{
  searchGroup: "mascara",
  keywords: [
    "mascara"
  ]
},

// ==========================
// NAIL POLISH
// ==========================

{
  searchGroup: "nail polish",
  keywords: [
    "nail polish",
    "nail paint"
  ]
},

// ==========================
// SOAP
// ==========================

{
  searchGroup: "soap",
  keywords: [
    "soap",
    "bathing soap",
    "beauty soap"
  ]
},

// ==========================
// BODY WASH
// ==========================

{
  searchGroup: "body wash",
  keywords: [
    "body wash",
    "shower gel"
  ]
},

// ==========================
// HAND WASH
// ==========================

{
  searchGroup: "hand wash",
  keywords: [
    "hand wash",
    "liquid hand wash"
  ]
},

// ==========================
// BODY LOTION
// ==========================

{
  searchGroup: "body lotion",
  keywords: [
    "body lotion",
    "body moisturizer"
  ]
},

// ==========================
// TALCUM POWDER
// ==========================

{
  searchGroup: "talcum powder",
  keywords: [
    "talcum powder",
    "body powder",
    "powder"
  ]
},

// ==========================
// PERFUME
// ==========================

{
  searchGroup: "perfume",
  keywords: [
    "perfume",
    "fragrance",
    "eau de parfum",
    "eau de toilette"
  ]
},

// ==========================
// DEODORANT
// ==========================

{
  searchGroup: "deodorant",
  keywords: [
    "deodorant",
    "deo",
    "body spray"
  ]
},

// ==========================
// RAZOR
// ==========================

{
  searchGroup: "razor",
  keywords: [
    "razor",
    "shaving razor"
  ]
},

// ==========================
// SHAVING CREAM
// ==========================

{
  searchGroup: "shaving cream",
  keywords: [
    "shaving cream",
    "shaving foam"
  ]
},

// ==========================
// AFTER SHAVE
// ==========================

{
  searchGroup: "after shave",
  keywords: [
    "after shave",
    "after shave lotion"
  ]
},

// ==========================
// TOOTHPASTE
// ==========================

{
  searchGroup: "toothpaste",
  keywords: [
    "toothpaste",
    "paste"
  ]
},

// ==========================
// TOOTHBRUSH
// ==========================

{
  searchGroup: "toothbrush",
  keywords: [
    "toothbrush",
    "brush"
  ]
},

// ==========================
// MOUTHWASH
// ==========================

{
  searchGroup: "mouthwash",
  keywords: [
    "mouthwash",
    "mouth wash"
  ]
},
// ==========================
// BABY DIAPER
// ==========================

{
  searchGroup: "baby diaper",
  keywords: [
    "baby diaper",
    "diaper",
    "baby diapers",
    "newborn diaper",
    "pant diaper"
  ]
},

// ==========================
// BABY WIPES
// ==========================

{
  searchGroup: "baby wipes",
  keywords: [
    "baby wipes",
    "wet wipes",
    "baby wet wipes"
  ]
},

// ==========================
// BABY POWDER
// ==========================

{
  searchGroup: "baby powder",
  keywords: [
    "baby powder",
    "baby talcum powder"
  ]
},

// ==========================
// BABY SOAP
// ==========================

{
  searchGroup: "baby soap",
  keywords: [
    "baby soap",
    "baby bathing soap"
  ]
},

// ==========================
// BABY SHAMPOO
// ==========================

{
  searchGroup: "baby shampoo",
  keywords: [
    "baby shampoo",
    "tear free shampoo"
  ]
},

// ==========================
// BABY OIL
// ==========================

{
  searchGroup: "baby oil",
  keywords: [
    "baby oil",
    "massage oil"
  ]
},

// ==========================
// BABY LOTION
// ==========================

{
  searchGroup: "baby lotion",
  keywords: [
    "baby lotion",
    "baby moisturizer"
  ]
},

// ==========================
// BABY CREAM
// ==========================

{
  searchGroup: "baby cream",
  keywords: [
    "baby cream",
    "rash cream",
    "baby skin cream"
  ]
},

// ==========================
// BABY MASSAGE OIL
// ==========================

{
  searchGroup: "baby massage oil",
  keywords: [
    "baby massage oil",
    "massage oil"
  ]
},

// ==========================
// BABY FOOD
// ==========================

{
  searchGroup: "baby food",
  keywords: [
    "baby food",
    "infant food",
    "baby cereal"
  ]
},

// ==========================
// BABY CEREAL
// ==========================

{
  searchGroup: "baby cereal",
  keywords: [
    "baby cereal",
    "rice cereal",
    "wheat cereal"
  ]
},

// ==========================
// BABY FORMULA
// ==========================

{
  searchGroup: "baby formula",
  keywords: [
    "baby formula",
    "formula milk",
    "infant formula"
  ]
},

// ==========================
// FEEDING BOTTLE
// ==========================

{
  searchGroup: "feeding bottle",
  keywords: [
    "feeding bottle",
    "baby bottle",
    "milk bottle"
  ]
},

// ==========================
// BABY NIPPLE
// ==========================

{
  searchGroup: "baby nipple",
  keywords: [
    "baby nipple",
    "feeding nipple"
  ]
},

// ==========================
// BABY SIPPY CUP
// ==========================

{
  searchGroup: "sippy cup",
  keywords: [
    "sippy cup",
    "baby sipper",
    "baby cup"
  ]
},

// ==========================
// BABY FEEDER
// ==========================

{
  searchGroup: "baby feeder",
  keywords: [
    "baby feeder",
    "fruit feeder"
  ]
},

// ==========================
// PACIFIER
// ==========================

{
  searchGroup: "pacifier",
  keywords: [
    "pacifier",
    "baby soother",
    "soother"
  ]
},

// ==========================
// BABY TOOTHBRUSH
// ==========================

{
  searchGroup: "baby toothbrush",
  keywords: [
    "baby toothbrush",
    "infant toothbrush"
  ]
},

// ==========================
// BABY TOOTHPASTE
// ==========================

{
  searchGroup: "baby toothpaste",
  keywords: [
    "baby toothpaste",
    "kids toothpaste"
  ]
},

// ==========================
// BABY COMB
// ==========================

{
  searchGroup: "baby comb",
  keywords: [
    "baby comb",
    "baby hair brush"
  ]
},

// ==========================
// BABY NAIL CUTTER
// ==========================

{
  searchGroup: "baby nail cutter",
  keywords: [
    "baby nail cutter",
    "baby nail clipper"
  ]
},

// ==========================
// BABY CLOTHES
// ==========================

{
  searchGroup: "baby clothes",
  keywords: [
    "baby clothes",
    "baby dress",
    "newborn clothes",
    "infant clothes"
  ]
},

// ==========================
// BABY BLANKET
// ==========================

{
  searchGroup: "baby blanket",
  keywords: [
    "baby blanket",
    "newborn blanket"
  ]
},

// ==========================
// BABY TOWEL
// ==========================

{
  searchGroup: "baby towel",
  keywords: [
    "baby towel",
    "hooded towel"
  ]
},

// ==========================
// BABY BED
// ==========================

{
  searchGroup: "baby bed",
  keywords: [
    "baby bed",
    "baby mattress",
    "baby crib"
  ]
},

// ==========================
// BABY STROLLER
// ==========================

{
  searchGroup: "baby stroller",
  keywords: [
    "baby stroller",
    "baby pram",
    "baby trolley"
  ]
},

// ==========================
// BABY WALKER
// ==========================

{
  searchGroup: "baby walker",
  keywords: [
    "baby walker",
    "walker"
  ]
},

// ==========================
// BABY CARRIER
// ==========================

{
  searchGroup: "baby carrier",
  keywords: [
    "baby carrier",
    "baby sling"
  ]
},
// ==========================
// T SHIRT
// ==========================

{
  searchGroup: "t shirt",
  keywords: [
    "t shirt",
    "tshirt",
    "tee",
    "round neck t shirt",
    "polo t shirt"
  ]
},

// ==========================
// SHIRT
// ==========================

{
  searchGroup: "shirt",
  keywords: [
    "shirt",
    "formal shirt",
    "casual shirt",
    "full sleeve shirt",
    "half sleeve shirt"
  ]
},

// ==========================
// JEANS
// ==========================

{
  searchGroup: "jeans",
  keywords: [
    "jeans",
    "denim jeans",
    "blue jeans",
    "black jeans"
  ]
},

// ==========================
// TROUSER
// ==========================

{
  searchGroup: "trouser",
  keywords: [
    "trouser",
    "formal pant",
    "casual pant"
  ]
},

// ==========================
// TRACK PANT
// ==========================

{
  searchGroup: "track pant",
  keywords: [
    "track pant",
    "track pants",
    "jogger",
    "joggers"
  ]
},

// ==========================
// SHORTS
// ==========================

{
  searchGroup: "shorts",
  keywords: [
    "shorts",
    "cotton shorts",
    "sports shorts"
  ]
},

// ==========================
// KURTA
// ==========================

{
  searchGroup: "kurta",
  keywords: [
    "kurta",
    "cotton kurta",
    "ethnic kurta"
  ]
},

// ==========================
// KURTA PAJAMA
// ==========================

{
  searchGroup: "kurta pajama",
  keywords: [
    "kurta pajama",
    "kurta pyjama"
  ]
},

// ==========================
// SHERWANI
// ==========================

{
  searchGroup: "sherwani",
  keywords: [
    "sherwani",
    "wedding sherwani"
  ]
},

// ==========================
// BLAZER
// ==========================

{
  searchGroup: "blazer",
  keywords: [
    "blazer",
    "formal blazer"
  ]
},

// ==========================
// SUIT
// ==========================

{
  searchGroup: "suit",
  keywords: [
    "suit",
    "formal suit",
    "coat pant"
  ]
},

// ==========================
// JACKET
// ==========================

{
  searchGroup: "jacket",
  keywords: [
    "jacket",
    "winter jacket",
    "bomber jacket"
  ]
},

// ==========================
// SWEATSHIRT
// ==========================

{
  searchGroup: "sweatshirt",
  keywords: [
    "sweatshirt",
    "sweat shirt"
  ]
},

// ==========================
// HOODIE
// ==========================

{
  searchGroup: "hoodie",
  keywords: [
    "hoodie",
    "hooded sweatshirt"
  ]
},

// ==========================
// SWEATER
// ==========================

{
  searchGroup: "sweater",
  keywords: [
    "sweater",
    "wool sweater"
  ]
},

// ==========================
// INNERWEAR
// ==========================

{
  searchGroup: "innerwear",
  keywords: [
    "innerwear",
    "vest",
    "baniyan"
  ]
},

// ==========================
// UNDERWEAR
// ==========================

{
  searchGroup: "underwear",
  keywords: [
    "underwear",
    "brief",
    "trunk",
    "boxer"
  ]
},

// ==========================
// SOCKS
// ==========================

{
  searchGroup: "socks",
  keywords: [
    "socks",
    "cotton socks",
    "ankle socks"
  ]
},

// ==========================
// BELT
// ==========================

{
  searchGroup: "belt",
  keywords: [
    "belt",
    "leather belt"
  ]
},

// ==========================
// WALLET
// ==========================

{
  searchGroup: "wallet",
  keywords: [
    "wallet",
    "leather wallet",
    "purse"
  ]
},

// ==========================
// CAP
// ==========================

{
  searchGroup: "cap",
  keywords: [
    "cap",
    "baseball cap",
    "sports cap"
  ]
},
// ==========================
// NOTEBOOK
// ==========================

{
  searchGroup: "notebook",
  keywords: [
    "notebook",
    "copy",
    "register"
  ]
},

// ==========================
// DIARY
// ==========================

{
  searchGroup: "diary",
  keywords: [
    "diary",
    "planner"
  ]
},

// ==========================
// PEN
// ==========================

{
  searchGroup: "pen",
  keywords: [
    "pen",
    "ball pen",
    "gel pen"
  ]
},

// ==========================
// PENCIL
// ==========================

{
  searchGroup: "pencil",
  keywords: [
    "pencil"
  ]
},

// ==========================
// ERASER
// ==========================

{
  searchGroup: "eraser",
  keywords: [
    "eraser",
    "rubber"
  ]
},

// ==========================
// SHARPENER
// ==========================

{
  searchGroup: "sharpener",
  keywords: [
    "sharpener"
  ]
},

// ==========================
// SCALE
// ==========================

{
  searchGroup: "scale",
  keywords: [
    "scale",
    "ruler"
  ]
},

// ==========================
// MARKER
// ==========================

{
  searchGroup: "marker",
  keywords: [
    "marker",
    "permanent marker",
    "whiteboard marker"
  ]
},

// ==========================
// HIGHLIGHTER
// ==========================

{
  searchGroup: "highlighter",
  keywords: [
    "highlighter"
  ]
},

// ==========================
// FILE
// ==========================

{
  searchGroup: "file",
  keywords: [
    "file",
    "office file"
  ]
},

// ==========================
// FOLDER
// ==========================

{
  searchGroup: "folder",
  keywords: [
    "folder",
    "document folder"
  ]
},

// ==========================
// STAPLER
// ==========================

{
  searchGroup: "stapler",
  keywords: [
    "stapler"
  ]
},

// ==========================
// STAPLE PIN
// ==========================

{
  searchGroup: "staple pin",
  keywords: [
    "staple pin",
    "staples"
  ]
},

// ==========================
// GLUE
// ==========================

{
  searchGroup: "glue",
  keywords: [
    "glue",
    "adhesive",
    "gum"
  ]
},

// ==========================
// TAPE
// ==========================

{
  searchGroup: "tape",
  keywords: [
    "tape",
    "cello tape"
  ]
},

// ==========================
// CALCULATOR
// ==========================

{
  searchGroup: "calculator",
  keywords: [
    "calculator"
  ]
},

// ==========================
// ART SUPPLIES
// ==========================

{
  searchGroup: "art supplies",
  keywords: [
    "crayons",
    "colour pencils",
    "water colour",
    "poster colour",
    "paint brush",
    "drawing book"
  ]
},

// ==========================
// SCHOOL BAG
// ==========================

{
  searchGroup: "school bag",
  keywords: [
    "school bag",
    "school backpack"
  ]
},

// ==========================
// OFFICE CHAIR
// ==========================

{
  searchGroup: "office chair",
  keywords: [
    "office chair",
    "computer chair"
  ]
},
// ==========================
// ENGINE OIL
// ==========================

{
  searchGroup: "engine oil",
  keywords: [
    "engine oil",
    "motor oil",
    "lubricant"
  ]
},

// ==========================
// GEAR OIL
// ==========================

{
  searchGroup: "gear oil",
  keywords: [
    "gear oil",
    "gear lubricant"
  ]
},

// ==========================
// COOLANT
// ==========================

{
  searchGroup: "coolant",
  keywords: [
    "coolant",
    "radiator coolant"
  ]
},

// ==========================
// BRAKE OIL
// ==========================

{
  searchGroup: "brake oil",
  keywords: [
    "brake oil",
    "brake fluid"
  ]
},

// ==========================
// BATTERY
// ==========================

{
  searchGroup: "battery",
  keywords: [
    "battery",
    "car battery",
    "bike battery"
  ]
},

// ==========================
// TYRE
// ==========================

{
  searchGroup: "tyre",
  keywords: [
    "tyre",
    "tire"
  ]
},

// ==========================
// TUBE
// ==========================

{
  searchGroup: "tube",
  keywords: [
    "tube",
    "tyre tube"
  ]
},

// ==========================
// ALLOY WHEEL
// ==========================

{
  searchGroup: "alloy wheel",
  keywords: [
    "alloy wheel",
    "alloy rim"
  ]
},

// ==========================
// HELMET
// ==========================

{
  searchGroup: "helmet",
  keywords: [
    "helmet",
    "bike helmet"
  ]
},

// ==========================
// SEAT COVER
// ==========================

{
  searchGroup: "seat cover",
  keywords: [
    "seat cover",
    "car seat cover",
    "bike seat cover"
  ]
},

// ==========================
// CAR PERFUME
// ==========================

{
  searchGroup: "car perfume",
  keywords: [
    "car perfume",
    "car freshener"
  ]
},

// ==========================
// CAR SHAMPOO
// ==========================

{
  searchGroup: "car shampoo",
  keywords: [
    "car shampoo",
    "car wash"
  ]
},

// ==========================
// PRESSURE WASHER
// ==========================

{
  searchGroup: "pressure washer",
  keywords: [
    "pressure washer",
    "car washer"
  ]
},

// ==========================
// WIPER
// ==========================

{
  searchGroup: "wiper",
  keywords: [
    "wiper",
    "wiper blade"
  ]
},

// ==========================
// SPARK PLUG
// ==========================

{
  searchGroup: "spark plug",
  keywords: [
    "spark plug"
  ]
},

// ==========================
// AIR FILTER
// ==========================

{
  searchGroup: "air filter",
  keywords: [
    "air filter",
    "engine air filter"
  ]
},

// ==========================
// OIL FILTER
// ==========================

{
  searchGroup: "oil filter",
  keywords: [
    "oil filter"
  ]
},

// ==========================
// SIDE MIRROR
// ==========================

{
  searchGroup: "side mirror",
  keywords: [
    "side mirror",
    "rear view mirror"
  ]
},
// ==========================
// DOG FOOD
// ==========================

{
  searchGroup: "dog food",
  keywords: [
    "dog food",
    "puppy food"
  ]
},

// ==========================
// CAT FOOD
// ==========================

{
  searchGroup: "cat food",
  keywords: [
    "cat food",
    "kitten food"
  ]
},

// ==========================
// BIRD FOOD
// ==========================

{
  searchGroup: "bird food",
  keywords: [
    "bird food",
    "parrot food"
  ]
},

// ==========================
// FISH FOOD
// ==========================

{
  searchGroup: "fish food",
  keywords: [
    "fish food",
    "aquarium food"
  ]
},

// ==========================
// PET TREATS
// ==========================

{
  searchGroup: "pet treats",
  keywords: [
    "dog treats",
    "cat treats",
    "pet treats"
  ]
},

// ==========================
// PET SHAMPOO
// ==========================

{
  searchGroup: "pet shampoo",
  keywords: [
    "pet shampoo",
    "dog shampoo",
    "cat shampoo"
  ]
},

// ==========================
// PET SOAP
// ==========================

{
  searchGroup: "pet soap",
  keywords: [
    "pet soap",
    "dog soap"
  ]
},

// ==========================
// PET COLLAR
// ==========================

{
  searchGroup: "pet collar",
  keywords: [
    "pet collar",
    "dog collar",
    "cat collar"
  ]
},

// ==========================
// PET LEASH
// ==========================

{
  searchGroup: "pet leash",
  keywords: [
    "pet leash",
    "dog leash"
  ]
},

// ==========================
// PET HARNESS
// ==========================

{
  searchGroup: "pet harness",
  keywords: [
    "pet harness",
    "dog harness"
  ]
},

// ==========================
// PET BED
// ==========================

{
  searchGroup: "pet bed",
  keywords: [
    "pet bed",
    "dog bed",
    "cat bed"
  ]
},

// ==========================
// PET BOWL
// ==========================

{
  searchGroup: "pet bowl",
  keywords: [
    "pet bowl",
    "dog bowl",
    "cat bowl"
  ]
},

// ==========================
// PET CAGE
// ==========================

{
  searchGroup: "pet cage",
  keywords: [
    "pet cage",
    "bird cage"
  ]
},

// ==========================
// LITTER
// ==========================

{
  searchGroup: "cat litter",
  keywords: [
    "cat litter",
    "litter sand"
  ]
},

// ==========================
// PET TOYS
// ==========================

{
  searchGroup: "pet toys",
  keywords: [
    "pet toys",
    "dog toys",
    "cat toys"
  ]
},

// ==========================
// PET MEDICINE
// ==========================

{
  searchGroup: "pet medicine",
  keywords: [
    "pet medicine",
    "dog medicine",
    "cat medicine"
  ]
},

// ==========================
// PET SUPPLEMENTS
// ==========================

{
  searchGroup: "pet supplements",
  keywords: [
    "pet supplements",
    "dog vitamins",
    "cat vitamins"
  ]
},
// ==========================
// CRICKET BAT
// ==========================

{
  searchGroup: "cricket bat",
  keywords: [
    "cricket bat",
    "bat"
  ]
},

// ==========================
// CRICKET BALL
// ==========================

{
  searchGroup: "cricket ball",
  keywords: [
    "cricket ball",
    "tennis ball",
    "leather ball"
  ]
},

// ==========================
// CRICKET KIT
// ==========================

{
  searchGroup: "cricket kit",
  keywords: [
    "cricket kit",
    "cricket set"
  ]
},

// ==========================
// BADMINTON RACKET
// ==========================

{
  searchGroup: "badminton racket",
  keywords: [
    "badminton racket",
    "racket"
  ]
},

// ==========================
// SHUTTLECOCK
// ==========================

{
  searchGroup: "shuttlecock",
  keywords: [
    "shuttlecock",
    "shuttle"
  ]
},

// ==========================
// FOOTBALL
// ==========================

{
  searchGroup: "football",
  keywords: [
    "football",
    "soccer ball"
  ]
},

// ==========================
// VOLLEYBALL
// ==========================

{
  searchGroup: "volleyball",
  keywords: [
    "volleyball"
  ]
},

// ==========================
// BASKETBALL
// ==========================

{
  searchGroup: "basketball",
  keywords: [
    "basketball"
  ]
},

// ==========================
// TABLE TENNIS
// ==========================

{
  searchGroup: "table tennis",
  keywords: [
    "table tennis",
    "tt bat",
    "ping pong"
  ]
},

// ==========================
// CHESS
// ==========================

{
  searchGroup: "chess",
  keywords: [
    "chess",
    "chess board"
  ]
},

// ==========================
// CARROM
// ==========================

{
  searchGroup: "carrom",
  keywords: [
    "carrom",
    "carrom board"
  ]
},

// ==========================
// YOGA MAT
// ==========================

{
  searchGroup: "yoga mat",
  keywords: [
    "yoga mat",
    "exercise mat"
  ]
},

// ==========================
// DUMBBELL
// ==========================

{
  searchGroup: "dumbbell",
  keywords: [
    "dumbbell",
    "dumbbells"
  ]
},

// ==========================
// BARBELL
// ==========================

{
  searchGroup: "barbell",
  keywords: [
    "barbell",
    "weight rod"
  ]
},

// ==========================
// WEIGHT PLATE
// ==========================

{
  searchGroup: "weight plate",
  keywords: [
    "weight plate",
    "gym plate"
  ]
},

// ==========================
// RESISTANCE BAND
// ==========================

{
  searchGroup: "resistance band",
  keywords: [
    "resistance band",
    "exercise band"
  ]
},

// ==========================
// SKIPPING ROPE
// ==========================

{
  searchGroup: "skipping rope",
  keywords: [
    "skipping rope",
    "jump rope"
  ]
},

// ==========================
// TREADMILL
// ==========================

{
  searchGroup: "treadmill",
  keywords: [
    "treadmill"
  ]
},

// ==========================
// EXERCISE CYCLE
// ==========================

{
  searchGroup: "exercise cycle",
  keywords: [
    "exercise cycle",
    "gym cycle"
  ]
},

// ==========================
// PROTEIN SHAKER
// ==========================

{
  searchGroup: "protein shaker",
  keywords: [
    "protein shaker",
    "gym shaker"
  ]
},

// ==========================
// SPORTS BOTTLE
// ==========================

{
  searchGroup: "sports bottle",
  keywords: [
    "sports bottle",
    "gym bottle"
  ]
},
// ==========================
// CEMENT
// ==========================

{
  searchGroup: "cement",
  keywords: [
    "cement",
    "opc cement",
    "ppc cement",
    "white cement"
  ]
},

// ==========================
// TMT BAR
// ==========================

{
  searchGroup: "tmt bar",
  keywords: [
    "tmt bar",
    "saria",
    "steel rod",
    "iron rod"
  ]
},

// ==========================
// STEEL
// ==========================

{
  searchGroup: "steel",
  keywords: [
    "steel",
    "steel pipe",
    "steel section"
  ]
},

// ==========================
// BRICKS
// ==========================

{
  searchGroup: "bricks",
  keywords: [
    "brick",
    "bricks",
    "red brick"
  ]
},

// ==========================
// FLY ASH BRICK
// ==========================

{
  searchGroup: "fly ash brick",
  keywords: [
    "fly ash brick",
    "fly ash bricks"
  ]
},

// ==========================
// BLOCK
// ==========================

{
  searchGroup: "aac block",
  keywords: [
    "aac block",
    "block",
    "concrete block"
  ]
},

// ==========================
// SAND
// ==========================

{
  searchGroup: "sand",
  keywords: [
    "sand",
    "river sand",
    "construction sand",
    "m sand"
  ]
},

// ==========================
// GRAVEL
// ==========================

{
  searchGroup: "gravel",
  keywords: [
    "gravel",
    "gitti",
    "stone chips",
    "aggregate"
  ]
},

// ==========================
// STONE
// ==========================

{
  searchGroup: "stone",
  keywords: [
    "stone",
    "building stone"
  ]
},

// ==========================
// MARBLE
// ==========================

{
  searchGroup: "marble",
  keywords: [
    "marble",
    "marble slab"
  ]
},

// ==========================
// GRANITE
// ==========================

{
  searchGroup: "granite",
  keywords: [
    "granite",
    "granite slab"
  ]
},

// ==========================
// TILES
// ==========================

{
  searchGroup: "tiles",
  keywords: [
    "tiles",
    "floor tiles",
    "wall tiles",
    "vitrified tiles"
  ]
},

// ==========================
// INTERLOCK TILES
// ==========================

{
  searchGroup: "interlock tiles",
  keywords: [
    "interlock tiles",
    "paver block"
  ]
},

// ==========================
// TILE ADHESIVE
// ==========================

{
  searchGroup: "tile adhesive",
  keywords: [
    "tile adhesive",
    "tile glue"
  ]
},

// ==========================
// PUTTY
// ==========================

{
  searchGroup: "wall putty",
  keywords: [
    "wall putty",
    "putty"
  ]
},

// ==========================
// PAINT
// ==========================

{
  searchGroup: "paint",
  keywords: [
    "paint",
    "wall paint",
    "interior paint",
    "exterior paint"
  ]
},

// ==========================
// PRIMER
// ==========================

{
  searchGroup: "primer",
  keywords: [
    "primer",
    "wall primer"
  ]
},

// ==========================
// WATERPROOFING
// ==========================

{
  searchGroup: "waterproofing",
  keywords: [
    "waterproofing",
    "waterproof chemical"
  ]
},

// ==========================
// POP
// ==========================

{
  searchGroup: "pop",
  keywords: [
    "pop",
    "plaster of paris"
  ]
},

// ==========================
// GYPSUM BOARD
// ==========================

{
  searchGroup: "gypsum board",
  keywords: [
    "gypsum board",
    "false ceiling board"
  ]
},

// ==========================
// PVC PIPE
// ==========================

{
  searchGroup: "pvc pipe",
  keywords: [
    "pvc pipe",
    "water pipe"
  ]
},

// ==========================
// CPVC PIPE
// ==========================

{
  searchGroup: "cpvc pipe",
  keywords: [
    "cpvc pipe"
  ]
},

// ==========================
// UPVC PIPE
// ==========================

{
  searchGroup: "upvc pipe",
  keywords: [
    "upvc pipe"
  ]
},

// ==========================
// WATER TANK
// ==========================

{
  searchGroup: "water tank",
  keywords: [
    "water tank",
    "plastic water tank"
  ]
},

// ==========================
// DOOR
// ==========================

{
  searchGroup: "door",
  keywords: [
    "door",
    "wooden door",
    "steel door",
    "flush door"
  ]
},

// ==========================
// WINDOW
// ==========================

{
  searchGroup: "window",
  keywords: [
    "window",
    "aluminium window",
    "upvc window"
  ]
},

// ==========================
// PLYWOOD
// ==========================

{
  searchGroup: "plywood",
  keywords: [
    "plywood",
    "ply board"
  ]
},

// ==========================
// LAMINATE
// ==========================

{
  searchGroup: "laminate",
  keywords: [
    "laminate",
    "sunmica"
  ]
},

// ==========================
// HARDWARE FITTINGS
// ==========================

{
  searchGroup: "hardware fittings",
  keywords: [
    "hardware fittings",
    "hinges",
    "door fittings",
    "drawer fittings"
  ]
},

// ==========================
// ROOFING SHEET
// ==========================

{
  searchGroup: "roofing sheet",
  keywords: [
    "roofing sheet",
    "gi sheet",
    "ppgi sheet",
    "color coated sheet"
  ]
},

// ==========================
// PUF PANEL
// ==========================

{
  searchGroup: "puf panel",
  keywords: [
    "puf panel",
    "sandwich panel"
  ]
},
// ==========================
// SOFA
// ==========================

{
  searchGroup: "sofa",
  keywords: [
    "sofa",
    "sofa set",
    "fabric sofa",
    "wooden sofa",
    "recliner sofa"
  ]
},

// ==========================
// CHAIR
// ==========================

{
  searchGroup: "chair",
  keywords: [
    "chair",
    "plastic chair",
    "wooden chair",
    "office chair",
    "dining chair"
  ]
},

// ==========================
// TABLE
// ==========================

{
  searchGroup: "table",
  keywords: [
    "table",
    "wooden table",
    "center table",
    "coffee table"
  ]
},

// ==========================
// DINING TABLE
// ==========================

{
  searchGroup: "dining table",
  keywords: [
    "dining table",
    "dining set"
  ]
},

// ==========================
// BED
// ==========================

{
  searchGroup: "bed",
  keywords: [
    "bed",
    "double bed",
    "single bed",
    "wooden bed"
  ]
},

// ==========================
// MATTRESS
// ==========================

{
  searchGroup: "mattress",
  keywords: [
    "mattress",
    "foam mattress",
    "spring mattress"
  ]
},

// ==========================
// PILLOW
// ==========================

{
  searchGroup: "pillow",
  keywords: [
    "pillow",
    "cushion pillow"
  ]
},

// ==========================
// WARDROBE
// ==========================

{
  searchGroup: "wardrobe",
  keywords: [
    "wardrobe",
    "almirah",
    "cupboard"
  ]
},

// ==========================
// STUDY TABLE
// ==========================

{
  searchGroup: "study table",
  keywords: [
    "study table",
    "computer table"
  ]
},

// ==========================
// BOOKSHELF
// ==========================

{
  searchGroup: "bookshelf",
  keywords: [
    "bookshelf",
    "book rack",
    "book shelf"
  ]
},

// ==========================
// TV UNIT
// ==========================

{
  searchGroup: "tv unit",
  keywords: [
    "tv unit",
    "tv stand",
    "tv cabinet"
  ]
},

// ==========================
// SHOE RACK
// ==========================

{
  searchGroup: "shoe rack",
  keywords: [
    "shoe rack",
    "shoe stand"
  ]
},

// ==========================
// MIRROR
// ==========================

{
  searchGroup: "mirror",
  keywords: [
    "mirror",
    "wall mirror",
    "dressing mirror"
  ]
},

// ==========================
// WALL CLOCK
// ==========================

{
  searchGroup: "wall clock",
  keywords: [
    "wall clock",
    "clock"
  ]
},

// ==========================
// WALL ART
// ==========================

{
  searchGroup: "wall art",
  keywords: [
    "wall art",
    "painting",
    "canvas painting",
    "wall painting"
  ]
},

// ==========================
// WALL STICKER
// ==========================

{
  searchGroup: "wall sticker",
  keywords: [
    "wall sticker",
    "wall decal"
  ]
},

// ==========================
// PHOTO FRAME
// ==========================

{
  searchGroup: "photo frame",
  keywords: [
    "photo frame",
    "picture frame"
  ]
},

// ==========================
// CURTAINS
// ==========================

{
  searchGroup: "curtains",
  keywords: [
    "curtain",
    "curtains",
    "door curtain",
    "window curtain"
  ]
},

// ==========================
// CARPET
// ==========================

{
  searchGroup: "carpet",
  keywords: [
    "carpet",
    "rug",
    "floor mat"
  ]
},

// ==========================
// DOOR MAT
// ==========================

{
  searchGroup: "door mat",
  keywords: [
    "door mat",
    "welcome mat"
  ]
},

// ==========================
// BEAN BAG
// ==========================

{
  searchGroup: "bean bag",
  keywords: [
    "bean bag",
    "beanbag"
  ]
},

// ==========================
// LAMP
// ==========================

{
  searchGroup: "lamp",
  keywords: [
    "lamp",
    "table lamp",
    "floor lamp",
    "night lamp"
  ]
},

// ==========================
// FLOWER VASE
// ==========================

{
  searchGroup: "flower vase",
  keywords: [
    "flower vase",
    "vase"
  ]
},

// ==========================
// ARTIFICIAL PLANT
// ==========================

{
  searchGroup: "artificial plant",
  keywords: [
    "artificial plant",
    "fake plant",
    "decor plant"
  ]
},

// ==========================
// PLANT POT
// ==========================

{
  searchGroup: "plant pot",
  keywords: [
    "plant pot",
    "flower pot"
  ]
},

// ==========================
// STORAGE BOX
// ==========================

{
  searchGroup: "storage box",
  keywords: [
    "storage box",
    "organizer box"
  ]
},

// ==========================
// HANGER
// ==========================

{
  searchGroup: "hanger",
  keywords: [
    "hanger",
    "cloth hanger"
  ]
},

// ==========================
// LAUNDRY BASKET
// ==========================

{
  searchGroup: "laundry basket",
  keywords: [
    "laundry basket",
    "cloth basket"
  ]
},
// ==========================
// RUNNING SHOES
// ==========================

{
  searchGroup: "running shoes",
  keywords: [
    "running shoes",
    "sports shoes",
    "running shoe"
  ]
},

// ==========================
// CASUAL SHOES
// ==========================

{
  searchGroup: "casual shoes",
  keywords: [
    "casual shoes",
    "daily wear shoes"
  ]
},

// ==========================
// FORMAL SHOES
// ==========================

{
  searchGroup: "formal shoes",
  keywords: [
    "formal shoes",
    "office shoes",
    "leather shoes"
  ]
},

// ==========================
// SCHOOL SHOES
// ==========================

{
  searchGroup: "school shoes",
  keywords: [
    "school shoes",
    "black school shoes"
  ]
},

// ==========================
// SNEAKERS
// ==========================

{
  searchGroup: "sneakers",
  keywords: [
    "sneakers",
    "sneaker shoes"
  ]
},

// ==========================
// LOAFERS
// ==========================

{
  searchGroup: "loafers",
  keywords: [
    "loafers",
    "loafer shoes"
  ]
},

// ==========================
// BOOTS
// ==========================

{
  searchGroup: "boots",
  keywords: [
    "boots",
    "ankle boots",
    "winter boots"
  ]
},

// ==========================
// SANDALS
// ==========================

{
  searchGroup: "sandals",
  keywords: [
    "sandals",
    "sandal"
  ]
},

// ==========================
// SLIPPERS
// ==========================

{
  searchGroup: "slippers",
  keywords: [
    "slippers",
    "slipper",
    "house slippers"
  ]
},

// ==========================
// FLIP FLOPS
// ==========================

{
  searchGroup: "flip flops",
  keywords: [
    "flip flops",
    "flip flop",
    "hawai chappal"
  ]
},

// ==========================
// CHAPPAL
// ==========================

{
  searchGroup: "chappal",
  keywords: [
    "chappal",
    "rubber chappal",
    "daily chappal"
  ]
},

// ==========================
// HEELS
// ==========================

{
  searchGroup: "heels",
  keywords: [
    "heels",
    "high heels",
    "ladies heels"
  ]
},

// ==========================
// WEDGES
// ==========================

{
  searchGroup: "wedges",
  keywords: [
    "wedges",
    "wedge sandals"
  ]
},

// ==========================
// BELLIES
// ==========================

{
  searchGroup: "bellies",
  keywords: [
    "bellies",
    "ballet shoes"
  ]
},

// ==========================
// ETHNIC FOOTWEAR
// ==========================

{
  searchGroup: "ethnic footwear",
  keywords: [
    "jutti",
    "mojari",
    "ethnic footwear"
  ]
},

// ==========================
// SAFETY SHOES
// ==========================

{
  searchGroup: "safety shoes",
  keywords: [
    "safety shoes",
    "industrial shoes",
    "steel toe shoes"
  ]
},

// ==========================
// RAIN BOOTS
// ==========================

{
  searchGroup: "rain boots",
  keywords: [
    "rain boots",
    "gum boots"
  ]
},

// ==========================
// BABY FOOTWEAR
// ==========================

{
  searchGroup: "baby footwear",
  keywords: [
    "baby shoes",
    "baby sandals",
    "baby slippers"
  ]
},

// ==========================
// SOCKS
// ==========================

{
  searchGroup: "socks",
  keywords: [
    "socks",
    "ankle socks",
    "cotton socks"
  ]
},

// ==========================
// SHOE LACES
// ==========================

{
  searchGroup: "shoe laces",
  keywords: [
    "shoe lace",
    "shoe laces",
    "laces"
  ]
},

// ==========================
// SHOE POLISH
// ==========================

{
  searchGroup: "shoe polish",
  keywords: [
    "shoe polish",
    "polish"
  ]
},

// ==========================
// SHOE INSOLE
// ==========================

{
  searchGroup: "shoe insole",
  keywords: [
    "shoe insole",
    "insole",
    "foot insole"
  ]
},
// ==========================
// SAREE
// ==========================

{
  searchGroup: "saree",
  keywords: [
    "saree",
    "sari",
    "silk saree",
    "cotton saree",
    "georgette saree"
  ]
},

// ==========================
// KURTI
// ==========================

{
  searchGroup: "kurti",
  keywords: [
    "kurti",
    "cotton kurti",
    "printed kurti",
    "designer kurti"
  ]
},

// ==========================
// SALWAR SUIT
// ==========================

{
  searchGroup: "salwar suit",
  keywords: [
    "salwar suit",
    "suit",
    "dress material",
    "punjabi suit"
  ]
},

// ==========================
// LEGGINGS
// ==========================

{
  searchGroup: "leggings",
  keywords: [
    "leggings",
    "cotton leggings"
  ]
},

// ==========================
// PALAZZO
// ==========================

{
  searchGroup: "palazzo",
  keywords: [
    "palazzo",
    "palazzo pant"
  ]
},

// ==========================
// JEANS
// ==========================

{
  searchGroup: "women jeans",
  keywords: [
    "jeans",
    "women jeans",
    "denim jeans"
  ]
},

// ==========================
// TOP
// ==========================

{
  searchGroup: "top",
  keywords: [
    "top",
    "ladies top",
    "crop top",
    "casual top"
  ]
},

// ==========================
// T SHIRT
// ==========================

{
  searchGroup: "women t shirt",
  keywords: [
    "t shirt",
    "women t shirt",
    "tee"
  ]
},

// ==========================
// SHIRT
// ==========================

{
  searchGroup: "women shirt",
  keywords: [
    "shirt",
    "formal shirt",
    "casual shirt"
  ]
},

// ==========================
// GOWN
// ==========================

{
  searchGroup: "gown",
  keywords: [
    "gown",
    "party gown"
  ]
},

// ==========================
// LEHENGA
// ==========================

{
  searchGroup: "lehenga",
  keywords: [
    "lehenga",
    "bridal lehenga",
    "lehenga choli"
  ]
},

// ==========================
// BLOUSE
// ==========================

{
  searchGroup: "blouse",
  keywords: [
    "blouse",
    "designer blouse"
  ]
},

// ==========================
// DUPATTA
// ==========================

{
  searchGroup: "dupatta",
  keywords: [
    "dupatta",
    "chunni",
    "stole"
  ]
},

// ==========================
// NIGHTY
// ==========================

{
  searchGroup: "nighty",
  keywords: [
    "nighty",
    "night dress",
    "night gown"
  ]
},

// ==========================
// BRA
// ==========================

{
  searchGroup: "bra",
  keywords: [
    "bra",
    "sports bra",
    "padded bra"
  ]
},

// ==========================
// PANTY
// ==========================

{
  searchGroup: "panty",
  keywords: [
    "panty",
    "panties",
    "underwear"
  ]
},

// ==========================
// BRA PANTY SET
// ==========================

{
  searchGroup: "bra panty set",
  keywords: [
    "bra panty set",
    "lingerie set"
  ]
},

// ==========================
// SHAWL
// ==========================

{
  searchGroup: "shawl",
  keywords: [
    "shawl",
    "wool shawl"
  ]
},

// ==========================
// SWEATER
// ==========================

{
  searchGroup: "women sweater",
  keywords: [
    "sweater",
    "cardigan",
    "wool sweater"
  ]
},

// ==========================
// JACKET
// ==========================

{
  searchGroup: "women jacket",
  keywords: [
    "jacket",
    "winter jacket"
  ]
},

// ==========================
// HANDBAG
// ==========================

{
  searchGroup: "handbag",
  keywords: [
    "handbag",
    "ladies bag"
  ]
},

// ==========================
// CLUTCH
// ==========================

{
  searchGroup: "clutch",
  keywords: [
    "clutch",
    "party clutch"
  ]
},

// ==========================
// PURSE
// ==========================

{
  searchGroup: "purse",
  keywords: [
    "purse",
    "wallet"
  ]
},
  {
    searchGroup: "mobile",

    keywords: [

      "mobile",

      "smartphone",

      "iphone",

      "galaxy",

      "samsung",

      "redmi",

      "realme",

      "vivo",

      "oppo",

      "oneplus",

      "motorola",

      "iqoo",

      "poco",

      "infinix",

      "tecno",

    ],

  },





  {
    searchGroup: "toothpaste",

    keywords: [

      "toothpaste",

      "tooth paste",

      "colgate",

      "closeup",

      "dabur red",

      "sensodyne",

      "pepsodent",

    ],

  },

];







// ======================================================
// NORMALIZE
// ======================================================

function normalize(text: string | null | undefined) {

  if (!text) return "";

  return text

    .toLowerCase()

    .replace(/[^\w\s]/g, " ")

    .replace(/\s+/g, " ")

    .trim();

}







// ======================================================
// FIND MATCH
// ======================================================

function findSearchGroup(text: string) {

  const value = normalize(text);

  for (const rule of RULES) {

    for (const keyword of rule.keywords) {

      if (value.includes(normalize(keyword))) {

        return {

          searchGroup: rule.searchGroup,

          searchKeywords: rule.keywords.join(","),

        };

      }

    }

  }

  return null;

}
// ======================================================
// MAIN
// ======================================================

async function run() {

  console.log("========================================");
  console.log("SEARCH GROUP MAPPING");
  console.log("========================================");

  console.log("");

  const products = await db.select().from(masterProducts);

  console.log("Total Master Products :", products.length);

  console.log("");



  let scanned = 0;

  let updated = 0;

  let alreadyFilled = 0;

  let skipped = 0;

  let unmatched = 0;



  const unmatchedProducts: any[] = [];



  for (const product of products) {

    scanned++;

    process.stdout.write(
      `\rScanning ${scanned}/${products.length}`
    );



    //--------------------------------------------------
    // FORCE UPDATE CHECK
    //--------------------------------------------------

    if (

      !FORCE_UPDATE &&

      product.search_group &&

      product.search_group.trim() !== ""

    ) {

      alreadyFilled++;

      continue;

    }



    //--------------------------------------------------
    // SEARCH TEXT
    //--------------------------------------------------

    const searchText = [

      product.name ?? "",

      product.brand ?? "",

      product.description ?? "",
      product.search_keywords ?? ""
    ].join(" ");



    //--------------------------------------------------
    // FIND MATCH
    //--------------------------------------------------

    const result = findSearchGroup(searchText);



    if (!result) {

      unmatched++;

      unmatchedProducts.push({

        id: product.id,

        name: product.name,

        brand: product.brand,

      });

      continue;

    }

//--------------------------------------------------
// DRY RUN
//--------------------------------------------------

if (DRY_RUN) {

  console.log("");

  console.log(

    `[DRY RUN] ${product.id} -> ${result.searchGroup}`

  );

  updated++;

  continue;

}



//--------------------------------------------------
// DATABASE UPDATE
//--------------------------------------------------

await db

.update(masterProducts)

.set({

  search_group: result.searchGroup,

  search_keywords: result.searchKeywords,

})

.where(

  eq(masterProducts.id, product.id)

);

updated++;

    
  }



  console.log("");

  console.log("");



  console.log("========================================");

  console.log("SUMMARY");

  console.log("========================================");



  console.log("Scanned        :", scanned);

  console.log("Matched        :", updated);

  console.log("Already Filled :", alreadyFilled);

  console.log("Unmatched      :", unmatched);

  console.log("");



  console.log("========================================");

  console.log("FIRST UNMATCHED PRODUCTS");

  console.log("========================================");



  unmatchedProducts

    .slice(0, MAX_UNMATCHED_TO_PRINT)

    .forEach((p) => {

      console.log(

        `${p.id} | ${p.name} | ${p.brand ?? ""}`

      );

    });

}



run()

.then(() => {

  console.log("");

  console.log("Done");

  process.exit(0);

})

.catch((err) => {

  console.error(err);

  process.exit(1);

});
// ======================================================
// REMAINING PRODUCTS
// ======================================================

const remainingProducts = await db
  .select({
    id: masterProducts.id,
    name: masterProducts.name,
    brand: masterProducts.brand,
    categoryId: masterProducts.categoryId,
    subCategoryId: masterProducts.subCategoryId,
  })
  .from(masterProducts)
  .where(isNull(masterProducts.search_group));



console.log("");
console.log("========================================");
console.log("REMAINING PRODUCTS");
console.log("========================================");

console.log("");

console.log("Still Missing :", remainingProducts.length);

console.log("");



if (remainingProducts.length > 0) {

  console.log("First", MAX_UNMATCHED_TO_PRINT, "Products");

  console.log("");

  remainingProducts

    .slice(0, MAX_UNMATCHED_TO_PRINT)

    .forEach((p, index) => {

      console.log(

        `${index + 1}. ID=${p.id} | ${p.name} | ${p.brand ?? ""}`

      );

    });

}