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
  },
  {
    category: "Caretaker & Nurse",
    subtitle: "Compassionate home healthcare, nursing & patient care",
    imageUrl: IMG.careTakerCategory,
    subcategories: [
      {
        name: "Elderly Care & Companion",
        description: "Dedicated daily assistance, medication management, and mobility support for seniors.",
        image: IMG.elderlyCare,
        services: [
          { name: "Elderly Day Attendant (12 Hours)", basePrice: 899, description: "Daytime assistance with meals, bathing, walking, and medication tracking." },
          { name: "Elderly 24-Hour Live-in Care", basePrice: 1599, description: "Round-the-clock dedicated assistance and companionship." },
          { name: "Elderly Mobility & Exercise Assistance", basePrice: 499, description: "Assisted walking, light mobility routines, and wheelchair support." }
        ]
      },
      {
        name: "Certified Home Nursing",
        description: "Clinical nursing care by qualified nurses at home.",
        image: IMG.certifiedNurse,
        services: [
          { name: "Home Injection & IV Drip Administration", basePrice: 299, description: "Safe intramuscular / intravenous injection and cannula setup." },
          { name: "Post-Operative Wound Dressing", basePrice: 399, description: "Sterile surgical dressing, suture care, and infection monitoring." },
          { name: "Catheter & Ryle's Tube Care", basePrice: 499, description: "Insertion, flushing, and hygienic maintenance of tubes." },
          { name: "Critical Care Nurse (12 Hours Shift)", basePrice: 1299, description: "ICU-trained nursing support for monitoring vitals, oxygen, and ventilator." }
        ]
      },
      {
        name: "Baby Care & Jharokha (Nanny)",
        description: "Trained and caring nannies for newborn and infant care.",
        image: IMG.babyCareNanny,
        services: [
          { name: "Newborn Baby Massage & Bathing", basePrice: 399, description: "Traditional gentle massage and hygiene care for infants." },
          { name: "Full Day Nanny / Babysitter (10 Hours)", basePrice: 799, description: "Feeding assistance, playtime supervision, and infant hygiene." }
        ]
      },
      {
        name: "Patient Attendant & Bedside Care",
        description: "Support for bedridden, recovering, or hospitalized patients.",
        image: IMG.patientAttendant,
        services: [
          { name: "Bedridden Patient Care & Sponge Bath", basePrice: 599, description: "Personal hygiene, position changing to prevent bedsores, and feeding." },
          { name: "Hospital Companion Attendant", basePrice: 799, description: "Assisting patient and family during hospital admission shifts." }
        ]
      },
      {
        name: "Home Physiotherapy & Rehab",
        description: "Certified physiotherapists for pain relief, post-stroke and paralysis recovery.",
        image: IMG.physiotherapy,
        services: [
          { name: "Orthopedic & Joint Pain Physiotherapy", basePrice: 599, description: "Therapeutic exercises for knee, back, neck, and shoulder pain." },
          { name: "Neuro & Stroke Rehabilitation Session", basePrice: 799, description: "Specialized neuromuscular re-education and gait training." }
        ]
      },
      {
        name: "Healthcare & Caretaking Products",
        description: "Essential home medical supplies and hygiene kits.",
        image: IMG.medicalProducts,
        services: [
          { name: "Adult Diapers & Underpads Combo", basePrice: 499, description: "High-absorption leak-proof diapers (Pack of 10)." },
          { name: "Digital BP Monitor & Oximeter Kit", basePrice: 999, description: "Accurate blood pressure and pulse rate monitoring kit." },
          { name: "Antiseptic Dressing & First Aid Kit", basePrice: 349, description: "Sterile gauze, micropore tape, betadine, and bandage roll." }
        ]
      }
    ]
  },
  {
    category: "Services On Demand",
    subtitle: "Quick on-demand repair, plumbing, electrical & cleaning",
    imageUrl: IMG.servicesOnDemandCategory,
    subcategories: [
      {
        name: "Plumbing Services",
        description: "Fast pipe leak fixing, tap repair, and bathroom fittings.",
        image: IMG.emergencyPlumber,
        services: [
          { name: "Tap & Shower Repair / Replacement", basePrice: 199, description: "Fixing dripping taps, mixers, and shower heads." },
          { name: "Pipe Leakage & Drainage Unclogging", basePrice: 349, description: "Unclogging sink drains, toilets, and repairing pipe joints." },
          { name: "Water Tank Cleaning & Sanitization", basePrice: 699, description: "High-pressure jet wash and chemical disinfection of overhead tanks." },
          { name: "Toilet Pot & Flush Tank Repair", basePrice: 399, description: "Flush valve replacement and commode leak repair." }
        ]
      },
      {
        name: "Electrical Services",
        description: "Switchboard fixes, wiring shorts, fan installation, and lighting.",
        image: IMG.urgentElectrician,
        services: [
          { name: "Switch, Socket & MCB Replacement", basePrice: 149, description: "Replacing burnt switches, power sockets, and faulty circuit breakers." },
          { name: "Ceiling Fan Installation & Repair", basePrice: 199, description: "Fan hookup, regulator installation, and capacitor replacement." },
          { name: "Short Circuit & Inverter Wiring Fix", basePrice: 399, description: "Diagnosing wiring faults, power trips, and inverter connections." },
          { name: "Chandelier & Decorative Light Mounting", basePrice: 499, description: "Secure ceiling mounting and electrical wiring." }
        ]
      },
      {
        name: "Carpentry & Furniture Repair",
        description: "Door locks, hinge alignment, furniture assembly, and woodwork.",
        image: IMG.carpenterRepair,
        services: [
          { name: "Door Lock & Handle Installation", basePrice: 249, description: "Fitting mortise locks, cylinder locks, and latches." },
          { name: "Hinges, Drawer Channel & Alignment Fix", basePrice: 199, description: "Repairing loose cabinet doors and sliding channels." },
          { name: "Bed & Wardrobe Assembly / Dismantling", basePrice: 599, description: "Precision assembly of flat-pack or wooden furniture." }
        ]
      },
      {
        name: "Deep Cleaning Services",
        description: "Intensive residential, kitchen, and bathroom deep cleaning.",
        image: IMG.deepCleaning,
        services: [
          { name: "Bathroom Deep Cleaning & Stain Removal", basePrice: 399, description: "Tile descaling, toilet scrubbing, and fittings shine." },
          { name: "Kitchen Deep Degreasing & Scrubbing", basePrice: 699, description: "Removal of sticky grease from tiles, cabinets, and slabs." },
          { name: "Full Home Deep Cleaning (1BHK / 2BHK)", basePrice: 1499, description: "Floor scrubbing, window dusting, fan wiping, and disinfection." },
          { name: "Sofa & Mattress Shampooing", basePrice: 599, description: "Vacuum extraction and fabric shampoo for stain removal." }
        ]
      },
      {
        name: "Pest Control & Disinfection",
        description: "Safe pest management for termites, cockroaches, and bedbugs.",
        image: IMG.pestControlOnDemand,
        services: [
          { name: "Cockroach & Ant Gel Treatment", basePrice: 499, description: "Odorless herbal gel application in kitchen and corners." },
          { name: "Bed Bug Eradication Treatment", basePrice: 799, description: "Double spray treatment for mattresses and wooden frames." },
          { name: "Termite Control & Wood Protection", basePrice: 1199, description: "Chemical drill-and-fill protection for furniture and walls." }
        ]
      },
      {
        name: "Painting & Wall Repair",
        description: "Touch-up painting, waterproof coating, and room color refresh.",
        image: IMG.housePainter,
        services: [
          { name: "Wall Touchup & Water Damage Patching", basePrice: 399, description: "Putty application, sanding, and primer touchup for peeling walls." },
          { name: "Single Room Interior Painting", basePrice: 1299, description: "Double-coat premium emulsion painting for 1 room." }
        ]
      },
      {
        name: "Handyman & Locksmith",
        description: "Drilling, curtain rod hanging, mirror mounting, and lock opening.",
        image: IMG.handymanLocksmith,
        services: [
          { name: "Drill & Hang (Frames / Mirrors / Rods)", basePrice: 149, description: "Professional drilling and secure mounting on concrete / tiles." },
          { name: "Emergency Lock Opening & Key Fix", basePrice: 299, description: "Non-destructive lock picking and jammed door unlock." }
        ]
      }
    ]
  }
];
