import "dotenv/config";

import { db } from "../server/db";

import {
  masterProducts,
  productSubcategories,
  categorySubcategories,
} from "../shared/backend/schema";

import {
  eq,
  and,
} from "drizzle-orm";
type Rule = {

  categoryId?: number;

  subCategoryId: number;

  priority: number;

  keywords: string[];

  exclude?: string[];

};
function normalize(text: string) {

  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}
// =====================================================
// SUBCATEGORY RULES
// =====================================================

const RULES: Rule[] = [

  // ===================================================
  // CHOCOLATES & CANDIES
  // ===================================================

  {
    categoryId: 2,
    subCategoryId: 14,
    priority: 100,

    keywords: [
      "kitkat",
      "kit kat",
      "cadbury",
      "dairy milk",
      "5 star",
      "five star",
      "munch",
      "perk",
      "fuse",
      "snickers",
      "mars",
      "bounty",
      "hershey",
      "gems",
      "eclairs",
      "melody",
      "chocolate",
      "candy",
      "toffee"
    ],

    exclude: [
      "shake",
      "pizza",
      "burger",
      "ice cream",
      "cake"
    ]
  },

  // ===================================================
  // BISCUITS & COOKIES
  // ===================================================

  {
    categoryId: 2,
    subCategoryId: 10,
    priority: 100,

    keywords: [
      "biscuit",
      "biscuits",
      "cookie",
      "cookies",

      "parle",
      "parle g",
      "good day",
      "oreo",
      "tiger",
      "bourbon",
      "hide and seek",
      "dark fantasy",
      "happy happy",
      "monaco",
      "krackjack",
      "sunfeast"
    ]
  },

  // ===================================================
  // OIL & GHEE
  // ===================================================

  {
    categoryId: 2,
    subCategoryId: 3,
    priority: 95,

    keywords: [
      "ghee",
      "oil",
      "mustard oil",
      "refined oil",
      "sunflower oil",
      "soyabean oil",
      "fortune oil",
      "dhara oil"
    ]
  },

  // ===================================================
  // SPICES
  // ===================================================

  {
    categoryId: 2,
    subCategoryId: 5,
    priority: 95,

    keywords: [
      "masala",
      "spice",
      "kitchen king",
      "garam masala",
      "turmeric",
      "haldi",
      "red chilli",
      "mirch",
      "coriander",
      "dhania",
      "jeera",
      "cumin",

      "mdh",
      "everest",
      "catch"
    ]
  },

  // ===================================================
  // DAIRY
  // ===================================================

  {
    categoryId: 2,
    subCategoryId: 24,
    priority: 90,

    keywords: [
      "milk",
      "paneer",
      "curd",
      "dahi",
      "lassi",
      "chaach",
      "butter",
      "cheese",

      "mother dairy",
      "amul",
      "saras"
    ]
  },
  // ===================================================
// GENERIC GROCERY RULES (LOW PRIORITY)
// ===================================================

{
  categoryId: 2,
  subCategoryId: 24,
  priority: 40,

  keywords: [
    "amul",
    "mother dairy",
    "saras",
    "verka",
    "nandini",
    "milk",
    "paneer",
    "curd",
    "dahi",
    "lassi",
    "chaach",
    "cheese",
    "butter",
    "cream",
    "whitener"
  ]
},

{
  categoryId: 2,
  subCategoryId: 14,
  priority: 35,

  keywords: [
    "cadbury",
    "nestle",
    "mars",
    "hershey",
    "ferrero",
    "choco",
    "cocoa"
  ]
},

{
  categoryId: 2,
  subCategoryId: 10,
  priority: 35,

  keywords: [
    "parle",
    "britannia",
    "sunfeast",
    "biscuit",
    "cookie"
  ]
},

{
  categoryId: 2,
  subCategoryId: 7,
  priority: 30,

  keywords: [
    "tea",
    "coffee",
    "nescafe",
    "bru"
  ]
},

{
  categoryId: 2,
  subCategoryId: 8,
  priority: 30,

  keywords: [
    "horlicks",
    "boost",
    "bournvita",
    "complan",
    "pediasure"
  ]
},

{
  categoryId: 2,
  subCategoryId: 3,
  priority: 30,

  keywords: [
    "fortune",
    "dhara",
    "saffola",
    "gemini",
    "ghee",
    "oil"
  ]
},

{
  categoryId: 2,
  subCategoryId: 5,
  priority: 30,

  keywords: [
    "mdh",
    "everest",
    "catch",
    "masala"
  ]
},

{
  categoryId: 2,
  subCategoryId: 13,
  priority: 30,

  keywords: [
    "real",
    "tropicana",
    "maaza",
    "frooti",
    "slice",
    "juice"
  ]
},

// ===================================================
// BEAUTY FALLBACK
// ===================================================

{
  categoryId: 8,
  subCategoryId: 52,
  priority: 20,

  keywords: [
    "soap",
    "body wash"
  ]
},

{
  categoryId: 8,
  subCategoryId: 53,
  priority: 20,

  keywords: [
    "shampoo"
  ]
},

{
  categoryId: 8,
  subCategoryId: 51,
  priority: 20,

  keywords: [
    "toothpaste",
    "toothbrush"
  ]
},

// ===================================================
// BABY FALLBACK
// ===================================================

{
  categoryId: 9,
  subCategoryId: 70,
  priority: 15,

  keywords: [
    "toy",
    "game",
    "doll"
  ]
},
// ===================================================
// DETERGENT & LAUNDRY
// ===================================================

{
  categoryId: 18,
  subCategoryId: 91,
  priority: 95,

  keywords: [
    "surf",
    "surf excel",
    "ariel",
    "tide",
    "rin",
    "wheel",
    "ghadi",
    "detergent",
    "washing powder",
    "liquid detergent",
    "comfort"
  ]
},

// ===================================================
// DISHWASH
// ===================================================

{
  categoryId: 18,
  subCategoryId: 92,
  priority: 95,

  keywords: [
    "vim",
    "pril",
    "dishwash",
    "dish wash",
    "dish cleaner",
    "scrub pad",
    "scotch brite",
    "steel scrubber"
  ]
},

// ===================================================
// FLOOR CLEANER
// ===================================================

{
  categoryId: 18,
  subCategoryId: 93,
  priority: 95,

  keywords: [
    "lizol",
    "floor cleaner",
    "phenyl",
    "harpic",
    "toilet cleaner",
    "domex"
  ]
},

// ===================================================
// MOSQUITO REPELLENT
// ===================================================

{
  categoryId: 18,
  subCategoryId: 94,
  priority: 95,

  keywords: [
    "good knight",
    "goodknight",
    "all out",
    "allout",
    "mortein",
    "mosquito",
    "coil",
    "liquid vaporizer"
  ]
},

// ===================================================
// TISSUE & PAPER
// ===================================================

{
  categoryId: 18,
  subCategoryId: 95,
  priority: 95,

  keywords: [
    "tissue",
    "paper napkin",
    "toilet paper",
    "kitchen towel",
    "napkin"
  ]
},

// ===================================================
// STATIONERY
// ===================================================

{
  categoryId: 21,
  subCategoryId: 96,
  priority: 95,

  keywords: [
    "pen",
    "pencil",
    "eraser",
    "sharpener",
    "notebook",
    "register",
    "copy",
    "marker",
    "highlighter",
    "geometry box",
    "scale",
    "stapler",
    "file folder"
  ]
},

// ===================================================
// SPORTS
// ===================================================

{
  categoryId: 23,
  subCategoryId: 97,
  priority: 95,

  keywords: [
    "cricket",
    "bat",
    "ball",
    "football",
    "badminton",
    "racket",
    "shuttle",
    "volleyball",
    "dumbbell",
    "yoga mat",
    "treadmill"
  ]
},

// ===================================================
// PET CARE
// ===================================================

{
  categoryId: 24,
  subCategoryId: 98,
  priority: 95,

  keywords: [
    "dog food",
    "cat food",
    "pedigree",
    "whiskas",
    "pet shampoo",
    "pet bowl",
    "pet leash"
  ]
},

// ===================================================
// MEN FASHION
// ===================================================

{
  categoryId: 14,
  subCategoryId: 99,
  priority: 95,

  keywords: [
    "shirt",
    "t shirt",
    "jeans",
    "pant",
    "trouser",
    "kurta",
    "jacket",
    "hoodie",
    "track pant"
  ]
},

// ===================================================
// WOMEN FASHION
// ===================================================

{
  categoryId: 13,
  subCategoryId: 100,
  priority: 95,

  keywords: [
    "saree",
    "kurti",
    "lehenga",
    "salwar",
    "dupatta",
    "top",
    "gown",
    "leggings",
    "bra",
    "nighty"
  ]
},

// ===================================================
// FOOTWEAR
// ===================================================

{
  categoryId: 15,
  subCategoryId: 101,
  priority: 95,

  keywords: [
    "shoe",
    "shoes",
    "slipper",
    "sandal",
    "heels",
    "loafer",
    "sports shoe",
    "flip flop"
  ]
},
// ===================================================
// MOBILE PHONES
// ===================================================

{
  categoryId: 10,
  subCategoryId: 81,
  priority: 95,

  keywords: [
    "mobile",
    "smartphone",
    "iphone",
    "samsung",
    "realme",
    "redmi",
    "xiaomi",
    "oppo",
    "vivo",
    "oneplus",
    "motorola",
    "nokia"
  ]
},

// ===================================================
// MOBILE ACCESSORIES
// ===================================================

{
  categoryId: 10,
  subCategoryId: 82,
  priority: 95,

  keywords: [
    "charger",
    "usb cable",
    "type c",
    "earphone",
    "headphone",
    "neckband",
    "bluetooth",
    "power bank",
    "mobile cover",
    "case",
    "tempered glass",
    "screen guard"
  ]
},

// ===================================================
// COMPUTER ACCESSORIES
// ===================================================

{
  categoryId: 11,
  subCategoryId: 83,
  priority: 95,

  keywords: [
    "keyboard",
    "mouse",
    "pendrive",
    "usb drive",
    "hard disk",
    "ssd",
    "monitor",
    "printer",
    "webcam",
    "router",
    "wifi",
    "laptop bag"
  ]
},

// ===================================================
// ELECTRICAL ITEMS
// ===================================================

{
  categoryId: 19,
  subCategoryId: 84,
  priority: 95,

  keywords: [
    "led bulb",
    "bulb",
    "tube light",
    "switch",
    "socket",
    "wire",
    "cable",
    "extension board",
    "holder",
    "fan regulator"
  ]
},

// ===================================================
// HARDWARE
// ===================================================

{
  categoryId: 19,
  subCategoryId: 85,
  priority: 95,

  keywords: [
    "hammer",
    "plier",
    "spanner",
    "wrench",
    "drill",
    "screwdriver",
    "nail",
    "bolt",
    "nut",
    "tape",
    "lock"
  ]
},

// ===================================================
// AUTO CARE
// ===================================================

{
  categoryId: 22,
  subCategoryId: 86,
  priority: 95,

  keywords: [
    "engine oil",
    "bike oil",
    "car oil",
    "helmet",
    "car shampoo",
    "tyre polish",
    "chain lube",
    "air freshener",
    "car perfume",
    "microfiber cloth"
  ]
},

// ===================================================
// BATTERIES
// ===================================================

{
  categoryId: 12,
  subCategoryId: 87,
  priority: 95,

  keywords: [
    "battery",
    "aa battery",
    "aaa battery",
    "duracell",
    "eveready",
    "cell"
  ]
},

// ===================================================
// LIGHTING
// ===================================================

{
  categoryId: 12,
  subCategoryId: 88,
  priority: 95,

  keywords: [
    "torch",
    "emergency light",
    "lamp",
    "led light",
    "night lamp"
  ]
},

// ===================================================
// SMALL APPLIANCES
// ===================================================

{
  categoryId: 12,
  subCategoryId: 89,
  priority: 95,

  keywords: [
    "fan",
    "heater",
    "room heater",
    "cooler",
    "table fan",
    "ceiling fan"
  ]
},

// ===================================================
// TV & AUDIO
// ===================================================

{
  categoryId: 12,
  subCategoryId: 90,
  priority: 95,

  keywords: [
    "tv",
    "television",
    "speaker",
    "soundbar",
    "home theatre",
    "remote"
  ]
},
// ===================================================
// WATER BOTTLES & FLASKS
// ===================================================

{
  categoryId: 17,
  subCategoryId: 71,
  priority: 95,

  keywords: [
    "water bottle",
    "bottle",
    "milton",
    "cello",
    "thermosteel",
    "flask",
    "vacuum flask",
    "steel bottle"
  ]
},

// ===================================================
// ELECTRIC KETTLE
// ===================================================

{
  categoryId: 17,
  subCategoryId: 72,
  priority: 95,

  keywords: [
    "electric kettle",
    "kettle",
    "pigeon kettle",
    "havells kettle",
    "prestige kettle"
  ]
},

// ===================================================
// MIXER / BLENDER
// ===================================================

{
  categoryId: 17,
  subCategoryId: 73,
  priority: 95,

  keywords: [
    "mixer",
    "mixer grinder",
    "grinder",
    "blend",
    "blender",
    "nutri blend",
    "nutriblend",
    "wonderchef"
  ]
},

// ===================================================
// WATER PURIFIER
// ===================================================

{
  categoryId: 17,
  subCategoryId: 74,
  priority: 95,

  keywords: [
    "water purifier",
    "purifier",
    "ro purifier",
    "kent",
    "aquaguard",
    "livpure"
  ]
},

// ===================================================
// PRESS / IRON
// ===================================================

{
  categoryId: 16,
  subCategoryId: 75,
  priority: 95,

  keywords: [
    "iron",
    "dry iron",
    "steam iron",
    "philips iron",
    "bajaj iron",
    "press"
  ]
},

// ===================================================
// INDUCTION COOKTOP
// ===================================================

{
  categoryId: 16,
  subCategoryId: 76,
  priority: 95,

  keywords: [
    "induction",
    "induction cooktop",
    "cooktop",
    "philips induction",
    "prestige induction"
  ]
},

// ===================================================
// PRESSURE COOKER
// ===================================================

{
  categoryId: 17,
  subCategoryId: 77,
  priority: 95,

  keywords: [
    "pressure cooker",
    "cooker",
    "hawkins",
    "prestige cooker",
    "pigeon cooker"
  ]
},

// ===================================================
// GAS STOVE
// ===================================================

{
  categoryId: 17,
  subCategoryId: 78,
  priority: 95,

  keywords: [
    "gas stove",
    "stove",
    "burner",
    "prestige stove",
    "sunflame"
  ]
},

// ===================================================
// COOKWARE
// ===================================================

{
  categoryId: 17,
  subCategoryId: 79,
  priority: 95,

  keywords: [
    "kadai",
    "frying pan",
    "tawa",
    "cookware",
    "non stick",
    "nonstick",
    "pan"
  ]
},

// ===================================================
// DINNERWARE & UTENSILS
// ===================================================

{
  categoryId: 17,
  subCategoryId: 80,
  priority: 95,

  keywords: [
    "plate",
    "glass",
    "cup",
    "mug",
    "spoon",
    "fork",
    "knife",
    "utensil",
    "dinner set",
    "bowl"
  ]
},
// ===================================================
// BABY FOOD
// ===================================================

{
  categoryId: 9,
  subCategoryId: 61,
  priority: 95,

  keywords: [
    "cerelac",
    "farex",
    "nestle cerelac",
    "baby cereal",
    "infant cereal",
    "baby food"
  ]
},

// ===================================================
// DIAPERS
// ===================================================

{
  categoryId: 9,
  subCategoryId: 62,
  priority: 95,

  keywords: [
    "pampers",
    "mamypoko",
    "mamy poko",
    "huggies",
    "diaper",
    "diapers",
    "pants diaper"
  ]
},

// ===================================================
// BABY WIPES
// ===================================================

{
  categoryId: 9,
  subCategoryId: 63,
  priority: 95,

  keywords: [
    "baby wipes",
    "wipes",
    "little's wipes",
    "mee mee wipes",
    "johnson wipes"
  ]
},

// ===================================================
// BABY SOAP
// ===================================================

{
  categoryId: 9,
  subCategoryId: 64,
  priority: 95,

  keywords: [
    "baby soap",
    "johnson soap",
    "mee mee soap",
    "himalaya baby soap",
    "sebamed baby soap"
  ]
},

// ===================================================
// BABY OIL
// ===================================================

{
  categoryId: 9,
  subCategoryId: 65,
  priority: 95,

  keywords: [
    "baby oil",
    "johnson oil",
    "mee mee oil",
    "himalaya baby oil"
  ]
},

// ===================================================
// BABY POWDER
// ===================================================

{
  categoryId: 9,
  subCategoryId: 66,
  priority: 95,

  keywords: [
    "baby powder",
    "johnson powder",
    "mee mee powder",
    "himalaya baby powder"
  ]
},

// ===================================================
// BABY LOTION
// ===================================================

{
  categoryId: 9,
  subCategoryId: 67,
  priority: 95,

  keywords: [
    "baby lotion",
    "johnson lotion",
    "mee mee lotion",
    "himalaya baby lotion"
  ]
},

// ===================================================
// BABY CLOTHES
// ===================================================

{
  categoryId: 9,
  subCategoryId: 68,
  priority: 95,

  keywords: [
    "baby clothes",
    "baby dress",
    "baby frock",
    "baby t shirt",
    "firstcry"
  ]
},

// ===================================================
// STROLLER / WALKER
// ===================================================

{
  categoryId: 9,
  subCategoryId: 69,
  priority: 95,

  keywords: [
    "stroller",
    "walker",
    "pram",
    "baby walker",
    "baby stroller",
    "luvlap",
    "r for rabbit"
  ]
},

// ===================================================
// TOYS
// ===================================================

{
  categoryId: 9,
  subCategoryId: 70,
  priority: 95,

  keywords: [
    "barbie",
    "lego",
    "toy",
    "toys",
    "teddy",
    "soft toy",
    "doll",
    "keyboard",
    "casio keyboard",
    "uno",
    "board game",
    "car toy",
    "remote car",
    "puzzle"
  ]
},
// ===================================================
// TOOTHPASTE & ORAL CARE
// ===================================================

{
  categoryId: 8,
  subCategoryId: 51,
  priority: 95,

  keywords: [
    "colgate",
    "closeup",
    "sensodyne",
    "pepsodent",
    "dabur red",
    "oral b",
    "toothpaste",
    "tooth brush",
    "toothbrush",
    "mouthwash"
  ]
},

// ===================================================
// BATH SOAP
// ===================================================

{
  categoryId: 8,
  subCategoryId: 52,
  priority: 95,

  keywords: [
    "lux",
    "lifebuoy",
    "dove",
    "hamam",
    "pears",
    "cinthol",
    "dettol soap",
    "medimix",
    "soap",
    "bathing bar"
  ]
},

// ===================================================
// SHAMPOO
// ===================================================

{
  categoryId: 8,
  subCategoryId: 53,
  priority: 95,

  keywords: [
    "shampoo",
    "clinic plus",
    "sunsilk",
    "pantene",
    "head & shoulders",
    "head and shoulders",
    "tresemme",
    "loreal shampoo",
    "dove shampoo",
    "indulekha"
  ]
},

// ===================================================
// HAIR OIL
// ===================================================

{
  categoryId: 8,
  subCategoryId: 54,
  priority: 95,

  keywords: [
    "hair oil",
    "parachute",
    "navratna",
    "bajaj almond",
    "indulekha oil",
    "coconut oil",
    "amla oil"
  ]
},

// ===================================================
// FACE WASH
// ===================================================

{
  categoryId: 8,
  subCategoryId: 55,
  priority: 95,

  keywords: [
    "face wash",
    "clean & clear",
    "clean and clear",
    "himalaya face wash",
    "ponds face wash",
    "garnier face wash",
    "pond's face wash"
  ]
},

// ===================================================
// FACE CREAM
// ===================================================

{
  categoryId: 8,
  subCategoryId: 56,
  priority: 95,

  keywords: [
    "fair & lovely",
    "fair and lovely",
    "glow & lovely",
    "glow and lovely",
    "ponds cream",
    "pond's cream",
    "nivea cream",
    "boroplus",
    "face cream"
  ]
},

// ===================================================
// BODY LOTION
// ===================================================

{
  categoryId: 8,
  subCategoryId: 57,
  priority: 95,

  keywords: [
    "body lotion",
    "vaseline lotion",
    "nivea lotion",
    "ponds lotion",
    "boroline",
    "moisturizer"
  ]
},

// ===================================================
// DEODORANT & PERFUME
// ===================================================

{
  categoryId: 8,
  subCategoryId: 58,
  priority: 95,

  keywords: [
    "deo",
    "deodorant",
    "perfume",
    "body spray",
    "fogg",
    "wild stone",
    "axe",
    "engage",
    "nivea deo"
  ]
},

// ===================================================
// SHAVING
// ===================================================

{
  categoryId: 8,
  subCategoryId: 59,
  priority: 95,

  keywords: [
    "gillette",
    "razor",
    "blade",
    "shaving",
    "after shave",
    "shaving foam",
    "shaving cream"
  ]
},

// ===================================================
// TALCUM POWDER
// ===================================================

{
  categoryId: 8,
  subCategoryId: 60,
  priority: 95,

  keywords: [
    "powder",
    "ponds powder",
    "pond's powder",
    "nycil",
    "prickly heat"
  ]
},
// ===================================================
// FLOUR, RICE & GRAINS
// ===================================================

{
  categoryId: 2,
  subCategoryId: 1,
  priority: 90,

  keywords: [
    "atta","aashirvaad","chakki","flour",
    "rice","basmati","sona masoori",
    "wheat","maida","besan","sooji","suji",
    "rava","poha","dalia","millet","jowar",
    "bajra","makka","oats"
  ]
},

// ===================================================
// PULSES
// ===================================================

{
  categoryId: 2,
  subCategoryId: 2,
  priority: 90,

  keywords: [
    "dal","lentil","moong","masoor",
    "urad","arhar","toor","chana dal",
    "rajma","kabuli","chole","lobia"
  ]
},

// ===================================================
// DRY FRUITS
// ===================================================

{
  categoryId: 2,
  subCategoryId: 4,
  priority: 90,

  keywords: [
    "almond","badam",
    "cashew","kaju",
    "pista","pistachio",
    "raisin","kishmish",
    "akhrot","walnut",
    "fig","anjeer",
    "dates","khajoor"
  ]
},

// ===================================================
// SALT & SUGAR
// ===================================================

{
  categoryId: 2,
  subCategoryId: 6,
  priority: 90,

  keywords: [
    "salt","namak",
    "sugar","chini",
    "jaggery","gud",
    "rock salt","sendha"
  ]
},

// ===================================================
// TEA & COFFEE
// ===================================================

{
  categoryId: 2,
  subCategoryId: 7,
  priority: 90,

  keywords: [
    "tea","chai",
    "coffee",
    "nescafe",
    "bru",
    "taj mahal",
    "red label",
    "wagh bakri",
    "green tea"
  ]
},

// ===================================================
// HEALTH DRINKS
// ===================================================

{
  categoryId: 2,
  subCategoryId: 8,
  priority: 90,

  keywords: [
    "horlicks",
    "bournvita",
    "boost",
    "complan",
    "protein powder",
    "pediasure"
  ]
},

// ===================================================
// NOODLES & PASTA
// ===================================================

{
  categoryId: 2,
  subCategoryId: 9,
  priority: 90,

  keywords: [
    "maggi",
    "noodle",
    "noodles",
    "pasta",
    "macaroni",
    "vermicelli"
  ]
},

// ===================================================
// PICKLE & SAUCE
// ===================================================

{
  categoryId: 2,
  subCategoryId: 11,
  priority: 90,

  keywords: [
    "pickle",
    "achar",
    "ketchup",
    "tomato sauce",
    "schezwan",
    "chilli sauce",
    "mayonnaise",
    "mayo"
  ]
},

// ===================================================
// JAM & SPREAD
// ===================================================

{
  categoryId: 2,
  subCategoryId: 12,
  priority: 90,

  keywords: [
    "jam",
    "peanut butter",
    "nutella",
    "spread",
    "honey"
  ]
},

// ===================================================
// JUICES
// ===================================================

{
  categoryId: 2,
  subCategoryId: 13,
  priority: 90,

  keywords: [
    "juice",
    "real",
    "tropicana",
    "maaza",
    "frooti",
    "slice",
    "appy"
  ]
},
{
  categoryId: 2,
  subCategoryId: 18, // Cleaning & Household

  priority: 95,

  keywords: [
    "lizol",
    "harpic",
    "domex",
    "wheel",
    "surf",
    "rin",
    "tide",
    "ariel",
    "comfort",
    "scotch brite",
    "scotchbrite",
    "vim",
    "pril",
    "floor cleaner",
    "glass cleaner",
    "toilet cleaner",
    "detergent",
    "washing powder",
    "dishwash",
    "fabric conditioner",
    "bucket mop",
    "mop"
  ]
},
{
  categoryId: 2,
  subCategoryId: 19, // Pest Control

  priority: 96,

  keywords: [
    "mortein",
    "good knight",
    "goodknight",
    "all out",
    "hit",
    "mosquito",
    "cockroach",
    "insect killer",
    "repellent",
    "liquid vaporizer",
    "coil",
    "mat refill"
  ]
},
// ===================================================
// TOOTHPASTE / ORAL CARE
// ===================================================

{
  categoryId: 2,
  subCategoryId: 11,
  priority: 96,

  keywords: [
    "colgate",
    "closeup",
    "close up",
    "sensodyne",
    "pepsodent",
    "dabur red",
    "meswak",
    "toothpaste",
    "tooth brush",
    "toothbrush",
    "mouthwash"
  ]
},

// ===================================================
// BODY LOTION / CREAM
// ===================================================

{
  categoryId: 2,
  subCategoryId: 12,
  priority: 96,

  keywords: [
    "vaseline",
    "nivea",
    "ponds",
    "boroline",
    "boroplus",
    "body lotion",
    "cold cream",
    "moisturizer",
    "cream"
  ]
},

// ===================================================
// SOYA / HEALTH FOOD
// ===================================================

{
  categoryId: 2,
  subCategoryId: 9,
  priority: 90,

  keywords: [
    "soya",
    "soyabean",
    "soya chunks",
    "nutrela",
    "protein"
  ]
},

// ===================================================
// BABY PRODUCTS
// ===================================================

{
  categoryId: 8,
  subCategoryId: 66,
  priority: 96,

  keywords: [
    "pampers",
    "mamypoko",
    "mamy poko",
    "cerelac",
    "farex",
    "baby wipes",
    "little's",
    "johnson baby",
    "baby powder",
    "baby lotion",
    "baby shampoo"
  ]
},
// ===================================================
// KITCHEN STORAGE
// ===================================================

{
  categoryId: 17,
  subCategoryId: 80,
  priority: 90,

  keywords: [
    "lunch box",
    "tiffin",
    "container",
    "storage box",
    "signoraware",
    "milton lunch"
  ]
},

// ===================================================
// ELECTRICAL
// ===================================================

{
  categoryId: 16,
  subCategoryId: 88,
  priority: 90,

  keywords: [
    "eveready",
    "led bulb",
    "bulb",
    "battery",
    "duracell"
  ]
},
// ===================================================
// BABY CARE
// ===================================================

{
  categoryId: 9,
  subCategoryId: 46,
  priority: 100,

  keywords: [
    "baby wipes",
    "wipes",
    "nail clipper",
    "baby powder",
    "baby soap",
    "baby shampoo",
    "baby lotion",
    "baby oil",
    "baby cream",
    "johnson",
    "mee mee",
    "little's",
    "himalaya baby"
  ]
},

// ===================================================
// BABY TOYS
// ===================================================

{
  categoryId: 9,
  subCategoryId: 47,
  priority: 100,

  keywords: [
    "toy",
    "teddy",
    "rock-a-stack",
    "fisher",
    "lego",
    "barbie",
    "keyboard",
    "uno",
    "doll"
  ]
},

// ===================================================
// CLEANING
// ===================================================

{
  categoryId: 18,
  subCategoryId: 66,
  priority: 100,

  keywords: [
    "broom",
    "jhadu",
    "झाड़ू",
    "mop",
    "spotzero",
    "gala",
    "harpic",
    "lizol",
    "phenyl",
    "toilet cleaner"
  ]
},

// ===================================================
// HOME DECOR
// ===================================================

{
  categoryId: 16,
  subCategoryId: 61,
  priority: 100,

  keywords: [
    "wall clock",
    "wind chime",
    "table lamp",
    "laughing buddha",
    "showpiece",
    "flower vase",
    "photo frame",
    "clock"
  ]
},

// ===================================================
// GIFT ITEMS
// ===================================================

{
  categoryId: 21,
  subCategoryId: 82,
  priority: 100,

  keywords: [
    "gift",
    "gift pack",
    "photo frame",
    "mug",
    "jewelry box",
    "celebration",
    "ferrero",
    "cadbury celebration"
  ]
},
// ===================================================
// RESTAURANT MAIN COURSE
// ===================================================

{
  categoryId: 7,
  subCategoryId: 34,
  priority: 100,

  keywords: [
    "biryani",
    "fried rice",
    "rice",
    "pulao",
    "jeera rice",
    "chole bhature",
    "pav bhaji",
    "manchurian",
    "noodle",
    "hakka",
    "pasta"
  ]
},

// ===================================================
// RESTAURANT STARTERS
// ===================================================

{
  categoryId: 7,
  subCategoryId: 35,
  priority: 100,

  keywords: [
    "crispy",
    "soup",
    "garlic bread",
    "corn",
    "starter"
  ]
},

// ===================================================
// RESTAURANT DESSERT
// ===================================================

{
  categoryId: 7,
  subCategoryId: 36,
  priority: 100,

  keywords: [
    "brownie",
    "gulab jamun",
    "ice cream",
    "dessert",
    "cake"
  ]
},

// ===================================================
// MINERAL WATER
// ===================================================

{
  categoryId: 7,
  subCategoryId: 41,
  priority: 120,

  keywords: [
    "bisleri",
    "mineral water",
    "water bottle",
    "aquafina",
    "kinley"
  ]
},

// ===================================================
// JUICE
// ===================================================

{
  categoryId: 7,
  subCategoryId: 40,
  priority: 120,

  keywords: [
    "real",
    "paper boat",
    "juice",
    "orange juicy",
    "guava",
    "litchi",
    "pomegranate"
  ]
},
// ===================================================
// HOME DECOR & FURNITURE
// ===================================================

{
  categoryId: 16,
  subCategoryId: 61,
  priority: 110,

  keywords: [
    "pillow",
    "comforter",
    "bedsheet",
    "curtain",
    "wall hanging",
    "dream catcher",
    "bonsai",
    "artificial plant",
    "air freshener",
    "odonil",
    "godrej aer",
    "diffuser",
    "lamp",
    "clock"
  ]
},

// ===================================================
// HOME APPLIANCES
// ===================================================

{
  categoryId: 16,
  subCategoryId: 62,
  priority: 110,

  keywords: [
    "mixer",
    "grinder",
    "extension board",
    "extension spike",
    "syska",
    "plug",
    "switch"
  ]
},

// ===================================================
// KITCHEN APPLIANCES
// ===================================================

{
  categoryId: 17,
  subCategoryId: 69,
  priority: 110,

  keywords: [
    "sandwich maker",
    "otg",
    "oven",
    "hair dryer",
    "mixer grinder",
    "electric kettle",
    "induction",
    "blender"
  ]
},

// ===================================================
// FOOTWEAR
// ===================================================

{
  categoryId: 15,
  subCategoryId: 57,
  priority: 110,

  keywords: [
    "crocs",
    "clogs",
    "slipper",
    "slider",
    "mojari",
    "kolhapuri",
    "shoe",
    "sandal",
    "wedge",
    "reebok",
    "paragon",
    "metro",
    "mochi"
  ]
},

// ===================================================
// SPORTS
// ===================================================

{
  categoryId: 23,
  subCategoryId: 99,
  priority: 110,

  keywords: [
    "skipping rope",
    "gripper",
    "dumbbell",
    "yoga",
    "football",
    "cricket",
    "bat",
    "fitness"
  ]
},

// ===================================================
// STATIONERY
// ===================================================

{
  categoryId: 21,
  subCategoryId: 84,
  priority: 110,

  keywords: [
    "calculator",
    "copier paper",
    "paper",
    "fevicol",
    "fevistik",
    "oil pastel",
    "camel",
    "glue",
    "stationery"
  ]
},

// ===================================================
// HARDWARE
// ===================================================

{
  categoryId: 19,
  subCategoryId: 92,
  priority: 110,

  keywords: [
    "wd-40",
    "rust remover",
    "multi plug",
    "adapter",
    "adaptor",
    "electrical"
  ]
},
// ===================================================
// CLEANING & HOUSEHOLD
// ===================================================

{
  categoryId: 16,
  subCategoryId: 63,
  priority: 120,

  keywords: [
    "broom",
    "jhadu",
    "झाड़ू",
    "mop",
    "spotzero",
    "gala",
    "bucket",
    "cleaning"
  ]
},

// ===================================================
// BEAUTY & PERSONAL CARE
// ===================================================

{
  categoryId: 8,
  subCategoryId: 45,
  priority: 120,

  keywords: [
    "kajal",
    "mascara",
    "micellar",
    "cleanser",
    "serum",
    "lakme",
    "maybelline",
    "loreal",
    "l'oreal",
    "garnier",
    "cetaphil",
    "talc",
    "pond's",
    "hair gel",
    "set wet"
  ]
},

// ===================================================
// BABY CARE
// ===================================================

{
  categoryId: 8,
  subCategoryId: 49,
  priority: 120,

  keywords: [
    "huggies",
    "johnson",
    "feeding bottle",
    "avent",
    "baby bottle",
    "baby"
  ]
},

// ===================================================
// TOYS
// ===================================================

{
  categoryId: 9,
  subCategoryId: 54,
  priority: 120,

  keywords: [
    "hot wheels",
    "remote control",
    "racing car",
    "teether",
    "sipper bottle"
  ]
},

// ===================================================
// MOBILE & ACCESSORIES
// ===================================================

{
  categoryId: 10,
  subCategoryId: 73,
  priority: 120,

  keywords: [
    "mouse",
    "router",
    "tripod",
    "camera",
    "airtag",
    "boat",
    "airdopes",
    "smart watch",
    "colorfit",
    "noise",
    "laptop bag"
  ]
},

{
  categoryId: 10,
  subCategoryId: 72,
  priority: 120,

  keywords: [
    "moto",
    "iphone",
    "samsung",
    "redmi",
    "realme",
    "oneplus",
    "pixel",
    "phone"
  ]
},

// ===================================================
// ELECTRONICS
// ===================================================

{
  categoryId: 12,
  subCategoryId: 77,
  priority: 120,

  keywords: [
    "echo dot",
    "nest mini",
    "smart bulb",
    "led bulb"
  ]
},
// ===================================================
// GIFTS
// ===================================================

{
  categoryId: 21,
  subCategoryId: 83,
  priority: 100,

  keywords: [
    "greeting card",
    "archies",
    "gift card",
    "gift",
    "teddy",
    "soft teddy",
    "bouquet",
    "wallet",
    "belt set",
    "perfume gift",
    "party speaker",
    "watch",
    "pocket watch",
    "board game",
    "jigsaw",
    "miniature car",
    "pooja thali",
    "candle",
    "scented candle"
  ]
},

// ===================================================
// AIR FRESHENER
// ===================================================

{
  categoryId: 16,
  subCategoryId: 60,
  priority: 100,

  keywords: [
    "odonil",
    "godrej aer",
    "air freshener",
    "room freshener",
    "diffuser"
  ]
},

// ===================================================
// CLEANING TOOLS
// ===================================================

{
  categoryId: 16,
  subCategoryId: 58,
  priority: 100,

  keywords: [
    "broom",
    "jhadu",
    "झाड़ू",
    "mop",
    "bucket mop",
    "spotzero",
    "gala"
  ]
},

// ===================================================
// BEDDING
// ===================================================

{
  categoryId: 16,
  subCategoryId: 64,
  priority: 100,

  keywords: [
    "pillow",
    "comforter",
    "bedsheet",
    "bed sheet",
    "blanket",
    "quilt",
    "kurl-on",
    "bombay dyeing"
  ]
},

// ===================================================
// FOOTWEAR SPORTS
// ===================================================

{
  categoryId: 15,
  subCategoryId: 74,
  priority: 100,

  keywords: [
    "nike",
    "adidas",
    "puma",
    "reebok",
    "skechers"
  ]
},

// ===================================================
// FOOTWEAR ETHNIC
// ===================================================

{
  categoryId: 15,
  subCategoryId: 75,
  priority: 99,

  keywords: [
    "jutti",
    "juti",
    "kolhapuri",
    "mojari",
    "mojaris"
  ]
},

// ===================================================
// FOOTWEAR CASUAL
// ===================================================

{
  categoryId: 15,
  subCategoryId: 76,
  priority: 98,

  keywords: [
    "crocs",
    "clogs",
    "sliders",
    "sandals",
    "slipper"
  ]
},
// ===================================================
// TALC / POWDER
// ===================================================

{
  categoryId: 8,
  subCategoryId: 41,
  priority: 100,

  keywords: [
    "talc",
    "powder",
    "pond's",
    "ponds dreamflower"
  ]
},

// ===================================================
// TRIMMERS / GROOMING
// ===================================================

{
  categoryId: 8,
  subCategoryId: 46,
  priority: 100,

  keywords: [
    "trimmer",
    "beard trimmer",
    "nose trimmer",
    "hair dryer",
    "nova",
    "panasonic",
    "philips"
  ]
},

// ===================================================
// TONER / ROSE WATER
// ===================================================

{
  categoryId: 8,
  subCategoryId: 43,
  priority: 99,

  keywords: [
    "toner",
    "rose water",
    "biotique cucumber",
    "kama ayurveda"
  ]
},

// ===================================================
// FACE WASH
// ===================================================

{
  categoryId: 8,
  subCategoryId: 40,
  priority: 99,

  keywords: [
    "face wash",
    "fw",
    "cleanser",
    "dark spot reduction",
    "nivea men"
  ]
},

// ===================================================
// SANITARY NAPKINS
// ===================================================

{
  categoryId: 8,
  subCategoryId: 49,
  priority: 100,

  keywords: [
    "whisper",
    "stayfree",
    "sanitary",
    "pads",
    "ultra xl"
  ]
},

// ===================================================
// MAKEUP
// ===================================================

{
  categoryId: 8,
  subCategoryId: 50,
  priority: 100,

  keywords: [
    "nail pops",
    "nail lacquer",
    "kajal",
    "kohl",
    "eyeshadow",
    "mascara",
    "lipstick",
    "elle 18",
    "colorbar",
    "sugar cosmetics",
    "swiss beauty"
  ]
},

// ===================================================
// LAPTOP
// ===================================================

{
  categoryId: 10,
  subCategoryId: 70,
  priority: 100,

  keywords: [
    "laptop",
    "hp laptop",
    "dell",
    "vostro",
    "ryzen",
    "intel core"
  ]
},

// ===================================================
// COMPUTER ACCESSORIES
// ===================================================

{
  categoryId: 10,
  subCategoryId: 71,
  priority: 99,

  keywords: [
    "keyboard",
    "mouse",
    "memory card",
    "micro sd",
    "hard drive",
    "external hard drive",
    "printer",
    "epson",
    "ring light",
    "tripod"
  ]
},

// ===================================================
// CORN FLAKES
// ===================================================

{
  categoryId: 2,
  subCategoryId: 17,
  priority: 99,

  keywords: [
    "corn flakes",
    "kellogg",
    "muesli"
  ]
},

// ===================================================
// PAPAD
// ===================================================

{
  categoryId: 2,
  subCategoryId: 18,
  priority: 99,

  keywords: [
    "papad",
    "lijjat"
  ]
},

// ===================================================
// CARDAMOM
// ===================================================

{
  categoryId: 2,
  subCategoryId: 5,
  priority: 98,

  keywords: [
    "elaichi",
    "cardamom"
  ]
},
// ===================================================
// MEDICINES / OTC
// ===================================================

{
  categoryId: 6,
  subCategoryId: 28,
  priority: 100,
  keywords: [
    "crocin",
    "saridon",
    "digene",
    "eno",
    "strepsils",
    "otrivin",
    "burnol",
    "betadine",
    "boroline",
    "itch guard",
    "itch-guard",
    "moov",
    "volini",
    "revital",
    "omimee"
  ]
},

// ===================================================
// FIRST AID
// ===================================================

{
  categoryId: 6,
  subCategoryId: 29,
  priority: 99,
  keywords: [
    "band aid",
    "band-aid",
    "hansaplast",
    "thermometer",
    "bp monitor",
    "blood pressure",
    "omron"
  ]
},

// ===================================================
// HARDWARE
// ===================================================

{
  categoryId: 19,
  subCategoryId: 80,
  priority: 100,
  keywords: [
    "hinge",
    "door closer",
    "ladder",
    "glue gun",
    "m-seal",
    "m seal",
    "fevitite",
    "adhesive",
    "mosquito bat",
    "night lamp"
  ]
},

// ===================================================
// STATIONERY
// ===================================================

{
  categoryId: 21,
  subCategoryId: 86,
  priority: 100,
  keywords: [
    "display file",
    "exam pad",
    "drawing board",
    "paint brush",
    "correction tape",
    "double sided tape",
    "school bag"
  ]
},

// ===================================================
// LUNCH BOX
// ===================================================

{
  categoryId: 21,
  subCategoryId: 87,
  priority: 99,
  keywords: [
    "lunch box"
  ]
},

// ===================================================
// PERFUME
// ===================================================

{
  categoryId: 21,
  subCategoryId: 84,
  priority: 100,
  keywords: [
    "perfume",
    "skinn"
  ]
},

// ===================================================
// HANDBAG / CLUTCH
// ===================================================

{
  categoryId: 13,
  subCategoryId: 57,
  priority: 100,
  keywords: [
    "clutch",
    "handbag",
    "wallet"
  ]
},

// ===================================================
// DRINKS
// ===================================================

{
  categoryId: 7,
  subCategoryId: 34,
  priority: 100,
  keywords: [
    "gatorade",
    "rasna",
    "alo frut",
    "schweppes",
    "amul kool",
    "jeera fizz"
  ]
},
// ===================================================
// CHOCOLATES (RESTAURANT / FOOD)
// ===================================================

{
  categoryId: 7,
  subCategoryId: 14,
  priority: 100,

  keywords: [
    "kitkat",
    "kit kat",
    "munch",
    "dairy milk",
    "cadbury",
    "chocolate"
  ]
},

// ===================================================
// FAST FOOD
// ===================================================

{
  categoryId: 7,
  subCategoryId: 35,
  priority: 100,

  keywords: [
    "spring roll",
    "stuffed kulcha"
  ]
},

// ===================================================
// BEAUTY CREAM
// ===================================================

{
  categoryId: 8,
  subCategoryId: 44,
  priority: 100,

  keywords: [
    "olay",
    "anti ageing",
    "total effects",
    "papaya"
  ]
},

// ===================================================
// ANTISEPTIC
// ===================================================

{
  categoryId: 8,
  subCategoryId: 45,
  priority: 100,

  keywords: [
    "dettol antiseptic"
  ]
},

// ===================================================
// STORAGE
// ===================================================

{
  categoryId: 10,
  subCategoryId: 72,
  priority: 100,

  keywords: [
    "micro sd",
    "memory card",
    "sandisk"
  ]
},

// ===================================================
// CLOTHING
// ===================================================

{
  categoryId: 13,
  subCategoryId: 56,
  priority: 100,

  keywords: [
    "hoodie",
    "jacket",
    "track pant",
    "palazzo",
    "sweater",
    "muffler",
    "cap",
    "scarf",
    "thermal",
    "poncho",
    "raincoat",
    "rompers",
    "petticoat",
    "blouse",
    "lingerie",
    "bikini",
    "sharara",
    "bow tie",
    "shorts"
  ]
},

// ===================================================
// APPLIANCES
// ===================================================

{
  categoryId: 12,
  subCategoryId: 74,
  priority: 100,

  keywords: [
    "air fryer",
    "egg boiler",
    "air cooler",
    "ups",
    "electronic safe",
    "bullet cam",
    "orient",
    "symphony",
    "hikvision",
    "luminous"
  ]
},

// ===================================================
// MEDICAL
// ===================================================

{
  categoryId: 6,
  subCategoryId: 28,
  priority: 100,

  keywords: [
    "soframycin",
    "accu-chek",
    "isabgol"
  ]
},
// ===================================================
// TALC / BODY POWDER
// ===================================================

{
  categoryId: 2,
  subCategoryId: 41,
  priority: 100,

  keywords: [
    "dreamflower",
    "talc",
    "body powder",
    "pond's"
  ]
},

// ===================================================
// KIDS CLOTHING
// ===================================================

{
  categoryId: 9,
  subCategoryId: 56,
  priority: 100,

  keywords: [
    "kids t-shirt",
    "kids shorts",
    "shorts set"
  ]
},

// ===================================================
// SUNGLASSES
// ===================================================

{
  categoryId: 13,
  subCategoryId: 58,
  priority: 100,

  keywords: [
    "sunglasses",
    "aviator"
  ]
},

// ===================================================
// WINTER / RAIN WEAR
// ===================================================

{
  categoryId: 14,
  subCategoryId: 59,
  priority: 100,

  keywords: [
    "thermal",
    "poncho",
    "swimming trunk"
  ]
},

// ===================================================
// HOME APPLIANCES
// ===================================================

{
  categoryId: 12,
  subCategoryId: 74,
  priority: 100,

  keywords: [
    "steam iron",
    "vacuum cleaner",
    "voltage stabilizer",
    "electronic safe"
  ]
},

// ===================================================
// HELMETS
// ===================================================

{
  categoryId: 12,
  subCategoryId: 76,
  priority: 100,

  keywords: [
    "helmet",
    "steelbird",
    "studds",
    "vega"
  ]
},

// ===================================================
// CAR ACCESSORIES
// ===================================================

{
  categoryId: 22,
  subCategoryId: 91,
  priority: 100,

  keywords: [
    "car wax",
    "dashboard polish",
    "tyre inflator",
    "car holder",
    "wiper",
    "body cover",
    "car charger",
    "seat gap",
    "floor mat",
    "rain-x",
    "rain x",
    "headlight",
    "shell advance",
    "microfiber",
    "car wash",
    "vacuum cleaner",
    "wd-40"
  ]
},

// ===================================================
// FURNITURE
// ===================================================

{
  categoryId: 12,
  subCategoryId: 78,
  priority: 99,

  keywords: [
    "chair",
    "table",
    "shoe rack",
    "mirror",
    "study desk",
    "wall shelf",
    "corner stand",
    "mattress",
    "bean bag",
    "camping chair",
    "spice rack",
    "serving tray",
    "potted plant",
    "wall clock",
    "cushion cover"
  ]
},// ==========================
// ===================================================
// HOME DECOR & STORAGE
// ===================================================
{
  categoryId: 12,
  subCategoryId: 81, // Plastic & Small Furniture (Ref: 81)
  priority: 100,
  keywords: ["safe", "shelves", "storage rack", "rice cooker", "toaster"]
},
{
  categoryId: 12,
  subCategoryId: 80, // Wall Decor & Clocks (Ref: 80)
  priority: 100,
  keywords: ["wall painting"]
},

// ===================================================
// CAR & VEHICLE ACCESSORIES
// ===================================================
{
  categoryId: 22,
  subCategoryId: 100, // Car & Bike Accessories (Ref: 100)
  priority: 100,
  keywords: ["air purifier", "mobile holder", "gloves", "blind spot mirror"]
},

// ===================================================
// ORGANIC & HEALTH FOODS
// ===================================================
{
  categoryId: 6,
  subCategoryId: 6, // Dry Fruits, Nuts & Seeds (Ref: 6)
  priority: 100,
  keywords: ["honey", "quinoa", "chia seeds", "pumpkin seeds", "flax seeds", "almond butter", "oats"]
},
{
  categoryId: 6,
  subCategoryId: 7, // Tea, Coffee & Beverages (Ref: 7)
  priority: 100,
  keywords: ["green tea", "stevia", "wheatgrass", "matcha", "tulsi ginger tea"]
},
{
  categoryId: 6,
  subCategoryId: 3, // Oil & Ghee (Ref: 3)
  priority: 100,
  keywords: ["coconut oil", "desi ghee"]
},

// ===================================================
// KITCHEN TOOLS & APPLIANCES
// ===================================================
{
  categoryId: 17,
  subCategoryId: 86, // Kitchen Gadgets & Tools (Ref: 86)
  priority: 100,
  keywords: ["chopper", "egg boiler", "weighing scale", "milk frother", "oil dispenser", "spatula", "garlic press", "apple cutter", "spice rack", "masala dani", "roti maker"]
},

// ===================================================
// PET CARE
// ===================================================
{
  categoryId: 24,
  subCategoryId: 106, // Dog & Cat Food (Ref: 106)
  priority: 100,
  keywords: ["choostix", "dog treats", "meat up", "dog biscuit", "royal canin"]
},
{
  categoryId: 24,
  subCategoryId: 107, // Pet Grooming & Shampoos (Ref: 107)
  priority: 100,
  keywords: ["himalaya erina", "pet grooming", "brush", "paw cleaner", "pet wipes"]
},
{
  categoryId: 24,
  subCategoryId: 108, // Pet Toys & Collars (Ref: 108)
  priority: 100,
  keywords: ["dog leash", "collar", "squeaky toy", "cat litter", "pet carrier", "nail clipper", "muzzle", "whistle"]
},
// ===================================================
// BABY CARE & TOYS
// ===================================================
{
  categoryId: 9, // Baby Care Essentials
  subCategoryId: 19, // Baby Care Essentials (Ref: 19)
  priority: 100,
  keywords: ["baby gentle wash", "grooming kit", "feeding bottle", "rattles", "dusting powder", "bed protector", "shampoo", "nasal aspirator"]
},
{
  categoryId: 9, 
  subCategoryId: 54, // Kids Toys & Games (Ref: 54)
  priority: 100,
  keywords: ["rubik's cube", "plush elephant", "nerf", "doctor set", "beyblade", "magnetic building blocks", "bubbles maker", "clay", "dough", "friction truck", "chess", "play tent", "stack a rings"]
},

// ===================================================
// OFFICE & SCHOOL STATIONERY
// ===================================================
{
  categoryId: 11, // Office/Electronics context
  subCategoryId: 98, // Office & School Stationery (Ref: 98)
  priority: 100,
  keywords: ["board markers", "document wallet", "scissors", "magnetic pins", "lamination pouch", "whiteboard", "sticky notes"]
},
{
  categoryId: 11,
  subCategoryId: 60, // Mouse, Keyboards & Accessories (Ref: 60)
  priority: 100,
  keywords: ["desk lamp", "usb-c hub", "wrist support", "screen protector"]
},
{
  categoryId: 11,
  subCategoryId: 62, // Routers & Pendrives (Ref: 62)
  priority: 100,
  keywords: ["sandisk", "microsd"]
},

// ===================================================
// FOOD & BISCUITS
// ===================================================
{
  categoryId: 7, 
  subCategoryId: 10, // Biscuits & Cookies (Ref: 10)
  priority: 100,
  keywords: ["parle-g", "gluco", "britannia good day", "hide & seek", "choco chip", "butter cookies", "cashew"]
},

// ===================================================
// HOUSEHOLD & OTHERS
// ===================================================
{
  categoryId: 19,
  subCategoryId: 88, // Dustbins & Buckets (Ref: 88)
  priority: 100,
  keywords: ["bamboo laundry basket"]
},
{
  categoryId: 4,
  subCategoryId: 3, // Oil & Ghee (Ref: 3)
  priority: 100,
  keywords: ["gir cow desi ghee"]
},
{
  categoryId: 24,
  subCategoryId: 108, // Pet Toys & Collars (Ref: 108)
  priority: 100,
  keywords: ["squeaky rubber toy", "laser toy"]
},
// ===================================================
// TOYS & HOUSEHOLD
// ===================================================
{
  categoryId: 9,
  subCategoryId: 54, // Kids Toys & Games
  priority: 100,
  keywords: ["friction powered truck", "rechargeable led torch"]
},
{
  categoryId: 12,
  subCategoryId: 66, // Kitchen & Home Appliances
  priority: 100,
  keywords: ["multi-plug extension", "surge protector"]
},

// ===================================================
// OFFICE & STATIONERY
// ===================================================
{
  categoryId: 11,
  subCategoryId: 98, // Office & School Stationery
  priority: 100,
  keywords: ["hdmi cable", "binding machine", "desk organizer", "sticky notes"]
},

// ===================================================
// PERSONAL CARE & HYGIENE
// ===================================================
{
  categoryId: 8,
  subCategoryId: 18, // Bath, Hair & Personal Care
  priority: 100,
  keywords: ["neem tulsi handwash", "dettol liquid", "nivea crème"]
},

// ===================================================
// BISCUITS, CANDIES & CHOCOLATES
// ===================================================
{
  categoryId: 7,
  subCategoryId: 10, // Biscuits & Cookies
  priority: 100,
  keywords: ["dark fantasy", "marie gold", "monaco", "krackjack", "nutrichoice", "50-50", "bounce orange", "mcvitie's digestive"]
},
{
  categoryId: 7,
  subCategoryId: 14, // Chocolates & Candies
  priority: 100,
  keywords: ["alpenliebe", "pulse candy", "mentos", "chupa chups"]
},

// ===================================================
// RESTAURANT / FAST FOOD
// ===================================================
{
  categoryId: 7,
  subCategoryId: 31, // Hot Snacks & Fast Food
  priority: 100,
  keywords: ["sev tamatar", "gatte ki sabji", "khaman dhokla", "margherita", "mirchi bada", "pyaz kachori", "malai kofta", "lachha paratha"]
},
{
  categoryId: 7,
  subCategoryId: 44, // Beverages & Shakes
  priority: 100,
  keywords: ["mojito", "kesar pista lassi", "masala chaas"]
},

// ===================================================
// HEALTH & SUPPLEMENTS (OTC)
// ===================================================
{
  categoryId: 6,
  subCategoryId: 32, // OTC Medicines & Pain Relief
  priority: 100,
  keywords: ["glucose-d", "swad digestive", "sualin", "kanthil", "safi blood purifier", "pain ointment", "sloan's liniment"]
},
// ===================================================
// PERSONAL CARE, HYGIENE & BABY CARE
// ===================================================
{
  categoryId: 6,
  subCategoryId: 32, // OTC Medicines & Pain Relief
  priority: 100,
  keywords: ["krack heel repair", "dermicool", "nycil"]
},
{
  categoryId: 6,
  subCategoryId: 36, // Personal Hygiene & Sanitizers
  priority: 100,
  keywords: ["sanitary pads", "panty liners"]
},
{
  categoryId: 9,
  subCategoryId: 19, // Baby Care Essentials
  priority: 100,
  keywords: ["janma ghutti", "olive oil", "lal tail", "gripe water"]
},
{
  categoryId: 8,
  subCategoryId: 46, // Skin Care & Lotions
  priority: 100,
  keywords: ["aloe vera gel", "ponds super light gel", "vlcc anti tan", "sunscreen"]
},
{
  categoryId: 8,
  subCategoryId: 49, // Makeup & Cosmetics
  priority: 100,
  keywords: ["eyeliner", "nail polish remover"]
},
{
  categoryId: 6,
  subCategoryId: 34, // Daily Health Supplements
  priority: 100,
  keywords: ["bournvita lil champs"]
},

// ===================================================
// OFFICE & SCHOOL STATIONERY
// ===================================================
{
  categoryId: 21, // Note: Mapping these to Stationery
  subCategoryId: 98, // Office & School Stationery
  priority: 100,
  keywords: ["sticky notes", "bill book", "diary", "scrap book", "glitter foam", "practical file", "crayons", "craft scissors", "ice cream sticks", "satin ribbon", "clay dough", "packing tape", "board pins", "ruler", "folder", "punching machine", "envelope", "price label", "name slip", "spring file", "acrylic color"]
},

// ===================================================
// FOOD & TRADITIONAL SWEETS
// ===================================================
{
  categoryId: 4,
  subCategoryId: 31, // Hot Snacks & Fast Food
  priority: 100,
  keywords: ["veg puff", "pattice"]
},
{
  categoryId: 5,
  subCategoryId: 28, // Traditional Sweets
  priority: 100,
  keywords: ["petha", "milk cake", "imarti", "balushahi"]
},

// ===================================================
// KITCHEN TOOLS
// ===================================================
{
  categoryId: 17,
  subCategoryId: 86, // Kitchen Gadgets & Tools
  priority: 100,
  keywords: ["roti dabba", "lemon squeezer"]
},
{
  categoryId: 19,
  subCategoryId: 66, // Kitchen & Home Appliances
  priority: 100,
  keywords: ["led torch"]
},
{
  categoryId: 8,
  subCategoryId: 50, // Grooming & Shaving
  priority: 100,
  keywords: ["safety pins"]
},
// ===================================================
// KITCHEN TOOLS & APPLIANCES
// ===================================================
{
  categoryId: 17,
  subCategoryId: 86, // Kitchen Gadgets & Tools
  priority: 100,
  keywords: ["tea strainer", "rolling pin", "chimney cleaner", "egg poacher", "dish draining rack"]
},

// ===================================================
// SPORTS, FITNESS & GAMES
// ===================================================
{
  categoryId: 23,
  subCategoryId: 103, // Fitness Equipment & Mats
  priority: 100,
  keywords: ["push up bars", "resistance bands", "knee support", "ankle support"]
},
{
  categoryId: 23,
  subCategoryId: 105, // Cricket, Badminton & Games
  priority: 100,
  keywords: ["swimming cap", "swimming goggles", "carrom board", "carrom powder", "carrom coins", "whistle"]
},

// ===================================================
// ELECTRONICS & COMPUTER ACCESSORIES
// ===================================================
{
  categoryId: 11,
  subCategoryId: 58, // Earphones & Headphones
  priority: 100,
  keywords: ["headset with mic"]
},
{
  categoryId: 11,
  subCategoryId: 60, // Mouse, Keyboards & Accessories
  priority: 100,
  keywords: ["web camera", "thermal paste"]
},
{
  categoryId: 11,
  subCategoryId: 62, // Routers & Pendrives
  priority: 100,
  keywords: ["converter cable", "lan cable", "external hard drive"]
},

// ===================================================
// HOME ELECTRICALS & HARDWARE
// ===================================================
{
  categoryId: 12,
  subCategoryId: 66, // Kitchen & Home Appliances
  priority: 100,
  keywords: ["hair trimmer", "hair straightener", "extension board", "multi plug", "inverter bulb", "batteries", "weight scale"]
},
{
  categoryId: 19,
  subCategoryId: 92, // Hardware Tools & Locks
  priority: 100,
  keywords: ["taparia", "screw driver", "pvc pipe", "sandpaper", "machine oil", "plastic plugs", "paint brush", "screws"]
},
{
  categoryId: 19,
  subCategoryId: 96, // Paints & Brushes
  priority: 100,
  keywords: ["tractor emulsion"]
},

// ===================================================
// SNACKS & BEVERAGES
// ===================================================
{
  categoryId: 7,
  subCategoryId: 11, // Namkeen, Chips & Snacks
  priority: 100,
  keywords: ["lay's", "bingo", "tedhe medhe", "balaji", "takatak"]
},
{
  categoryId: 7,
  subCategoryId: 12, // Sauces, Spreads & Honey
  priority: 100,
  keywords: ["kissan fresh tomato ketchup"]
},

// ===================================================
// FRESH PRODUCE & DAIRY
// ===================================================
{
  categoryId: 3,
  subCategoryId: 22, // Fresh Fruits
  priority: 100,
  keywords: ["papaya", "watermelon", "coconut water", "sweet lime"]
},
{
  categoryId: 4,
  subCategoryId: 21, // Fresh Vegetables
  priority: 100,
  keywords: ["carrots", "radish", "ginger", "garlic", "green chillies"]
},
// ===================================================
// CONSTRUCTION, HARDWARE & PLUMBING
// ===================================================
{
  categoryId: 19,
  subCategoryId: 93, // Plumbing & Taps
  priority: 100,
  keywords: ["pvc flexible waste pipe", "ptmt plastic water tap"]
},
{
  categoryId: 20,
  subCategoryId: 94, // Cement & Putty Supplies
  priority: 100,
  keywords: ["ultra tech cement", "jk super strong", "ambuja kawach", "white marble chips", "jk wall putty", "plaster of paris"]
},
{
  categoryId: 20,
  subCategoryId: 95, // Bricks & Iron Bars
  priority: 100,
  keywords: ["red clay bricks", "fly ash cement bricks", "tmt steel sariya"]
},
{
  categoryId: 20,
  subCategoryId: 95, // Wall Decor & Clocks (Fitting for Stones)
  priority: 100,
  keywords: ["kota stone", "sandstone", "transparent chaddar", "tin chaddar"]
},
{
  categoryId: 19,
  subCategoryId: 92, // Hardware Tools & Locks
  priority: 100,
  keywords: ["taparia", "green shade net", "river sand", "lohe ki channi", "kudal", "tasla", "fevikwik", "screws"]
},

// ===================================================
// FOOD, SNACKS & BEVERAGES
// ===================================================
{
  categoryId: 7,
  subCategoryId: 12, // Sauces, Spreads & Honey
  priority: 100,
  keywords: ["maggi hot sweet tomato", "tops pure vinegar", "ching's secret", "mayonnaise"]
},
{
  categoryId: 7,
  subCategoryId: 11, // Namkeen, Chips & Snacks
  priority: 100,
  keywords: ["lay's", "bingo", "balaji", "haldiram's takatak", "bikaji papdi"]
},
{
  categoryId: 7,
  subCategoryId: 9, // Breakfast & Instant Food
  priority: 100,
  keywords: ["saffola gold rolled oats"]
},
{
  categoryId: 4,
  subCategoryId: 13, // Bakery & Bread
  priority: 100,
  keywords: ["pizza base", "chocolate chip cookies"]
},
{
  categoryId: 2,
  subCategoryId: 44, // Beverages & Shakes
  priority: 100,
  keywords: ["bisleri mineral water", "kinley soda", "coca-cola"]
},
{
  categoryId: 5,
  subCategoryId: 28, // Traditional Sweets
  priority: 100,
  keywords: ["desi ghee jalebi", "white rasbhari"]
},

// ===================================================
// PERSONAL CARE & APPAREL
// ===================================================
{
  categoryId: 8,
  subCategoryId: 18, // Bath, Hair & Personal Care
  priority: 100,
  keywords: ["babool ayurvedic", "vega hair brush", "everyuth walnut scrub", "vaseline intensive care"]
},
{
  categoryId: 14,
  subCategoryId: 71, // Undergarments & Nightwear
  priority: 100,
  keywords: ["men's cotton briefs", "men's cotton vests"]
},
{
  categoryId: 14,
  subCategoryId: 74, // Ethnic & Winter Wear
  priority: 100,
  keywords: ["winter woolen beanie", "sunglasses"]
},
{
  categoryId: 13, // Accessories
  subCategoryId: 75, // Innerwear & Socks
  priority: 100,
  keywords: ["school uniform ankle socks", "premium cotton sports socks", "women's handkerchief"]
},

// ===================================================
// ELECTRONICS & STATIONERY
// ===================================================
{
  categoryId: 10,
  subCategoryId: 59, // Laptops & Desktops
  priority: 100,
  keywords: ["lenovo tab", "canon pixma"]
},
{
  categoryId: 10,
  subCategoryId: 60, // Mouse, Keyboards & Accessories
  priority: 100,
  keywords: ["fire-boltt ninja smartwatch"]
},
{
  categoryId: 11,
  subCategoryId: 98, // Office & School Stationery
  priority: 100,
  keywords: ["sticky notes", "paper shredder", "casio scientific calculator", "clear tape"]
},
// ===================================================
// PET CARE & STATIONERY
// ===================================================
{
  categoryId: 24,
  subCategoryId: 106, // Dog & Cat Food
  priority: 100,
  keywords: ["drools", "calcium tablets", "focus adult"]
},
{
  categoryId: 21,
  subCategoryId: 98, // Office & School Stationery
  priority: 100,
  keywords: ["identity card holder", "drawing book", "cello tape", "brown packaging box tape"]
},

// ===================================================
// WOMEN'S ACCESSORIES & BEAUTY (Category 13 Mapping)
// ===================================================
{
  categoryId: 13,
  subCategoryId: 49, // Makeup & Cosmetics
  priority: 100,
  keywords: ["bindi", "nail polish", "nail art", "lipstick", "lip gloss", "eyeliner", "mascara", "foundation", "makeup kit", "blush", "concealer"]
},
{
  categoryId: 13,
  subCategoryId: 47, // Hair Care & Oils
  priority: 100,
  keywords: ["hair pins", "hair band", "bobby pins", "juda pin", "hair roller", "hair curling", "hair claw clip", "scrunchie", "hair beads", "bun maker", "hair oil", "shampoo", "conditioner", "hair mask", "hair dryer", "hair straightener"]
},
{
  categoryId: 13,
  subCategoryId: 71, // Undergarments & Nightwear
  priority: 100,
  keywords: ["panty", "camisole", "innerwear", "socks"]
},
{
  categoryId: 13,
  subCategoryId: 78, // Slippers & Daily FlipFlops
  priority: 100,
  keywords: ["footwear", "sandals", "heels", "flats", "sneakers"]
},

// ===================================================
// FOOD, SNACKS & BEVERAGES
// ===================================================
{
  categoryId: 4, // Food & Sweets
  subCategoryId: 43, // Sweets & Desserts
  priority: 100,
  keywords: ["kulfi", "chocobar", "chocolate chip cookies"]
},
{
  categoryId: 7, // Food
  subCategoryId: 11, // Namkeen, Chips & Snacks
  priority: 100,
  keywords: ["bikaji", "haldiram's soan papdi", "kurkure", "lays", "mentos", "pass pass"]
},
{
  categoryId: 7,
  subCategoryId: 5, // Spices & Masalas
  priority: 100,
  keywords: ["hing powder", "garlic paste", "ginger paste", "chilli powder"]
},

// ===================================================
// CONSTRUCTION & HARDWARE
// ===================================================
{
  categoryId: 20,
  subCategoryId: 94, // Cement & Putty Supplies
  priority: 100,
  keywords: ["ultratech cement", "dr. fixit"]
},
{
  categoryId: 19,
  subCategoryId: 93, // Plumbing & Taps
  priority: 100,
  keywords: ["gi pipe", "pvc agriculture water pipe"]
},
{
  categoryId: 19,
  subCategoryId: 92, // Hardware Tools & Locks
  priority: 100,
  keywords: ["tirpal", "nylon rassi", "jute rassi", "channi", "kudal", "tasla", ]
},

// ===================================================
// HEALTH & PERSONAL CARE (Category 6, 8, 14)
// ===================================================
{
  categoryId: 6,
  subCategoryId: 32, // OTC Medicines & Pain Relief
  priority: 100,
  keywords: ["shankhpushpi", "gas-o-fast", "koflet", "ring guard", "gelusil"]
},
{
  categoryId: 8,
  subCategoryId: 46, // Skin Care & Lotions
  priority: 100,
  keywords: ["vlcc", "vaseline", "savlon", "dettol sanitizer"]
},
{
  categoryId: 14,
  subCategoryId: 71, // Undergarments & Nightwear
  priority: 100,
  keywords: ["briefs", "handkerchief", "vests"]
},
{
  categoryId: 14,
  subCategoryId: 100, // Car & Bike Accessories / Sunglasses
  priority: 100,
  keywords: ["sunglasses", "beanie cap"]
},
// ===================================================
// BUILDING MATERIALS (CORRECTED: Category ID 20)
// ===================================================

// 1. Cement & Putty (Ref ID: 94)
{
  categoryId: 20,
  subCategoryId: 94,
  priority: 150,
  keywords: ["cement", "ultratech", "jk super", "ambuja", "dr. fixit", "wall putty", "pop", "plaster of paris", "white marble chips"]
},

// 2. Bricks & Iron Bars (Ref ID: 95)
{
  categoryId: 20,
  subCategoryId: 95,
  priority: 150,
  keywords: ["bricks", "red clay bricks", "fly ash", "cemented bricks", "tmt steel", "sariya", "gi pipe", "khamba","bajri", "gitti"]
},

// 3. Paints & Brushes (Ref ID: 96)
{
  categoryId: 20,
  subCategoryId: 96,
  priority: 150,
  keywords: ["paint", "emulsion", "asian paints", "sandpaper", "regmar", "paint brush", "rollers"]
},
// ===================================================
// 1. FOOTWEAR & SOCKS (Category 15)
// ===================================================
{
  categoryId: 15,
  subCategoryId: 75, // Innerwear & Socks
  priority: 100,
  keywords: ["socks", "ankle socks", "sports socks"]
},

// ===================================================
// 2. BABY & KIDS ZONE (Category 9)
// ===================================================
{
  categoryId: 9,
  subCategoryId: 53, // Baby Bath & Skin Care
  priority: 100,
  keywords: ["baby bathing soap", "baby cleansing bar", "infant milk", "pacifier", "baby bibs", "potty seat", "sipper", "baby socks", "ear buds", "baby mosquito net"]
},
{
  categoryId: 9,
  subCategoryId: 54, // Kids Toys & Games
  priority: 100,
  keywords: ["cricket plastic bat", "ball set"]
},

// ===================================================
// 3. KITCHENWARE & GADGETS (Category 17)
// ===================================================
{
  categoryId: 17,
  subCategoryId: 86, // Kitchen Gadgets & Tools
  priority: 100,
  keywords: ["vegetable slicer", "sink drain strainer", "tope set", "handi", "chimta", "potato masher", "whisk", "peeler", "chopping board", "kitchen hand towels", "gas lighter", "pooja brass diya", "brass bell", "agarbatti stand", "copper lota", "pooja thali", "funnel", "fly swatter"]
},

// ===================================================
// 4. MEN & GENERAL FASHION / ACCESSORIES (Category 14)
// ===================================================
{
  categoryId: 14,
  subCategoryId: 75, // Innerwear & Socks
  priority: 100,
  keywords: ["briefs", "handkerchief", "vests"]
},
{
  categoryId: 14,
  subCategoryId: 100, // (Assuming Accessory mapping)
  priority: 100,
  keywords: ["leather formal belt", "cufflinks"]
},

// ===================================================
// 5. WOMEN FASHION (Category 13)
// ===================================================
{
  categoryId: 13,
  subCategoryId: 49, // Makeup & Cosmetics
  priority: 100,
  keywords: ["bindi", "makeup", "nail", "lipstick", "lip balm", "eyeliner", "mascara", "concealer", "foundation", "makeup brush", "beauty sponge", "bleach cream", "moisturizer", "sunscreen", "talcum powder", "perfume", "deodorant", "facial kit"]
},
{
  categoryId: 13,
  subCategoryId: 47, // Hair Care & Oils
  priority: 100,
  keywords: ["hair pins", "hair band", "bobby pins", "juda pin", "hair roller", "hair curling", "hair straight", "hair accessories", "hair claw", "hair oil", "shampoo", "conditioner", "hair mask", "hair dryer", "hair straightener", "electric trimmer"]
},
{
  categoryId: 13,
  subCategoryId: 78, // Slippers & Daily FlipFlops
  priority: 100,
  keywords: ["footwear", "sandals", "heels", "flats", "sneakers"]
},
{
  categoryId: 13,
  subCategoryId: 71, // Undergarments & Nightwear
  priority: 100,
  keywords: ["panty", "camisole", "innerwear set"]
},

// ===================================================
// 6. BUILDING MATERIALS (Category 20 - CORRECTED)
// ===================================================
{
  categoryId: 20,
  subCategoryId: 94, // Cement & Putty
  priority: 150,
  keywords: ["cement", "waterproofing liquid", "ultra tech cement"]
},
{
  categoryId: 20,
  subCategoryId: 95, // Bricks & Iron Bars
  priority: 150,
  keywords: ["gi pipe", "pvc agriculture water pipe", "tarpaulin", "tirpal", "nylon rassi", "jute rassi", "red clay bricks", "cemented bricks", "tmt steel sariya"]
},

// ===================================================
// 7. ELECTRONICS & APPLIANCES (Category 12)
// ===================================================
{
  categoryId: 12,
  subCategoryId: 66, // Kitchen & Home Appliances
  priority: 120,
  keywords: ["dry iron", "led tube light", "trimmer", "hair dryer", "electric kettle", "hand blender", "power bank", "charging adapter", "charging cable", "earphones", "neckband", "earbuds", "auxiliary cable", "hdmi cable"]
},

// ===================================================
// 8. CAR & BIKE ACCESSORIES (Category 22)
// ===================================================
{
  categoryId: 22,
  subCategoryId: 100, // Car & Bike Accessories
  priority: 120,
  keywords: ["car gel spray", "car decor", "car ganesha", "car cover", "bike cover", "liquid polish", "paste wax", "anti-rust spray", "chain clean", "dashboard foam", "steering wheel cover", "seat cushion", "usb charger", "bike disc lock", "bike chain lock", "mobile pouch", "face mask", "arm sleeves", "ambi pur", "godrej aer", "mobile mount"]
},
// ===================================================
// 1. FRESH PRODUCE (Category 3)
// ===================================================
{
  categoryId: 3,
  subCategoryId: 23, // Milk, Chaas & Curd
  priority: 100,
  keywords: ["milk", "chaas", "dahi", "buttermilk", "lassi", "paneer", "fresh cream", "cheese", "butter", "peanut butter"]
},
{
  categoryId: 3,
  subCategoryId: 22, // Fresh Fruits
  priority: 100,
  keywords: ["papaya", "watermelon", "coconut water", "sweet lime", "potato"]
},

// ===================================================
// 2. BAKERY & DAIRY (Category 4)
// ===================================================
{
  categoryId: 4,
  subCategoryId: 25, // Breads, Buns & Pav
  priority: 100,
  keywords: ["pizza base", "cookies", "kulfi", "chocobar"]
},

// ===================================================
// 3. BABY & KIDS ZONE (Category 9)
// ===================================================
{
  categoryId: 9,
  subCategoryId: 53, // Baby Bath & Skin Care
  priority: 100,
  keywords: ["baby soap", "cleansing bar", "infant milk", "pacifier", "baby bibs", "potty seat", "sipper", "baby socks", "ear buds", "baby mosquito net", "baby toothpaste", "face cream", "safety locks"]
},
{
  categoryId: 9,
  subCategoryId: 54, // Kids Toys & Games
  priority: 100,
  keywords: ["cricket", "bat", "ball"]
},

// ===================================================
// 4. WOMEN FASHION (Category 13)
// ===================================================
{
  categoryId: 13,
  subCategoryId: 49, // Makeup & Cosmetics
  priority: 100,
  keywords: ["bindi", "makeup", "nail", "lipstick", "lip balm", "eyeliner", "mascara", "foundation", "makeup brush", "beauty sponge", "bleach cream", "moisturizer", "sunscreen", "talcum powder", "perfume", "deodorant", "facial kit"]
},
{
  categoryId: 13,
  subCategoryId: 47, // Hair Care & Oils
  priority: 100,
  keywords: ["hair pins", "hair band", "bobby pins", "juda pin", "hair roller", "hair curling", "hair straight", "hair accessories", "hair claw", "hair oil", "shampoo", "conditioner", "hair mask", "hair dryer", "hair straightener", "electric trimmer", "hair brush"]
},
{
  categoryId: 13,
  subCategoryId: 71, // Undergarments & Nightwear
  priority: 100,
  keywords: ["panty", "camisole", "innerwear"]
},
{
  categoryId: 13,
  subCategoryId: 70, // Western Wear & Tops
  priority: 100,
  keywords: ["backpack", "handkerchief", "shawl", "gloves", "sling bag", "shoulder bag", "cosmetic bag", "shirt", "t-shirt", "yoga pants", "jeans", "stole", "umbrella"]
},

// ===================================================
// 5. BUILDING MATERIALS (Category 20)
// ===================================================
{
  categoryId: 20,
  subCategoryId: 94, // Cement & Putty
  priority: 150,
  keywords: ["cement", "waterproofing", "putty", "pop"]
},
{
  categoryId: 20,
  subCategoryId: 95, // Bricks & Iron Bars
  priority: 150,
  keywords: ["pipe", "tarpaulin", "tirpal", "rassi", "rope", "bricks", "steel", "sariya"]
},

// ===================================================
// 6. ELECTRONICS & APPLIANCES (Category 12)
// ===================================================
{
  categoryId: 12,
  subCategoryId: 66, // Kitchen & Home Appliances
  priority: 120,
  keywords: ["dry iron", "trimmer", "hair dryer", "electric kettle", "blender", "power bank", "charging", "cable", "earphones", "earbuds", "audio cable", "hdmi cable"]
},
// ===================================================
// 1. HARDWARE TOOLS (Category 19)
// ===================================================
{
  categoryId: 19,
  subCategoryId: 92, // Hardware Tools & Locks
  priority: 150,
  keywords: ["screwdriver", "pliers", "spanner", "wrench", "measuring tape", "hand saw", "hacksaw", "wire nails", "gi wire", "screws", "nut bolt", "padlock", "door latch", "door handle", "door hinges", "seal tape", "water tap", "bib cock", "hose pipe", "steel wire brush", "caulking glue gun"]
},

// ===================================================
// 2. BUILDING MATERIALS (Category 20)
// ===================================================
{
  categoryId: 20,
  subCategoryId: 94, // Cement & Putty
  priority: 150,
  keywords: ["cement", "waterproofing", "putty", "pop"]
},
{
  categoryId: 20,
  subCategoryId: 95, // Bricks & Iron Bars
  priority: 150,
  keywords: ["tarpaulin", "tirपाल", "pipe", "pvc agri pipe"]
},

// ===================================================
// 3. RESTAURANT & FOOD (Category 7)
// ===================================================
{
  categoryId: 7,
  subCategoryId: 31, // Hot Snacks & Fast Food
  priority: 150,
  keywords: ["burger", "pizza", "noodles", "fried rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "mocktail", "shake", "kadi kachori"]
},
{
  categoryId: 7,
  subCategoryId: 10, // Biscuits & Cookies
  priority: 150,
  keywords: ["soan papdi", "bhakarwadi", "mathri", "pringles", "chips"]
},

// ===================================================
// 4. STATIONERY & GIFTS (Category 21)
// ===================================================
{
  categoryId: 21,
  subCategoryId: 98, // Office & School Stationery
  priority: 150,
  keywords: ["cello tape", "stamp pad", "geometry box", "writing board", "labels"]
},

// ===================================================
// 5. WOMEN FASHION (Category 13)
// ===================================================
{
  categoryId: 13,
  subCategoryId: 49, // Makeup & Cosmetics
  priority: 100,
  keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial kit", "wax strips", "razor", "powder", "lotion", "creams", "beauty kit"]
},
{
  categoryId: 13,
  subCategoryId: 47, // Hair Care & Oils
  priority: 100,
  keywords: ["hair pins", "hair band", "hair claw", "hair oil", "hair straightener", "curling iron", "hair brush", "hair serum"]
},
{
  categoryId: 13,
  subCategoryId: 71, // Undergarments & Nightwear
  priority: 100,
  keywords: ["panty", "lingerie", "socks"]
},

// ===================================================
// 6. BABY & KIDS ZONE (Category 9)
// ===================================================
{
  categoryId: 9,
  subCategoryId: 53, // Baby Bath & Skin Care
  priority: 100,
  keywords: ["baby soap", "toothpaste", "baby net", "feeding spoon", "baby bibs", "swaddle", "baby socks"]
},
// ===================================================
// MASTER MAPPING RULES
// ===================================================

// 1. BUILDING MATERIALS (Category 20) - Mapped correctly to 94, 95, 96
{
  categoryId: 20,
  subCategoryId: 94, // Cement & Putty
  priority: 200,
  keywords: ["cement", "ultratech", "ambuja", "shree jung"]
},
{
  categoryId: 20,
  subCategoryId: 95, // Bricks & Iron Bars
  priority: 200,
  keywords: ["tarpaulin", "tirपाल", "pipe", "sariya"]
},

// 2. HARDWARE TOOLS & PLUMBING (Category 19)
{
  categoryId: 19,
  subCategoryId: 92, // Hardware Tools
  priority: 200,
  keywords: ["screwdriver", "pliers", "spanner", "measuring tape", "saw", "nails", "nut bolt", "padlock", "door latch", "door handle", "door hinges", "seal tape", "water tap", "hose pipe", "glue gun", "wire brush"]
},
{
  categoryId: 19,
  subCategoryId: 93, // Plumbing
  priority: 200,
  keywords: ["pipe", "tap", "valve"]
},

// 3. FAST FOOD & RESTAURANT (Category 7)
{
  categoryId: 7,
  subCategoryId: 31, // Fast Food
  priority: 200,
  keywords: ["burger", "pizza", "noodles", "fried rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "mocktail", "shake", "kachori", "samosa", "chaat", "thali"]
},
{
  categoryId: 7,
  subCategoryId: 10, // Sweets & Biscuits
  priority: 200,
  keywords: ["soan papdi", "bhakarwadi", "mathri", "pringles", "chips", "biscuits", "jam", "syrup", "jelly"]
},

// 4. WOMEN FASHION & ACCESSORIES (Category 13)
{
  categoryId: 13,
  subCategoryId: 49, // Makeup/Cosmetics
  priority: 200,
  keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "lotion", "cream", "beauty"]
},
{
  categoryId: 13,
  subCategoryId: 47, // Hair Care
  priority: 200,
  keywords: ["hair pins", "hair band", "hair claw", "hair oil", "shampoo", "curling", "hair straight", "hair brush", "hair serum"]
},
{
  categoryId: 13,
  subCategoryId: 71, // Undergarments
  priority: 200,
  keywords: ["panty", "lingerie", "socks"]
},

// 5. BABY CARE (Category 9)
{
  categoryId: 9,
  subCategoryId: 53, // Baby Care
  priority: 200,
  keywords: ["baby soap", "baby net", "feeding", "baby bibs", "swaddle", "baby socks", "toothpaste", "safety locks"]
},

// 6. ELECTRONICS & COMPUTER (Category 11/12)
{
  categoryId: 11,
  subCategoryId: 60, // Accessories/Computer
  priority: 200,
  keywords: ["usb", "vga", "hdmi", "cable", "hard drive", "speakers", "headset", "dvd", "fan", "ups", "bluetooth", "mouse", "keyboard"]
},
{
  categoryId: 12,
  subCategoryId: 66, // Kitchen/Home Appliances
  priority: 200,
  keywords: ["iron", "trimmer", "hair dryer", "kettle", "blender", "power bank"]
},
// ===================================================
// MASTER MAPPING RULES: 200 PRODUCTS COVERAGE
// ===================================================


  // BUILDING MATERIALS (Category 20)
  {
    categoryId: 20, subCategoryId: 94, priority: 200,
    keywords: ["cement", "waterproofing", "dr. fixit", "wall putty", "pop", "plaster of paris", "white cement", "marble chips"]
  },
  {
    categoryId: 20, subCategoryId: 95, priority: 200,
    keywords: ["sariya", "tmt steel", "iron bar", "rebar", "gi pipe", "pvc agri pipe", "tarpaulin", "tirपाल", "rope", "rassi", "sutli", "bricks"]
  },
  {
    categoryId: 20, subCategoryId: 96, priority: 200,
    keywords: ["paint", "emulsion", "distemper", "enamel", "primer", "sandpaper", "emery sheet", "paint brush", "roller brush", "thinner"]
  },

  // HARDWARE & PLUMBING (Category 19)
  {
    categoryId: 19, subCategoryId: 92, priority: 200,
    keywords: ["taparia", "screwdriver", "pliers", "spanner", "wrench", "measuring tape", "freemans", "hand saw", "hacksaw", "nails", "wire", "screws", "nut bolt", "padlock", "door latch", "door handle", "door hinges", "trowel", "karni", "shovel", "hammer", "pickaxe", "gaiti", "tasla", "tagari", "rust remover", "caulking glue gun"]
  },
  {
    categoryId: 19, subCategoryId: 93, priority: 200,
    keywords: ["water tap", "bib cock", "valve", "hose pipe", "teflon", "waste pipe", "pvc pipe"]
  },

  // FAST FOOD & RESTAURANT (Category 7)
  {
    categoryId: 7, subCategoryId: 31, priority: 200,
    keywords: ["burger", "pizza", "noodles", "fried rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "mocktail", "shake", "kachori", "samosa", "chaat", "thali", "kadi"]
  },
  {
    categoryId: 7, subCategoryId: 10, priority: 200,
    keywords: ["soan papdi", "bhakarwadi", "mathri", "pringles", "chips", "biscuits", "jam", "syrup", "jelly", "kurkure", "lays", "idli mix", "dosa mix", "soup"]
  },

  // WOMEN FASHION & ACCESSORIES (Category 13)
  {
    categoryId: 13, subCategoryId: 49, priority: 200,
    keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax strips", "razor", "powder", "lotion", "cream", "cosmetic", "beauty", "compact", "foundation", "concealer"]
  },
  {
    categoryId: 13, subCategoryId: 47, priority: 200,
    keywords: ["hair pin", "hair band", "hair claw", "hair oil", "shampoo", "curling iron", "hair brush", "hair serum", "bangle", "jhumka", "necklace", "ear ring", "chain", "ring", "anklet", "toe ring"]
  },
  {
    categoryId: 13, subCategoryId: 71, priority: 200,
    keywords: ["panty", "lingerie", "socks", "sports wear", "gym", "jeans", "t-shirt", "handkerchief"]
  },
  {
    categoryId: 13, subCategoryId: 70, priority: 200,
    keywords: ["backpack", "sling bag", "shoulder bag", "cosmetic bag", "stole", "shawl", "gloves", "umbrella", "watch", "smart watch", "travel kit", "pouch"]
  },

  // BABY & KIDS (Category 9)
  {
    categoryId: 9, subCategoryId: 53, priority: 200,
    keywords: ["baby soap", "baby net", "feeding", "baby bib", "swaddle", "baby sock", "toothpaste", "safety locks", "cotton bud", "infant milk", "pacifier", "sipper"]
  },
  {
    categoryId: 9, subCategoryId: 54, priority: 200,
    keywords: ["cricket", "bat", "ball", "flying disc", "frisbee", "dart", "chess", "ludo", "snakes", "skipping rope"]
  },

  // ELECTRONICS & ACCESSORIES (Category 11)
  
   // 1. Building Materials (Category 20) -> Sub-categories: 94, 95, 96
  { categoryId: 20, subCategoryId: 94, priority: 200, keywords: ["cement", "putty", "wallmax", "waterproofing", "dr. fixit", "pop", "plaster"] },
  { categoryId: 20, subCategoryId: 95, priority: 200, keywords: ["bricks", "iron bar", "tmt steel", "sariya", "pipe", "conduit", "tarpaulin", "तिरपाल"] },
  { categoryId: 20, subCategoryId: 96, priority: 200, keywords: ["paint", "emulsion", "distemper", "enamel", "primer", "sandpaper", "paint brush", "roller"] },

  // 2. Hardware & Electrical (Category 19) -> Sub-categories: 92, 93
  { categoryId: 19, subCategoryId: 92, priority: 200, keywords: ["screwdriver", "pliers", "spanner", "wrench", "measuring tape", "saw", "nails", "wire", "screws", "bolt", "padlock", "door latch", "handle", "hinges", "trowel", "karni", "shovel", "hammer", "pickaxe", "tasla", "switch", "socket", "tape", "box", "breaker", "helmet"] },
  { categoryId: 19, subCategoryId: 93, priority: 200, keywords: ["tap", "valve", "hose", "pipe", "teflon", "waste pipe"] },

  // 3. Restaurants & Food (Category 7) -> Sub-categories: 31, 44, 14
  { categoryId: 7, subCategoryId: 31, priority: 200, keywords: ["burger", "pizza", "noodles", "fried rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "chaat", "thali"] },
  { categoryId: 7, subCategoryId: 44, priority: 200, keywords: ["mocktail", "shake", "cooler", "nimbu paani", "soda", "coke"] },
  { categoryId: 7, subCategoryId: 14, priority: 200, keywords: ["soan papdi", "bhakarwadi", "mathri", "chips", "kurkure", "lays", "idli", "dosa", "soup", "jam", "syrup"] },

  // 4. Women Fashion (Category 13) -> Sub-categories: 49, 47, 71, 70
  { categoryId: 13, subCategoryId: 49, priority: 200, keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "cream", "cosmetic"] },
  { categoryId: 13, subCategoryId: 47, priority: 200, keywords: ["hair pin", "hair band", "hair claw", "hair oil", "shampoo", "straightener", "hair brush", "bangle", "necklace", "earring", "jhumka"] },
  { categoryId: 13, subCategoryId: 71, priority: 200, keywords: ["panty", "lingerie", "socks", "innerwear"] },
  { categoryId: 13, subCategoryId: 70, priority: 200, keywords: ["backpack", "sling bag", "handbag", "stole", "shawl", "gloves", "umbrella", "watch"] },

  // 5. Baby & Kids Zone (Category 9) -> Sub-categories: 53, 54
  { categoryId: 9, subCategoryId: 53, priority: 200, keywords: ["baby soap", "baby net", "feeding", "baby bib", "swaddle", "baby sock", "toothpaste", "safety locks"] },
  { categoryId: 9, subCategoryId: 54, priority: 200, keywords: ["cricket", "bat", "ball", "flying disc", "chess", "ludo"] },

  // 6. Electronics (Category 11, 12) -> Sub-categories: 60, 66
  { categoryId: 11, subCategoryId: 60, priority: 200, keywords: ["usb", "vga", "hdmi", "cable", "hard drive", "speaker", "headset", "dvd", "fan", "ups", "bluetooth", "mouse", "keyboard", "selfie"] },
  { categoryId: 12, subCategoryId: 66, priority: 200, keywords: ["iron", "trimmer", "hair dryer", "kettle", "blender", "power bank", "adapter"] },
   
  
  { categoryId: 20, subCategoryId: 94, priority: 200, keywords: ["cement", "putty", "wallmax", "waterproofing", "dr. fixit", "pop", "plaster"] },
  { categoryId: 20, subCategoryId: 95, priority: 200, keywords: ["bricks", "iron bar", "tmt steel", "sariya", "pipe", "conduit", "tarpaulin", "तिरपाल"] },
  { categoryId: 20, subCategoryId: 96, priority: 200, keywords: ["paint", "emulsion", "distemper", "enamel", "primer", "sandpaper", "paint brush", "roller"] },

  // 2. Hardware & Electrical (Category 19) -> Sub-categories: 92, 93
  { categoryId: 19, subCategoryId: 92, priority: 200, keywords: ["screwdriver", "pliers", "spanner", "wrench", "measuring tape", "saw", "nails", "wire", "screws", "bolt", "padlock", "door latch", "handle", "hinges", "trowel", "karni", "shovel", "hammer", "pickaxe", "tasla", "switch", "socket", "tape", "box", "breaker", "helmet"] },
  { categoryId: 19, subCategoryId: 93, priority: 200, keywords: ["tap", "valve", "hose", "pipe", "teflon", "waste pipe"] },

  // 3. Restaurants & Food (Category 7) -> Sub-categories: 31, 44, 14
  { categoryId: 7, subCategoryId: 31, priority: 200, keywords: ["burger", "pizza", "noodles", "fried rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "chaat", "thali"] },
  { categoryId: 7, subCategoryId: 44, priority: 200, keywords: ["mocktail", "shake", "cooler", "nimbu paani", "soda", "coke"] },
  { categoryId: 7, subCategoryId: 14, priority: 200, keywords: ["soan papdi", "bhakarwadi", "mathri", "chips", "kurkure", "lays", "idli", "dosa", "soup", "jam", "syrup"] },

  // 4. Women Fashion (Category 13) -> Sub-categories: 49, 47, 71, 70
  { categoryId: 13, subCategoryId: 49, priority: 200, keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "cream", "cosmetic"] },
  { categoryId: 13, subCategoryId: 47, priority: 200, keywords: ["hair pin", "hair band", "hair claw", "hair oil", "shampoo", "straightener", "hair brush", "bangle", "necklace", "earring", "jhumka"] },
  { categoryId: 13, subCategoryId: 71, priority: 200, keywords: ["panty", "lingerie", "socks", "innerwear"] },
  { categoryId: 13, subCategoryId: 70, priority: 200, keywords: ["backpack", "sling bag", "handbag", "stole", "shawl", "gloves", "umbrella", "watch"] },

  // 5. Baby & Kids Zone (Category 9) -> Sub-categories: 53, 54
  { categoryId: 9, subCategoryId: 53, priority: 200, keywords: ["baby soap", "baby net", "feeding", "baby bib", "swaddle", "baby sock", "toothpaste", "safety locks"] },
  { categoryId: 9, subCategoryId: 54, priority: 200, keywords: ["cricket", "bat", "ball", "flying disc", "chess", "ludo"] },

  // 6. Electronics (Category 11, 12) -> Sub-categories: 60, 66
  { categoryId: 11, subCategoryId: 60, priority: 200, keywords: ["usb", "vga", "hdmi", "cable", "hard drive", "speaker", "headset", "dvd", "fan", "ups", "bluetooth", "mouse", "keyboard", "selfie"] },
  { categoryId: 12, subCategoryId: 66, priority: 200, keywords: ["iron", "trimmer", "hair dryer", "kettle", "blender", "power bank", "adapter"] },
// ===================================================
// HIGH PRIORITY MAPPING RULES
// ===================================================


  // Building Materials (Category 20)
  { categoryId: 20, subCategoryId: 94, priority: 500, keywords: ["cement", "putty", "waterproof", "dr. fixit", "pop", "plaster", "wallmax"] },
  { categoryId: 20, subCategoryId: 95, priority: 500, keywords: ["sariya", "tmt steel", "iron", "pipe", "conduit", "bricks", "tarpaulin", "tirपाल", "rassi"] },
  { categoryId: 20, subCategoryId: 96, priority: 500, keywords: ["paint", "emulsion", "distemper", "enamel", "primer", "sandpaper", "emery", "brush", "roller"] },

  // Hardware & Plumbing (Category 19)
  { categoryId: 19, subCategoryId: 92, priority: 500, keywords: ["taparia", "screwdriver", "pliers", "spanner", "wrench", "measuring tape", "freemans", "saw", "nails", "wire", "screws", "bolt", "padlock", "latch", "handle", "hinges", "trowel", "karni", "shovel", "hammer", "pickaxe", "gaiti", "tasla", "tagari", "switch", "socket", "tape", "box", "rose", "holder", "breaker", "helmet"] },
  { categoryId: 19, subCategoryId: 93, priority: 500, keywords: ["tap", "valve", "hose", "pipe", "teflon", "waste pipe"] },

  // Food & Snacks (Category 7)
  { categoryId: 7, subCategoryId: 31, priority: 500, keywords: ["burger", "pizza", "noodles", "rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "mocktail", "shake", "kachori", "samosa", "chaat", "thali", "kadi"] },
  { categoryId: 7, subCategoryId: 10, priority: 500, keywords: ["soan papdi", "bhakarwadi", "mathri", "pringles", "chips", "kurkure", "lays", "idli", "dosa", "soup", "jam", "syrup", "jelly"] },

  // Women Fashion (Category 13)
  { categoryId: 13, subCategoryId: 49, priority: 500, keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "lotion", "cream", "cosmetic", "beauty", "earring", "necklace", "ring", "anklet"] },
  { categoryId: 13, subCategoryId: 47, priority: 500, keywords: ["hair pin", "hair band", "hair claw", "hair oil", "shampoo", "curling", "hair brush", "hair serum", "bangle", "jhumka", "hair bun"] },
  { categoryId: 13, subCategoryId: 71, priority: 500, keywords: ["panty", "lingerie", "socks"] },
  { categoryId: 13, subCategoryId: 70, priority: 500, keywords: ["backpack", "sling bag", "handbag", "stole", "shawl", "gloves", "umbrella", "watch", "smart watch", "travel kit", "pouch"] },

  // Baby Care (Category 9)
  { categoryId: 9, subCategoryId: 53, priority: 500, keywords: ["baby soap", "baby net", "feeding", "baby bib", "swaddle", "baby sock", "toothpaste", "safety locks", "cotton bud", "infant milk", "pacifier", "sipper"] },
  { categoryId: 9, subCategoryId: 54, priority: 500, keywords: ["cricket", "bat", "ball", "flying disc", "frisbee", "dart", "chess", "ludo", "snakes", "skipping rope"] },

  // Electronics (Category 11)
  { categoryId: 11, subCategoryId: 60, priority: 500, keywords: ["usb", "vga", "hdmi", "cable", "hard drive", "speaker", "headset", "dvd", "fan", "ups", "bluetooth", "mouse", "keyboard", "selfie", "earbuds"] },
 { categoryId: 20, subCategoryId: 94, priority: 500,keywords: ["cement", "putty", "fixit", "pop", "plaster"] },
  { categoryId: 20, subCategoryId: 95,priority: 500, keywords: ["sariya", "pipe", "conduit", "bricks", "tarpaulin", "tirpal", "rassi"] },
  { categoryId: 20, subCategoryId: 96,priority: 500, keywords: ["paint", "emulsion", "distemper", "enamel", "primer", "sandpaper", "brush", "roller"] },

  // Hardware (Category 19)
  { categoryId: 19, subCategoryId: 92,priority: 500, keywords: ["taparia", "screwdriver", "pliers", "wrench", "measuring", "saw", "nails", "bolt", "lock", "latch", "handle", "hinges", "hammer", "switch", "socket", "tape"] },

  // Restaurant/Food (Category 7)
  { categoryId: 7, subCategoryId: 31,priority: 500, keywords: ["burger", "pizza", "noodles", "manchurian", "momos", "spring roll", "fries", "sandwich", "chaat", "thali"] },
  { categoryId: 7, subCategoryId: 44,priority: 500, keywords: ["mocktail", "shake", "cooler", "soda"] },
  { categoryId: 7, subCategoryId: 10,priority: 500, keywords: ["chips", "kurkure", "lays", "idli", "dosa", "soup", "jam", "syrup", "kaju katli", "poha", "oats"] },

  // Fashion (Category 13)
  { categoryId: 13, subCategoryId: 49,priority: 500, keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "cream", "beauty"] },
  { categoryId: 13, subCategoryId: 49,priority: 500, keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "cream", "beauty"] },
  { categoryId: 13, subCategoryId: 47,priority: 500, keywords: ["hair", "brush", "shampoo", "serum", "bangle", "necklace", "earring", "jhumka"] },
    { categoryId: 2, subCategoryId: 10, priority: 800, keywords: ["kurkure", "hing", "paste", "sauce", "idli", "dosa", "soup", "chutney", "makhana", "clove", "nutmeg", "pickle"] },
  { categoryId: 7, subCategoryId: 31, priority: 800, keywords: ["burger", "pizza", "noodles", "rice", "manchurian", "momos", "spring roll", "fries", "sandwich", "chaat", "thali", "poha", "oats"] },

  // BUILDING MATERIALS (Cat 20)
  { categoryId: 20, subCategoryId: 94, priority: 800, keywords: ["cement", "putty", "fixit", "pop", "plaster", "adhesive"] },
  { categoryId: 20, subCategoryId: 95, priority: 800, keywords: ["pipe", "conduit", "bricks", "tarpaulin", "tirpal", "rassi", "sutli"] },
  { categoryId: 20, subCategoryId: 96, priority: 800, keywords: ["paint", "emulsion", "distemper", "enamel", "primer", "sandpaper", "brush", "roller"] },

  // HARDWARE & ELECTRICAL (Cat 19)
  { categoryId: 19, subCategoryId: 92, priority: 800, keywords: ["taparia", "screwdriver", "pliers", "wrench", "measuring", "saw", "nails", "bolt", "lock", "latch", "handle", "hinges", "hammer", "switch", "socket", "tape", "breaker"] },

  // WOMEN FASHION & GROOMING (Cat 13)
  { categoryId: 13, subCategoryId: 49, priority: 800, keywords: ["makeup", "nail", "lipstick", "bindi", "eyeliner", "kajal", "facial", "wax", "razor", "powder", "cream", "cosmetic", "beauty", "grooming"] },
  { categoryId: 13, subCategoryId: 47, priority: 800, keywords: ["hair", "brush", "shampoo", "serum", "bangle", "necklace", "earring", "jhumka", "jewelry"] },
  { categoryId: 13, subCategoryId: 70, priority: 800, keywords: ["belt", "bag", "pillow", "watch"] },

  // ELECTRONICS (Cat 11 & 10)
  { categoryId: 11, subCategoryId: 60, priority: 800, keywords: ["mechanical", "keyboard", "audio", "cable", "power supply", "cabinet", "headphone", "headset"] },
  { categoryId: 10, subCategoryId: 61, priority: 800, keywords: ["privacy", "charging", "adaptor", "finger sleeves"] },

  // SPORTS & CAR ACCESSORIES (Cat 22 & 23)
  { categoryId: 22, subCategoryId: 85, priority: 800, keywords: ["car", "gel", "polish", "wax", "shiner", "charger"] },
  { categoryId: 23, subCategoryId: 88, priority: 800, keywords: ["yonex", "wickets", "chess", "carrom", "stopwatch", "skipping", "ankle", "wrist"] },

  // BABY & PETS (Cat 9 & 24)
  { categoryId: 9, subCategoryId: 53, priority: 800, keywords: ["baby", "bib", "socks", "mosquito net", "safety"] },
  { categoryId: 24, subCategoryId: 90, priority: 800, keywords: ["dog", "pet", "harness", "leash", "raincoat"] },
   { categoryId: 4, subCategoryId: 25, priority: 900, keywords: ["potato", "onion", "tomato", "cauliflower", "cabbage", "peas", "ladies finger", "brinjal", "bottle gourd", "bitter gourd", "cucumber", "lemon", "capsicum", "pumpkin", "beetroot", "sweet potato", "banana", "apple", "pomegranate", "orange", "papaya", "watermelon", "muskmelon", "guava", "mango", "pineapple", "coconut", "pear", "sweet lime", "chikoo", "kiwi"] },
  
  // 2. MEAT, EGGS & FROZEN FOODS (Category 5)
  { categoryId: 5, subCategoryId: 28, priority: 900, keywords: ["eggs", "chicken", "mutton", "fish", "prawns", "seekh kebab", "nuggets", "meatballs", "veggie nuggets", "aloo tikki", "smiles", "paneer bites", "crab sticks", "paratha", "kofta", "chole bhature", "mixed vegetables", "dahi tikki"] },
  
  // 3. DAIRY & BAKERY (Category 3)
  { categoryId: 3, subCategoryId: 22, priority: 900, keywords: ["rusk", "bread", "pav bun", "shrikhand", "chocolate spread", "chach"] },
  
  // 4. ELECTRONICS & GAMING (Category 11)
  { categoryId: 11, subCategoryId: 60, priority: 900, keywords: ["mechanical", "keyboard", "audio", "power supply", "cabinet", "gaming", "headphone", "headset"] },
  
  // 5. PERSONAL CARE & HYGIENE (Category 8)
  { categoryId: 8, subCategoryId: 18, priority: 900, keywords: ["sanitizer", "bleach", "ear buds", "comb", "brush", "paste", "dant kanti"] },

  // 6. GROCERY & STAPLES (Category 2)
  { categoryId: 2, subCategoryId: 11, priority: 900, keywords: ["sabudana", "kasuri methi", "ginger paste", "garlic paste", "sauce", "chilli powder", "khaman"] },
    { categoryId: 11, subCategoryId: 60, priority: 999, keywords: ["foot rest", "sennheiser", "headphone"] },
  { categoryId: 21, subCategoryId: 81, priority: 999, keywords: ["sello-tape", "foam tape", "geometry"] },
  { categoryId: 17, subCategoryId: 75, priority: 999, keywords: ["matchbox", "lota", "copper"] },
  { categoryId: 22, subCategoryId: 85, priority: 999, keywords: ["anti-rust", "spray"] },
  { categoryId: 23, subCategoryId: 88, priority: 999, keywords: ["inflator", "swimming", "frisbee", "dart", "ludo", "snakes", "skipping", "sweat guard"] },

  // 2. WOMEN FASHION & GROOMING (Cat 13)
  { categoryId: 13, subCategoryId: 49, priority: 999, keywords: ["eyebrow", "shoe polish", "pedicure", "eye mask", "skin care", "combo kit", "neck tie", "sweatbands", "trousers", "dhoti"] },

  // 3. FOOD, SNACKS & FROZEN (Cat 2, 7, 5)
  { categoryId: 2, subCategoryId: 10, priority: 999, keywords: ["lays", "mentos", "mouth freshener", "makhana", "chilli powder", "khaman"] },
  { categoryId: 7, subCategoryId: 31, priority: 999, keywords: ["maggi", "vinegar", "paneer", "bounce", "chilli"] },
  { categoryId: 5, subCategoryId: 28, priority: 999, keywords: ["frozen", "sweet corn", "green peas", "malai paneer", "kofta", "safal"] },

  // 4. BABY, PETS & PERSONAL CARE (Cat 9, 24, 8, 6)
  { categoryId: 9, subCategoryId: 53, priority: 999, keywords: ["uniform"] },
  { categoryId: 24, subCategoryId: 90, priority: 999, keywords: ["raincoat", "digyton"] },
  { categoryId: 8, subCategoryId: 18, priority: 999, keywords: ["sanitizer", "bleach", "ear buds", "hair paddle", "comb"] },
  { categoryId: 6, subCategoryId: 20, priority: 999, keywords: ["surgical", "boroplus", "vinegar", "ringcutter"] },

  // 5. HARDWARE (Cat 19, 14)
  { categoryId: 19, subCategoryId: 92, priority: 999, keywords: ["gloves"] },
  { categoryId: 14, subCategoryId: 95, priority: 999, keywords: ["wire", "screws"] },
    { categoryId: 2, subCategoryId: 10, priority: 999, keywords: ["lays", "hot 'n' sweet chili"] },
  { categoryId: 7, subCategoryId: 31, priority: 999, keywords: ["sunfeast yippee", "masala"] },
  
  // 2. Electronics (Category 10)
  { categoryId: 10, subCategoryId: 61, priority: 999, keywords: ["mivi duopods", "earbuds", "selfie stick"] }
];

// =====================================================
// FIND BEST SUBCATEGORY
// =====================================================

function findSubCategory(product: {
  categoryId: number | null;
  name: string;
}) {

  const productName = normalize(product.name);

  let bestRule: Rule | null = null;

  for (const rule of RULES) {

    // Category match
    if (
      rule.categoryId &&
      rule.categoryId !== product.categoryId
    ) {
      continue;
    }

    // Excluded words
    if (rule.exclude) {

      let blocked = false;

      for (const ex of rule.exclude) {

        if (
          productName.includes(normalize(ex))
        ) {
          blocked = true;
          break;
        }

      }

      if (blocked) continue;

    }

    // Keyword match
    for (const keyword of rule.keywords) {

      if (
        productName.includes(
          normalize(keyword)
        )
      ) {

        if (
          !bestRule ||
          rule.priority > bestRule.priority
        ) {
          bestRule = rule;
        }

      }

    }

  }

  if (!bestRule) {
    return null;
  }

  return bestRule.subCategoryId;

}
const keywordMappings: Record<string, string[]> = {
  "Oil & Ghee": [
    "ghee",
    "oil",
    "mustard",
    "sunflower",
    "refined",
    "fortune",
    "dhara",
  ],

  "Butter, Cheese & Paneer": [
    "paneer",
    "cheese",
    "butter",
    "dahi",
    "curd",
    "lassi",
    "milk",
  ],

  "Biscuits & Cookies": [
    "biscuit",
    "cookie",
    "parle",
    "oreo",
    "bourbon",
    "hide & seek",
    "dark fantasy",
    "good day",
    "tiger",
  ],

  "Chocolates & Candies": [
    "kitkat",
    "dairy milk",
    "5 star",
    "perk",
    "munch",
    "eclairs",
    "melody",
    "chocolate",
    "candy",
  ],

  "Spices & Masalas": [
    "masala",
    "haldi",
    "turmeric",
    "jeera",
    "coriander",
    "chilli",
    "mdh",
    "everest",
    "catch",
  ],

  "Dry Fruits": [
    "almond",
    "cashew",
    "kaju",
    "pista",
    "raisin",
    "kishmish",
    "akhrot",
  ],

  "Juices": [
    "juice",
    "real",
    "tropicana",
    "maaza",
    "frooti",
    "slice",
  ],

  "Toothpaste & Oral Care": [
    "colgate",
    "closeup",
    "sensodyne",
    "toothpaste",
    "toothbrush",
  ],

  "Bath Soap": [
    "lux",
    "lifebuoy",
    "dove",
    "soap",
    "hamam",
    "pears",
  ],

  "Shampoo": [
    "shampoo",
    "clinic plus",
    "sunsilk",
    "head & shoulders",
    "pantene",
  ],

  "Shaving": [
    "gillette",
    "razor",
    "blade",
    "shaving",
  ],

  "Baby Food": [
    "cerelac",
    "farex",
  ],

  "Diapers": [
    "pampers",
    "mamypoko",
    "diaper",
  ],

  "Toys": [
    "barbie",
    "lego",
    "toy",
    "teddy",
    "keyboard",
    "uno",
  ],
};
// =====================================================
// MAIN
// =====================================================

async function main() {

  console.log("======================================");
  console.log("PRODUCT SUBCATEGORY MAPPING STARTED");
  console.log("======================================");

  // -----------------------------
  // Load Master Products
  // -----------------------------

  const allProducts =
    await db.select().from(masterProducts);

  console.log(
    `Master Products : ${allProducts.length}`
  );

  // -----------------------------
  // Existing mappings
  // -----------------------------

  const existingMappings =
    await db
      .select()
      .from(productSubcategories);

  const mappingSet =
    new Set(
      existingMappings.map(
        m =>
          `${m.masterProductId}_${m.subCategoryId}`
      )
    );

  const mappedProducts =
    new Set(
      existingMappings.map(
        m => m.masterProductId
      )
    );

  console.log(
    `Existing mappings : ${existingMappings.length}`
  );

  // -----------------------------
  // Counters
  // -----------------------------

  let inserted = 0;

  let skipped = 0;

  let unmatched = 0;

  const unmatchedProducts: any[] = [];

  // -----------------------------
  // Start Loop
  // -----------------------------

  for (const product of allProducts) {

    // Already mapped

    if (
      mappedProducts.has(product.id)
    ) {
      skipped++;
      continue;
    }

    const subCategoryId =
      findSubCategory({
        categoryId: product.categoryId,
        name: product.name,
      });

    // No rule matched

    if (!subCategoryId) {

      unmatched++;

      unmatchedProducts.push({
        id: product.id,
        categoryId: product.categoryId,
        name: product.name,
      });

      continue;

    }

    const key =
      `${product.id}_${subCategoryId}`;

    if (
      mappingSet.has(key)
    ) {

      skipped++;

      continue;

    }

    // -----------------------------
    // Insert Mapping
    // -----------------------------

    try {

      await db
        .insert(productSubcategories)
        .values({

          masterProductId: product.id,

          subCategoryId,

        });

      inserted++;

      mappingSet.add(key);

      mappedProducts.add(product.id);

      if (inserted % 100 === 0) {

        console.log(
          `Inserted : ${inserted}`
        );

      }

    } catch (err) {

      console.log(
        `Insert failed for Product ${product.id}`
      );

      console.log(err);

    }

  }
  // =====================================================
// CATEGORY -> SUBCATEGORY MAPPING
// =====================================================

console.log("");

console.log("Updating category_subcategories...");

const categoryMappings =
  await db
    .select()
    .from(productSubcategories);

const existingCategoryMappings =
  await db
    .select()
    .from(categorySubcategories);

const categorySet =
  new Set(
    existingCategoryMappings.map(
      x =>
        `${x.categoryId}_${x.subCategoryId}`
    )
  );

let categoryInserted = 0;

for (const product of allProducts) {

  const productMappings =
    categoryMappings.filter(
      x => x.masterProductId === product.id
    );

  for (const mapping of productMappings) {

    const key =
      `${product.categoryId}_${mapping.subCategoryId}`;

    if (
      categorySet.has(key)
    ) {
      continue;
    }

    try {

      await db
        .insert(categorySubcategories)
        .values({

          categoryId: product.categoryId!,

          subCategoryId: mapping.subCategoryId,

        });

      categorySet.add(key);

      categoryInserted++;

    } catch {}

  }

}

console.log(
  `Category mappings inserted : ${categoryInserted}`
);
// -----------------------------
  // SUMMARY
  // -----------------------------

  console.log("");

  console.log("======================================");

  console.log("MAPPING FINISHED");

  console.log("======================================");

  console.log(`Inserted : ${inserted}`);

  console.log(`Skipped : ${skipped}`);

  console.log(`Unmatched : ${unmatched}`);
console.log(
  `Category mappings : ${categoryInserted}`
);
  console.log("");

  if (unmatchedProducts.length > 0) {

    console.log("First 200 unmatched products:");

    console.table(
      unmatchedProducts.slice(0, 200)
    );

  }

}

main()
  .then(() => process.exit(0))
  .catch((err) => {

    console.error(err);

    process.exit(1);

  });