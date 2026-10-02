import 'dotenv/config'
import mongoose from 'mongoose'
import { LabourCategoryGroup } from '../models/LabourCategoryGroup.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { LABOUR_CATEGORY_SEED_V2 } from '../data/labourCategorySeed.js'
import { slugify } from '../utils/slugify.js'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)

  // Clear out old category groups to only show the requested ones
  await LabourCategoryGroup.updateMany({}, { isActive: false })
  
  // Clean slate for categories, subcategories, and services
  await LabourCategory.deleteMany({})
  await LabourSubcategory.deleteMany({})
  await LabourService.deleteMany({})

  console.log('Seeding Salon, Home Appliances, Caretaker & Nurse, and Services On Demand...')

  let catSort = 10
  for (const cat of LABOUR_CATEGORY_SEED_V2) {
    const categoryDoc = await LabourCategory.create({
      name: cat.category,
      subtitle: cat.subtitle || '',
      slug: slugify(cat.category),
      imageUrl: cat.imageUrl || '',
      sortOrder: catSort,
      isActive: true,
    })
    catSort += 10

    for (const sub of cat.subcategories) {
      const subcategoryDoc = await LabourSubcategory.create({
        categoryId: categoryDoc._id,
        name: sub.name,
        description: sub.description || '',
        iconUrl: sub.image || '',
        isActive: true,
      })
      
      if (!categoryDoc.imageUrl && sub.image) {
        categoryDoc.imageUrl = sub.image
        await categoryDoc.save()
      }

      for (const svc of sub.services) {
        const serviceData = typeof svc === 'string' 
          ? { name: svc, basePrice: 0, description: '' } 
          : svc

        const price = serviceData.basePrice || 0

        await LabourService.create({
          subcategoryId: subcategoryDoc._id,
          name: serviceData.name,
          description: serviceData.description || '',
          isActive: true,
          basePrice: price,
          hourlyPrice: price,
          estimatedDurationMins: 60,
          isAllZones: true,
        })
      }
    }
  }

  console.log('Successfully seeded all 4 categories (Salon, Home Appliances, Caretaker & Nurse, Services On Demand)!')
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
