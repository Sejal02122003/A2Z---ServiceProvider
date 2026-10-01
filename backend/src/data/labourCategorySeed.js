import { LABOUR_CATEGORY_IMAGES as IMG } from './labourCategoryImages.js'

export const LABOUR_CATEGORY_SEED_V2 = [
  {
    category: "Salon",
    subtitle: "Beauty, grooming & spa at your doorstep",
    imageUrl: IMG.salonCategory,
    subcategories: [
      {
        name: "Women's Salon & Spa",
        description: "Professional hair, skincare, waxing, and beauty therapies for women.",
        image: IMG.salonWomen,
        services: [
          { name: "Haircut & Blowdry", basePrice: 499, description: "Precision haircut, hair wash, and blowdry styling." },
          { name: "Facial & Cleanup", basePrice: 799, description: "Deep pore cleansing, fruit/gold facial, and skin glow therapy." },
          { name: "Waxing & Threading", basePrice: 399, description: "Smooth body waxing and eyebrow/upper lip threading." },
          { name: "Manicure & Pedicure", basePrice: 699, description: "Complete nail grooming, scrub, polish, and foot massage." },
          { name: "Hair Spa & Nourishing Treatment", basePrice: 899, description: "Intense hair spa, scalp massage, and deep conditioning." },
          { name: "Bridal & Party Makeup", basePrice: 2499, description: "HD party and bridal makeup with saree/attire draping." },
          { name: "Hair Coloring & Highlights", basePrice: 1199, description: "Global hair color, grey coverage, and streak highlights." }
        ]
      },
      {
        name: "Men's Salon & Grooming",
        description: "Expert haircut, beard grooming, facials, and massages for men.",
        image: IMG.salonMen,
        services: [
          { name: "Men's Haircut & Styling", basePrice: 249, description: "Trend haircut, styling, and scalp wash." },
          { name: "Beard Trimming & Shaping", basePrice: 149, description: "Precision beard shaping, line-up, and razor styling." },
          { name: "Men's Charcoal Facial", basePrice: 599, description: "Deep cleansing facial to remove dirt, oil, and dead skin." },
          { name: "Head Massage & Hair Spa", basePrice: 349, description: "Relaxing oil head massage and hair conditioning." },
          { name: "Hair Color & Grey Coverage", basePrice: 399, description: "Natural ammonia-free grey hair coloring." },
          { name: "De-tan Pack & Face Scrub", basePrice: 299, description: "Instant sun damage repair and face skin brightening." }
        ]
      },
      {
        name: "Kids Haircut & Styling",
        description: "Gentle and patient haircut & styling for children.",
        image: IMG.kidsHaircut,
        services: [
          { name: "Kids Haircut & Styling", basePrice: 199, description: "Safe and comfortable haircut for young kids." }
        ]
      },
      {
        name: "Salon & Beauty Products",
        description: "Premium hair care, skin care, and grooming kits.",
        image: IMG.salonProducts,
        services: [
          { name: "Hair Care & Styling Kit", basePrice: 599, description: "Herbal shampoo, conditioner, and nourishing hair serum." },
          { name: "Glow Skin Care Combo", basePrice: 799, description: "Face wash, scrubbing gel, toner, and hydrating cream." },
          { name: "Beard Care & Oil Combo", basePrice: 449, description: "Organic beard growth oil, balm, and wooden styling comb." }
        ]
      }
    ]
  },
  {
    category: "Home Appliances",
    subtitle: "Installation, repair, and maintenance for household appliances",
    imageUrl: IMG.homeAppliancesCategory,
    subcategories: [
      {
        name: "AC Services & Repair",
        description: "Air conditioner servicing, gas charging, and installation.",
        image: IMG.acTechnician,
        services: [
          { name: "AC Jet Pump Deep Cleaning", basePrice: 499, description: "Foam jet wash for indoor cooling coils and outdoor unit." },
          { name: "AC Installation / Uninstallation", basePrice: 799, description: "Wall bracket mounting, pipe connection, and full testing." },
          { name: "AC Gas Leak Repair & Refill", basePrice: 1299, description: "Leak detection, nitrogen testing, and pure gas charging." },
          { name: "AC PCB & Circuit Repair", basePrice: 899, description: "Electronic motherboard diagnosis and part replacement." }
        ]
      },
      {
        name: "Refrigerator Services",
        description: "Cooling diagnostics, compressor, and gas refill for all fridge models.",
        image: IMG.refrigeratorTechnician,
        services: [
          { name: "Refrigerator Inspection & Servicing", basePrice: 299, description: "Complete cooling check, condenser cleaning, and temperature tuning." },
          { name: "Refrigerator Gas Charging & Repair", basePrice: 1199, description: "Compressor servicing, gas top-up, and seal check." },
          { name: "Refrigerator Thermostat & Sensor Repair", basePrice: 499, description: "Defrost timer, temperature sensor, and relay replacement." }
        ]
      },
      {
        name: "Washing Machine Services",
        description: "Front load, top load, and semi-automatic washing machine repair.",
        image: IMG.washingMachineTechnician,
        services: [
          { name: "Washing Machine Servicing & Descaling", basePrice: 299, description: "Drum scale removal, lint filter cleaning, and cycle diagnostics." },
          { name: "Washing Machine Drum & Motor Repair", basePrice: 799, description: "Motor capacitor, spin belt, and suspension repair." },
          { name: "Washing Machine Water Inlet & Drain Repair", basePrice: 449, description: "Inlet valve replacement, drain pipe cleaning, and pump repair." }
        ]
      },
      {
        name: "Water Purifier (RO) Services",
        description: "RO water purifier filter replacement, installation, and pump repair.",
        image: IMG.roTechnician,
        services: [
          { name: "RO Filter Replacement & Servicing", basePrice: 399, description: "Sediment filter, carbon block, and RO membrane replacement." },
          { name: "RO Complete Installation / Shift", basePrice: 499, description: "Mounting, water line connection, and TDS level adjustment." },
          { name: "RO Booster Pump & SMPS Repair", basePrice: 599, description: "Booster pump motor and power adapter replacement." }
        ]
      },
      {
        name: "Microwave & Oven Services",
        description: "Heating issues, keypad errors, and electrical fixes for microwaves.",
        image: IMG.microwaveTechnician,
        services: [
          { name: "Microwave Servicing & Heating Repair", basePrice: 399, description: "Magnetron testing, high voltage diode, and fuse check." },
          { name: "Microwave Touchpad & Door Switch Repair", basePrice: 449, description: "Keypad membrane replacement and safety door interlock repair." }
        ]
      },
      {
        name: "Geyser & Water Heater Services",
        description: "Fast heating element, thermostat, and leakage fixes.",
        image: IMG.geyserTechnician,
        services: [
          { name: "Geyser Installation & Uninstallation", basePrice: 399, description: "Safe wall mounting and inlet/outlet plumbing hookup." },
          { name: "Geyser Heating Coil & Thermostat Repair", basePrice: 499, description: "Heating element descaling and thermostat replacement." }
        ]
      },
      {
        name: "TV & LED Repair",
        description: "Smart TV wall mounting, display panel, and sound repairs.",
        image: IMG.tvTechnician,
        services: [
          { name: "TV Wall Mounting & Setup", basePrice: 349, description: "Standard / swivel bracket wall mount and cable management." },
          { name: "LED TV Backlight & Mainboard Repair", basePrice: 899, description: "LED backlight strip replacement and motherboard diagnosis." }
        ]
      },
      {
        name: "Kitchen Chimney & Hob Services",
        description: "Deep degreasing, motor repair, and duct fitting.",
        image: IMG.chimneyTechnician,
        services: [
          { name: "Kitchen Chimney Deep Degreasing", basePrice: 599, description: "Heavy oil/grease removal, baffle filter cleaning, and blower wash." },
          { name: "Chimney & Gas Hob Installation / Repair", basePrice: 699, description: "Exhaust duct installation, motor capacitor, and burner repair." }
        ]
      },
      {
        name: "Appliance Care Products & Spares",
        description: "Essential care kits and universal spare accessories.",
        image: IMG.applianceProducts,
        services: [
          { name: "Washing Machine Descaler Powder (3-Pack)", basePrice: 199, description: "Universal anti-scaling and odor removal formula." },
          { name: "Universal RO Cartridge Replacement Set", basePrice: 699, description: "5-stage sediment and pre-carbon replacement filter pack." },
          { name: "Universal AC Remote Controller", basePrice: 299, description: "Pre-programmed remote compatible with all major AC brands." }
        ]
      }
    ]
  }
];
