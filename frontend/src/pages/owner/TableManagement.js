import { useState, useEffect } from "react";
import axios from "axios";
import OwnerLayout from "../../components/OwnerLayout";
import { QrCode, Download, Eye, Copy } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TableManagement() {
  const [restaurantId] = useState(localStorage.getItem("owner_restaurant_id") || "");
  const [qrData, setQrData] = useState({});
  const [loading, setLoading] = useState({});
  const [previewTable, setPreviewTable] = useState(null);

  async function loadQR(tableNum) {
    if (qrData[tableNum]) return;
    setLoading(p => ({ ...p, [tableNum]: true }));
    try {
      const { data } = await axios.get(`${API}/qr/${restaurantId}/${tableNum}`);
      setQrData(p => ({ ...p, [tableNum]: data }));
    } catch {
      toast.error("Failed to generate QR");
    } finally {
      setLoading(p => ({ ...p, [tableNum]: false }));
    }
  }

  function downloadQR(tableNum) {
    const qr = qrData[tableNum];
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr.qr_code;
    a.download = `table-${tableNum}-qr.png`;
    a.click();
    toast.success(`QR for Table #${tableNum} downloaded!`);
  }

  function copyURL(tableNum) {
    const qr = qrData[tableNum];
    if (!qr) return;
    navigator.clipboard.writeText(qr.url).then(() => toast.success("URL copied to clipboard!"));
  }

  function openPreview(tableNum) {
    loadQR(tableNum);
    setPreviewTable(tableNum);
  }

  const tables = Array.from({ length: 50 }, (_, i) => i + 1);

  return (
    <OwnerLayout title="QR Codes & Tables">
      <div className="space-y-4">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-700">
          <QrCode size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">How to use QR codes</p>
            <p className="text-blue-600 mt-0.5">Click "Preview" to view a QR code, then "Download" to save it as PNG. Print and place on each table.</p>
          </div>
        </div>

        {/* Restaurant URL */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1 font-['Inter',sans-serif]">Restaurant ID</p>
          <div className="flex items-center gap-2">
            <code className="text-sm text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex-1 truncate font-mono">
              {restaurantId}
            </code>
            <button data-testid="copy-restaurant-id-btn"
              onClick={() => { navigator.clipboard.writeText(restaurantId); toast.success("Restaurant ID copied!"); }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2">
              <Copy size={12} /> Copy
            </button>
          </div>
        </div>

        {/* Table grid */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">50 Tables</h2>
            <p className="text-xs text-slate-400">Click Preview to generate QR code</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {tables.map(num => (
              <div key={num} data-testid={`table-card-${num}`}
                className="border border-slate-200 rounded-xl p-3 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-all">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                  {loading[num] ? (
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                  ) : qrData[num] ? (
                    <img src={qrData[num].qr_code} alt={`QR ${num}`} className="w-8 h-8" />
                  ) : (
                    <QrCode size={18} className="text-slate-400" />
                  )}
                </div>
                <p className="text-xs font-bold text-slate-700 mb-2">Table #{num}</p>
                <div className="flex gap-1">
                  <button data-testid={`preview-qr-${num}`}
                    onClick={() => openPreview(num)}
                    className="flex-1 text-xs bg-slate-100 text-slate-600 py-1.5 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">
                    <Eye size={10} /> View
                  </button>
                  {qrData[num] && (
                    <button data-testid={`download-qr-${num}`}
                      onClick={() => downloadQR(num)}
                      className="flex-1 text-xs bg-emerald-500 text-white py-1.5 rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1">
                      <Download size={10} /> DL
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QR Preview Modal */}
      {previewTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl animate-bounceIn">
            <h2 className="font-bold text-slate-800 text-xl mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Table #{previewTable}</h2>
            <p className="text-sm text-slate-500 mb-5">Scan to access menu</p>
            {loading[previewTable] ? (
              <div className="w-48 h-48 flex items-center justify-center mx-auto">
                <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : qrData[previewTable] ? (
              <>
                <img src={qrData[previewTable].qr_code} alt="QR" className="w-48 h-48 mx-auto rounded-xl border-2 border-slate-200 p-2" />
                <p className="text-xs text-slate-400 mt-3 break-all">{qrData[previewTable].url}</p>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => copyURL(previewTable)}
                    className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">
                    <Copy size={14} /> Copy URL
                  </button>
                  <button data-testid={`download-qr-modal-${previewTable}`} onClick={() => downloadQR(previewTable)}
                    className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1">
                    <Download size={14} /> Download
                  </button>
                </div>
              </>
            ) : null}
            <button onClick={() => setPreviewTable(null)} className="mt-4 text-sm text-slate-400 hover:text-slate-600 w-full py-2">Close</button>
          </div>
        </div>
      )}
    </OwnerLayout>
  );
}
