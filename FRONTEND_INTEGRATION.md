# Frontend Integration Guide - Yesterday Stories API

## 🎯 Overview

**Key Change:** All trails now require payment. No free trails anymore.

Trail state is controlled by 3 fields:
- **status**: `payment_pending`, `payment_completed`, `payment_failed`
- **isPaid**: boolean (true after payment)
- **publishedAt**: null (unpublished) or date (published)

---

## 📊 Trail State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                  Trail Lifecycle                                 │
└─────────────────────────────────────────────────────────────────┘

1. CREATE TRAIL
   ├─ status: payment_pending
   ├─ isPaid: false
   └─ publishedAt: null
   └─ Visible to: User only (Draft)

2. USER PAYS (Stripe)
   ├─ status: payment_completed
   ├─ isPaid: true
   └─ publishedAt: null
   └─ Visible to: User only (Paid, Unpublished)

3a. USER PUBLISHES
    ├─ status: payment_completed
    ├─ isPaid: true
    └─ publishedAt: <timestamp>
    └─ Visible to: Public (Published)

3b. PAYMENT FAILS
    ├─ status: payment_failed
    ├─ isPaid: false
    └─ publishedAt: null
    └─ Visible to: User only (Payment Failed - Retry)

4. USER UNPUBLISHES
   ├─ status: payment_completed
   ├─ isPaid: true
   └─ publishedAt: null
   └─ Visible to: User only (Published → Unpublished)
```

---

## 🔗 API Endpoints

### 1. Create Trail
```http
POST /trails
Authorization: Bearer {token}
Content-Type: application/json

{
  "referenceCode": "YS-20260226-AB12",
  "trailData": {
    "title": "Amazing Trail",
    "description": "A beautiful trail...",
    "difficulty": "Medium",
    "distance": "5.5",
    "headerImages": ["url1", "url2"],
    "headerVideos": [],
    "customStories": [
      {
        "title": "Story 1",
        "description": "...",
        "latitude": -33.8688,
        "longitude": 151.2093,
        "imageUrl": "...",
        "categoryId": 1
      }
    ]
  },
  "isPublished": false
}

Response 201:
{
  "id": 1,
  "referenceCode": "YS-20260226-AB12",
  "userId": "firebase-uid",
  "email": "user@example.com",
  "paymentRequired": true,
  "initialStatus": "payment_pending"
}
```

### 2. Create Payment Intent
```http
POST /payments/create-intent
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 9999,
  "currency": "AUD",
  "metadata": {
    "referenceCode": "YS-20260226-AB12",
    "trailTitle": "Amazing Trail"
  }
}

Response 200:
{
  "clientSecret": "pi_xxxxx_secret_xxxxx",
  "id": "pi_xxxxx",
  "amount": 9999,
  "currency": "AUD",
  "status": "requires_payment_method"
}
```

### 3. Mark Trail as Paid (After Stripe Success)
```http
PUT /trails/{referenceCode}/paid
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "Trail marked as paid and published",
  "referenceCode": "YS-20260226-AB12",
  "isPaid": true,
  "publishedAt": "2026-02-26T10:30:00Z",
  "trailId": 1
}
```

### 4. Publish Trail
```http
PUT /trails/{referenceCode}/update
Authorization: Bearer {token}
Content-Type: application/json

{
  "isPublished": true
}

Response 200:
{
  "success": true,
  "message": "Trail updated",
  "referenceCode": "YS-20260226-AB12",
  "status": "payment_completed",
  "publishedAt": "2026-02-26T10:30:00Z",
  "isPaid": true
}
```

### 5. Unpublish Trail
```http
PUT /trails/{referenceCode}/update
Authorization: Bearer {token}
Content-Type: application/json

{
  "isPublished": false
}

Response 200:
{
  "success": true,
  "message": "Trail updated",
  "referenceCode": "YS-20260226-AB12",
  "status": "payment_completed",
  "publishedAt": null,
  "isPaid": true
}
```

### 6. Get Trail Details
```http
GET /trails/{referenceCode}
Authorization: Bearer {token}

