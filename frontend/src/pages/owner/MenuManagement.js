import { useState, useEffect } from "react";
import axios from "axios";
import OwnerLayout from "../../components/OwnerLayout";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BLANK_ITEM = { category_id: "", name: "", description: "", price: "", image_url: "", prep_time_minutes: "8", item_type: "food" };

export default function MenuManagement() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_ITEM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const token = localStorage.getItem("owner_token");
  const headers = { Authorization: `Bearer ${token}` };

  async function loadData() {
    const [cRes, iRes] = await Promise.all([
      axios.get(`${API}/owner/categories`, { headers }),
      axios.get(`${API}/owner/menu-items`, { headers }),
    ]);
    setCategories(cRes.data);
    setItems(iRes.data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function openAdd() { setForm({ ...BLANK_ITEM, category_id: categories[0]?.id || "" }); setEditId(null); setShowForm(true); }
  function openEdit(item) { setForm({ ...item, price: String(item.price), prep_time_minutes: String(item.prep_time_minutes) }); setEditId(item.id); setShowForm(true); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.price || !form.category_id) { toast.error("Name, price, and category are required"); return; }
    try {
      const payload = { ...form, price: parseFloat(form.price), prep_time_minutes: parseInt(form.prep_time_minutes) };
      if (editId) {
        await axios.put(`${API}/owner/menu-items/${editId}`, payload, { headers });
        toast.success("Item updated!");
      } else {
        await axios.post(`${API}/owner/menu-items`, payload, { headers });
        toast.success("Item added!");
      }
      setShowForm(false); loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
  }

  async function toggleAvailable(item) {
    await axios.put(`${API}/owner/menu-items/${item.id}`, { is_available: !item.is_available }, { headers });
    loadData();
  }

  async function deleteItem(id) {
    if (!window.confirm("Delete this item?")) return;
    await axios.delete(`${API}/owner/menu-items/${id}`, { headers });
    toast.success("Item deleted");
    loadData();
  }

  async function reseedMenu() {
    if (!window.confirm("This will replace all menu items with demo data. Continue?")) return;
    try {
      await axios.post(`${API}/owner/seed-menu`, {}, { headers });
      toast.success("Menu re-seeded with demo items!");
      loadData();
    } catch { toast.error("Reseed failed"); }
  }

  const displayItems = activeCategory === "all" ? items : items.filter(i => i.category_id === activeCategory);

  return (
    <OwnerLayout title="Menu Management">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button data-testid="add-item-btn" onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors">
          <Plus size={16} /> Add Item
        </button>
        <button data-testid="reseed-menu-btn" onClick={reseedMenu}
          className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <RefreshCw size={14} /> Reset Demo Menu
        </button>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        <button onClick={() => setActiveCategory("all")}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
          All ({items.length})
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCategory(c.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === c.id ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
            {c.name} ({items.filter(i => i.category_id === c.id).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 font-['Inter',sans-serif]">Item</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Price</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Prep</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayItems.map(item => (
                <tr key={item.id} data-testid={`menu-item-row-${item.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        onError={e => { e.target.src = 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=80&q=60'; }} />
                      <div>
                        <p className="font-medium text-slate-800 font-['Inter',sans-serif]">{item.name}</p>
                        <p className="text-xs text-slate-400 hidden sm:block truncate max-w-[200px]">{item.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{item.category_name}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">₹{item.price}</td>
                  <td className="px-4 py-3 text-center text-slate-500 hidden md:table-cell">{item.prep_time_minutes}m</td>
                  <td className="px-4 py-3 text-center">
                    <button data-testid={`toggle-item-${item.id}`} onClick={() => toggleAvailable(item)}>
                      {item.is_available
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Available</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full">Unavailable</span>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button data-testid={`edit-item-${item.id}`} onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button data-testid={`delete-item-${item.id}`} onClick={() => deleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayItems.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-bounceIn">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">
                {editId ? "Edit Item" : "Add New Item"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Burger name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Price (₹) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="199" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Brief description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prep Time (min)</label>
                  <input type="number" value={form.prep_time_minutes} onChange={e => setForm(p => ({ ...p, prep_time_minutes: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={form.item_type} onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="food">Food</option>
                    <option value="drink">Drink</option>
                    <option value="shake">Shake</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Image URL</label>
                <input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button data-testid="save-item-btn" type="submit"
                  className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2">
                  <Check size={16} /> {editId ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OwnerLayout>
  );
}
