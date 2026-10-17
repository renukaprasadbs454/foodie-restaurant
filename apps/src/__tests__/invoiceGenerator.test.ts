import { generateInvoice, extractAddressString } from '../features/orders/utils/invoiceGenerator';

describe('DELIMO Invoice Generator', () => {
  const sampleOrder = {
    id: 'FD-20261016-000002',
    orderId: '10000000-0000-4000-8000-000000000001',
    orderNumber: '#ORD-2026-0801',
    status: 'CONFIRMED',
    userId: 'cust-101',
    customerName: 'Aarav Patel',
    customerPhone: '+91 98451 12233',
    restaurantName: 'Foodie Delights',
    restaurantAddress: {
      street: '124 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
    },
    restaurantPhone: '+91 98765 43210',
    subtotal: 936,
    totalAmount: 936,
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    transactionId: 'TXN_982347612',
    createdAt: '2026-10-16T12:00:00.000Z',
    items: [
      {
        name: 'Hyderabadi Dum Biryani',
        quantity: 2,
        unitPrice: 349,
        lineTotal: 698,
      },
      {
        name: 'Special Mango Lassi',
        quantity: 2,
        unitPrice: 119,
        lineTotal: 238,
      },
    ],
  };

  it('correctly extracts string from structured address object without [object Object]', () => {
    expect(extractAddressString('[object Object]')).toBe('');
    expect(
      extractAddressString({
        street: '124 MG Road',
        city: 'Bengaluru',
      })
    ).toBe('124 MG Road');
    expect(
      extractAddressString({
        fullAddress: 'Flat 402, Green Acres, Koramangala, Bengaluru',
      })
    ).toBe('Flat 402, Green Acres, Koramangala, Bengaluru');
  });

  it('generates an invoice with correct filename and jsPDF document without errors', async () => {
    const result = await generateInvoice(sampleOrder, { autoDownload: false });
    expect(result).toBeDefined();
    expect(result.fileName).toBe('Invoice_FD-20261016-000002.pdf');
    expect(result.doc).toBeDefined();
  });

  it('generates an invoice for Cash on Delivery orders with dynamic COD detection', async () => {
    const codOrder = {
      ...sampleOrder,
      id: 'FD-20261016-000003',
      orderNumber: '#ORD-2026-0802',
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'pending',
      deliveryAddress: {
        name: 'Sneha Reddy',
        phone: '+91 98765 00001',
      },
      customerName: undefined,
      customerPhone: undefined,
    };
    const result = await generateInvoice(codOrder, { autoDownload: false });
    expect(result).toBeDefined();
    expect(result.fileName).toBe('Invoice_FD-20261016-000003.pdf');
  });

  it('correctly extracts customer name and phone across all backend payload variations', () => {
    const { extractCustomerDetails } = require('../features/orders/utils/invoiceGenerator');

    // Variant 1: Direct fields
    expect(extractCustomerDetails({ customerName: 'Alice', customerPhone: '+91 90000 11111' })).toEqual({
      name: 'Alice',
      phone: '+91 90000 11111',
    });

    // Variant 2: In deliveryAddress object
    expect(
      extractCustomerDetails({
        deliveryAddress: { name: 'Bob Smith', phone: '+91 90000 22222' },
      })
    ).toEqual({
      name: 'Bob Smith',
      phone: '+91 90000 22222',
    });

    // Variant 3: Snake case customer_name & customer_phone
    expect(
      extractCustomerDetails({
        customer_name: 'Charlie',
        customer_phone: '+91 90000 33333',
      })
    ).toEqual({
      name: 'Charlie',
      phone: '+91 90000 33333',
    });

    // Variant 4: Inside user or customer object
    expect(
      extractCustomerDetails({
        customer: { fullName: 'Deepa Roy', phoneNumber: '+91 90000 44444' },
      })
    ).toEqual({
      name: 'Deepa Roy',
      phone: '+91 90000 44444',
    });

    // Variant 5: Fallback if completely empty
    expect(extractCustomerDetails({})).toEqual({
      name: 'Customer',
      phone: 'N/A',
    });
  });

  it('correctly extracts dynamic barcodes for each unique order', () => {
    const { extractBarcodeValue } = require('../features/orders/utils/invoiceGenerator');

    expect(extractBarcodeValue({ id: 'FD-20261016-000001' })).toEqual({
      barcodeValue: 'FD-20261016-000001',
      displayOrderId: 'FD-20261016-000001',
    });

    expect(extractBarcodeValue({ orderNumber: '#ORD-2026-0802' })).toEqual({
      barcodeValue: 'ORD-2026-0802',
      displayOrderId: 'ORD-2026-0802',
    });

    expect(extractBarcodeValue({ orderId: '10000000-0000-4000-8000-000000000003' })).toEqual({
      barcodeValue: '10000000-0000-4000-8000-000000000003',
      displayOrderId: '10000000-0000-4000-8000-000000000003',
    });
  });

  it('correctly extracts dynamic payment methods for COD vs ONLINE across all fields', () => {
    const { extractPaymentDetails } = require('../features/orders/utils/invoiceGenerator');

    // COD variants (paymentMethod, paymentMode, method, paymentType, isCOD, cod boolean)
    expect(extractPaymentDetails({ paymentMethod: 'COD' }).isCOD).toBe(true);
    expect(extractPaymentDetails({ paymentMode: 'cash' }).isCOD).toBe(true);
    expect(extractPaymentDetails({ method: 'cash_on_delivery' }).isCOD).toBe(true);
    expect(extractPaymentDetails({ paymentType: 'COD' }).isCOD).toBe(true);
    expect(extractPaymentDetails({ isCOD: true }).isCOD).toBe(true);
    expect(extractPaymentDetails({ isCod: true }).isCOD).toBe(true);
    expect(extractPaymentDetails({ cod: true }).isCOD).toBe(true);
    expect(extractPaymentDetails({ isCOD: 'true' }).isCOD).toBe(true);
    expect(extractPaymentDetails({ payment: { method: 'CASH_ON_DELIVERY' } }).isCOD).toBe(true);
    expect(extractPaymentDetails({ paymentDetails: { mode: 'cod' } }).isCOD).toBe(true);

    // COD must show CASH ON DELIVERY, PENDING, and hide Transaction ID completely
    const codRes = extractPaymentDetails({ paymentMethod: 'cod', transactionId: 'LEAKED_ID' });
    expect(codRes.paymentMethodText).toBe('CASH ON DELIVERY');
    expect(codRes.paymentStatusText).toBe('PENDING');
    expect(codRes.transactionId).toBe('');

    // Online variants must show ONLINE PAYMENT, PAID, and real Transaction ID
    const online = extractPaymentDetails({ paymentMethod: 'ONLINE', transactionId: 'TXN_999' });
    expect(online.isCOD).toBe(false);
    expect(online.paymentMethodText).toBe('ONLINE PAYMENT');
    expect(online.paymentStatusText).toBe('PAID');
    expect(online.transactionId).toBe('TXN_999');

    // Real payment methods (UPI, Card, Net Banking, Wallet)
    const upiRes = extractPaymentDetails({ paymentMethod: 'UPI', transactionId: 'TXN_UPI_123' });
    expect(upiRes.paymentMethodText).toBe('UPI');
    expect(upiRes.paymentStatusText).toBe('PAID');
    expect(upiRes.transactionId).toBe('TXN_UPI_123');

    const cardRes = extractPaymentDetails({ paymentMethod: 'CREDIT_CARD', transactionId: 'TXN_CARD_456' });
    expect(cardRes.paymentMethodText).toBe('CREDIT CARD');

    const netBankingRes = extractPaymentDetails({ paymentMethod: 'NET_BANKING', transactionId: 'TXN_NB_789' });
    expect(netBankingRes.paymentMethodText).toBe('NET BANKING');

    const walletRes = extractPaymentDetails({ paymentMethod: 'WALLET', transactionId: 'TXN_WAL_101' });
    expect(walletRes.paymentMethodText).toBe('WALLET');

    // Prevent undefined in detail from clobbering COD in order
    const mergedCod = extractPaymentDetails(
      { paymentMethod: 'COD', isCOD: true },
      { paymentMethod: undefined, paymentMode: undefined }
    );
    expect(mergedCod.isCOD).toBe(true);
    expect(mergedCod.paymentMethodText).toBe('CASH ON DELIVERY');
    expect(mergedCod.paymentStatusText).toBe('PENDING');
    expect(mergedCod.transactionId).toBe('');
  });
});
