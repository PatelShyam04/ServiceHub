import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import ConfirmModal from '../components/ConfirmModal';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState({ 
    total_users: 0, 
    total_providers: 0, 
    total_customers: 0, 
    total_bookings: 0,
    total_revenue: 0,
    platform_commission: 0,
    monthly_data: [] 
  });
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search State
  const [userSearch, setUserSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState('All');

  // Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('home_repair_service');

  // Service Modal State
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [selectedCatForService, setSelectedCatForService] = useState(null);
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcDesc, setNewSvcDesc] = useState('');

  // Provider Profile Modal State
  const [selectedProviderModal, setSelectedProviderModal] = useState(null);
  const [providerProfileLoading, setProviderProfileLoading] = useState(false);

  // Custom Confirm Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Delete',
    type: 'danger',
    isLoading: false,
  });

  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const fetchData = async () => {
    try {
      const [statsRes, providersRes, bookingsRes, usersRes, catRes] = await Promise.all([
        api.get('accounts/admin/stats/'),
        api.get('accounts/admin/providers/'),
        api.get('accounts/admin/bookings/'),
        api.get('accounts/admin/users/'),
        api.get('services/categories/')
      ]);
      setStats(statsRes.data || {});
      setProviders(Array.isArray(providersRes.data) ? providersRes.data : []);
      setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      setUsersList(Array.isArray(usersRes.data) ? usersRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/login');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  };

  const verifyProvider = async (id) => {
    try {
      await api.patch(`accounts/admin/providers/${id}/verify/`);
      showNotification('Provider verified successfully!');
      fetchData();
    } catch (err) {
      console.error('Error verifying provider:', err);
      showNotification('Failed to verify provider.', 'error');
    }
  };

  const toggleUserActiveStatus = async (userId, username, currentStatus) => {
    try {
      const res = await api.patch(`accounts/admin/users/${userId}/toggle-active/`);
      showNotification(res.data.message || `Account updated successfully.`);
      fetchData();
    } catch (err) {
      console.error('Error toggling account status:', err);
      showNotification(err.response?.data?.detail || 'Failed to update account status.', 'error');
    }
  };

  const handleExportUsersCSV = () => {
    if (!usersList.length) return;
    const data = usersList.map(u => ({
      'User ID': u.id,
      'Full Name': `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'N/A',
      'Username': u.username || 'N/A',
      'Email Address': u.email || 'N/A',
      'System Role': u.is_staff || u.role === 'Admin' ? 'Admin' : (u.is_provider || u.role === 'Provider' ? 'Provider' : 'Customer'),
      'Email Verified': u.is_email_verified ? 'VERIFIED' : 'UNVERIFIED',
      'Account Status': u.is_active ? 'ACTIVE' : 'BLOCKED',
      'Date Joined': u.date_joined ? new Date(u.date_joined).toLocaleDateString() : 'N/A'
    }));

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(h => `"${('' + (row[h] ?? '')).replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ServiceHub_Users_Directory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('User Directory exported to CSV!');
  };

  const handleExportBookingsCSV = () => {
    if (!bookings.length) return;
    const data = bookings.map(b => ({
      'Booking ID': `#BK-${b.id}`,
      'Service Title': b.provider_service_details?.service_details?.name || 'General Service Contract',
      'Customer Name': b.customer_name || 'N/A',
      'Provider Name': `${b.provider_service_details?.provider_first_name || ''} ${b.provider_service_details?.provider_last_name || ''}`.trim() || 'N/A',
      'Scheduled Date': b.booking_date ? new Date(b.booking_date).toLocaleString() : 'N/A',
      'Contract Price (INR)': `Rs. ${b.provider_service_details?.price || 0}`,
      'Payment Status': (b.payment_status || 'UNPAID').toUpperCase(),
      'Payment Method': (b.payment_method || 'CASH').toUpperCase(),
      'Contract Status': (b.status || 'PENDING').toUpperCase(),
      'Service Address': (b.address || 'N/A').replace(/\n/g, ' ')
    }));

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(h => `"${('' + (row[h] ?? '')).replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ServiceHub_Bookings_Audit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Bookings Audit Log exported to CSV!');
  };

  const handleViewProviderProfile = async (providerId) => {
    setProviderProfileLoading(true);
    try {
      const res = await api.get(`accounts/providers/${providerId}/public/`);
      setSelectedProviderModal(res.data);
      setProviderProfileLoading(false);
    } catch (err) {
      console.error('Failed to load provider profile:', err);
      showNotification('Failed to fetch provider details.', 'error');
      setProviderProfileLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('accounts/admin/categories/', {
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        icon: newCatIcon.trim() || 'home_repair_service'
      });
      showNotification('New category created successfully!');
      setShowAddCategoryModal(false);
      setNewCatName('');
      setNewCatDesc('');
      setNewCatIcon('home_repair_service');
      fetchData();
    } catch (err) {
      console.error('Failed to create category:', err);
      showNotification('Failed to create category.', 'error');
    }
  };

  const handleDeleteCategory = (id, name) => {
    setConfirmModalConfig({
      isOpen: true,
      title: `Delete Category "${name}"?`,
      message: `All associated services and provider offerings for "${name}" will be permanently deleted. This action cannot be undone.`,
      confirmText: 'Delete Category',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`accounts/admin/categories/${id}/`);
          showNotification(`Category "${name}" deleted successfully!`);
          fetchData();
        } catch (err) {
          console.error('Failed to delete category:', err);
          showNotification('Failed to delete category.', 'error');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    if (!newSvcName.trim() || !selectedCatForService) return;
    try {
      await api.post('accounts/admin/services/', {
        category: selectedCatForService.id,
        name: newSvcName.trim(),
        description: newSvcDesc.trim()
      });
      showNotification(`Service "${newSvcName.trim()}" added to ${selectedCatForService.name}!`);
      setShowAddServiceModal(false);
      setSelectedCatForService(null);
      setNewSvcName('');
      setNewSvcDesc('');
      fetchData();
    } catch (err) {
      console.error('Failed to create service:', err);
      showNotification('Failed to create service.', 'error');
    }
  };

  const handleDeleteService = (serviceId, serviceName) => {
    setConfirmModalConfig({
      isOpen: true,
      title: `Delete Service "${serviceName}"?`,
      message: `Are you sure you want to delete service "${serviceName}"? Providers offering this service will no longer be listed for it.`,
      confirmText: 'Delete Service',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`accounts/admin/services/${serviceId}/`);
          showNotification(`Service "${serviceName}" deleted!`);
          fetchData();
        } catch (err) {
          console.error('Failed to delete service:', err);
          showNotification('Failed to delete service.', 'error');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white font-extrabold text-lg flex-col gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-bounce flex items-center justify-center shadow-xl">
          <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
        </div>
        <span>Initializing Admin Console...</span>
      </div>
    );
  }

  const filteredUsers = (Array.isArray(usersList) ? usersList : []).filter(u => 
    (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.first_name && u.first_name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredBookings = (Array.isArray(bookings) ? bookings : []).filter(b => {
    if (!b) return false;
    const matchesFilter = bookingFilter === 'All' || b.status === bookingFilter.toLowerCase();
    if (!matchesFilter) return false;
    
    if (!bookingSearch.trim()) return true;
    
    const query = bookingSearch.toLowerCase();
    const serviceName = b.provider_service_details?.service_details?.name || '';
    const customerName = b.customer_name || '';
    const providerName = `${b.provider_service_details?.provider_first_name || ''} ${b.provider_service_details?.provider_last_name || ''}`;
    const address = b.address || '';
    const bookingIdStr = `#bk-${b.id} bk-${b.id} ${b.id}`;

    return serviceName.toLowerCase().includes(query) ||
           customerName.toLowerCase().includes(query) ||
           providerName.toLowerCase().includes(query) ||
           address.toLowerCase().includes(query) ||
           bookingIdStr.toLowerCase().includes(query);
  });

  // ── Overview Tab Component ──
  const renderOverview = () => (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
      {/* Financial & Platform Bento Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Gross Volume</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-lg">payments</span>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-on-background tracking-tight">₹{stats.total_revenue?.toLocaleString('en-IN') || 0}</h3>
          <span className="text-[10px] text-emerald-600 font-extrabold mt-1 inline-block">Total platform GMV</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Platform Fee</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-lg">account_balance</span>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-on-background tracking-tight">₹{stats.platform_commission?.toLocaleString('en-IN') || 0}</h3>
          <span className="text-[10px] text-indigo-600 font-extrabold mt-1 inline-block">10% Platform Revenue</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Total Users</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-lg">group_add</span>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-on-background tracking-tight">{stats.total_users}</h3>
          <span className="text-[10px] text-emerald-600 font-extrabold mt-1 inline-block">Registered accounts</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Providers</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-lg">engineering</span>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-on-background tracking-tight">{stats.total_providers}</h3>
          <span className="text-[10px] text-indigo-600 font-extrabold mt-1 inline-block">Verified experts</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Customers</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-lg">person_check</span>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-on-background tracking-tight">{stats.total_customers}</h3>
          <span className="text-[10px] text-emerald-600 font-extrabold mt-1 inline-block">Active buyers</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Total Bookings</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-on-background tracking-tight">{stats.total_bookings}</h3>
          <span className="text-[10px] text-indigo-600 font-extrabold mt-1 inline-block">Service contracts</span>
        </div>
      </div>

      {/* Main Charts & Verifications Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Performance Area Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-title-md text-title-md font-extrabold text-on-background flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-xl">trending_up</span>
                Platform Revenue & Commission Growth
              </h3>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">Gross revenue and 10% platform share over time</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              ₹ Financial Growth
            </span>
          </div>
          <div className="h-64 w-full">
            {stats.monthly_data && stats.monthly_data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthly_data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminColorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="adminColorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(val, name) => [ `₹${val}`, name === 'revenue' ? 'Gross Revenue' : '10% Commission' ]}
                    contentStyle={{ borderRadius: '16px', background: '#0f172a', color: '#fff', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#adminColorRev)" />
                  <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#adminColorComm)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-on-surface-variant font-medium">
                No monthly trend data captured yet.
              </div>
            )}
          </div>
        </div>

        {/* Booking Status Distribution Donut */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-title-md text-title-md font-extrabold text-on-background flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-xl">pie_chart</span>
                Booking Status
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">Platform completion rates</p>
            </div>
          </div>

          <div className="h-[180px] w-full relative flex items-center justify-center">
            {stats.status_counts ? (() => {
              const pieData = [
                { name: 'Completed', value: stats.status_counts.completed, color: '#10b981' },
                { name: 'Pending', value: stats.status_counts.pending, color: '#f59e0b' },
                { name: 'Accepted', value: stats.status_counts.accepted, color: '#6366f1' },
                { name: 'Cancelled', value: stats.status_counts.cancelled, color: '#ef4444' },
              ].filter(item => item.value > 0);

              if (pieData.length === 0) {
                return (
                  <div className="text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">pie_chart</span>
                    <p className="text-xs font-semibold">No booking status metrics.</p>
                  </div>
                );
              }

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} bookings`, name]}
                      contentStyle={{ borderRadius: '12px', background: '#0f172a', color: '#fff', border: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              );
            })() : null}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex justify-between p-1.5 rounded-lg bg-slate-50 font-medium text-slate-700">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/>Completed</span>
              <span className="font-extrabold">{stats.status_counts?.completed || 0}</span>
            </div>
            <div className="flex justify-between p-1.5 rounded-lg bg-slate-50 font-medium text-slate-700">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/>Pending</span>
              <span className="font-extrabold">{stats.status_counts?.pending || 0}</span>
            </div>
            <div className="flex justify-between p-1.5 rounded-lg bg-slate-50 font-medium text-slate-700">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"/>Accepted</span>
              <span className="font-extrabold">{stats.status_counts?.accepted || 0}</span>
            </div>
            <div className="flex justify-between p-1.5 rounded-lg bg-slate-50 font-medium text-slate-700">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"/>Cancelled</span>
              <span className="font-extrabold">{stats.status_counts?.cancelled || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Categories Leaderboard */}
      {stats.top_categories && stats.top_categories.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-title-md text-title-md font-extrabold text-on-background flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-xl">leaderboard</span>
              Top Performing Categories
            </h3>
            <span className="text-xs font-semibold text-slate-500">By gross revenue</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.top_categories.map((cat, idx) => (
              <div key={cat.name} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/60 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{cat.name}</h4>
                    <p className="text-xs text-slate-500">{cat.count} completed bookings</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-indigo-700 text-base">₹{cat.revenue.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Provider Verifications Tab ──
  const renderProviderVerifications = () => (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl overflow-hidden shadow-md animate-[fadeIn_0.3s_ease-out]">
      <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/40">
        <div>
          <h3 className="font-title-md text-title-md font-extrabold text-on-background flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-xl">badge</span>
            Provider Verifications
          </h3>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">Review registered professionals, view public profiles, and grant platform verification.</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200/60 shadow-2xs">
          {providers.length} Registered
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/80 border-b border-outline-variant/20 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
              <th className="py-4 px-6 font-extrabold">Provider Info</th>
              <th className="py-4 px-6 font-extrabold">City</th>
              <th className="py-4 px-6 font-extrabold">Phone</th>
              <th className="py-4 px-6 font-extrabold">Verification</th>
              <th className="py-4 px-6 font-extrabold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="font-body-base text-sm divide-y divide-outline-variant/10">
            {providers.map(p => (
              <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="py-4 px-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-2xs">
                    {p.first_name ? p.first_name[0].toUpperCase() : p.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-extrabold text-on-background">{p.first_name} {p.last_name}</p>
                    <p className="text-xs font-mono text-on-surface-variant font-semibold">@{p.username}</p>
                  </div>
                </td>
                <td className="py-4 px-6 text-on-surface-variant font-medium">{p.city || 'Not Set'}</td>
                <td className="py-4 px-6 text-on-surface-variant font-medium">{p.phone_number || 'N/A'}</td>
                <td className="py-4 px-6">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase flex items-center gap-1 w-fit border ${
                    p.is_verified 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {p.is_verified ? 'verified' : 'hourglass_empty'}
                    </span>
                    {p.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* View Profile Option */}
                    <button
                      onClick={() => handleViewProviderProfile(p.id)}
                      className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-extrabold hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">visibility</span>
                      <span>Profile</span>
                    </button>

                    {/* Verify Action */}
                    {!p.is_verified ? (
                      <button 
                        onClick={() => verifyProvider(p.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        <span>Verify</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-extrabold inline-flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-base">verified</span>
                        Approved
                      </span>
                    )}

                    {/* Block / Unblock Action */}
                    <button
                      onClick={() => toggleUserActiveStatus(p.user_id, p.username, p.is_active)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1 ${
                        p.is_active !== false 
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {p.is_active !== false ? 'block' : 'check_circle'}
                      </span>
                      <span>{p.is_active !== false ? 'Block' : 'Unblock'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── User Directory Tab ──
  const renderUsers = () => (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-on-background flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">manage_accounts</span>
            User Account Directory ({filteredUsers.length})
          </h3>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Full platform accounts management, role auditing, and real-time block access control.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {filteredUsers.length > 0 && (
            <button
              onClick={handleExportUsersCSV}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Export CSV</span>
            </button>
          )}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              placeholder="Search user, email, role..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-outline-variant/40 text-xs font-semibold bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/80 border-b border-outline-variant/20 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                <th className="py-4 px-6 font-extrabold">User Profile</th>
                <th className="py-4 px-6 font-extrabold">Email Address</th>
                <th className="py-4 px-6 font-extrabold">System Role</th>
                <th className="py-4 px-6 font-extrabold">Email Verification</th>
                <th className="py-4 px-6 font-extrabold">Account Status</th>
                <th className="py-4 px-6 font-extrabold text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="font-body-base text-sm divide-y divide-outline-variant/10">
              {filteredUsers.map(u => {
                if (!u) return null;
                const displayName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || 'User';
                const avatarLetter = u.first_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || 'U';
                const userRole = u.is_staff || u.role === 'Admin' ? 'Admin' : (u.is_provider || u.role === 'Provider' ? 'Provider' : 'Customer');

                return (
                  <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                        {avatarLetter}
                      </div>
                      <div>
                        <p className="font-extrabold text-on-background text-sm">{displayName}</p>
                        <p className="text-xs font-mono text-on-surface-variant font-semibold">@{u.username || 'user'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-on-surface-variant font-medium text-xs">{u.email || 'N/A'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        userRole === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        userRole === 'Provider' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {userRole}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        u.is_email_verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {u.is_email_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {u.is_active ? 'Active' : 'BLOCKED'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => toggleUserActiveStatus(u.id, u.username, u.is_active)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1 ml-auto ${
                          u.is_active
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {u.is_active ? 'block' : 'check_circle'}
                        </span>
                        <span>{u.is_active ? 'Block Account' : 'Unblock Account'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-on-surface-variant text-sm font-medium">
                    No matching accounts found in directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── Global Bookings Audit Tab ──
  const renderBookings = () => (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-on-background flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">receipt_long</span>
            Global Bookings Audit Monitor ({filteredBookings.length})
          </h3>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Real-time monitoring, financial auditing, and status tracking for all platform service contracts.
          </p>
        </div>

        {/* Real-time Search & CSV Export Input for Bookings */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {filteredBookings.length > 0 && (
            <button
              onClick={handleExportBookingsCSV}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Export CSV Report</span>
            </button>
          )}
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
            <input
              type="text"
              placeholder="Search booking ID, customer, provider, service..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-outline-variant/40 text-xs font-semibold bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-surface-container-low rounded-2xl border border-outline-variant/30 w-fit">
        {['All', 'Pending', 'Accepted', 'Completed', 'Cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setBookingFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              bookingFilter === f
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bookings Card List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredBookings.map(b => {
          if (!b) return null;
          const serviceName = b.provider_service_details?.service_details?.name || 'General Service Contract';
          const providerName = `${b.provider_service_details?.provider_first_name || ''} ${b.provider_service_details?.provider_last_name || ''}`.trim() || 'Service Provider';
          const price = b.provider_service_details?.price || 0;
          const status = (b.status || 'pending').toLowerCase();
          const paymentStatus = (b.payment_status || 'unpaid').toLowerCase();
          const paymentMethod = (b.payment_method || 'CASH').toUpperCase();

          return (
            <div key={b.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    status === 'accepted' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {status}
                  </span>
                  <span className="text-xs font-mono font-extrabold text-on-surface-variant">#BK-{b.id}</span>
                </div>
                <h4 className="text-base font-extrabold text-on-surface">
                  {serviceName}
                </h4>
                <p className="text-xs text-on-surface-variant font-medium">
                  Customer: <strong className="text-on-surface">{b.customer_name || 'Customer'}</strong> | Provider: <strong className="text-indigo-600">{providerName}</strong>
                </p>
                <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1 text-slate-500">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  <span>{b.address || 'Address not specified'}</span>
                </p>
              </div>

              <div className="text-left md:text-right shrink-0">
                <span className="text-[10px] text-on-surface-variant uppercase font-extrabold tracking-wider block">Contract Value</span>
                <p className="text-xl font-extrabold text-indigo-600 mt-0.5">₹{price}</p>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border inline-block mt-1 ${
                  paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {paymentStatus} ({paymentMethod})
                </span>
              </div>
            </div>
          );
        })}
        {filteredBookings.length === 0 && (
          <div className="text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 text-xs text-on-surface-variant font-medium">
            No bookings found matching search query or filter criteria.
          </div>
        )}
      </div>
    </div>
  );

  // ── Service Categories Tab ──
  const renderCategories = () => (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-extrabold text-on-background flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">category</span>
            Marketplace Service Categories
          </h3>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">Manage catalog categories and individual services offered on the platform.</p>
        </div>
        <button
          onClick={() => setShowAddCategoryModal(true)}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-extrabold hover:bg-indigo-700 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Add New Category</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(c => (
          <div key={c.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-xl transition-all duration-300 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs shrink-0">
                    <span className="material-symbols-outlined text-2xl">{c.icon || 'home_repair_service'}</span>
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-on-surface leading-tight">{c.name}</h4>
                    <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 inline-block mt-0.5">
                      {c.services ? c.services.length : 0} Services
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCategory(c.id, c.name)}
                  className="p-1.5 rounded-xl text-red-500 hover:text-white hover:bg-red-600 hover:shadow-sm transition-all cursor-pointer flex items-center justify-center shrink-0"
                  title="Delete Category"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>

              {c.description && (
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed line-clamp-2">
                  {c.description}
                </p>
              )}

              {/* Services Section under Category */}
              <div className="space-y-2 pt-3 border-t border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">Services ({c.services ? c.services.length : 0})</span>
                  <button
                    onClick={() => {
                      setSelectedCatForService(c);
                      setShowAddServiceModal(true);
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[11px] font-extrabold transition-all cursor-pointer border border-indigo-200/60 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    <span>Add Service</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(c.services || []).map(svc => (
                    <div key={svc.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 hover:border-indigo-200 transition-colors">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-extrabold text-on-surface truncate">{svc.name}</p>
                        {svc.description && (
                          <p className="text-[10px] text-on-surface-variant truncate font-medium">{svc.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteService(svc.id, svc.name)}
                        className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        title="Delete Service"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                  {(!c.services || c.services.length === 0) && (
                    <p className="text-xs text-on-surface-variant/70 italic py-2 text-center font-medium">No services added yet. Click "+ Add Service" above.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-background flex font-sans">
      {notification.show && (
        <div className={`fixed top-5 right-5 p-4 rounded-2xl shadow-xl z-50 text-white font-extrabold text-xs animate-[slideIn_0.3s_ease-out] flex items-center gap-2 ${
          notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          <span className="material-symbols-outlined text-base">
            {notification.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-[260px] flex flex-col z-30 shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        
        {/* Brand Header */}
        <div className="px-6 pt-7 pb-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: 'linear-gradient(135deg, #4648d4, #7c7dff)' }}>
              <span className="material-symbols-outlined text-white text-xl">admin_panel_settings</span>
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">ServiceHub</span>
          </div>
          <span className="text-[10px] font-extrabold text-indigo-300/60 uppercase tracking-[0.2em] pl-11">Admin Console</span>
        </div>

        <div className="mx-6 h-px bg-white/10 mb-3" />

        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
          {[
            { id: 'Overview', label: 'Overview & Stats', icon: 'dashboard' },
            { id: 'Verifications', label: 'Provider Verifications', icon: 'badge', badge: providers.filter(p => !p.is_verified).length },
            { id: 'Users', label: 'User Directory', icon: 'group' },
            { id: 'Bookings', label: 'Global Bookings Audit', icon: 'receipt_long' },
            { id: 'Categories', label: 'Service Categories', icon: 'category' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer relative ${
                activeTab === tab.id
                  ? 'text-white shadow-lg'
                  : 'text-indigo-200/60 hover:text-white hover:bg-white/5'
              }`}
              style={activeTab === tab.id ? { background: 'linear-gradient(135deg, rgba(70,72,212,0.85), rgba(124,125,255,0.55))' } : {}}
            >
              {activeTab === tab.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full bg-white" />}
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Admin Profile Footer */}
        <div className="mx-3 mb-4 mt-3">
          <div className="rounded-2xl p-3 flex items-center gap-3 mb-2.5 border border-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ring-2 ring-white/20"
              style={{ background: 'linear-gradient(135deg, #4648d4, #7c7dff)', color: 'white' }}>
              A
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-extrabold truncate">Administrator</p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold">Superuser</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all duration-200 hover:bg-red-500/20 text-red-300 border border-red-400/30"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[260px] min-h-screen flex flex-col">
        {/* Top App Bar */}
        <header className="sticky top-0 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 flex justify-between items-center h-16 w-full px-8 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium">Control Center</span>
              <span className="font-extrabold text-on-surface text-sm">Platform Management &mdash; {activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-extrabold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>System Live</span>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-8 max-w-container_max w-full mx-auto space-y-8 pb-20">
          {activeTab === 'Overview' && renderOverview()}
          {activeTab === 'Verifications' && renderProviderVerifications()}
          {activeTab === 'Users' && renderUsers()}
          {activeTab === 'Bookings' && renderBookings()}
          {activeTab === 'Categories' && renderCategories()}
        </div>
      </main>

      {/* Add New Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md border border-outline-variant/20 shadow-2xl p-6 space-y-4 animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h3 className="text-lg font-extrabold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">category</span>
                Add New Service Category
              </h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Plumbing Services"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/40 p-3 text-xs bg-surface-container-lowest font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Description</label>
                <textarea
                  rows="3"
                  placeholder="Describe services offered under this category..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/40 p-3 text-xs bg-surface-container-lowest font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Icon (Material Symbol)</label>
                  <span className="text-[10px] font-bold text-indigo-600">Live Preview</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <span className="material-symbols-outlined text-2xl">{newCatIcon || 'category'}</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Type any Material Symbol icon (e.g. build, cleaning_services, spa)"
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    className="flex-1 rounded-2xl border border-outline-variant/40 p-3 text-xs bg-surface-container-lowest font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                {/* Popular Icon Suggestions */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-on-surface-variant">Click to select popular icon:</span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {[
                      'home_repair_service', 'spa', 'school', 'devices', 'directions_car', 
                      'cleaning_services', 'plumbing', 'bolt', 'build', 'handyman', 
                      'pest_control', 'local_laundry_service', 'cut', 'format_paint', 
                      'roofing', 'grass', 'shield', 'fitness_center', 'medical_services'
                    ].map(iconName => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setNewCatIcon(iconName)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                          newCatIcon === iconName
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:border-indigo-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">{iconName}</span>
                        <span>{iconName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2.5 border border-outline-variant rounded-xl text-xs font-extrabold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-extrabold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer shadow-md"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Service Modal */}
      {showAddServiceModal && selectedCatForService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md border border-outline-variant/20 shadow-2xl p-6 space-y-4 animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">add_task</span>
                  Add Service
                </h3>
                <p className="text-xs text-indigo-600 font-extrabold mt-0.5">Category: {selectedCatForService.name}</p>
              </div>
              <button onClick={() => { setShowAddServiceModal(false); setSelectedCatForService(null); }} className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leak Detection, Deep Cleaning, Wiring Repair"
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/40 p-3 text-xs bg-surface-container-lowest font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Description (Optional)</label>
                <textarea
                  rows="3"
                  placeholder="Describe what is included in this service..."
                  value={newSvcDesc}
                  onChange={(e) => setNewSvcDesc(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/40 p-3 text-xs bg-surface-container-lowest font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddServiceModal(false); setSelectedCatForService(null); }}
                  className="px-4 py-2.5 border border-outline-variant rounded-xl text-xs font-extrabold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-extrabold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer shadow-md"
                >
                  Add Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provider Full Public Profile Modal */}
      {selectedProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-2xl border border-outline-variant/20 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            
            {/* Modal Header Banner */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-6 text-white relative shadow-md">
              <button
                onClick={() => setSelectedProviderModal(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
              <div className="flex items-center gap-4">
                {selectedProviderModal.profile_picture ? (
                  <img src={selectedProviderModal.profile_picture} alt="" className="w-18 h-18 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg" />
                ) : (
                  <div className="w-18 h-18 rounded-2xl bg-indigo-500 text-white flex items-center justify-center text-3xl font-extrabold ring-4 ring-white/20 shadow-lg">
                    {selectedProviderModal.first_name ? selectedProviderModal.first_name[0].toUpperCase() : 'P'}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold">{selectedProviderModal.first_name} {selectedProviderModal.last_name}</h3>
                    {selectedProviderModal.is_verified ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-400/40 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">verified</span> Verified Partner
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-extrabold border border-amber-400/40 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">hourglass_empty</span> Pending Verification
                      </span>
                    )}

                    {selectedProviderModal.is_active !== false ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-400/40 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span> Active Account
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-500/30 text-red-200 text-[10px] font-extrabold border border-red-400/50 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">block</span> ACCOUNT BLOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-indigo-200/80 font-medium">📍 {selectedProviderModal.city || 'City not specified'} &bull; 📞 {selectedProviderModal.phone_number || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                  <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Experience</span>
                  <p className="text-base font-extrabold text-on-surface mt-0.5">{selectedProviderModal.experience_years || 0} Years</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                  <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Services</span>
                  <p className="text-base font-extrabold text-indigo-600 mt-0.5">{(selectedProviderModal.services || []).length} Active</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                  <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Reviews</span>
                  <p className="text-base font-extrabold text-amber-600 mt-0.5">{(selectedProviderModal.reviews || []).length} Total</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                  <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider block">Skills</span>
                  <p className="text-xs font-extrabold text-on-surface truncate mt-0.5">{selectedProviderModal.skills || 'General Pro'}</p>
                </div>
              </div>

              {selectedProviderModal.bio && (
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">About / Bio</h4>
                  <p className="text-xs leading-relaxed text-on-surface font-medium p-3.5 bg-surface-container-low/40 rounded-2xl border border-outline-variant/15">
                    "{selectedProviderModal.bio}"
                  </p>
                </div>
              )}

              {/* Offered Services */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Offered Services ({(selectedProviderModal.services || []).length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(selectedProviderModal.services || []).map(s => (
                    <div key={s.id} className="p-3.5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest flex justify-between items-center shadow-2xs">
                      <div>
                        <p className="text-xs font-extrabold text-on-surface">{s.service_details?.name}</p>
                        <span className="text-[10px] text-on-surface-variant font-medium">{s.category_name}</span>
                      </div>
                      <span className="text-xs font-extrabold text-indigo-600">₹{s.price}</span>
                    </div>
                  ))}
                  {(selectedProviderModal.services || []).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic col-span-2">No services added yet.</p>
                  )}
                </div>
              </div>

              {/* Reviews */}
              <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Customer Reviews ({(selectedProviderModal.reviews || []).length})</h4>
                <div className="space-y-2">
                  {(selectedProviderModal.reviews || []).map(r => (
                    <div key={r.id} className="p-3.5 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-on-surface">{r.customer_name}</span>
                        <span className="text-xs font-extrabold text-amber-500">⭐ {r.rating}.0</span>
                      </div>
                      <p className="text-xs text-on-surface-variant italic">"{r.comment}"</p>
                    </div>
                  ))}
                  {(selectedProviderModal.reviews || []).length === 0 && (
                    <p className="text-xs text-on-surface-variant italic">No reviews submitted yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Control Bar */}
            <div className="p-4 bg-surface-container-low/60 border-t border-outline-variant/20 flex flex-wrap justify-between items-center gap-3">
              <div className="flex gap-2">
                {!selectedProviderModal.is_verified && (
                  <button
                    onClick={() => {
                      verifyProvider(selectedProviderModal.id);
                      setSelectedProviderModal(prev => ({ ...prev, is_verified: true }));
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 transition-colors cursor-pointer shadow-md flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>Verify Partner</span>
                  </button>
                )}

                <button
                  onClick={async () => {
                    const userId = selectedProviderModal.user_id;
                    const newStatus = !selectedProviderModal.is_active;
                    await toggleUserActiveStatus(userId, selectedProviderModal.username, selectedProviderModal.is_active);
                    setSelectedProviderModal(prev => ({ ...prev, is_active: newStatus }));
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-1 shadow-2xs ${
                    selectedProviderModal.is_active !== false
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {selectedProviderModal.is_active !== false ? 'block' : 'check_circle'}
                  </span>
                  <span>{selectedProviderModal.is_active !== false ? 'Block Account' : 'Unblock Account'}</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedProviderModal(null)}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-extrabold hover:bg-indigo-700 transition-colors cursor-pointer shadow-md"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        type={confirmModalConfig.type}
        isLoading={confirmModalConfig.isLoading}
      />
    </div>
  );
};

export default AdminDashboard;