Response 200:
{
  "id": 1,
  "referenceCode": "YS-20260226-AB12",
  "userId": "firebase-uid",
  "trailData": {
    "title": "Amazing Trail",
    "description": "...",
    "difficulty": "Medium",
    "distance": "5.5",
    "customStories": [...]
  },
  "status": "payment_completed",
  "isPaid": true,
  "paymentRequired": true,
  "publishedAt": "2026-02-26T10:30:00.000Z",
  "createdAt": "2026-02-26T09:00:00.000Z"
}
```

---

## 🔘 Publish/Unpublish Button Logic

### Button Visibility Rules

**Show "Publish" Button when:**
- ✅ `isPaid === true`
- ✅ `publishedAt === null`
- ✅ Trail has at least 1 story

**Show "Unpublish" Button when:**
- ✅ `isPaid === true`
- ✅ `publishedAt !== null`

**Disable Both Buttons when:**
- ❌ `isPaid === false`
- ❌ `status === "payment_pending"`
- ❌ Trail has 0 stories

### State Management

```javascript
// Calculate button states
const canPublish = trail.isPaid && !trail.publishedAt && trail.customStories?.length > 0
const canUnpublish = trail.isPaid && trail.publishedAt

const buttonStates = {
  publish: {
    enabled: canPublish,
    label: "Publish Trail",
    tooltip: !trail.isPaid 
      ? "Complete payment first" 
      : trail.customStories?.length === 0
      ? "Add at least one story"
      : "Make trail public",
    loading: false
  },
  unpublish: {
    enabled: canUnpublish,
    label: "Unpublish Trail",
    tooltip: "Hide trail from public",
    loading: false
  }
}
```

### Publish Button Handler

```javascript
async function handlePublish(referenceCode) {
  try {
    // Show loading state
    buttonStates.publish.loading = true
    
    const response = await fetch(`/trails/${referenceCode}/update`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isPublished: true
      })
    })

    if (!response.ok) {
      const error = await response.json()
      
      if (error.message.includes('PAYMENT_REQUIRED')) {
        showError('Payment required to publish')
        showPaymentForm()
      } else {
        showError(error.message || 'Failed to publish trail')
      }
      return
    }

    const data = await response.json()
    
    // Update trail state
    trail.isPaid = data.isPaid
    trail.publishedAt = data.publishedAt
    trail.status = data.status
    
    // Update UI
    showSuccess('Trail published successfully! 🎉')
    updateButtonStates()
    
    // Optionally refresh published list
    refreshPublishedTrails()

  } catch (error) {
    showError(`Error: ${error.message}`)
  } finally {
    buttonStates.publish.loading = false
  }
}
```

### Unpublish Button Handler

```javascript
async function handleUnpublish(referenceCode) {
  // Optional: Show confirmation dialog
  const confirmed = await showConfirmDialog(
    'Unpublish Trail?',
    'This trail will be hidden from public view but payment will remain recorded.',
    'Unpublish',
    'Cancel'
  )
  
  if (!confirmed) return

  try {
    buttonStates.unpublish.loading = true
    
    const response = await fetch(`/trails/${referenceCode}/update`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isPublished: false
      })
    })

    if (!response.ok) {
      const error = await response.json()
      showError(error.message || 'Failed to unpublish trail')
      return
    }

    const data = await response.json()
    
    // Update trail state
    trail.publishedAt = null
    trail.status = data.status
    
    // Update UI
    showSuccess('Trail unpublished')
    updateButtonStates()
    
    // Optional: Refresh published list
    refreshPublishedTrails()

  } catch (error) {
    showError(`Error: ${error.message}`)
  } finally {
    buttonStates.unpublish.loading = false
  }
}
```

---

## 💰 Payment Flow

### Complete Payment Workflow

```javascript
async function completePaymentFlow(trailData) {
  try {
    // 1. Create trail (unpaid)
    const trailResponse = await createTrail(trailData)
    const { referenceCode } = trailResponse
    
    // 2. Create payment intent
    const paymentResponse = await createPaymentIntent({
      amount: 9999,
      currency: 'AUD',
      metadata: { referenceCode }
    })
    const { clientSecret } = paymentResponse
    
    // 3. Show Stripe payment form
    const stripe = Stripe(STRIPE_PUBLIC_KEY)
    const elements = stripe.elements()
    const cardElement = elements.create('card')
    cardElement.mount('#card-element')
    
    // 4. Handle form submission
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: { name: userEmail }
      }
    })
    
    if (error) {
      showError(`Payment failed: ${error.message}`)
      return
    }
    
    // 5. Payment succeeded - Mark trail as paid
    if (paymentIntent.status === 'succeeded') {
      const paidResponse = await markTrailAsPaid(referenceCode)
      
      showSuccess('Payment successful! Trail published automatically ✅')
      
      // Update UI
      trail.isPaid = true
      trail.publishedAt = paidResponse.publishedAt
      
      // Redirect or refresh
      navigateTo(`/trails/${referenceCode}`)
    }
    
  } catch (error) {
    showError(`Error: ${error.message}`)
  }
}
```

---

## ⚠️ Error Handling

### Common Error Responses

```javascript
// 400 Bad Request - Payment Required
{
  "error": "PAYMENT_REQUIRED",
  "message": "Cannot publish without payment",
  "statusCode": 400
}

