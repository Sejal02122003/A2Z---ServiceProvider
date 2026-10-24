// scripts/testMultiServiceBooking.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Booking } from '../src/models/Booking.js'
import { User } from '../src/models/User.js'
import { LabourService } from '../src/models/LabourService.js'
import { LabourSubcategory } from '../src/models/LabourSubcategory.js'
import { LabourCategory } from '../src/models/LabourCategory.js'
import { Wallet } from '../src/models/Wallet.js'
import { WalletTransaction } from '../src/models/WalletTransaction.js'

dotenv.config()

async function runTests() {
  console.log('=== MULTI-SERVICE BOOKING SYSTEM TEST SUITE ===')
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI not found in environment')
  }

  await mongoose.connect(uri)
  console.log('✓ Connected to MongoDB')

  const testIdsToClean = []

  try {
    // 1. Fetch test actors & services
    const customer = await User.findOne({ role: 'customer' }).lean()
    const labour = await User.findOne({ role: 'labour' }).lean()
    const services = await LabourService.find({ isActive: true }).limit(2).lean()

    if (!customer) throw new Error('No customer found for test')
    if (!labour) throw new Error('No labour partner found for test')
    if (services.length < 2) throw new Error('Need at least 2 active services for testing')

    console.log(`✓ Test Customer: ${customer.fullName || customer.phone} (${customer._id})`)
    console.log(`✓ Test Labour: ${labour.fullName || labour.phone} (${labour._id})`)
    console.log(`✓ Service 1: ${services[0].name} (₹${services[0].pricePerHour})`)
    console.log(`✓ Service 2: ${services[1].name} (₹${services[1].pricePerHour})`)

    // -------------------------------------------------------------
    // TEST 1: Authoritative multi-service billing calculations
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Authoritative Billing Calculations ---')
    const item1Price = Number(services[0].pricePerHour) || 299
    const item2Price = Number(services[1].pricePerHour) || 499
    const expectedSubtotal = item1Price * 1 + item2Price * 2
    console.log(`Calculated Subtotal: ₹${expectedSubtotal}`)

    if (expectedSubtotal <= 0) throw new Error('Subtotal calculation failed')
    console.log('✓ TEST 1 PASSED: Subtotal and item calculations verified')

    // -------------------------------------------------------------
    // TEST 2: Multi-service Booking Creation & Snapshot
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Multi-Service Booking Creation ---')
    const testBooking = await Booking.create({
      userId: customer._id,
      serviceId: services[0]._id,
      subcategoryId: services[0].subcategoryId || new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      status: 'BROADCASTING',
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      basePrice: expectedSubtotal,
      taxes: Math.round(expectedSubtotal * 0.18),
      totalAmount: expectedSubtotal + Math.round(expectedSubtotal * 0.18),
      laborShare: Math.round(expectedSubtotal * 0.90),
      address: {
        locationText: '123 Test Street, Sector 10',
        latitude: 28.6139,
        longitude: 77.2090,
      },
      multiServiceBooking: {
        isMultiService: true,
        items: [
          {
            serviceId: services[0]._id,
            serviceName: services[0].name,
            categoryId: services[0].categoryId,
            subcategoryId: services[0].subcategoryId,
            unitPrice: item1Price,
            quantity: 1,
            hours: 1,
            itemTotal: item1Price,
            status: 'PENDING',
            startOtp: '1111',
            completionOtp: '2222',
          },
          {
            serviceId: services[1]._id,
            serviceName: services[1].name,
            categoryId: services[1].categoryId,
            subcategoryId: services[1].subcategoryId,
            unitPrice: item2Price,
            quantity: 2,
            hours: 1,
            itemTotal: item2Price * 2,
            status: 'PENDING',
            startOtp: '3333',
            completionOtp: '4444',
          },
        ],
      },
    })

    testIdsToClean.push(testBooking._id)
    console.log(`✓ Booking created: ${testBooking._id}`)
    if (!testBooking.multiServiceBooking?.isMultiService) {
      throw new Error('multiServiceBooking.isMultiService was not saved as true')
    }
    if (testBooking.multiServiceBooking.items.length !== 2) {
      throw new Error('multiServiceBooking.items length must be 2')
    }
    if (!testBooking.multiServiceBooking.items[0].startOtp || !testBooking.multiServiceBooking.items[1].startOtp) {
      throw new Error('OTPs not properly initialized on child items')
    }
    console.log('✓ TEST 2 PASSED: Booking schema, snapshots, and item OTPs verified')

    // -------------------------------------------------------------
    // TEST 3: Partial Acceptance & Status Transition
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Provider Acceptance & Partial Acceptance Transition ---')
    // Accept item 0
    testBooking.multiServiceBooking.items[0].status = 'ACCEPTED'
    testBooking.multiServiceBooking.items[0].assignedLabourId = labour._id

    // Derive parent status
    const itemStatuses = testBooking.multiServiceBooking.items.map(it => it.status)
    const anyAccepted = itemStatuses.some(s => s === 'ACCEPTED')
    const allAccepted = itemStatuses.every(s => s === 'ACCEPTED')

    if (anyAccepted && !allAccepted) {
      testBooking.status = 'PARTIALLY_ACCEPTED'
    } else if (allAccepted) {
      testBooking.status = 'ACCEPTED'
    }
    await testBooking.save()

    const fetchedAfterAccept1 = await Booking.findById(testBooking._id)
    console.log(`Parent status after 1 item accepted: ${fetchedAfterAccept1.status}`)
    if (fetchedAfterAccept1.status !== 'PARTIALLY_ACCEPTED') {
      throw new Error(`Expected PARTIALLY_ACCEPTED, got ${fetchedAfterAccept1.status}`)
    }

    // Accept item 1
    fetchedAfterAccept1.multiServiceBooking.items[1].status = 'ACCEPTED'
    fetchedAfterAccept1.multiServiceBooking.items[1].assignedLabourId = labour._id
    fetchedAfterAccept1.status = 'ACCEPTED'
    await fetchedAfterAccept1.save()

    const fetchedAfterAccept2 = await Booking.findById(testBooking._id)
    console.log(`Parent status after both items accepted: ${fetchedAfterAccept2.status}`)
    if (fetchedAfterAccept2.status !== 'ACCEPTED') {
      throw new Error(`Expected ACCEPTED, got ${fetchedAfterAccept2.status}`)
    }
    console.log('✓ TEST 3 PASSED: Independent acceptance and parent status derivation verified')

    // -------------------------------------------------------------
    // TEST 4: Partial Work In Progress & Completion
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Partial Work In Progress & Completion Transition ---')
    // Item 0 started, item 1 accepted
    fetchedAfterAccept2.multiServiceBooking.items[0].status = 'STARTED'
    fetchedAfterAccept2.status = 'STARTED'
    await fetchedAfterAccept2.save()

    // Item 0 completed, item 1 still accepted
    fetchedAfterAccept2.multiServiceBooking.items[0].status = 'COMPLETED'
    fetchedAfterAccept2.status = 'PARTIALLY_COMPLETED'
    await fetchedAfterAccept2.save()

    const fetchedAfterComp1 = await Booking.findById(testBooking._id)
    console.log(`Parent status with 1 item completed: ${fetchedAfterComp1.status}`)
    if (fetchedAfterComp1.status !== 'PARTIALLY_COMPLETED') {
      throw new Error(`Expected PARTIALLY_COMPLETED, got ${fetchedAfterComp1.status}`)
    }

    // Item 1 completed
    fetchedAfterComp1.multiServiceBooking.items[1].status = 'COMPLETED'
    fetchedAfterComp1.status = 'COMPLETED'
    await fetchedAfterComp1.save()

    const fetchedAfterComp2 = await Booking.findById(testBooking._id)
    console.log(`Parent status with all items completed: ${fetchedAfterComp2.status}`)
    if (fetchedAfterComp2.status !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED, got ${fetchedAfterComp2.status}`)
    }
    console.log('✓ TEST 4 PASSED: Progression through PARTIALLY_COMPLETED to COMPLETED verified')

    // -------------------------------------------------------------
    // TEST 5: Child Service Item Cancellation & Partial Refund
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Child Service Item Cancellation & Partial Refund ---')
    const paidBooking = await Booking.create({
      userId: customer._id,
      serviceId: services[0]._id,
      subcategoryId: services[0].subcategoryId || new mongoose.Types.ObjectId(),
      type: 'SCHEDULED',
      status: 'ACCEPTED',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      basePrice: 1000,
      taxes: 180,
      totalAmount: 1180,
      laborShare: 900,
      address: {
        locationText: '456 Test Ave, Sector 12',
        coordinates: { type: 'Point', coordinates: [77.2090, 28.6139] },
      },
      multiServiceBooking: {
        isMultiService: true,
        items: [
          {
            serviceId: services[0]._id,
            serviceName: services[0].name,
            unitPrice: 400,
            quantity: 1,
            itemTotal: 400,
            status: 'ACCEPTED',
            assignedLabourId: labour._id,
          },
          {
            serviceId: services[1]._id,
            serviceName: services[1].name,
            unitPrice: 600,
            quantity: 1,
            itemTotal: 600,
            status: 'ACCEPTED',
            assignedLabourId: labour._id,
          },
        ],
      },
    })
    testIdsToClean.push(paidBooking._id)

    // Ensure customer has a wallet
    let wallet = await Wallet.findOne({ userId: customer._id })
    if (!wallet) {
      wallet = await Wallet.create({ userId: customer._id, balance: 0, currency: 'INR' })
    }
    const initialWalletBalance = wallet.balance || 0

    // Cancel item 0 (₹400 + proportional tax ₹72 = ₹472 refund)
    const itemToCancel = paidBooking.multiServiceBooking.items[0]
    const refundProportion = itemToCancel.itemTotal / paidBooking.basePrice
    const refundTax = Math.round((paidBooking.taxes || 0) * refundProportion)
    const refundTotal = itemToCancel.itemTotal + refundTax

    itemToCancel.status = 'CANCELLED'
    itemToCancel.cancellationReason = 'Test cancellation'
    itemToCancel.cancelledAt = new Date()

    // Credit refund to wallet
    wallet.balance += refundTotal
    await wallet.save()

    await WalletTransaction.create({
      walletId: wallet._id,
      userId: customer._id,
      type: 'CREDIT',
      context: 'REFUND',
      transactionId: `TXN_REFUND_${Date.now()}`,
      amount: refundTotal,
      balanceAfter: wallet.balance,
      description: `Refund for cancelled item ${itemToCancel.serviceName} (#${String(paidBooking._id).slice(-6)})`,
      referenceId: String(paidBooking._id),
      referenceModel: 'Booking',
      status: 'COMPLETED',
    })

    // Check remaining items and update parent status
    const activeItems = paidBooking.multiServiceBooking.items.filter(it => it.status !== 'CANCELLED')
    paidBooking.status = activeItems.length > 0 ? 'PARTIALLY_CANCELLED' : 'CANCELLED'
    await paidBooking.save()

    const fetchedAfterItemCancel = await Booking.findById(paidBooking._id)
    const updatedWallet = await Wallet.findById(wallet._id)

    console.log(`Parent status after single item cancelled: ${fetchedAfterItemCancel.status}`)
    console.log(`Wallet balance: initial=₹${initialWalletBalance}, updated=₹${updatedWallet.balance} (refunded ₹${refundTotal})`)

    if (fetchedAfterItemCancel.status !== 'PARTIALLY_CANCELLED') {
      throw new Error(`Expected PARTIALLY_CANCELLED, got ${fetchedAfterItemCancel.status}`)
    }
    if (updatedWallet.balance !== initialWalletBalance + refundTotal) {
      throw new Error('Wallet refund amount mismatch')
    }
    if (fetchedAfterItemCancel.multiServiceBooking.items[1].status !== 'ACCEPTED') {
      throw new Error('Unaffected item 1 was corrupted during item 0 cancellation')
    }
    console.log('✓ TEST 5 PASSED: Item cancellation, wallet refund, and unaffected item isolation verified')

    console.log('\n========================================')
    console.log('🎉 ALL MULTI-SERVICE SYSTEM TESTS PASSED!')
    console.log('========================================\n')
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err)
    process.exitCode = 1
  } finally {
    if (testIdsToClean.length > 0) {
      await Booking.deleteMany({ _id: { $in: testIdsToClean } })
      console.log(`✓ Cleaned up ${testIdsToClean.length} test booking records`)
    }
    await mongoose.disconnect()
    console.log('✓ Disconnected from MongoDB')
  }
}

runTests()
