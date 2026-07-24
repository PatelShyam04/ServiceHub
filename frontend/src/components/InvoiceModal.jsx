import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const InvoiceModal = ({ booking, onClose }) => {
  const invoiceRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!booking) return null;

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'pt', 'a4');
      const invoiceId = `INV-BK-${booking.id}`;

      // Primary Brand Bar
      doc.setFillColor(55, 48, 163); // Indigo #3730a3
      doc.rect(0, 0, 595, 75, 'F');

      // Logo Icon box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(36, 18, 40, 40, 8, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(55, 48, 163);
      doc.text('S', 51, 45);

      // Brand Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('ServiceHub', 88, 42);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Quality Local Services On-Demand', 88, 56);

      // Invoice Title (Right Top)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('TAX INVOICE', 560, 36, { align: 'right' });
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`#${invoiceId}`, 560, 50, { align: 'right' });

      let y = 105;

      // Status Pill
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(36, y, 120, 20, 10, 10, 'F');
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('PAID & COMPLETED', 96, y + 13, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`Invoice Date: ${bookingDateStr}`, 560, y + 13, { align: 'right' });

      y += 35;

      // Customer & Provider Cards Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(36, y, 250, 95, 8, 8, 'F');
      doc.roundedRect(308, y, 250, 95, 8, 8, 'F');

      // Billed To
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('BILLED TO (CUSTOMER)', 48, y + 20);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(customerName, 48, y + 38);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Phone: ${customerPhone}`, 48, y + 54);
      doc.text(`Address: ${booking.address ? booking.address.substring(0, 35) : 'N/A'}`, 48, y + 70);

      // Service Provider
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICE PROVIDER', 320, y + 20);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(`${providerFirstName} ${providerLastName}`.trim() || 'Service Provider', 320, y + 38);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Category: ${categoryName}`, 320, y + 54);
      doc.text(`Phone: ${providerPhone}`, 320, y + 70);

      y += 115;

      // Problem description if exists
      if (booking.problem_description) {
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(36, y, 522, 32, 6, 6, 'F');
        doc.setTextColor(146, 64, 14);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Note: ', 48, y + 19);
        doc.setFont('helvetica', 'italic');
        doc.text(`"${booking.problem_description.substring(0, 80)}"`, 80, y + 19);
        y += 44;
      }

      // Itemized Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(36, y, 522, 28, 'F');
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ITEM DESCRIPTION', 48, y + 18);
      doc.text('CATEGORY', 260, y + 18);
      doc.text('QTY', 420, y + 18, { align: 'center' });
      doc.text('AMOUNT', 545, y + 18, { align: 'right' });

      y += 28;

      // Item Row 1
      doc.setDrawColor(226, 232, 240);
      doc.line(36, y + 30, 558, y + 30);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(serviceName, 48, y + 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(categoryName, 260, y + 20);
      doc.text('1', 420, y + 20, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${price}`, 545, y + 20, { align: 'right' });

      y += 32;

      // Item Row 2 (Platform Fee)
      doc.line(36, y + 30, 558, y + 30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('ServiceHub Platform Booking Fee', 48, y + 20);
      doc.text('Platform', 260, y + 20);
      doc.text('1', 420, y + 20, { align: 'center' });
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.text('INCLUDED (Rs. 0)', 545, y + 20, { align: 'right' });

      y += 45;

      // Summary Section
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Payment Method:', 48, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text((booking.payment_method || 'CASH').toUpperCase(), 140, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Subtotal:', 420, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rs. ${price}`, 545, y, { align: 'right' });

      y += 18;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Payment Status:', 48, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text('PAID & CONFIRMED', 140, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Taxes & GST (0%):', 420, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('Rs. 0', 545, y, { align: 'right' });

      y += 24;

      doc.setDrawColor(203, 213, 225);
      doc.line(400, y, 558, y);

      y += 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text('Total Paid:', 420, y);
      doc.text(`Rs. ${price}`, 545, y, { align: 'right' });

      // Footer Note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Thank you for choosing ServiceHub! For queries regarding this invoice, contact support@servicehub.com', 297, 800, { align: 'center' });

      doc.save(`ServiceHub_Invoice_BK${booking.id}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF invoice:', err);
      alert('Could not download PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const serviceName = booking.provider_service_details?.service_details?.name || 'Service Booking';
  const categoryName = booking.provider_service_details?.service_details?.category?.name || 'General Service';
  const price = booking.provider_service_details?.price || 0;
  const providerFirstName = booking.provider_service_details?.provider_first_name || '';
  const providerLastName = booking.provider_service_details?.provider_last_name || '';
  const providerPhone = booking.provider_service_details?.provider_phone || 'N/A';
  const customerName = booking.customer_name || 'Customer';
  const customerPhone = booking.customer_phone || 'N/A';
  const bookingDateStr = booking.booking_date ? new Date(booking.booking_date).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div 
        className="relative bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400">description</span>
            <span className="font-bold text-sm">Tax Invoice #INV-BK-{booking.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {isGenerating ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div ref={invoiceRef} className="p-8 bg-white text-slate-800 font-sans">
          
          {/* Header */}
          <div className="flex justify-between items-start pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white text-lg">
                  S
                </div>
                <span className="text-2xl font-extrabold tracking-tight text-slate-900">ServiceHub</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Connecting Quality Local Services</p>
              <p className="text-xs text-slate-500">support@servicehub.com | www.servicehub.com</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
                PAID & COMPLETED
              </span>
              <h2 className="text-xl font-bold text-slate-900">INVOICE</h2>
              <p className="text-xs text-slate-500 font-mono">Invoice #: INV-BK-{booking.id}</p>
              <p className="text-xs text-slate-500">Date: {bookingDateStr}</p>
            </div>
          </div>

          {/* Customer & Provider Details */}
          <div className="grid grid-cols-2 gap-6 my-6 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">Billed To (Customer)</span>
              <p className="font-bold text-sm text-slate-900">{customerName}</p>
              <p className="text-slate-600 mt-0.5">📞 {customerPhone}</p>
              <p className="text-slate-600 mt-1 font-medium">📍 {booking.address}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">Service Provider</span>
              <p className="font-bold text-sm text-slate-900">{providerFirstName} {providerLastName}</p>
              <p className="text-slate-600 mt-0.5">Specialization: {categoryName}</p>
              <p className="text-slate-600">📞 {providerPhone}</p>
            </div>
          </div>

          {/* Problem Note if provided */}
          {booking.problem_description && (
            <div className="mb-6 p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900">
              <span className="font-bold">Customer Problem Note: </span>
              <span className="italic">"{booking.problem_description}"</span>
            </div>
          )}

          {/* Itemized Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Item Description</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-center">Qty</th>
                  <th className="p-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="p-3.5 font-medium text-slate-900">{serviceName}</td>
                  <td className="p-3.5">{categoryName}</td>
                  <td className="p-3.5 text-center">1</td>
                  <td className="p-3.5 text-right font-bold text-slate-900">₹{price}</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-medium text-slate-500">ServiceHub Platform Booking Fee</td>
                  <td className="p-3.5 text-slate-400">Platform</td>
                  <td className="p-3.5 text-center text-slate-400">1</td>
                  <td className="p-3.5 text-right font-medium text-emerald-600">INCLUDED (₹0)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals & Payment Info */}
          <div className="flex justify-between items-start pt-2 border-t border-slate-200">
            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">Payment Information:</p>
              <p>Payment Method: <span className="font-bold uppercase text-slate-800">{booking.payment_method || 'ONLINE'}</span></p>
              <p>Payment Status: <span className="font-bold text-emerald-600">PAID</span></p>
            </div>

            <div className="w-48 text-right text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-medium text-slate-800">₹{price}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxes & GST (0%):</span>
                <span className="font-medium text-slate-800">₹0</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-300">
                <span>Total Paid:</span>
                <span className="text-indigo-600">₹{price}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
            Thank you for choosing ServiceHub! For queries regarding this invoice, please contact support@servicehub.com.
          </div>

        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
