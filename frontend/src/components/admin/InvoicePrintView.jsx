import React from 'react'

export default function InvoicePrintView({ data }) {
  if (!data) return null
  const { invoice, booking } = data

  const clientName = booking?.userId?.fullName || 'Client'
  const clientEmail = booking?.userId?.email || ''
  const clientPhone = booking?.userId?.phone || ''
  
  const invoiceNumber = invoice?.invoiceNumber || 'INV-000000'
  const date = new Date(invoice?.createdAt || Date.now()).toLocaleDateString('en-IN')

  return (
    <div className="bg-white text-black p-6 print:px-8 print:py-4 mx-auto w-full min-h-[297mm]">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tighter">INVOICE</h1>
          <p className="text-sm text-gray-500 mt-1">Invoice #{invoiceNumber}</p>
          <p className="text-sm text-gray-500">Date: {date}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-gray-800">A2Z Platform</h2>
          <p className="text-sm text-gray-600 mt-1">123 Tech Park, Phase 1</p>
          <p className="text-sm text-gray-600">Mumbai, Maharashtra 400001</p>
          <p className="text-sm text-gray-600">GSTIN: 27AABCT1234F1Z5</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Bill To:</h3>
        <p className="text-lg font-medium text-gray-800">{clientName}</p>
        {clientEmail && <p className="text-sm text-gray-600">{clientEmail}</p>}
        {clientPhone && <p className="text-sm text-gray-600">+91 {clientPhone}</p>}
        {booking?.contractorInfo?.companyName && (
          <p className="text-sm text-gray-600 mt-1 font-medium">{booking.contractorInfo.companyName}</p>
        )}
      </div>

      {/* Table */}
      <table className="w-full mb-10 text-left">
        <thead>
          <tr className="border-b-2 border-gray-900">
            <th className="py-3 text-sm font-semibold text-gray-700 w-1/2">Description</th>
            <th className="py-3 text-sm font-semibold text-gray-700">Quantity</th>
            <th className="py-3 text-sm font-semibold text-gray-700">Rate</th>
            <th className="py-3 text-sm font-semibold text-gray-700 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(invoice?.lines || []).map((line, idx) => {
            let relevantAssignments = []
            let actualDescription = line.description
            
            if (booking?.assignments?.length > 0) {
              // Map invoice line directly to the contractor service at the same index
              const matchedService = booking.contractorInfo?.services?.[idx]
              
              if (matchedService && matchedService.serviceId) {
                const targetId = matchedService.serviceId._id || matchedService.serviceId
                relevantAssignments = booking.assignments.filter(a => String(a.serviceId) === String(targetId))
                
                // If invoice saved generic name, try to show the actual service name
                if (line.description === 'Service - Contractor Service' && matchedService.serviceId.name) {
                  actualDescription = `Service - ${matchedService.serviceId.name}`
                }
              } else {
                relevantAssignments = booking.assignments
              }
            }
            
            return (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-4 text-sm text-gray-800">
                  <p className="font-medium">{actualDescription}</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-[300px] whitespace-normal">
                    Labour: {relevantAssignments.length > 0 
                      ? relevantAssignments.map(a => a.labourId?.fullName).filter(Boolean).join(', ') 
                      : (booking?.laborId?.fullName || (booking?.quantity > 1 ? `${booking.quantity} Labours` : 'Assigned Labour'))
                    }
                  </p>
                </td>
                <td className="py-4 text-sm text-gray-800">{line.billableUnits || 1}</td>
              <td className="py-4 text-sm text-gray-800">₹{(line.ratePerUnit || 0).toLocaleString('en-IN')}</td>
              <td className="py-4 text-sm text-gray-800 text-right">₹{(line.amount || 0).toLocaleString('en-IN')}</td>
            </tr>
            )
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-1/2">
          <div className="flex justify-between py-2 text-sm text-gray-600 border-b border-gray-100">
            <span>Subtotal</span>
            <span>₹{(invoice?.subtotal || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-2 text-sm text-gray-600 border-b border-gray-100">
            <span>Platform Fee</span>
            <span>₹{(booking?.platformFee || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-2 text-sm text-gray-600 border-b border-gray-100">
            <span>GST (18%)</span>
            <span>₹{(invoice?.gstTotal || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-4 text-lg font-bold text-gray-900 border-b-2 border-gray-900">
            <span>Total Amount</span>
            <span>₹{(invoice?.total || booking?.totalAmount || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>Thank you for choosing Kaam Expert.</p>
        <p className="mt-1">This is a computer generated invoice and does not require a physical signature.</p>
      </div>
    </div>
  )
}