// 403 Forbidden - No Permission
{
  "error": "You do not have permission to modify this trail",
  "message": "Trail belongs to another user",
  "statusCode": 403
}

// 404 Not Found
{
  "error": "Trail not found",
  "statusCode": 404
}

// 401 Unauthorized
{
  "error": "Missing or invalid authentication token",
  "statusCode": 401
}
```

### Error Handling Template

```javascript
async function handleApiCall(promise) {
  try {
    const response = await promise
    return response
  } catch (error) {
    if (error.status === 401) {
      // Redirect to login
      redirectToLogin()
    } else if (error.status === 403) {
      showError('You do not have permission to access this trail')
    } else if (error.status === 404) {
      showError('Trail not found')
    } else if (error.status === 400) {
      if (error.message.includes('PAYMENT_REQUIRED')) {
        showPaymentButton()
      }
      showError(error.message)
    } else {
      showError('Something went wrong. Please try again.')
    }
    throw error
  }
}
```

---

## ✅ Frontend Checklist

### Trail Creation
- [ ] Collect trail data (title, description, stories, etc.)
- [ ] Show "Create Trail" button
- [ ] POST to `/trails` endpoint
- [ ] Store `referenceCode` in state
- [ ] Show "Payment Required" message
- [ ] Disable Publish button until paid

### Payment
- [ ] Create Stripe PaymentIntent via `/payments/create-intent`
- [ ] Display Stripe payment form
- [ ] Handle payment success/failure
- [ ] On success: Call `PUT /trails/{code}/paid`
- [ ] Auto-publish trail on payment success
- [ ] Show success message
- [ ] Update UI state

### Publish Button
- [ ] Show only if `isPaid && !publishedAt && hasStories`
- [ ] Show loading state during API call
- [ ] PUT to `/trails/{code}/update` with `isPublished: true`
- [ ] Update `publishedAt` from response
- [ ] Show success toast
- [ ] Change button to "Unpublish"

### Unpublish Button
- [ ] Show only if `isPaid && publishedAt`
- [ ] Show confirmation dialog
- [ ] Show loading state during API call
- [ ] PUT to `/trails/{code}/update` with `isPublished: false`
- [ ] Clear `publishedAt` (set to null)
- [ ] Show success toast
- [ ] Change button to "Publish"

### Error Handling
- [ ] Handle 400 (Bad Request) - Show error message
- [ ] Handle 401 (Unauthorized) - Redirect to login
- [ ] Handle 403 (Forbidden) - Show permission error
- [ ] Handle 404 (Not Found) - Show trail not found
- [ ] Handle network errors - Show retry option
- [ ] Log errors for debugging

### UI/UX
- [ ] Disable buttons during loading
- [ ] Show loading spinners
- [ ] Show success toasts
- [ ] Show error messages
- [ ] Update button labels dynamically
- [ ] Disable when conditions not met
- [ ] Show helpful tooltips
- [ ] Handle empty/null states

---

## 🧪 Testing Scenarios

### Scenario 1: Create → Pay → Publish
1. Create trail with stories
2. See "Payment Required" message
3. Click payment button
4. Complete Stripe payment
5. See "Trail published successfully"
6. See "Unpublish Trail" button
7. Trail appears in public list

### Scenario 2: Publish → Unpublish
1. Open paid, unpublished trail
2. See "Publish Trail" button
3. Click publish
4. See "Unpublish Trail" button
5. Click unpublish
6. See "Publish Trail" button again
7. Trail hidden from public list

### Scenario 3: Payment Failure
1. Create trail
2. Start payment process
3. Payment fails
4. See error message
5. See "Retry Payment" button
6. Payment still shows as pending

### Scenario 4: Insufficient Stories
1. Create trail but don't add stories
2. See "Publish" button disabled
3. Tooltip: "Add at least one story"
4. Add a story
5. "Publish" button enabled

---

## 🔐 Security Notes

- ✅ All endpoints require authentication (`Bearer {token}`)
- ✅ Users can only access/modify their own trails
- ✅ `isPaid` cannot be set from frontend (server-only)
- ✅ `publishedAt` is auto-managed (cannot be manually set)
- ✅ Payment validation happens server-side
- ✅ Use HTTPS for all API calls
- ✅ Store token securely (HttpOnly cookies recommended)

---

## 📞 Support

For questions or issues, contact the backend team with:
- Trail reference code
- User ID
- Error message
- API endpoint called
- Request payload (sanitized)
