// Seed data parsed from the "Current Stock Position Report"
// Noir Cinema — Othaim Mall, Onaizah · 25/09/2026 4:14 PM
// stock = System Stock per location · rate = Nett Amount / System Stock (SAR, pre-tax)
// sku = item name as it appears on the report
// Product photos: supplier PDF (30/09/2026)
// par = "full" level used for the stock gauge (defaults to the report quantity)
export const SEED_VERSION = 4;
export const SEED_DATE = "2026-09-25T16:14:00+03:00";
export const SEED_PRODUCTS = [
 {
  "id": "bib-coke",
  "name": "Coca-Cola BIB Syrup",
  "sku": "BIB COKE",
  "code": "",
  "category": "syrups",
  "unit": "box",
  "image": "assets/products/bib-coke.webp",
  "stock": {
   "mini": 17.36,
   "refuel": 0,
   "stores": 20.0
  },
  "min": 0,
  "rate": 27.102,
  "par": 40
 },
 {
  "id": "bib-coke-zero",
  "name": "Coke Zero BIB Syrup",
  "sku": "BIB Coke Zero",
  "code": "",
  "category": "syrups",
  "unit": "box",
  "image": "assets/products/bib-coke-zero.webp",
  "stock": {
   "mini": 8.94,
   "refuel": 0,
   "stores": 10.0
  },
  "min": 0,
  "rate": 27.1035,
  "par": 20
 },
 {
  "id": "bib-fanta",
  "name": "Fanta BIB Syrup",
  "sku": "BIB FANTA",
  "code": "",
  "category": "syrups",
  "unit": "box",
  "image": "assets/products/bib-fanta.webp",
  "stock": {
   "mini": 9.67,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 25.5988,
  "par": 10
 },
 {
  "id": "lemonade-syrup",
  "name": "Lemonade Syrup",
  "sku": "Lemonade Syrup",
  "code": "",
  "category": "syrups",
  "unit": "ltr",
  "image": "assets/products/lemonade-syrup.webp",
  "stock": {
   "mini": 0.83,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 48.2289,
  "par": 1
 },
 {
  "id": "mojito-syrup",
  "name": "Mojito Syrup",
  "sku": "Mojito Syrup",
  "code": "",
  "category": "syrups",
  "unit": "ltr",
  "image": "assets/products/mojito-syrup.webp",
  "stock": {
   "mini": 0.7,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 48.5143,
  "par": 1
 },
 {
  "id": "bib-sprite",
  "name": "Sprite BIB Syrup",
  "sku": "BIB SPRITE",
  "code": "",
  "category": "syrups",
  "unit": "box",
  "image": "assets/products/bib-sprite.webp",
  "stock": {
   "mini": 8.78,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 25.5911,
  "par": 9
 },
 {
  "id": "arwa-500",
  "name": "Arwa Water 500 ml",
  "sku": "Arwa - 500 ML",
  "code": "",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/arwa-500.webp",
  "stock": {
   "mini": 21.0,
   "refuel": 50.0,
   "stores": 528.0
  },
  "min": 0,
  "rate": 0.53,
  "par": 600
 },
 {
  "id": "arwa-zero",
  "name": "Arwa Zero 500 ml",
  "sku": "Arwa Zero - 500Ml",
  "code": "",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/arwa-zero.webp",
  "stock": {
   "mini": 0,
   "refuel": 38.0,
   "stores": 51.0
  },
  "min": 0,
  "rate": 0.75,
  "par": 90
 },
 {
  "id": "barbican",
  "name": "Barbican",
  "sku": "BARBICAN CAN",
  "code": "B00000016",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/barbican.webp",
  "stock": {
   "mini": 0,
   "refuel": 19.0,
   "stores": 30.0
  },
  "min": 0,
  "rate": 2.0,
  "par": 50
 },
 {
  "id": "monster",
  "name": "Monster Energy Can",
  "sku": "MONSTER CAN",
  "code": "M00000013",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/monster.webp",
  "stock": {
   "mini": 0,
   "refuel": 22.0,
   "stores": 0
  },
  "min": 0,
  "rate": 7.66,
  "par": 25
 },
 {
  "id": "rani",
  "name": "Rani Can",
  "sku": "RANI CAN",
  "code": "R00000007",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/rani.webp",
  "stock": {
   "mini": 0,
   "refuel": 32.0,
   "stores": 64.0
  },
  "min": 0,
  "rate": 1.92,
  "par": 100
 },
 {
  "id": "schweppes",
  "name": "Schweppes Can",
  "sku": "SCHWEPPES CAN",
  "code": "S00000025",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/schweppes.webp",
  "stock": {
   "mini": 0,
   "refuel": 16.0,
   "stores": 42.0
  },
  "min": 0,
  "rate": 2.61,
  "par": 60
 },
 {
  "id": "vimto-can",
  "name": "Vimto Can 250 ml",
  "sku": "VIMTO CAN - 250 ML",
  "code": "",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/vimto-can.webp",
  "stock": {
   "mini": 0,
   "refuel": 26.0,
   "stores": 15.0
  },
  "min": 0,
  "rate": 1.8,
  "par": 45
 },
 {
  "id": "vimto-pet",
  "name": "Vimto PET 250 ml",
  "sku": "VIMTO PET - 250 ML",
  "code": "",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/vimto-pet.webp",
  "stock": {
   "mini": 0,
   "refuel": 31.0,
   "stores": 35.0
  },
  "min": 0,
  "rate": 1.58,
  "par": 70
 },
 {
  "id": "vimto-blueberry",
  "name": "Vimto PET Blueberry 250 ml",
  "sku": "",
  "code": "",
  "category": "drinks",
  "unit": "pcs",
  "image": "assets/products/vimto-blueberry.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 0,
  "par": 0
 },
 {
  "id": "mm-choco-150",
  "name": "M&M's Chocolate 150 g",
  "sku": "M&M CHOCO 150 GM",
  "code": "",
  "category": "snacks",
  "unit": "pcs",
  "image": "assets/products/mm-choco-150.webp",
  "stock": {
   "mini": 10.0,
   "refuel": 9.0,
   "stores": 45.0
  },
  "min": 0,
  "rate": 13.5,
  "par": 65
 },
 {
  "id": "mm-choco-45",
  "name": "M&M's Chocolate 45 g",
  "sku": "M&M Choco 45Gm",
  "code": "",
  "category": "snacks",
  "unit": "pcs",
  "image": "assets/products/mm-choco-45.webp",
  "stock": {
   "mini": 0,
   "refuel": 16.0,
   "stores": 0
  },
  "min": 0,
  "rate": 2.29,
  "par": 20
 },
 {
  "id": "mm-peanut-150",
  "name": "M&M's Peanut 150 g",
  "sku": "M&M PEANUT 150 GM",
  "code": "",
  "category": "snacks",
  "unit": "pcs",
  "image": "assets/products/mm-peanut-150.webp",
  "stock": {
   "mini": 0,
   "refuel": 16.0,
   "stores": 0
  },
  "min": 0,
  "rate": 13.95,
  "par": 20
 },
 {
  "id": "mm-peanut-45",
  "name": "M&M's Peanut 45 g",
  "sku": "M&M Peanut 45Gm",
  "code": "",
  "category": "snacks",
  "unit": "pcs",
  "image": "assets/products/mm-peanut-45.webp",
  "stock": {
   "mini": 0,
   "refuel": 27.0,
   "stores": 0
  },
  "min": 0,
  "rate": 2.75,
  "par": 30
 },
 {
  "id": "maltesers-175",
  "name": "Maltesers 175 g",
  "sku": "Maltesers 175Gm",
  "code": "",
  "category": "snacks",
  "unit": "pcs",
  "image": "assets/products/maltesers-175.webp",
  "stock": {
   "mini": 0,
   "refuel": 15.0,
   "stores": 0
  },
  "min": 0,
  "rate": 15.5,
  "par": 15
 },
 {
  "id": "maltesers-37",
  "name": "Maltesers 37 g",
  "sku": "Maltesers 37Gm",
  "code": "",
  "category": "snacks",
  "unit": "pcs",
  "image": "assets/products/maltesers-37.webp",
  "stock": {
   "mini": 0,
   "refuel": 27.0,
   "stores": 25.0
  },
  "min": 0,
  "rate": 2.6,
  "par": 55
 },
 {
  "id": "flossine-blue",
  "name": "Blue Raspberry Flossine",
  "sku": "Blue Raspberry Flossine",
  "code": "B00000021",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/flossine-blue.webp",
  "stock": {
   "mini": 2.91,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 490.7766,
  "par": 3
 },
 {
  "id": "corn-butterfly",
  "name": "Butterfly Corn",
  "sku": "CORN Butterfly",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/corn-butterfly.webp",
  "stock": {
   "mini": 28.26,
   "refuel": 0,
   "stores": 45.36
  },
  "min": 0,
  "rate": 5.5099,
  "par": 75
 },
 {
  "id": "caramel",
  "name": "Caramel",
  "sku": "CARAMEL",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/caramel.webp",
  "stock": {
   "mini": 5.46,
   "refuel": 0,
   "stores": 113.5
  },
  "min": 0,
  "rate": 14.7699,
  "par": 120
 },
 {
  "id": "cheese-masala",
  "name": "Cheese Masala",
  "sku": "CHEESE MASALA",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/cheese-masala.webp",
  "stock": {
   "mini": 7.35,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 53.0639,
  "par": 8
 },
 {
  "id": "cotton-candy-tub",
  "name": "Cotton Candy Floss Tub",
  "sku": "Cotton Candy Floss Tub",
  "code": "C00000012",
  "category": "popcorn",
  "unit": "pcs",
  "image": "assets/products/cotton-candy-tub.webp",
  "stock": {
   "mini": 0,
   "refuel": 10.0,
   "stores": 1172.0
  },
  "min": 0,
  "rate": 2.2309,
  "par": 1185
 },
 {
  "id": "corn-mushroom",
  "name": "Mushroom Corn",
  "sku": "CORN Mushroom",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/corn-mushroom.webp",
  "stock": {
   "mini": 20.4,
   "refuel": 0,
   "stores": 136.08
  },
  "min": 0,
  "rate": 5.7301,
  "par": 160
 },
 {
  "id": "pizza-mix",
  "name": "Pizza Savory Mix",
  "sku": "Pizza Savory Mix",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/pizza-mix.webp",
  "stock": {
   "mini": 10.49,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 61.0601,
  "par": 15
 },
 {
  "id": "popcorn-oil",
  "name": "Popcorn Oil",
  "sku": "POPCORN OIL",
  "code": "",
  "category": "popcorn",
  "unit": "ltr",
  "image": "assets/products/popcorn-oil.webp",
  "stock": {
   "mini": 10.62,
   "refuel": 0,
   "stores": 82.38
  },
  "min": 0,
  "rate": 22.9406,
  "par": 95
 },
 {
  "id": "tub-130",
  "name": "Popcorn Tub 130 oz",
  "sku": "130 Oz TUB",
  "code": "",
  "category": "popcorn",
  "unit": "pcs",
  "image": "assets/products/tub-130.webp",
  "stock": {
   "mini": 60.0,
   "refuel": 14.0,
   "stores": 500.0
  },
  "min": 0,
  "rate": 1.1,
  "par": 575
 },
 {
  "id": "tub-46",
  "name": "Popcorn Tub 46 oz",
  "sku": "46 Oz TUB",
  "code": "",
  "category": "popcorn",
  "unit": "pcs",
  "image": "assets/products/tub-46.webp",
  "stock": {
   "mini": 180.0,
   "refuel": 3.0,
   "stores": 4925.0
  },
  "min": 0,
  "rate": 0.5751,
  "par": 5110
 },
 {
  "id": "tub-64",
  "name": "Popcorn Tub 64 oz",
  "sku": "64 Oz TUB",
  "code": "",
  "category": "popcorn",
  "unit": "pcs",
  "image": "assets/products/tub-64.webp",
  "stock": {
   "mini": 51.0,
   "refuel": 16.0,
   "stores": 600.0
  },
  "min": 0,
  "rate": 0.85,
  "par": 670
 },
 {
  "id": "tub-85",
  "name": "Popcorn Tub 85 oz",
  "sku": "85 Oz TUB",
  "code": "",
  "category": "popcorn",
  "unit": "pcs",
  "image": "assets/products/tub-85.webp",
  "stock": {
   "mini": 38.0,
   "refuel": 14.0,
   "stores": 1300.0
  },
  "min": 0,
  "rate": 1.2944,
  "par": 1355
 },
 {
  "id": "salt",
  "name": "Salt",
  "sku": "SALT",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/salt.webp",
  "stock": {
   "mini": 22.35,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 9.2282,
  "par": 25
 },
 {
  "id": "sugar",
  "name": "Sugar",
  "sku": "SUGAR",
  "code": "",
  "category": "popcorn",
  "unit": "kg",
  "image": "",
  "stock": {
   "mini": 48.77,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 2.8999,
  "par": 50
 },
 {
  "id": "flossine-pink",
  "name": "Vanilla Pink Flossine",
  "sku": "Vanilla Pink Flossine",
  "code": "V00000003",
  "category": "popcorn",
  "unit": "kg",
  "image": "assets/products/flossine-pink.webp",
  "stock": {
   "mini": 2.89,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 490.5675,
  "par": 3
 },
 {
  "id": "hotdog",
  "name": "Beef Frankfurter Hot Dog",
  "sku": "",
  "code": "",
  "category": "food",
  "unit": "pcs",
  "image": "assets/products/hotdog.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 0,
  "par": 0
 },
 {
  "id": "cheese-sauce",
  "name": "Cheese Sauce",
  "sku": "CHEESE SAUCE",
  "code": "",
  "category": "food",
  "unit": "kg",
  "image": "assets/products/cheese-sauce.webp",
  "stock": {
   "mini": 6.77,
   "refuel": 0,
   "stores": 78.0
  },
  "min": 0,
  "rate": 17.2198,
  "par": 85
 },
 {
  "id": "hotdog-bun",
  "name": "Hot Dog Bun",
  "sku": "",
  "code": "",
  "category": "food",
  "unit": "pcs",
  "image": "assets/products/hotdog-bun.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 0,
  "par": 0
 },
 {
  "id": "jalapeno",
  "name": "Jalapeño",
  "sku": "NACHOS - JALAPENO",
  "code": "",
  "category": "food",
  "unit": "kg",
  "image": "assets/products/jalapeno.webp",
  "stock": {
   "mini": 3.06,
   "refuel": 0,
   "stores": 24.0
  },
  "min": 0,
  "rate": 9.7199,
  "par": 30
 },
 {
  "id": "mustard",
  "name": "Mustard Sauce",
  "sku": "MUSTARD SAUCE",
  "code": "M00000008",
  "category": "food",
  "unit": "kg",
  "image": "assets/products/mustard.webp",
  "stock": {
   "mini": 0.95,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 35.1263,
  "par": 1
 },
 {
  "id": "salsa",
  "name": "Ricos Chunky Salsa",
  "sku": "NACHOS - Ricos Chunky Salsa",
  "code": "N00000003",
  "category": "food",
  "unit": "kg",
  "image": "assets/products/salsa.webp",
  "stock": {
   "mini": 11.13,
   "refuel": 0,
   "stores": 26.46
  },
  "min": 0,
  "rate": 19.5073,
  "par": 40
 },
 {
  "id": "nachos-chips",
  "name": "Señorah Nacho Chips",
  "sku": "NACHOS - SENORAH CHIPS",
  "code": "N00000002",
  "category": "food",
  "unit": "kg",
  "image": "assets/products/nachos-chips.webp",
  "stock": {
   "mini": 1.56,
   "refuel": 0,
   "stores": 38.0
  },
  "min": 0,
  "rate": 27.498,
  "par": 40
 },
 {
  "id": "ketchup",
  "name": "Tomato Ketchup",
  "sku": "TOMATO KETCHUP",
  "code": "T00000006",
  "category": "food",
  "unit": "kg",
  "image": "assets/products/ketchup.webp",
  "stock": {
   "mini": 0.16,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 18.3125,
  "par": 1
 },
 {
  "id": "slush-blue",
  "name": "Slush Blue Raspberry",
  "sku": "SLUSH - Blue Raspberry",
  "code": "S00000015",
  "category": "slush",
  "unit": "ltr",
  "image": "assets/products/slush-blue.webp",
  "stock": {
   "mini": 15.83,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 21.5028,
  "par": 20
 },
 {
  "id": "slush-glass-12",
  "name": "Slush Glass 12 oz",
  "sku": "SLUSH - Glass 12 Oz",
  "code": "",
  "category": "slush",
  "unit": "pcs",
  "image": "assets/products/slush-glass-12.webp",
  "stock": {
   "mini": 25.0,
   "refuel": 17.0,
   "stores": 5600.0
  },
  "min": 0,
  "rate": 0.22,
  "par": 5645
 },
 {
  "id": "slush-glass-16",
  "name": "Slush Glass 16 oz",
  "sku": "SLUSH - Glass 16 Oz",
  "code": "",
  "category": "slush",
  "unit": "pcs",
  "image": "assets/products/slush-glass-16.webp",
  "stock": {
   "mini": 50.0,
   "refuel": 14.0,
   "stores": 4200.0
  },
  "min": 0,
  "rate": 0.29,
  "par": 4265
 },
 {
  "id": "slush-pom",
  "name": "Slush Pomegranate",
  "sku": "SLUSH - Pomegranate",
  "code": "",
  "category": "slush",
  "unit": "ltr",
  "image": "assets/products/slush-pom.webp",
  "stock": {
   "mini": 2.88,
   "refuel": 0,
   "stores": 10.0
  },
  "min": 0,
  "rate": 23.9922,
  "par": 15
 },
 {
  "id": "slush-straw",
  "name": "Slush Strawberry",
  "sku": "SLUSH - Strawberry",
  "code": "",
  "category": "slush",
  "unit": "ltr",
  "image": "assets/products/slush-straw.webp",
  "stock": {
   "mini": 12.68,
   "refuel": 0,
   "stores": 5.0
  },
  "min": 0,
  "rate": 24.0,
  "par": 20
 },
 {
  "id": "brown-sugar",
  "name": "Brown Sugar Sachet",
  "sku": "SUGAR SACHETS - BROWN",
  "code": "S00000017",
  "category": "hot",
  "unit": "pcs",
  "image": "assets/products/brown-sugar.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 2000.0
  },
  "min": 0,
  "rate": 0.06,
  "par": 2000
 },
 {
  "id": "coffee-cup-big",
  "name": "Coffee Cup Big",
  "sku": "Coffee Cup Big",
  "code": "",
  "category": "hot",
  "unit": "pcs",
  "image": "assets/products/coffee-cup-big.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 500.0
  },
  "min": 0,
  "rate": 0.28,
  "par": 500
 },
 {
  "id": "coffee-cup-small",
  "name": "Coffee Cup Small",
  "sku": "COFFEE CUP SMALL",
  "code": "C00000024",
  "category": "hot",
  "unit": "pcs",
  "image": "assets/products/coffee-cup-small.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 1000.0
  },
  "min": 0,
  "rate": 0.16,
  "par": 1000
 },
 {
  "id": "lemon",
  "name": "Lemon",
  "sku": "Lemon Whole",
  "code": "",
  "category": "hot",
  "unit": "kg",
  "image": "assets/products/lemon.webp",
  "stock": {
   "mini": 0.61,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 8.6557,
  "par": 1
 },
 {
  "id": "mint",
  "name": "Mint Leaves",
  "sku": "Mint Leaves",
  "code": "",
  "category": "hot",
  "unit": "kg",
  "image": "assets/products/mint.webp",
  "stock": {
   "mini": 0.29,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 8.4483,
  "par": 1
 },
 {
  "id": "sugar-sachet",
  "name": "Sugar Sachet",
  "sku": "SUGAR SACHET",
  "code": "",
  "category": "hot",
  "unit": "pcs",
  "image": "assets/products/sugar-sachet.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 2000.0
  },
  "min": 0,
  "rate": 0.02,
  "par": 2000
 },
 {
  "id": "sweet-low",
  "name": "Sweet'N Low Sachet",
  "sku": "SUGAR SACHETS - SWEET & LOW",
  "code": "S00000018",
  "category": "hot",
  "unit": "pcs",
  "image": "assets/products/sweet-low.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 400.0
  },
  "min": 0,
  "rate": 0.37,
  "par": 400
 },
 {
  "id": "cups-16",
  "name": "Cup 16 oz",
  "sku": "CUPS - 16 Oz",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/cups-16.webp",
  "stock": {
   "mini": 20.0,
   "refuel": 28.0,
   "stores": 1575.0
  },
  "min": 0,
  "rate": 0.01,
  "par": 1625
 },
 {
  "id": "cups-24",
  "name": "Cup 24 oz",
  "sku": "CUPS - 24 Oz",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/cups-24.webp",
  "stock": {
   "mini": 25.0,
   "refuel": 20.0,
   "stores": 2700.0
  },
  "min": 0,
  "rate": 0.1619,
  "par": 2745
 },
 {
  "id": "cups-30",
  "name": "Cup 30 oz",
  "sku": "CUPS - 30 Oz",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/cups-30.webp",
  "stock": {
   "mini": 50.0,
   "refuel": 23.0,
   "stores": 150.0
  },
  "min": 0,
  "rate": 0.4,
  "par": 225
 },
 {
  "id": "dip-cup-4",
  "name": "Dip Cup 4 oz",
  "sku": "Dip Cup 4",
  "code": "D00000002",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/dip-cup-4.webp",
  "stock": {
   "mini": 0,
   "refuel": 917.0,
   "stores": 0
  },
  "min": 0,
  "rate": 0.09,
  "par": 920
 },
 {
  "id": "hotdog-tray",
  "name": "Hot Dog Tray",
  "sku": "HOT DOG - Tray",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/hotdog-tray.webp",
  "stock": {
   "mini": 10.0,
   "refuel": 10.0,
   "stores": 3075.0
  },
  "min": 0,
  "rate": 0.4257,
  "par": 3095
 },
 {
  "id": "lids-16",
  "name": "Lid 16 oz",
  "sku": "LIDS - 16 Oz",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/lids-16.webp",
  "stock": {
   "mini": 39.0,
   "refuel": 0,
   "stores": 1700.0
  },
  "min": 0,
  "rate": 0.0135,
  "par": 1740
 },
 {
  "id": "lids-24",
  "name": "Lid 24 oz",
  "sku": "LIDS - 24 Oz",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/lids-24.webp",
  "stock": {
   "mini": 292.0,
   "refuel": 0,
   "stores": 2800.0
  },
  "min": 0,
  "rate": 0.0718,
  "par": 3095
 },
 {
  "id": "lids-30",
  "name": "Lid 30 oz",
  "sku": "LIDS - 30 Oz",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/lids-30.webp",
  "stock": {
   "mini": 191.0,
   "refuel": 0,
   "stores": 400.0
  },
  "min": 0,
  "rate": 0.0845,
  "par": 595
 },
 {
  "id": "nachos-tray-3",
  "name": "Nachos Tray 3-Comp",
  "sku": "NACHOS - TRAY 03 Comp",
  "code": "N00000004",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/nachos-tray-3.webp",
  "stock": {
   "mini": 35.0,
   "refuel": 23.0,
   "stores": 3610.0
  },
  "min": 0,
  "rate": 0.6498,
  "par": 3670
 },
 {
  "id": "nachos-tray-4",
  "name": "Nachos Tray 4-Comp",
  "sku": "NACHOS - TRAY 04 Comp",
  "code": "N00000005",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/nachos-tray-4.webp",
  "stock": {
   "mini": 35.0,
   "refuel": 11.0,
   "stores": 1922.0
  },
  "min": 0,
  "rate": 1.35,
  "par": 1970
 },
 {
  "id": "napkin",
  "name": "Paper Napkin",
  "sku": "PAPER NAPKIN",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/napkin.webp",
  "stock": {
   "mini": 1161.0,
   "refuel": 0,
   "stores": 11000.0
  },
  "min": 0,
  "rate": 0.02,
  "par": 12165
 },
 {
  "id": "stirrer",
  "name": "Stirrer",
  "sku": "STIRRER",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/stirrer.webp",
  "stock": {
   "mini": 0,
   "refuel": 0,
   "stores": 5000.0
  },
  "min": 0,
  "rate": 0.05,
  "par": 5000
 },
 {
  "id": "straw",
  "name": "Straw",
  "sku": "Straw",
  "code": "",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/straw.webp",
  "stock": {
   "mini": 3391.0,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 0.0688,
  "par": 3395
 },
 {
  "id": "straw-spoon",
  "name": "Straw with Spoon",
  "sku": "SLUSH - Straw With Spoon",
  "code": "S00000016",
  "category": "packaging",
  "unit": "pcs",
  "image": "assets/products/straw-spoon.webp",
  "stock": {
   "mini": 472.0,
   "refuel": 0,
   "stores": 500.0
  },
  "min": 0,
  "rate": 0.09,
  "par": 975
 },
 {
  "id": "co2",
  "name": "CO2 Gas",
  "sku": "CO2",
  "code": "C00000014",
  "category": "other",
  "unit": "kg",
  "image": "assets/products/co2.webp",
  "stock": {
   "mini": 43.68,
   "refuel": 0,
   "stores": 0
  },
  "min": 0,
  "rate": 0.0101,
  "par": 45
 }
];
