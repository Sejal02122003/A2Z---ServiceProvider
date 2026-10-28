import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const CART_STORAGE_KEY = 'a2z_multi_service_cart_v1'

const BookingCartContext = createContext(null)

export function BookingCartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      console.warn('Failed to parse booking cart from localStorage:', e)
      return []
    }
  })

  // Persist cart changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems))
    } catch (e) {
      console.warn('Failed to save booking cart to localStorage:', e)
    }
  }, [cartItems])

  const getItemId = useCallback((serviceId, subServiceId) => {
    return subServiceId ? `${serviceId}_${subServiceId}` : `${serviceId}`
  }, [])

  const isInCart = useCallback(
    (serviceId, subServiceId) => {
      const id = getItemId(serviceId, subServiceId)
      return cartItems.some((item) => item.id === id)
    },
    [cartItems, getItemId]
  )

  const getItemQuantity = useCallback(
    (serviceId, subServiceId) => {
      const id = getItemId(serviceId, subServiceId)
      const found = cartItems.find((item) => item.id === id)
      return found ? found.quantity : 0
    },
    [cartItems, getItemId]
  )

  const addToCart = useCallback(
    (service, subService = null, options = {}) => {
      if (!service || !service._id) return

      const serviceId = String(service._id)
      const subServiceId = subService?._id ? String(subService._id) : undefined
      const id = getItemId(serviceId, subServiceId)

      const sName = service.name || 'Service'
      const ssName = subService?.name || undefined
      const displayName = ssName ? `${sName} (${ssName})` : sName

      const subOriginalPrice = Number(subService?.originalPrice) || 0
      const subPrice = Number(subService?.price) || 0

      let origPrice = 0
      let unitPrice = 0

      if (subService && subOriginalPrice > subPrice && subPrice > 0) {
        origPrice = subOriginalPrice
        unitPrice = subPrice
      } else {
        const basePrice = subService?.price !== undefined
          ? Number(subService.price)
          : Number(service.hourlyPrice || service.basePrice || service.pricePerUnit || 0)

        origPrice = basePrice
        unitPrice = basePrice
        if (service.discountValue > 0) {
          if (service.discountType === 'PERCENTAGE') {
            unitPrice = Math.max(0, Math.round(basePrice * (1 - service.discountValue / 100)))
          } else {
            unitPrice = Math.max(0, basePrice - service.discountValue)
          }
        }
      }

      setCartItems((prev) => {
        const existingIdx = prev.findIndex((it) => it.id === id)
        if (existingIdx >= 0) {
          // Increment quantity
          const updated = [...prev]
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + (options.quantity || 1),
          }
          return updated
        }

        const newItem = {
          id,
          serviceId,
          subServiceId,
          serviceName: sName,
          subServiceName: ssName,
          displayName,
          categoryId: options.categoryId || service.subcategoryId?.categoryId || undefined,
          subcategoryId: options.subcategoryId || service.subcategoryId?._id || service.subcategoryId || undefined,
          categoryName: options.categoryName || undefined,
          subcategoryName: options.subcategoryName || undefined,
          iconUrl: service.iconUrl || '',
          price: unitPrice,
          originalPrice: origPrice,
          savings: Math.max(0, origPrice - unitPrice),
          offerBadge: service.offerBadge || '',
          quantity: options.quantity || 1,
          hours: options.hours || 1,
          estimatedDurationMins: subService?.estimatedDurationMins || service.estimatedDurationMins || 60,
          description: subService?.description || service.description || '',
          inclusions: service.inclusions || [],
          exclusions: service.exclusions || [],
        }

        return [...prev, newItem]
      })
    },
    [getItemId]
  )

  const removeFromCart = useCallback((cartItemId) => {
    setCartItems((prev) => prev.filter((it) => it.id !== cartItemId))
  }, [])

  const updateQuantity = useCallback((cartItemId, quantity) => {
    if (quantity <= 0) {
      setCartItems((prev) => prev.filter((it) => it.id !== cartItemId))
      return
    }
    setCartItems((prev) =>
      prev.map((it) => (it.id === cartItemId ? { ...it, quantity } : it))
    )
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
    } catch {}
  }, [])

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0)
  }, [cartItems])

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.price || 0) * (curr.quantity || 1), 0)
  }, [cartItems])

  const cartTotalDurationMins = useMemo(() => {
    return cartItems.reduce((acc, curr) => {
      const unitDuration = Number(curr.estimatedDurationMins) || 45
      const qty = Number(curr.quantity) || 1
      return acc + (unitDuration * qty)
    }, 0)
  }, [cartItems])

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      cartSubtotal,
      cartTotalDurationMins,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      isInCart,
      getItemQuantity,
    }),
    [
      cartItems,
      cartCount,
      cartSubtotal,
      cartTotalDurationMins,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      isInCart,
      getItemQuantity,
    ]
  )

  return (
    <BookingCartContext.Provider value={value}>
      {children}
    </BookingCartContext.Provider>
  )
}

export function useBookingCart() {
  const ctx = useContext(BookingCartContext)
  if (!ctx) {
    throw new Error('useBookingCart must be used within a BookingCartProvider')
  }
  return ctx
}
