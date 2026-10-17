import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text, useTheme } from 'foodie-shared-rn';
import JsBarcode from 'jsbarcode';
import {
  useGetOrderCustomerQuery,
  useGetOrderPaymentQuery,
  useGetOrderQuery,
} from '../../../api/endpoints/ordersApi';
import { useGetUserByIdQuery } from '../../../api/endpoints/usersApi';
import {
  extractAddressString,
  extractBarcodeValue,
  extractCustomerDetails,
  extractPaymentDetails,
  generateInvoice,
} from '../utils/invoiceGenerator';

export type InvoicePreviewModalProps = {
  visible: boolean;
  onClose: () => void;
  order: any | null;
  restaurantProfile?: any;
};

const BRAND_PRIMARY = '#14532D'; // Dark Green

export function InvoicePreviewModal({
  visible,
  onClose,
  order,
  restaurantProfile,
}: InvoicePreviewModalProps) {
  const { tokens } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');

  // 1. Dynamic Order ID & Real Barcode value (Changes for every order)
  const lookupOrderId = String(
    (order?.orderId && !String(order.orderId).startsWith('#') ? order.orderId : undefined) ||
    (order?.id && !String(order.id).startsWith('#') ? order.id : undefined) ||
    order?.orderId ||
    order?.id ||
    order?.orderNumber ||
    ''
  ).replace(/^#/, '').trim();

  // Fetch full live order details if available
  const orderDetailsQuery = useGetOrderQuery(lookupOrderId, {
    skip: !visible || !lookupOrderId,
  });
  const detail = orderDetailsQuery.data;

  // Resolve best order ID to query payment info: prioritize clean database ID
  const paymentLookupId = String(
    (detail?.orderId && !String(detail.orderId).startsWith('#') ? detail.orderId : undefined) ||
    (detail?.id && !String(detail.id).startsWith('#') ? detail.id : undefined) ||
    lookupOrderId
  ).replace(/^#/, '').trim();

  // Fetch customer contact details for this order
  const orderCustomerQuery = useGetOrderCustomerQuery(lookupOrderId, {
    skip: !visible || !lookupOrderId,
  });
  const orderCustomer = orderCustomerQuery.data;

  // Resolve user/customer id for phone & name if missing
  const targetUserId =
    (detail as any)?.userId ||
    (detail as any)?.customerId ||
    order?.userId ||
    order?.customerId ||
    '';

  const userQuery = useGetUserByIdQuery(targetUserId, {
    skip: !visible || !targetUserId,
  });
  const userData = userQuery.data;

  // Fetch real payment details directly from backend
  const orderPaymentQuery = useGetOrderPaymentQuery(paymentLookupId, {
    skip: !visible || !paymentLookupId,
  });
  const paymentInfo = orderPaymentQuery.data;

  // Resolve dynamic payment method, status, COD flag, and transaction ID
  const { isCOD, paymentMethodText, paymentStatusText, transactionId: txnId } =
    extractPaymentDetails(order, detail, paymentInfo);

  const activeOrder = {
    ...order,
    ...(detail || {}),
    paymentMethod: paymentMethodText,
    paymentMode: paymentMethodText,
    isCOD,
    isCod: isCOD,
    paymentStatus: paymentStatusText,
    transactionId: txnId,
  };

  const { barcodeValue, displayOrderId } = extractBarcodeValue(activeOrder);
  const cleanOrderId = displayOrderId;
  const fileName = `Invoice_${cleanOrderId}.pdf`;

  // Generate real dynamic barcode on mount / order change
  useEffect(() => {
    setBarcodeDataUrl('');
    if (typeof document !== 'undefined' && visible && barcodeValue) {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 45,
          displayValue: true,
          font: 'monospace',
          fontSize: 13,
          textMargin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
        setBarcodeDataUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('[InvoicePreviewModal] Barcode generation error:', e);
      }
    }
  }, [visible, barcodeValue]);

  const modalBoxRef = React.useRef<any>(null);

  // Autofocus modal and prevent background scroll
  useEffect(() => {
    if (visible && Platform.OS === 'web' && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Autofocus
      const focusTimer = setTimeout(() => {
        if (modalBoxRef.current) {
          if (typeof modalBoxRef.current.focus === 'function') {
            modalBoxRef.current.focus();
          } else if (modalBoxRef.current.node && typeof modalBoxRef.current.node.focus === 'function') {
            modalBoxRef.current.node.focus();
          }
        }
      }, 0);

      return () => {
        clearTimeout(focusTimer);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [visible]);

  // Close instantly on Escape key
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  const targetOrder = order || {};

  // 2. HOTEL / RESTAURANT DETAILS (WITH [object Object] FIX)
  const restData = restaurantProfile || {};
  const restaurantName =
    targetOrder.restaurantName ||
    targetOrder.restaurant?.name ||
    restData.name ||
    restData.legalName ||
    'DELIMO Restaurant';

  const rawRestAddr =
    targetOrder.restaurantAddress ||
    targetOrder.restaurant?.address ||
    targetOrder.restaurant?.formattedAddress ||
    restData.address ||
    restData.formattedAddress ||
    restData.registeredAddressLine1;

  let restaurantAddress = extractAddressString(rawRestAddr);
  if (!restaurantAddress && restData) {
    restaurantAddress = [restData.registeredAddressLine1, restData.city, restData.state, restData.pincode]
      .filter(Boolean)
      .join(', ');
  }
  if (!restaurantAddress) {
    restaurantAddress = 'Bengaluru, Karnataka';
  }

  const restaurantPhone =
    targetOrder.restaurantPhone ||
    targetOrder.restaurant?.phone ||
    restData.phone ||
    restData.businessPhone ||
    '+91 98765 43210';

  // 3. 100% DYNAMIC CUSTOMER DETAILS (NO HARDCODED FALLBACKS)
  const combinedCustomerOrder = {
    ...targetOrder,
    ...(detail || {}),
    customerName:
      orderCustomer?.customerName ||
      orderCustomer?.name ||
      targetOrder.customerName ||
      targetOrder.customer_name ||
      (detail as any)?.customerName ||
      userData?.name ||
      userData?.fullName ||
      userData?.displayName ||
      (typeof targetOrder.deliveryAddress === 'object' ? targetOrder.deliveryAddress?.name || targetOrder.deliveryAddress?.recipientName : undefined) ||
      (typeof (detail as any)?.deliveryAddress === 'object' ? (detail as any)?.deliveryAddress?.name || (detail as any)?.deliveryAddress?.recipientName : undefined),
    customerPhone:
      orderCustomer?.customerPhone ||
      orderCustomer?.phone ||
      targetOrder.customerPhone ||
      targetOrder.customer_phone ||
      (detail as any)?.customerPhone ||
      userData?.phone ||
      userData?.phoneNumber ||
      (typeof targetOrder.deliveryAddress === 'object' ? targetOrder.deliveryAddress?.phone || targetOrder.deliveryAddress?.phoneNumber || targetOrder.deliveryAddress?.recipientPhone : undefined) ||
      (typeof (detail as any)?.deliveryAddress === 'object' ? (detail as any)?.deliveryAddress?.phone || (detail as any)?.deliveryAddress?.phoneNumber || (detail as any)?.deliveryAddress?.recipientPhone : undefined),
    deliveryAddress:
      orderCustomer?.deliveryAddress ||
      orderCustomer?.address ||
      (detail as any)?.deliveryAddress ||
      targetOrder.deliveryAddress,
  };

  const { name: customerName, phone: customerPhone } = extractCustomerDetails(combinedCustomerOrder);

  // 4. ITEMS LIST (Dynamic: from live detail or order)
  const rawItems = (detail as any)?.items && (detail as any).items.length > 0 ? (detail as any).items : targetOrder.items;
  const items = Array.isArray(rawItems) ? rawItems : [];

  // 5. AMOUNTS (Subtotal & TOTAL with ₹ only)
  const subtotal = Number((detail as any)?.subtotal ?? targetOrder.subtotal ?? (detail as any)?.totalAmount ?? targetOrder.totalAmount ?? targetOrder.total ?? 0);
  const total = Number((detail as any)?.totalAmount ?? targetOrder.totalAmount ?? (detail as any)?.total ?? targetOrder.total ?? subtotal);

  // 6. DYNAMIC PAYMENT METHOD & STATUS (Already resolved accurately above via extractPaymentDetails)

  // 7. DATE
  const rawDate = targetOrder.createdAt || targetOrder.placedAt || new Date().toISOString();
  let formattedDate = '';
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      formattedDate = `${day}/${month}/${year}, ${timeStr}`;
    } else {
      formattedDate = new Date().toLocaleString();
    }
  } catch {
    formattedDate = new Date().toLocaleString();
  }

  // Merged Order object to pass to invoice generator when user clicks Download PDF
  const mergedOrder = {
    ...activeOrder,
    id: barcodeValue,
    orderId: displayOrderId,
    orderNumber: displayOrderId,
    restaurantName,
    restaurantAddress,
    restaurantPhone,
    customerName,
    customerPhone,
    items,
    subtotal,
    totalAmount: total,
    paymentMethod: paymentMethodText,
    paymentStatus: paymentStatusText,
    isCOD,
    transactionId: txnId,
    createdAt: rawDate,
  };

  // ACTION: Download PDF using existing invoiceGenerator.ts logic
  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await generateInvoice(mergedOrder, { autoDownload: true });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('[InvoicePreviewModal] Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  // ACTION: Print using window.print()
  const handlePrint = () => {
    if (typeof window === 'undefined') return;

    const printWindow = window.open('', '_blank', 'width=420,height=650');
    if (printWindow) {
      const itemsHtml =
        items.length > 0
          ? items
              .map((item: any) => {
                const qty = Number(item.quantity || 1);
                const price = Number(item.price ?? item.unitPrice ?? 0);
                const lineTotal = item.lineTotal != null ? Number(item.lineTotal) : price * qty;
                const name = String(item.foodName || item.name || 'Food Item').toUpperCase();
                return `<div class="row"><span>${qty} x ${name}</span><span>₹${lineTotal.toFixed(2)}</span></div>`;
              })
              .join('')
          : `<div class="row"><span>1 x ORDER ITEMS</span><span>₹${total.toFixed(2)}</span></div>`;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice #${cleanOrderId}</title>
            <style>
              @page { margin: 4mm; size: 80mm auto; }
              body {
                font-family: 'Courier New', Courier, monospace;
                color: #000;
                background: #fff;
                margin: 0;
                padding: 10px;
                font-size: 11px;
                line-height: 1.4;
              }
              .receipt { max-width: 290px; margin: 0 auto; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .title { font-size: 18px; margin-bottom: 2px; }
              .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
              .row { display: flex; justify-content: space-between; margin: 3px 0; }
              .total-row { font-size: 13px; font-weight: bold; margin-top: 4px; }
              .barcode-img { display: block; width: 220px; margin: 8px auto 4px auto; }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="center bold title">DELIMO</div>
              <div class="center bold">${restaurantName.toUpperCase()}</div>
              <div class="center">${restaurantAddress}</div>
              <div class="center">Phone: ${restaurantPhone}</div>
              <div class="divider"></div>
              <div>Date: ${formattedDate}</div>
              <div>Order ID: #${cleanOrderId}</div>
              <div class="divider"></div>
              <div class="bold">Customer Name: ${customerName}</div>
              <div>Customer Phone: ${customerPhone}</div>
              <div class="divider"></div>
              ${itemsHtml}
              <div class="divider"></div>
              <div class="row"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
              <div class="row total-row"><span>TOTAL:</span><span>₹${total.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div>Payment Method: ${paymentMethodText}</div>
              <div>Payment Status: <b>${paymentStatusText}</b></div>
              ${isCOD ? `<div class="bold">Amount To Be Collected: ₹${total.toFixed(2)}</div>` : txnId ? `<div>Transaction ID: ${txnId}</div>` : ''}
              <div class="divider"></div>
              <div class="center bold">Thank you for ordering with DELIMO!</div>
              ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" class="barcode-img" alt="Barcode" />` : `<div class="center bold">*${barcodeValue}*</div>`}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    } else {
      window.print();
    }
  };

  const content = (
    <View
      style={styles.modalContainer}
      testID="invoice-modal-container"
    >
      <Pressable
        style={styles.backdropPressable}
        onPress={onClose}
        accessibilityLabel="Close modal backdrop"
      />
      <View
        ref={modalBoxRef}
        focusable={true}
        tabIndex={-1}
        aria-modal={true}
        role="dialog"
        accessibilityRole="alert"
        style={styles.dialogCard}
      >
        {/* MODAL TOP HEADER */}
        <View style={styles.modalHeader}>
          <View>
            <Text variant="heading2" style={styles.modalTitle}>
              Invoice Preview
            </Text>
            <Text variant="caption" style={styles.modalSubtitle}>
              #{cleanOrderId} • Thermal Receipt Preview
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close Preview"
            style={styles.closeIconButton}
          >
            <Text style={styles.closeIconText}>✕</Text>
          </Pressable>
        </View>

        {downloadSuccess && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>
              ✓ Invoice PDF downloaded: {fileName}
            </Text>
          </View>
        )}

        {/* SCROLLABLE RECEIPT PREVIEW CONTENT */}
        <ScrollView
          style={styles.receiptScrollView}
          contentContainerStyle={styles.receiptScrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.receiptPaper}>
            {/* 1. DELIMO TITLE */}
            <Text style={styles.receiptAppTitle}>DELIMO</Text>

            {/* 2. HOTEL NAME & REAL ADDRESS (NO [object Object]) */}
            <Text style={styles.receiptRestName}>{restaurantName.toUpperCase()}</Text>
            <Text style={styles.receiptRestDetails}>{restaurantAddress}</Text>
            <Text style={styles.receiptRestDetails}>Phone: {restaurantPhone}</Text>

            {/* 3. HORIZONTAL LINE */}
            <View style={styles.receiptDivider} />

            {/* 4. DATE & ORDER ID */}
            <View style={styles.receiptMetaBlock}>
              <Text style={styles.receiptMonoText}>Date: {formattedDate}</Text>
              <Text style={styles.receiptMonoText}>Order ID: #{cleanOrderId}</Text>
            </View>

            {/* 5. HORIZONTAL LINE */}
            <View style={styles.receiptDivider} />

            {/* 6. 100% DYNAMIC CUSTOMER DETAILS */}
            <View style={styles.receiptMetaBlock}>
              <Text style={[styles.receiptMonoText, styles.receiptBold]}>
                Customer Name: {customerName}
              </Text>
              <Text style={styles.receiptMonoText}>
                Customer Phone: {customerPhone}
              </Text>
            </View>

            {/* 7. HORIZONTAL LINE */}
            <View style={styles.receiptDivider} />

            {/* 8. ORDERED FOOD ITEMS LIST WITH ₹ */}
            <View style={styles.receiptItemsList}>
              {items.length > 0 ? (
                items.map((item: any, idx: number) => {
                  const qty = Number(item.quantity || 1);
                  const price = Number(item.price ?? item.unitPrice ?? 0);
                  const lineTotal = item.lineTotal != null ? Number(item.lineTotal) : price * qty;
                  const name = String(item.foodName || item.name || 'Food Item').toUpperCase();

                  return (
                    <View key={idx} style={styles.receiptItemRow}>
                      <Text style={[styles.receiptMonoText, { flex: 1 }]} numberOfLines={1}>
                        {qty} x {name}
                      </Text>
                      <Text style={styles.receiptDashes} numberOfLines={1}>
                        {' ----------------- '}
                      </Text>
                      <Text style={[styles.receiptMonoText, styles.receiptBold]}>
                        ₹{lineTotal.toFixed(2)}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.receiptItemRow}>
                  <Text style={[styles.receiptMonoText, { flex: 1 }]}>
                    1 x ORDER ITEMS
                  </Text>
                  <Text style={styles.receiptDashes}>{' ----------------- '}</Text>
                  <Text style={[styles.receiptMonoText, styles.receiptBold]}>
                    ₹{total.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* 9. HORIZONTAL LINE */}
            <View style={styles.receiptDivider} />

            {/* 10. SUBTOTAL & TOTAL WITH ₹ ONLY */}
            <View style={styles.receiptSummaryBlock}>
              <View style={styles.receiptRowBetween}>
                <Text style={styles.receiptMonoText}>Subtotal:</Text>
                <Text style={styles.receiptMonoText}>₹{subtotal.toFixed(2)}</Text>
              </View>

              <View style={[styles.receiptRowBetween, styles.receiptTotalRow]}>
                <Text style={[styles.receiptMonoText, styles.receiptTotalText]}>TOTAL:</Text>
                <Text style={[styles.receiptMonoText, styles.receiptTotalText]}>
                  ₹{total.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* 11. HORIZONTAL LINE */}
            <View style={styles.receiptDivider} />

            {/* 12. 100% DYNAMIC PAYMENT DETAILS */}
            <View style={styles.receiptMetaBlock}>
              <View style={styles.receiptRowBetween}>
                <Text style={styles.receiptMonoText}>Payment Method:</Text>
                <Text style={[styles.receiptMonoText, styles.receiptBold]}>
                  {paymentMethodText}
                </Text>
              </View>

              <View style={styles.receiptRowBetween}>
                <Text style={styles.receiptMonoText}>Payment Status:</Text>
                <Text style={[styles.receiptMonoText, styles.receiptBold]}>
                  {paymentStatusText}
                </Text>
              </View>

              {isCOD ? (
                <Text style={[styles.receiptMonoText, styles.receiptBold, { marginTop: 4 }]}>
                  Amount To Be Collected: ₹{total.toFixed(2)}
                </Text>
              ) : txnId ? (
                <Text style={[styles.receiptMonoText, { marginTop: 4 }]}>
                  Transaction ID: {txnId}
                </Text>
              ) : null}
            </View>

            {/* 13. THANK YOU FOOTER */}
            <View style={styles.receiptDivider} />

            <Text style={styles.receiptFooterTitle}>
              Thank you for ordering with DELIMO!
            </Text>

            {/* 14. REAL DYNAMIC BARCODE OF ORDER ID (CODE128) */}
            <View style={styles.barcodeWrapper}>
              {barcodeDataUrl ? (
                <Image
                  source={{ uri: barcodeDataUrl }}
                  style={styles.barcodeImage}
                  accessibilityLabel={`Barcode for order ${barcodeValue}`}
                />
              ) : (
                <Text style={styles.barcodeFallbackText}>*{barcodeValue}*</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* MODAL ACTIONS: [Print] [Download PDF] [Close] */}
        <View style={styles.modalActionsBar}>
          <Button
            label="🖨️ Print"
            accessibilityLabel="Print Receipt"
            variant="secondary"
            onPress={handlePrint}
            style={styles.actionBtn}
          />

          <Button
            label={downloading ? 'Generating...' : '📥 Download PDF'}
            accessibilityLabel="Download Invoice PDF"
            variant="primary"
            disabled={downloading}
            onPress={handleDownloadPdf}
            style={[styles.actionBtn, { backgroundColor: BRAND_PRIMARY }]}
          />

          <Button
            label="Close"
            accessibilityLabel="Close Invoice Dialog"
            variant="secondary"
            onPress={onClose}
            style={styles.actionBtn}
          />
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const ReactDOM = require('react-dom');
      if (ReactDOM && typeof ReactDOM.createPortal === 'function') {
        return ReactDOM.createPortal(content, document.body);
      }
    } catch (e) {
      console.warn('[InvoicePreviewModal] Portal fallback:', e);
    }
  }

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      transparent={true}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  dialogCard: {
    position: 'relative' as any,
    zIndex: 10000,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  closeIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748B',
  },
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  successBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: 'bold',
  },
  receiptScrollView: {
    flexGrow: 1,
    maxHeight: 520,
    marginVertical: 4,
  },
  receiptScrollContent: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  receiptPaper: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  receiptAppTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: 2,
  },
  receiptRestName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 2,
  },
  receiptRestDetails: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10.5,
    textAlign: 'center',
    color: '#1E293B',
    lineHeight: 15,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  receiptMetaBlock: {
    gap: 3,
  },
  receiptMonoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#000000',
  },
  receiptBold: {
    fontWeight: 'bold',
  },
  receiptItemsList: {
    gap: 4,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptDashes: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#64748B',
  },
  receiptSummaryBlock: {
    gap: 3,
  },
  receiptRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTotalRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  receiptTotalText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  receiptFooterTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10.5,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 6,
  },
  barcodeWrapper: {
    alignItems: 'center',
    marginVertical: 6,
  },
  barcodeImage: {
    width: 220,
    height: 55,
    resizeMode: 'contain',
  },
  barcodeFallbackText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalActionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionBtn: {
    flex: 1,
    height: 42,
  },
});
