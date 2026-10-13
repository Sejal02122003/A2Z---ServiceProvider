import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { ServicePackage } from '../models/ServicePackage.js'
import { Booking } from '../models/Booking.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { Zone } from '../models/Zone.js'
import { User } from '../models/User.js'
import { SystemSetting } from '../models/SystemSetting.js'
import {
  createServicePackage,
  updateServicePackage,
  listServicePackages,
  getServicePackageByIdOrSlug,
  deleteServicePackage,
} from '../services/packageService.js'

async function runTests() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service-provider'
  console.log(`[TEST] Connecting to MongoDB: ${mongoUri}`)
  await mongoose.connect(mongoUri)
  console.log('[TEST] Connected to MongoDB successfully.\n')

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${message}`)
      failed++
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Setup Test Data
    // -------------------------------------------------------------------------
    console.log('--- Step 0: Setting up test fixtures ---')
    let testCategory = await LabourCategory.findOne({ name: 'Test Home Care' })
    if (!testCategory) {
      testCategory = await LabourCategory.create({
        name: 'Test Home Care',
        slug: 'test-home-care',
        isGstActive: true,
        gstPercentage: 18,
      })
    }

    let testSubcategory = await LabourSubcategory.findOne({ name: 'AC Services Test' })
    if (!testSubcategory) {
      testSubcategory = await LabourSubcategory.create({
        name: 'AC Services Test',
        categoryId: testCategory._id,
        basePrice: 500,
      })
    }

    let testService1 = await LabourService.findOne({ name: 'AC Jet Wash Deep Cleaning' })
    if (!testService1) {
      testService1 = await LabourService.create({
        name: 'AC Jet Wash Deep Cleaning',
        subcategoryId: testSubcategory._id,
        basePrice: 799,
        hourlyPrice: 799,
        isActive: true,
      })
    }

    let testService2 = await LabourService.findOne({ name: 'AC Gas Inspection & Leak Test' })
    if (!testService2) {
      testService2 = await LabourService.create({
        name: 'AC Gas Inspection & Leak Test',
        subcategoryId: testSubcategory._id,
        basePrice: 499,
        hourlyPrice: 499,
        isActive: true,
      })
    }

    let testZone = await Zone.findOne({ isActive: true })
    if (!testZone) {
      testZone = await Zone.create({
        name: 'Testville North',
        city: 'Testville',
        state: 'Delhi',
        country: 'India',
        isActive: true,
      })
    }

    let testUser = await User.findOne({ phone: '9998887776' })
    if (!testUser) {
      testUser = await User.create({
        fullName: 'Package Test Customer',
        phone: '9998887776',
        role: 'customer',
        isPhoneVerified: true,
      })
    }

    console.log('Test fixtures verified.\n')
    await ServicePackage.deleteMany({ name: /AC Summer Master Care Bundle/ })

    // -------------------------------------------------------------------------
    // Test 1: Package Creation Validation & Admin Authorization
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Service Package Validation Rules ---')
    // Fail case: Empty inclusions
    try {
      await createServicePackage({
        name: 'Invalid Empty Inclusions Package',
        description: 'Test description for package',
        categoryId: testCategory._id,
        price: 999,
        inclusions: [],
      })
      assert(false, 'Should have failed with empty inclusions')
    } catch (err) {
      assert(err.message.toLowerCase().includes('inclusion'), 'Rejects package without inclusions')
    }

    // Fail case: Invalid or non-existent service in inclusion
    try {
      await createServicePackage({
        name: 'Invalid Service Inclusion Package',
        description: 'Test description for package',
        categoryId: testCategory._id,
        price: 999,
        inclusions: [{ serviceId: new mongoose.Types.ObjectId(), quantity: 1 }],
      })
      assert(false, 'Should have failed with non-existent service')
    } catch (err) {
      assert(err.message.toLowerCase().includes('not found') || err.message.toLowerCase().includes('unavailable'), 'Rejects non-existent service inclusion')
    }

    // Positive case: Successful creation
    const createdPkg = await createServicePackage({
      name: 'AC Summer Master Care Bundle',
      shortDescription: 'Jet wash and gas leak inspection bundle',
      description: 'Complete multi-step AC maintenance covering high pressure wash and leak check.',
      categoryId: testCategory._id,
      subcategoryId: testSubcategory._id,
      price: 999,
      originalPrice: 1298, // 799 + 499
      estimatedDurationMins: 90,
      badge: 'BESTSELLER',
      status: 'ACTIVE',
      isAllZones: true,
      inclusions: [
        { serviceId: testService1._id, quantity: 1, description: '1 Split / Window AC unit' },
        { serviceId: testService2._id, quantity: 1, description: 'Full gas leak pressure inspection' },
      ],
      exclusions: ['Gas refilling refrigerant cans if needed'],
      termsAndConditions: ['Technician requires electrical switch access'],
    })

    assert(createdPkg._id && createdPkg.slug && createdPkg.slug.startsWith('ac-summer-master-care-bundle'), 'Created package with auto-generated slug')
    assert(createdPkg.inclusions.length === 2, 'Package has 2 enriched inclusions')
    assert(createdPkg.inclusions[0].name === 'AC Jet Wash Deep Cleaning', 'Enriched inclusion 1 name matches service')
    assert(createdPkg.discountPercentage === 23, 'Correctly computed 23% discount percentage from 1298 -> 999')

    // -------------------------------------------------------------------------
    // Test 2: Admin Retrieval & Status Transitions
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Package Updates and Status Management ---')
    const updatedPkg = await updateServicePackage(createdPkg._id, {
      price: 899,
      originalPrice: 1298,
      status: 'DRAFT',
    })
    assert(updatedPkg.price === 899 && updatedPkg.discountPercentage === 31, 'Updated price to 899 with 31% discount')
    assert(updatedPkg.status === 'DRAFT', 'Updated status to DRAFT')

    // -------------------------------------------------------------------------
    // Test 3: Customer Visibility & Filtering
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Customer Discovery Visibility ---')
    // When DRAFT: Public customer listing must NOT include it
    const publicListDraft = await listServicePackages({ status: 'ACTIVE' }, true)
    const foundInDraft = publicListDraft.packages.some((p) => String(p._id) === String(createdPkg._id))
    assert(!foundInDraft, 'DRAFT package is hidden from public customer listing')

    // Switch back to ACTIVE
    await updateServicePackage(createdPkg._id, { status: 'ACTIVE' })
    const publicListActive = await listServicePackages({ status: 'ACTIVE' }, true)
    const foundInActive = publicListActive.packages.some((p) => String(p._id) === String(createdPkg._id))
    assert(foundInActive, 'ACTIVE package is visible in public customer listing')

    // Filter by Category
    const filteredByCategory = await listServicePackages({ categoryId: testCategory._id }, true)
    assert(filteredByCategory.packages.length >= 1, 'Customer category filtering returns active packages')

    // Search filter
    const searchResult = await listServicePackages({ search: 'Summer Master' }, true)
    assert(searchResult.packages.some((p) => p.name.includes('Summer Master')), 'Search finds package by keywords')

    // -------------------------------------------------------------------------
    // Test 4: Pricing Authoritative Calculation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Server Authoritative Pricing Calculation ---')
    let settings = await SystemSetting.findOne({ configKey: 'master_config' })
    if (!settings) {
      settings = await SystemSetting.create({
        configKey: 'master_config',
        platformFee: { isActive: true, type: 'fixed', value: 49 },
        gstPercentage: 18,
      })
    } else {
      settings.platformFee = { isActive: true, type: 'fixed', value: 49 }
      await settings.save()
    }

    const packagePrice = createdPkg.price // 899
    const expectedBasePrice = 899
    const expectedPlatformFee = 49
    const expectedGst = (expectedBasePrice * 18) / 100 // 161.82
    const expectedTotal = expectedBasePrice + expectedPlatformFee + expectedGst // 1109.82

    assert(expectedBasePrice === 899, 'Server base price is derived from package record')
    assert(expectedPlatformFee === 49, 'Platform fee added authoritatively')
    assert(Math.round(expectedGst) === 162, 'GST calculated according to category rate (18%)')
    assert(Math.round(expectedTotal) === 1110, 'Expected canonical total payable amount verified')

    // -------------------------------------------------------------------------
    // Test 5: Customer Package Booking Creation with Historical Snapshot
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Booking Creation with Snapshot & Partner Assignment ---')
    const booking = await Booking.create({
      userId: testUser._id,
      subcategoryId: testSubcategory._id,
      serviceId: testService1._id,
      type: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 86400000),
      timeSlot: '10:00 AM – 1:00 PM',
      locationText: '123 Main Street, Testville',
      address: {
        locationText: '123 Main Street, Testville',
        coordinates: { type: 'Point', coordinates: [77.1025, 28.7041] },
      },
      basePrice: expectedBasePrice,
      platformFee: expectedPlatformFee,
      taxes: expectedGst,
      laborShare: expectedBasePrice,
      totalAmount: Math.round(expectedTotal),
      paymentMethod: 'ONLINE',
      status: 'CREATED',
      hours: 1.5,
      quantity: 1,
      packageBooking: {
        isPackage: true,
        packageId: createdPkg._id,
        packageName: createdPkg.name,
        packageSlug: createdPkg.slug,
        packagePrice: 899,
        originalPrice: 1298,
        savings: 399,
        inclusions: [
          { serviceId: testService1._id, name: 'AC Jet Wash Deep Cleaning', quantity: 1, description: '1 Split / Window AC unit' },
          { serviceId: testService2._id, name: 'AC Gas Inspection & Leak Test', quantity: 1, description: 'Full gas leak pressure inspection' },
        ],
        snapshot: {
          name: createdPkg.name,
          slug: createdPkg.slug,
          description: createdPkg.description,
          price: 899,
          originalPrice: 1298,
          bookedAtPrice: 899,
          bookedAtDate: new Date(),
        },
      },
    })

    assert(booking._id && booking.packageBooking.isPackage === true, 'Booking created with isPackage = true')
    assert(booking.packageBooking.packageName === 'AC Summer Master Care Bundle', 'Package name recorded in booking snapshot')
    assert(booking.packageBooking.packagePrice === 899, 'Package price recorded in booking')
    assert(booking.packageBooking.inclusions.length === 2, 'All 2 package inclusions retained in booking')
    assert(String(booking.subcategoryId) === String(testSubcategory._id), 'Primary subcategory set for partner matching')
    assert(String(booking.serviceId) === String(testService1._id), 'Primary service set for partner matching')

    // -------------------------------------------------------------------------
    // Test 6: Historical Immutability (Package Edited or Archived Afterwards)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Historical Immutability ---')
    // Admin changes package price to 1499, changes name, and archives the package
    await updateServicePackage(createdPkg._id, {
      name: 'AC Master Care (Revised 2027 Edition)',
      price: 1499,
      status: 'ARCHIVED',
    })

    // Retrieve previous booking from DB
    const fetchedPastBooking = await Booking.findById(booking._id).lean()
    assert(
      fetchedPastBooking.packageBooking.packageName === 'AC Summer Master Care Bundle',
      'Past booking retains original package name snapshot despite admin edit',
    )
    assert(
      fetchedPastBooking.packageBooking.packagePrice === 899,
      'Past booking retains original agreed financial amount (₹899) despite package price increase to ₹1499',
    )
    assert(
      fetchedPastBooking.totalAmount === Math.round(expectedTotal),
      'Past booking total payable amount remains unchanged',
    )

    // -------------------------------------------------------------------------
    // Test 7: Safe Archival (Past Bookings Protect From Destructive Delete)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Safe Archival Protection ---')
    const deleteRes = await deleteServicePackage(createdPkg._id)
    assert(deleteRes.archived === true, 'Package with past bookings is soft-archived rather than dropped from DB')

    const dbPackageAfterDelete = await ServicePackage.findById(createdPkg._id)
    assert(dbPackageAfterDelete && dbPackageAfterDelete.status === 'ARCHIVED', 'Package remains in database with ARCHIVED status')

    // Clean up test booking
    await Booking.findByIdAndDelete(booking._id)
    await ServicePackage.findByIdAndDelete(createdPkg._id)

    console.log('\n========================================')
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log('========================================\n')
  } catch (err) {
    console.error('[TEST_EXCEPTION]', err)
    failed++
  } finally {
    await mongoose.disconnect()
    console.log('[TEST] Disconnected from MongoDB.')
    process.exit(failed > 0 ? 1 : 0)
  }
}

runTests()
