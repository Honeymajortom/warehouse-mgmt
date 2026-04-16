// ── 12 categories × subcategories ─────────────────────────────
export const CATEGORIES = {
  "Electronics": [
    "Mobile Phones & Accessories","Laptops & Computers","TVs & Home Entertainment",
    "Cameras","Wearables","Networking Devices",
  ],
  "Fashion & Apparel": [
    "Men's Clothing","Women's Clothing","Kids Wear","Footwear","Accessories",
  ],
  "Beauty & Personal Care": [
    "Skincare","Haircare","Makeup","Grooming Products","Fragrances",
  ],
  "Home & Kitchen": [
    "Furniture","Kitchen Appliances","Cookware & Utensils","Home Decor","Cleaning Supplies",
  ],
  "Grocery & Food": [
    "Staples","Packaged Food","Beverages","Dairy Products","Snacks",
  ],
  "Toys & Baby Products": [
    "Toys & Games","Baby Care","School Supplies","Kids Furniture",
  ],
  "Sports & Fitness": [
    "Gym Equipment","Outdoor Sports Gear","Yoga & Fitness Accessories","Cycling Equipment",
  ],
  "Automotive": [
    "Car Accessories","Bike Accessories","Spare Parts","Lubricants & Oils",
  ],
  "Office & Stationery": [
    "Office Supplies","Printers & Accessories","Books & Notebooks","School Supplies",
  ],
  "Industrial & Tools": [
    "Hand Tools","Power Tools","Electrical Supplies","Safety Equipment",
  ],
  "Agriculture & Livestock": [
    "Seeds & Fertilizers","Animal Feed","Farming Equipment","Veterinary Products",
  ],
  "Healthcare & Pharma": [
    "Medicines","Medical Devices","Supplements","First Aid Supplies",
  ],
};

export const CATEGORY_LIST   = Object.keys(CATEGORIES);
export const PICK_ZONES      = ["PZ-01","PZ-02","PZ-03"];

// Default mapping: 4 categories per zone
export const DEFAULT_ZONE_MAP = {
  "PZ-01": ["Electronics","Fashion & Apparel","Beauty & Personal Care","Home & Kitchen"],
  "PZ-02": ["Grocery & Food","Toys & Baby Products","Sports & Fitness","Automotive"],
  "PZ-03": ["Office & Stationery","Industrial & Tools","Agriculture & Livestock","Healthcare & Pharma"],
};
