import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { parseApiError } from '../api/errorUtils';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import InvoiceModal from '../components/InvoiceModal';
import ConfirmModal from '../components/ConfirmModal';
import { Modal } from '../components/Modal';

const INDIAN_CITIES = [
  "Ahmedabad", "Bangalore", "Bhopal", "Chennai", "Coimbatore", "Delhi",
  "Ghaziabad", "Hyderabad", "Indore", "Jaipur", "Kanpur", "Kochi",
  "Kolkata", "Lucknow", "Ludhiana", "Madurai", "Mumbai", "Nagpur",
  "Nashik", "Noida", "Patna", "Pune", "Rajkot", "Surat", "Thane",
  "Vadodara", "Varanasi", "Visakhapatnam"
].sort();

const ProviderDashboard = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [profile, setProfile] = useState({ bio: '', phone_number: '', first_name: '', last_name: '', is_verified: false, skills: '', experience_years: 0, gallery_images: [] });
  const [categories, setCategories] = useState([]);
  const [myServices, setMyServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Availability state
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [newServiceId, setNewServiceId] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [galleryFile, setGalleryFile] = useState(null);

  // Chat states
  const [activeChatBookingId, setActiveChatBookingId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [declineBookingId, setDeclineBookingId] = useState(null);
  const [activePhotoModal, setActivePhotoModal] = useState(null);
  const chatEndRef = React.useRef(null);

  // App Notifications
  const [appNotifications, setAppNotifications] = useState([]);

  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

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

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const formatBookingDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, catsRes, myServicesRes, bookingsRes, reviewsRes, analyticsRes] = await Promise.all([
        api.get('accounts/profile/'),
        api.get('services/categories/'),
        api.get('services/provider/services/'),
        api.get('services/bookings/'),
        api.get('services/provider/reviews/'),
        api.get('services/provider/analytics/').catch(() => ({ data: null }))
      ]);
      setProfile(profileRes.data);
      setCategories(catsRes.data);
      setMyServices(myServicesRes.data);
      setBookings(bookingsRes.data);
      setReviews(reviewsRes.data);
      if (analyticsRes.data) {
        setAnalyticsData(analyticsRes.data);
      }
      setLoading(false);

      // Auto-direct first time or incomplete profiles to Settings tab
      if (!profileRes.data.phone_number || !profileRes.data.city || !profileRes.data.skills) {
        setActiveTab('Profile');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  // Fetch provider availability
  const fetchAvailability = async () => {
    try {
      const res = await api.get('services/availability/');
      setAvailabilitySlots(res.data);
    } catch (err) {
      console.error('Failed to fetch availability', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'Availability') fetchAvailability();
  }, [activeTab]);

  const saveAvailability = async () => {
    setAvailabilitySaving(true);
    try {
      const res = await api.put('services/availability/', availabilitySlots);
      setAvailabilitySlots(res.data);
      showNotification('Availability schedule saved!');
    } catch (err) {
      console.error('Failed to save availability', err);
      showNotification('Failed to save. Please try again.', 'error');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const toggleDay = (dayIndex) => {
    const existing = availabilitySlots.find(s => s.day_of_week === dayIndex);
    if (existing) {
      // Toggle is_available
      setAvailabilitySlots(prev =>
        prev.map(s => s.day_of_week === dayIndex ? { ...s, is_available: !s.is_available } : s)
      );
    } else {
      // Add new slot with defaults
      setAvailabilitySlots(prev => [
        ...prev,
        { day_of_week: dayIndex, start_time: '09:00', end_time: '17:00', is_available: true }
      ]);
    }
  };

  const updateSlotTime = (dayIndex, field, value) => {
    setAvailabilitySlots(prev =>
      prev.map(s => s.day_of_week === dayIndex ? { ...s, [field]: value } : s)
    );
  };

  const fetchAppNotifications = async () => {
    try {
      const res = await api.get('services/notifications/');
      setAppNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    let interval;
    if (activeTab === 'Notifications') {
      fetchAppNotifications();
      interval = setInterval(fetchAppNotifications, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  const markNotificationRead = async (id) => {
    try {
      await api.patch(`services/notifications/${id}/read/`);
      fetchAppNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`services/notifications/${id}/delete/`);
      fetchAppNotifications();
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('services/notifications/clear/');
      fetchAppNotifications();
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setProfile(prev => ({
          ...prev,
          latitude: Math.round(latitude * 100000) / 100000,
          longitude: Math.round(longitude * 100000) / 100000
        }));
        setIsDetectingLocation(false);
        showNotification('GPS location detected successfully!');
      },
      (err) => {
        setIsDetectingLocation(false);
        showNotification('Unable to fetch GPS position. Please check permissions.', 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      if (profile.phone_number) formData.append('phone_number', profile.phone_number);
      if (profile.city) formData.append('city', profile.city);
      if (profile.latitude) formData.append('latitude', profile.latitude);
      if (profile.longitude) formData.append('longitude', profile.longitude);
      if (profile.bio) formData.append('bio', profile.bio);
      if (profile.available_days) formData.append('available_days', profile.available_days);
      if (profile.start_time) formData.append('start_time', profile.start_time);
      if (profile.end_time) formData.append('end_time', profile.end_time);
      if (profile.skills) formData.append('skills', profile.skills);
      if (profile.experience_years) formData.append('experience_years', profile.experience_years);
      if (profilePictureFile) formData.append('profile_picture', profilePictureFile);

      const response = await api.put('accounts/profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProfile(response.data);
      setProfilePictureFile(null); // Clear the file input state after success
      showNotification('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      showNotification(parseApiError(err, 'Failed to update profile.'), 'error');
    }
  };

  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const handleSwitchRole = async (targetRole) => {
    setIsSwitchingRole(true);
    try {
      const response = await api.post('accounts/switch-role/', { target_role: targetRole });
      localStorage.setItem('access', response.data.access);
      localStorage.setItem('refresh', response.data.refresh);
      showNotification(`Account switched to ${targetRole === 'provider' ? 'Service Professional' : 'Customer'}! Redirecting...`);
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err) {
      console.error(err);
      showNotification(parseApiError(err, 'Failed to switch role.'), 'error');
      setIsSwitchingRole(false);
    }
  };

  const handleGalleryUpload = async (e) => {
    e.preventDefault();
    if (!galleryFile) return;
    try {
      const formData = new FormData();
      formData.append('image', galleryFile);
      await api.post('accounts/gallery/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setGalleryFile(null);
      fetchData(); // refresh profile to get new images
      showNotification('Image added to gallery!');
    } catch (err) {
      console.error(err);
      showNotification(parseApiError(err, 'Failed to upload image.'), 'error');
    }
  };

  const handleDeleteGalleryImage = (id) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Remove Portfolio Image?',
      message: 'Are you sure you want to remove this photo from your showcase portfolio?',
      confirmText: 'Remove Photo',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`accounts/gallery/${id}/`);
          fetchData();
          showNotification('Image removed.');
        } catch (err) {
          console.error(err);
          showNotification(parseApiError(err, 'Failed to remove image.'), 'error');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleDayToggle = (day) => {
    let currentDays = profile.available_days ? profile.available_days.split(',') : [];
    if (currentDays.includes(day)) {
      currentDays = currentDays.filter(d => d !== day);
    } else {
      currentDays.push(day);
    }
    setProfile({ ...profile, available_days: currentDays.join(',') });
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await api.post('services/provider/services/', {
        service_id: newServiceId,
        price: newServicePrice
      });
      setNewServiceId('');
      setNewServicePrice('');
      fetchData(); // refresh list
      showNotification('Service added successfully!');
    } catch (err) {
      console.error(err);
      showNotification(parseApiError(err, 'Failed to add service.'), 'error');
    }
  };

  const handleDeleteService = (id) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Remove Offered Service?',
      message: 'Are you sure you want to remove this service from your provider profile?',
      confirmText: 'Remove Service',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`services/provider/services/${id}/`);
          fetchData();
          showNotification('Service removed.');
        } catch (err) {
          console.error(err);
          showNotification(parseApiError(err, 'Failed to delete service.'), 'error');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleUpdateBookingStatus = async (id, newStatus) => {
    try {
      await api.patch(`services/bookings/${id}/status/`, { status: newStatus });
      fetchData(); // refresh bookings
      showNotification(`Booking marked as ${newStatus}.`);
    } catch (err) {
      console.error(err);
      showNotification(parseApiError(err, 'Failed to update booking status.'), 'error');
    }
  };

  const handleDeclineBooking = (id) => {
    setDeclineBookingId(id);
  };

  const confirmDeclineBooking = async (id) => {
    try {
      await api.patch(`services/bookings/${id}/status/`, { status: 'cancelled' });
      fetchData(); // refresh bookings
      showNotification('Booking declined and cancelled.');
      setDeclineBookingId(null);
    } catch (err) {
      console.error(err);
      showNotification(parseApiError(err, 'Failed to decline booking.'), 'error');
    }
  };

  // WebSocket refs
  const chatSocketRef = React.useRef(null);
  const notificationSocketRef = React.useRef(null);

  // Real-time Notification WebSocket Connection
  useEffect(() => {
    const token = localStorage.getItem('access');
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsUrl = `${wsProtocol}//${wsHost}:8000/ws/notifications/?token=${token}`;
    
    const socket = new WebSocket(wsUrl);
    notificationSocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev]);
          showNotification(data.notification.message);
          fetchData();
        }
      } catch (err) {
        console.error('Notification WS parse error:', err);
      }
    };

    return () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => socket.close();
      }
    };
  }, []);

  // Real-time Chat WebSocket Connection
  useEffect(() => {
    if (!activeChatBookingId || activeTab !== 'Messages') {
      if (chatSocketRef.current) {
        const currentSocket = chatSocketRef.current;
        if (currentSocket.readyState === WebSocket.OPEN) {
          currentSocket.close();
        } else if (currentSocket.readyState === WebSocket.CONNECTING) {
          currentSocket.onopen = () => currentSocket.close();
        }
        chatSocketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('access');
    if (!token) return;

    fetchMessages();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsUrl = `${wsProtocol}//${wsHost}:8000/ws/chat/${activeChatBookingId}/?token=${token}`;
    
    const socket = new WebSocket(wsUrl);
    chatSocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setChatMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      } catch (err) {
        console.error('Chat WS parse error:', err);
      }
    };

    return () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.onopen = () => socket.close();
      }
    };
  }, [activeChatBookingId, activeTab]);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`services/messages/?booking_id=${activeChatBookingId}`);
      setChatMessages(res.data);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const deleteMessage = async (id) => {
    try {
      await api.delete(`services/messages/${id}/delete/`);
      fetchMessages();
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const handleClearConversation = () => {
    setShowClearConfirmModal(true);
  };

  const confirmClearConversation = async (bookingId) => {
    try {
      await api.delete(`services/messages/clear/${bookingId}/`);
      showNotification('Conversation cleared successfully.');
      fetchMessages();
    } catch (err) {
      console.error(err);
      showNotification('Failed to clear conversation.', 'error');
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatBookingId) return;
    const content = chatInput.trim();
    setChatInput('');

    if (chatSocketRef.current && chatSocketRef.current.readyState === WebSocket.OPEN) {
      chatSocketRef.current.send(JSON.stringify({ content }));
    } else {
      try {
        await api.post('services/messages/', {
          booking: activeChatBookingId,
          content: content
        });
        fetchMessages();
      } catch (err) {
        showNotification('Failed to send message', 'error');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-[260px] h-screen fixed left-0 top-0 bg-surface border-r border-outline-variant/30 p-6 flex flex-col gap-4">
          <div className="skeleton h-8 w-36 mb-2" />
          <div className="skeleton h-4 w-24 mb-6" />
          {[...Array(7)].map((_, i) => <div key={i} className="skeleton h-10 w-full rounded-lg" />)}
        </div>
        <div className="ml-[260px] flex-1 p-8 space-y-6">
          <div className="skeleton h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-36 rounded-xl" />)}
          </div>
          <div className="skeleton h-64 rounded-xl" />
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Earnings aggregator
  const earningsData = bookings
    .filter(b => b.status === 'completed')
    .map(b => ({
      name: `BK-${b.id}`,
      amount: parseFloat(b.provider_service_details.price)
    }));

  const totalEarnings = bookings
    .filter(b => b.status === 'completed')
    .reduce((acc, b) => acc + parseFloat(b.provider_service_details.price), 0);

  const pendingJobs = bookings.filter(b => b.status === 'pending');

  const renderDashboard = () => (
    <div className="space-y-stack_lg" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      {(!profile.phone_number || !profile.city || !profile.skills) && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-[fadeIn_0.3s_ease-out]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
              <span className="material-symbols-outlined text-2xl">priority_high</span>
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">First-Time Setup Required: Complete Your Profile</h4>
              <p className="text-xs text-slate-600 mt-0.5">Please add your Phone Number, City location, and Primary Skills in Settings below to start receiving job bookings.</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('Profile')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-md shrink-0 flex items-center gap-1.5"
          >
            <span>Complete Profile Now</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className="absolute top-[-30%] right-[-5%] w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c7dff, transparent)' }} />
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-indigo-200/80 text-xs font-semibold">Welcome back,</span>
            {profile.is_verified ? (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                <span className="material-symbols-outlined text-[13px]">verified</span> Verified Partner
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                <span className="material-symbols-outlined text-[13px]">hourglass_empty</span> Verification Pending
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {profile.first_name || 'Professional'}! 👋
          </h2>
          <p className="text-xs text-indigo-200/80 font-medium">
            You have <strong className="text-white font-extrabold">{pendingJobs.length}</strong> new job {pendingJobs.length === 1 ? 'request' : 'requests'} pending your review.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 hover:-translate-y-1.5 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Total Earnings</span>
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-on-surface tracking-tight">₹{totalEarnings.toFixed(0)}</div>
          <span className="text-xs text-indigo-600 font-extrabold mt-1 inline-block">From completed contracts</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 hover:-translate-y-1.5 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Completed Jobs</span>
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">done_all</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-on-surface tracking-tight">{bookings.filter(b => b.status === 'completed').length}</div>
          <span className="text-xs text-emerald-600 font-extrabold mt-1 inline-block">Total finished requests</span>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 hover:-translate-y-1.5 transition-all duration-300 shadow-2xs hover:shadow-xl group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Avg. Rating</span>
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">star</span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-on-surface tracking-tight">
            {reviews.length > 0 ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '—'}
          </div>
          <span className="text-xs text-amber-600 font-extrabold mt-1 inline-block">Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
        </div>
      </div>



      {/* Incoming Requests */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-lg text-headline-lg font-extrabold text-on-background">Incoming Requests</h3>
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-200/60 shadow-2xs">
            {bookings.filter(b => ['pending', 'accepted'].includes(b.status)).length} Active
          </span>
        </div>

        {bookings.filter(b => ['pending', 'accepted'].includes(b.status)).length === 0 ? (
          <div className="text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <h4 className="font-extrabold text-on-surface text-lg">No active requests</h4>
            <p className="text-xs text-on-surface-variant mt-1">Check back later for new customer service bookings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookings.filter(b => ['pending', 'accepted'].includes(b.status)).map(booking => (
              <div key={booking.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 shadow-2xs hover:shadow-md transition-all duration-200">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 border ${
                      booking.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {booking.status === 'accepted' ? 'check_circle' : 'hourglass_empty'}
                      </span>
                      {booking.status}
                    </span>
                    <span className="text-xs font-mono text-on-surface-variant font-extrabold">#BK-{booking.id}</span>
                  </div>
                  <h4 className="font-title-md text-title-md font-extrabold text-on-surface">
                    {booking.provider_service_details.service_details.name}
                  </h4>
                  <p className="text-xs text-on-surface-variant font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">person</span>
                    Customer: <span className="text-on-surface font-extrabold">{booking.customer_name}</span> ({booking.customer_phone || 'No phone'})
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                    <span className="material-symbols-outlined text-base">location_on</span>
                    {booking.address}
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
                    <span className="material-symbols-outlined text-base">event</span>
                    {formatBookingDate(booking.booking_date)}
                  </p>

                  {booking.problem_description && (
                    <div className="p-3.5 bg-surface-container-low/60 rounded-2xl border border-outline-variant/15 text-xs text-on-surface-variant italic font-medium mt-2">
                      "{booking.problem_description}"
                    </div>
                  )}

                  {booking.problem_photo && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <span className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">Attached Photo:</span>
                      <button
                        type="button"
                        onClick={() => setActivePhotoModal(booking.problem_photo)}
                        className="relative group/pic cursor-pointer overflow-hidden rounded-xl border border-indigo-200 hover:border-indigo-500 transition-all shadow-2xs"
                      >
                        <img src={booking.problem_photo} alt="Problem Area" className="w-14 h-14 object-cover group-hover/pic:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pic:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="material-symbols-outlined text-white text-base">zoom_in</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-4 shrink-0 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-outline-variant/15">
                  <div className="text-left md:text-right w-full md:w-auto">
                    <span className="text-[10px] text-on-surface-variant uppercase font-extrabold tracking-wider block">Payout</span>
                    <p className="text-xl font-extrabold text-indigo-600 mt-0.5">₹{booking.provider_service_details.price}</p>
                    <span className={`text-xs font-extrabold uppercase inline-block mt-1 px-2.5 py-0.5 rounded-full border ${
                      booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {booking.payment_status} {booking.payment_method && `(${booking.payment_method.toUpperCase()})`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {booking.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleDeclineBooking(booking.id)}
                          className="flex-1 md:flex-none px-4 py-2.5 border border-red-200 text-red-600 font-extrabold text-xs rounded-xl hover:bg-red-50 transition-all cursor-pointer"
                        >
                          Decline
                        </button>
                        <button 
                          onClick={() => handleUpdateBookingStatus(booking.id, 'accepted')}
                          className="flex-1 md:flex-none px-5 py-2.5 bg-indigo-600 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-700 transition-all cursor-pointer shadow-md"
                        >
                          Accept
                        </button>
                      </>
                    )}
                    {booking.status === 'accepted' && (
                      <button 
                        onClick={() => handleUpdateBookingStatus(booking.id, 'completed')}
                        className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-md"
                      >
                        Mark Completed
                      </button>
                    )}
                    {booking.status === 'completed' && (
                      <button 
                        onClick={() => setSelectedInvoiceBooking(booking)}
                        className="w-full md:w-auto px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 font-extrabold text-xs rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 justify-center shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-base">receipt_long</span>
                        <span>Invoice</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-stack_lg animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Offer Services</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage the services you offer and configure your rates.</p>
        </div>
        <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-200 shadow-2xs">
          {myServices.length} Active Services
        </span>
      </div>
      
      {/* Add Service Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md space-y-4">
        <h3 className="font-title-md text-title-md font-extrabold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">add_circle</span>
          Offer a New Service
        </h3>
        <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Select Category & Service</label>
            <select 
              value={newServiceId} 
              onChange={(e) => setNewServiceId(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 p-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs"
              required
            >
              <option value="">-- Choose a Service --</option>
              {categories.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.services.map(svc => (
                    <option key={svc.id} value={svc.id}>{svc.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Hourly Rate (₹)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-xs">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                placeholder="e.g. 500"
                className="w-full rounded-2xl border border-slate-300 pl-8 pr-3.5 py-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs font-bold"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-2xl text-xs font-extrabold hover:bg-indigo-700 transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 h-[42px]">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Service
          </button>
        </form>
      </div>

      {/* Active Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {myServices.length === 0 ? (
          <div className="col-span-full text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl">handyman</span>
            </div>
            <h4 className="font-extrabold text-on-surface text-lg">No services added</h4>
            <p className="text-xs text-on-surface-variant mt-1">Add the services you offer above so customers can search and book your services.</p>
          </div>
        ) : (
          myServices.map(ps => (
            <div key={ps.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 flex flex-col justify-between shadow-2xs hover:shadow-xl transition-all duration-300 group">
              <div>
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">construction</span>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border border-indigo-200/60">
                    {ps.category_name}
                  </span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-extrabold mt-4 tracking-tight">
                  {ps.service_details.name}
                </h3>
              </div>
              <div className="flex justify-between items-center mt-6 pt-4 border-t border-outline-variant/20">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Rate</span>
                  <span className="font-extrabold text-indigo-600 text-lg">₹{ps.price}/hr</span>
                </div>
                <button 
                  onClick={() => handleDeleteService(ps.id)} 
                  className="w-9 h-9 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title="Remove Service"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPortfolio = () => (
    <div className="space-y-stack_lg animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Portfolio Gallery</h2>
          <p className="text-sm text-on-surface-variant mt-1">Showcase high-quality photos of your completed projects to earn client trust.</p>
        </div>
        <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-200 shadow-2xs">
          {profile.gallery_images?.length || 0} Photos Uploaded
        </span>
      </div>
      
      {/* Upload Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md space-y-4">
        <h3 className="font-title-md text-title-md font-extrabold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">cloud_upload</span>
          Upload Portfolio Work
        </h3>
        <form onSubmit={handleGalleryUpload} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Select Image File</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setGalleryFile(e.target.files[0])}
              className="w-full rounded-2xl border border-slate-300 p-2.5 text-xs bg-white text-slate-900 cursor-pointer shadow-2xs"
              required
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-2xl text-xs font-extrabold hover:bg-indigo-700 transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 h-[42px]">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            Upload Work
          </button>
        </form>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {profile.gallery_images && profile.gallery_images.length === 0 ? (
          <div className="col-span-full text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl">collections</span>
            </div>
            <h4 className="font-extrabold text-on-surface text-lg">No images uploaded</h4>
            <p className="text-xs text-on-surface-variant mt-1">Showcase your past work by uploading high-quality images of completed projects.</p>
          </div>
        ) : (
          profile.gallery_images && profile.gallery_images.map(img => (
            <div key={img.id} className="aspect-square rounded-3xl overflow-hidden border border-slate-200/80 relative group shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => setActivePhotoModal(img.image)}>
              <img src={img.image} alt="Portfolio Work" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                <span className="text-white text-[11px] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">zoom_in</span> View
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteGalleryImage(img.id); }}
                  className="text-white bg-red-600 p-2 rounded-xl hover:bg-red-700 cursor-pointer shadow-md transition-colors"
                  title="Delete Image"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const handleExportJobsCSV = () => {
    if (!bookings.length) return;
    const data = bookings.map(b => ({
      'Job Ref': `#BK-${b.id}`,
      'Service Name': b.provider_service_details?.service_details?.name || 'N/A',
      'Category': b.provider_service_details?.service_details?.category?.name || 'General',
      'Customer Name': b.customer_name || 'N/A',
      'Customer Phone': b.customer_phone || 'N/A',
      'Scheduled Time': b.booking_date ? new Date(b.booking_date).toLocaleString() : 'N/A',
      'Payout Amount (INR)': `Rs. ${b.provider_service_details?.price || 0}`,
      'Payment Status': (b.payment_status || 'UNPAID').toUpperCase(),
      'Payment Method': (b.payment_method || 'CASH').toUpperCase(),
      'Job Status': (b.status || 'PENDING').toUpperCase(),
      'Location Address': (b.address || 'N/A').replace(/\n/g, ' ')
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
    a.download = `ServiceHub_Provider_Jobs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Jobs & Earnings log exported to CSV!');
  };

  const renderHistory = () => (
    <div className="space-y-stack_lg animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Job History & Earning Logs</h2>
          <p className="text-sm text-on-surface-variant mt-1">Complete record of your past completed and cancelled service jobs.</p>
        </div>
        {bookings.length > 0 && (
          <button
            onClick={handleExportJobsCSV}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Export CSV Log</span>
          </button>
        )}
      </div>

      {bookings.filter(b => ['completed', 'cancelled'].includes(b.status)).length === 0 ? (
        <div className="text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">history</span>
          </div>
          <h4 className="font-extrabold text-on-surface text-lg">No job history found</h4>
          <p className="text-xs text-on-surface-variant mt-1">Your completed and cancelled contracts will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.filter(b => ['completed', 'cancelled'].includes(b.status)).map(booking => (
            <div key={booking.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-outline-variant/10">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                    booking.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {booking.status}
                  </span>
                  <span className="text-xs text-slate-500 font-bold font-mono">#BK-{booking.id}</span>
                </div>
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-indigo-600">calendar_month</span>
                  {formatBookingDate(booking.booking_date)}
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="space-y-1.5">
                  <h3 className="font-title-md text-title-md text-on-surface font-extrabold tracking-tight">
                    {booking.provider_service_details.service_details.name}
                  </h3>
                  <p className="text-xs text-slate-600 font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">person</span>
                    Customer: {booking.customer_name}
                  </p>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">location_on</span>
                    {booking.address}
                  </p>
                </div>
                
                <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Payout</span>
                    <p className="text-xl font-extrabold text-indigo-600 mt-0.5">₹{booking.provider_service_details.price}</p>
                    <span className={`text-[11px] font-bold uppercase inline-block mt-1 px-2.5 py-0.5 rounded-full border ${
                      booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {booking.payment_status} {booking.payment_method && `(${booking.payment_method.toUpperCase()})`}
                    </span>
                  </div>
                  {booking.status === 'completed' && (
                    <button 
                      onClick={() => setSelectedInvoiceBooking(booking)}
                      className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs rounded-xl hover:bg-indigo-100 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      <span>Invoice</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReviews = () => (
    <div className="space-y-stack_lg animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Customer Reviews</h2>
          <p className="text-sm text-on-surface-variant mt-1">Feedback and ratings left by verified clients after job completion.</p>
        </div>
        {reviews.length > 0 && (
          <span className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 font-extrabold text-xs border border-amber-200 shadow-2xs flex items-center gap-1">
            ⭐ {(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)} / 5.0 Average
          </span>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">reviews</span>
          </div>
          <h4 className="font-extrabold text-on-surface text-lg">No reviews yet</h4>
          <p className="text-xs text-on-surface-variant mt-1">Complete work on active bookings to build trust and receive reviews from customers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reviews.map(review => (
            <div key={review.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1 text-amber-500 text-base font-bold">
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    <span className="text-xs text-slate-700 font-extrabold ml-1">{review.rating}.0</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{new Date(review.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                </div>
                <p className="text-xs text-slate-700 italic leading-relaxed bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  "{review.comment}"
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-900 flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
                    {review.customer_name[0].toUpperCase()}
                  </span>
                  {review.customer_name}
                </span>
                <span className="text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60 text-[11px]">{review.service_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMessages = () => {
    const getUniqueCustomerConversations = (bookingsList) => {
      const uniqueCustomers = {};
      const sortedBookings = [...bookingsList].sort((a, b) => b.id - a.id);
      
      for (const booking of sortedBookings) {
        if (booking.status === 'cancelled' || booking.status === 'completed') continue;
        
        const customerName = booking.customer_name;
        if (!uniqueCustomers[customerName]) {
          uniqueCustomers[customerName] = booking;
        }
      }
      return Object.values(uniqueCustomers);
    };

    const chatBookings = getUniqueCustomerConversations(bookings);
    
    return (
      <div className="flex h-[calc(100vh-10rem)] border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm">
        {/* Chat Sidebar */}
        <div className="w-[300px] border-r border-outline-variant/20 flex flex-col">
          <h2 className="p-5 font-title-md text-title-md font-bold text-on-background border-b border-outline-variant/20">
            Conversations
          </h2>
          {chatBookings.length === 0 ? (
            <p className="p-5 text-sm text-on-surface-variant font-medium">No active bookings to chat about.</p>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {chatBookings.map(b => (
                <div 
                  key={b.id} 
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-container-low/40 transition-colors ${activeChatBookingId === b.id ? 'bg-primary/5 border-l-4 border-primary font-bold' : ''}`}
                  onClick={() => setActiveChatBookingId(b.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {b.customer_name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm text-on-surface font-semibold truncate">
                      {b.customer_name}
                    </h4>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">
                      {b.provider_service_details.service_details.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col bg-surface-container-low/20">
          {!activeChatBookingId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">forum</span>
              <h3 className="font-bold text-on-surface">Select a conversation</h3>
              <p className="text-sm text-on-surface-variant max-w-sm">Choose a booking from the left to start messaging the customer.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              <div className="p-4 bg-surface border-b border-outline-variant/20 flex justify-between items-center shrink-0">
                <h3 className="font-title-md text-title-md font-bold text-on-surface">
                  Booking #BK-{activeChatBookingId}
                </h3>
                <button
                  onClick={() => handleClearConversation(activeChatBookingId)}
                  className="px-3.5 py-1.5 border border-error text-error text-xs font-bold rounded-lg hover:bg-error/5 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  Clear Chat
                </button>
              </div>
              
              <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-outline text-sm mt-12">Send a message to start the conversation!</p>
                ) : (() => {
                  const activeBooking = bookings.find(b => b.id === activeChatBookingId);
                  const customerName = activeBooking?.customer_name || '?';
                  const myFirstName = profile?.first_name || '?';
                  const myPic = profile?.profile_picture;

                  return chatMessages.map(msg => {
                    const isMe = msg.sender_is_provider;
                    return (
                      <div key={msg.id} className={`group flex items-end gap-1.5 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shadow-sm"
                          style={isMe ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)' } : { background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}
                        >
                          {isMe ? (
                            myPic
                              ? <img src={myPic} alt={myFirstName} className="w-full h-full object-cover" />
                              : myFirstName[0].toUpperCase()
                          ) : (
                            customerName[0].toUpperCase()
                          )}
                        </div>

                        {/* Bubble */}
                        <div className="flex flex-col max-w-[65%]">
                          {/* Name label */}
                          <span className={`text-[10px] font-bold mb-1 opacity-60 ${isMe ? 'text-right' : 'text-left'} text-on-surface`}>
                            {isMe ? 'You' : customerName}
                          </span>
                          <div className={`p-3.5 rounded-2xl shadow-sm ${
                            isMe
                              ? 'bg-primary text-on-primary rounded-tr-none'
                              : 'bg-surface-container-highest text-on-surface rounded-tl-none'
                          }`}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                            <span className={`text-[10px] mt-1.5 opacity-70 block ${isMe ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>

                        {/* Delete button — appears on hover, outside the bubble */}
                        {isMe && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 self-center w-7 h-7 flex items-center justify-center rounded-full hover:bg-error/10 text-outline hover:text-error cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
                <div ref={chatEndRef} />
              </div>

              <form className="p-4 bg-surface border-t border-outline-variant/20 flex gap-2 shrink-0" onSubmit={sendMessage}>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-outline-variant/60 p-3 text-sm focus:outline-none focus:border-primary bg-transparent"
                />
                <button type="submit" className="px-5 bg-primary hover:bg-surface-tint text-on-primary rounded-lg font-bold text-sm cursor-pointer shadow-sm">
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAvailability = () => (
    <div className="max-w-[720px] mx-auto space-y-stack_lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Weekly Availability</h2>
          <p className="text-sm text-on-surface-variant mt-1">Set the days and hours you're available for bookings. Customers will only see open time slots.</p>
        </div>
        <button
          onClick={saveAvailability}
          disabled={availabilitySaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl shadow-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">{availabilitySaving ? 'hourglass_top' : 'save'}</span>
          {availabilitySaving ? 'Saving…' : 'Save Schedule'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">info</span>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Toggle each day on to mark it as a working day. Set your start and end hours. Time slots are shown in 30-minute intervals to customers when they book.
        </p>
      </div>

      {/* Day Cards */}
      <div className="space-y-3">
        {DAY_LABELS.map((dayName, dayIndex) => {
          const slot = availabilitySlots.find(s => s.day_of_week === dayIndex);
          const isOn = slot?.is_available ?? false;
          const isWeekend = dayIndex >= 5;

          return (
            <div
              key={dayIndex}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isOn
                  ? 'bg-surface-container-lowest border-primary/30 shadow-sm'
                  : 'bg-surface-container-low/40 border-outline-variant/20 opacity-70'
              }`}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Day toggle */}
                <button
                  onClick={() => toggleDay(dayIndex)}
                  title={isOn ? 'Click to mark as unavailable' : 'Click to mark as available'}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                    isOn ? 'bg-primary' : 'bg-outline-variant/50'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>

                {/* Day label */}
                <div className="w-28 flex-shrink-0">
                  <span className={`font-semibold text-sm ${isOn ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {dayName}
                  </span>
                  {isWeekend && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">Weekend</span>
                  )}
                </div>

                {/* Time pickers — visible only when day is ON */}
                {isOn && slot ? (
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">From</span>
                      <input
                        type="time"
                        value={slot.start_time?.substring(0, 5) || '09:00'}
                        onChange={(e) => updateSlotTime(dayIndex, 'start_time', e.target.value)}
                        className="border border-outline-variant/60 rounded-lg px-3 py-1.5 text-sm bg-transparent focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">To</span>
                      <input
                        type="time"
                        value={slot.end_time?.substring(0, 5) || '17:00'}
                        onChange={(e) => updateSlotTime(dayIndex, 'end_time', e.target.value)}
                        className="border border-outline-variant/60 rounded-lg px-3 py-1.5 text-sm bg-transparent focus:outline-none focus:border-primary text-on-surface"
                      />
                    </div>
                    {/* Duration chip */}
                    {slot.start_time && slot.end_time && (() => {
                      const [sh, sm] = (slot.start_time).split(':').map(Number);
                      const [eh, em] = (slot.end_time).split(':').map(Number);
                      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
                      if (diffMins > 0) {
                        const h = Math.floor(diffMins / 60);
                        const m = diffMins % 60;
                        return (
                          <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">
                            {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''} · {Math.floor(diffMins / 30)} slots
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-on-surface-variant italic">
                    {isOn ? 'No slot configured' : 'Not available'}
                  </span>
                )}

                {/* Status badge */}
                <span className={`ml-auto flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  isOn ? 'bg-emerald-500/10 text-emerald-600' : 'bg-outline-variant/20 text-on-surface-variant'
                }`}>
                  {isOn ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {availabilitySlots.filter(s => s.is_available).length > 0 && (
        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <h4 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Active Schedule Summary
          </h4>
          <div className="flex flex-wrap gap-2">
            {availabilitySlots.filter(s => s.is_available).map(s => (
              <span key={s.day_of_week} className="text-xs bg-emerald-500/10 text-emerald-700 font-semibold px-3 py-1 rounded-full">
                {DAY_LABELS[s.day_of_week]} {s.start_time?.substring(0,5)}–{s.end_time?.substring(0,5)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className="max-w-[800px] mx-auto space-y-stack_lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Your Notifications</h2>
          <p className="text-sm text-on-surface-variant mt-1">Stay updated with service progress and messages.</p>
        </div>
        <div className="flex gap-2">
          {appNotifications.filter(n => !n.is_read).length > 0 && (
            <button 
              onClick={() => appNotifications.filter(n => !n.is_read).forEach(n => markNotificationRead(n.id))}
              className="px-4 py-2 border border-outline-variant rounded-full font-label-sm text-xs text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Mark all read
            </button>
          )}
          {appNotifications.length > 0 && (
            <button 
              onClick={clearAllNotifications}
              className="px-4 py-2 border border-error text-error rounded-full font-label-sm text-xs hover:bg-error/5 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      
      {appNotifications.length === 0 ? (
        <div className="text-center p-12 bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">notifications_off</span>
          <h3 className="font-bold text-on-surface">All caught up!</h3>
          <p className="text-sm text-on-surface-variant">You have no notifications at the moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appNotifications.map(n => (
            <div 
              key={n.id} 
              className={`p-5 rounded-xl border flex gap-4 hover:shadow-sm transition-all cursor-pointer ${
                n.is_read ? 'bg-surface-container-lowest border-outline-variant/30' : 'bg-primary/5 border-primary/20'
              }`}
              onClick={() => !n.is_read && markNotificationRead(n.id)}
            >
              <div className="w-10 h-10 rounded-full bg-primary-fixed-dim/20 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">info</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-on-surface truncate">{n.title}</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed mt-1">{n.message}</p>
                <span className="text-xs text-outline inline-block mt-3">{formatBookingDate(n.created_at)}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                className="text-outline hover:text-error cursor-pointer font-bold text-xl self-start"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => {
    const statusData = analyticsData?.status_counts ? [
      { name: 'Completed', value: analyticsData.status_counts.completed, color: '#10b981' },
      { name: 'Pending', value: analyticsData.status_counts.pending, color: '#f59e0b' },
      { name: 'Accepted', value: analyticsData.status_counts.accepted, color: '#6366f1' },
      { name: 'Cancelled', value: analyticsData.status_counts.cancelled, color: '#ef4444' },
    ].filter(item => item.value > 0) : [];

    const monthlyData = analyticsData?.monthly_earnings || [];
    const categoryData = analyticsData?.category_earnings || [];
    const totalCatRevenue = categoryData.reduce((acc, c) => acc + c.amount, 0) || 1;

    return (
      <div className="space-y-stack_lg animate-[fadeIn_0.3s_ease-out]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Business Analytics & Metrics</h2>
            <p className="text-sm text-on-surface-variant mt-1">Real-time performance overview, revenue trends, and booking completion rates.</p>
          </div>
          <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-200 shadow-2xs flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-indigo-600">monitoring</span>
            Live Performance Metrics
          </span>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Total Revenue</span>
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-lg">payments</span>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-on-surface tracking-tight">₹{(analyticsData?.total_earnings || 0).toFixed(0)}</div>
            <span className="text-xs text-indigo-600 font-bold mt-1 inline-block">Gross earnings from jobs</span>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Completion Rate</span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-lg">task_alt</span>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">{analyticsData?.completion_rate || 0}%</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(analyticsData?.completion_rate || 0, 100)}%` }} />
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Avg. Job Value</span>
              <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-lg">receipt_long</span>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-on-surface tracking-tight">₹{(analyticsData?.avg_booking_value || 0).toFixed(0)}</div>
            <span className="text-xs text-violet-600 font-bold mt-1 inline-block">Average per booking</span>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">Customer Rating</span>
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-lg">star</span>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-on-surface tracking-tight flex items-baseline gap-1">
              {analyticsData?.avg_rating || '—'}
              <span className="text-sm font-bold text-amber-500">★</span>
            </div>
            <span className="text-xs text-amber-600 font-bold mt-1 inline-block">{analyticsData?.total_reviews || 0} reviews</span>
          </div>
        </div>

        {/* ── Visual Charts Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue Area Chart */}
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-on-surface text-base">Monthly Revenue Trend</h3>
                <p className="text-xs text-on-surface-variant font-medium">Earnings breakdown by month</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                ₹ Revenue
              </span>
            </div>
            <div className="h-[280px] w-full">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="providerColorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      formatter={(val) => [`₹${val}`, 'Revenue']}
                      contentStyle={{ borderRadius: '16px', background: '#0f172a', color: '#fff', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#providerColorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">show_chart</span>
                  <p className="text-xs font-semibold">No revenue trend data available yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Job Status Distribution Donut Chart */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-on-surface text-base">Booking Status</h3>
                <p className="text-xs text-on-surface-variant font-medium">Job distribution breakdown</p>
              </div>
            </div>

            <div className="h-[220px] w-full relative flex items-center justify-center">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} jobs`, name]}
                      contentStyle={{ borderRadius: '12px', background: '#0f172a', color: '#fff', border: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-1 text-slate-300">pie_chart</span>
                  <p className="text-xs font-semibold">No booking status metrics.</p>
                </div>
              )}
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              {[
                { label: 'Completed', count: analyticsData?.status_counts?.completed || 0, color: 'bg-emerald-500' },
                { label: 'Pending', count: analyticsData?.status_counts?.pending || 0, color: 'bg-amber-500' },
                { label: 'Accepted', count: analyticsData?.status_counts?.accepted || 0, color: 'bg-indigo-500' },
                { label: 'Cancelled', count: analyticsData?.status_counts?.cancelled || 0, color: 'bg-red-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50">
                  <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="font-extrabold text-slate-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Performance Breakdown */}
        {categoryData.length > 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-md space-y-4">
            <h3 className="font-bold text-on-surface text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">category</span>
              Revenue Breakdown by Category
            </h3>
            <div className="space-y-3">
              {categoryData.map(cat => {
                const pct = Math.round((cat.amount / totalCatRevenue) * 100);
                return (
                  <div key={cat.category} className="space-y-1.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        {cat.category}
                      </span>
                      <span className="text-indigo-700">₹{cat.amount.toFixed(0)} ({cat.count} jobs · {pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProfile = () => (
    <div className="max-w-[800px] mx-auto space-y-stack_lg animate-[fadeIn_0.3s_ease-out]">
      <div className="border-b border-outline-variant/20 pb-4">
        <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Edit Professional Profile</h2>
        <p className="text-sm text-on-surface-variant mt-1">Manage details presented to potential clients on the marketplace.</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-md space-y-6">
        <form onSubmit={handleProfileUpdate} className="space-y-6">
          
          {/* Profile Picture Section */}
          <div className="flex flex-col sm:flex-row gap-5 items-center pb-5 border-b border-slate-100">
            {profilePictureFile ? (
              <img src={URL.createObjectURL(profilePictureFile)} alt="Preview" className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-md" />
            ) : profile.profile_picture ? (
              <img src={profile.profile_picture} alt="Profile" className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 shadow-md" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                {profile.first_name ? profile.first_name[0].toUpperCase() : 'P'}
              </div>
            )}
            <div className="flex-1 flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Update profile photo</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setProfilePictureFile(e.target.files[0])}
                className="text-xs border border-slate-300 rounded-2xl p-2.5 bg-white text-slate-900 cursor-pointer w-full shadow-2xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Years of Experience</label>
              <input
                type="number"
                min="0"
                value={profile.experience_years || 0}
                onChange={(e) => setProfile({...profile, experience_years: e.target.value})}
                className="rounded-2xl border border-slate-300 p-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Skills (Comma Separated)</label>
              <input
                type="text"
                placeholder="e.g. Plumbing, Pipe Fitting, Repair"
                value={profile.skills || ''}
                onChange={(e) => setProfile({...profile, skills: e.target.value})}
                className="rounded-2xl border border-slate-300 p-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                value={profile.phone_number || ''}
                onChange={(e) => setProfile({...profile, phone_number: e.target.value})}
                className="rounded-2xl border border-slate-300 p-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">City</label>
              <select
                value={profile.city || ''}
                onChange={(e) => setProfile({...profile, city: e.target.value})}
                className="rounded-2xl border border-slate-300 p-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs font-bold"
              >
                <option value="">-- Select City --</option>
                {INDIAN_CITIES.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Professional Bio</label>
            <textarea
              rows="3"
              placeholder="Tell customers about your expertise and quality of work..."
              value={profile.bio || ''}
              onChange={(e) => setProfile({...profile, bio: e.target.value})}
              className="rounded-2xl border border-slate-300 p-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-2xs font-medium"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-md hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            Save Profile Changes
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-background flex font-body-base">
      {notification.show && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg z-[9999] text-white font-bold animate-[slideIn_0.3s_ease-out] ${
          notification.type === 'error' ? 'bg-error' : 'bg-emerald-600'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-[260px] flex flex-col z-30"
        style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        
        {/* Brand */}
        <div className="px-6 pt-7 pb-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4648d4, #7c7dff)' }}>
              <span className="material-symbols-outlined text-white text-[18px]">home_repair_service</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">ServiceHub</span>
          </div>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-10">Partner Panel</span>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10 mb-3" />

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {[
            { tab: 'Dashboard', icon: 'dashboard', label: 'Dashboard', onClick: () => setActiveTab('Dashboard') },
            { tab: 'Analytics', icon: 'analytics', label: 'Analytics', onClick: () => setActiveTab('Analytics') },
            { tab: 'Services', icon: 'handyman', label: 'My Services', onClick: () => setActiveTab('Services') },
            { tab: 'Portfolio', icon: 'collections', label: 'Portfolio', onClick: () => setActiveTab('Portfolio') },
            { tab: 'History', icon: 'history', label: 'Job History', onClick: () => setActiveTab('History') },
            { tab: 'Reviews', icon: 'reviews', label: 'Reviews', onClick: () => setActiveTab('Reviews') },
            { tab: 'Availability', icon: 'calendar_month', label: 'Availability', onClick: () => setActiveTab('Availability') },
            { tab: 'Messages', icon: 'chat_bubble', label: 'Messages', onClick: () => setActiveTab('Messages') },
            { tab: 'Notifications', icon: 'notifications', label: 'Alerts',
              badge: appNotifications.filter(n => !n.is_read).length,
              onClick: () => setActiveTab('Notifications') },
            { tab: 'Profile', icon: 'manage_accounts', label: 'Profile', onClick: () => setActiveTab('Profile') },
          ].map(({ tab, icon, label, onClick, badge }) => (
            <button key={tab} onClick={onClick}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group relative ${
                activeTab === tab
                  ? 'text-white shadow-lg'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              style={activeTab === tab ? { background: 'linear-gradient(135deg, rgba(70,72,212,0.8), rgba(124,125,255,0.5))' } : {}}
            >
              {activeTab === tab && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white" />}
              <span className={`material-symbols-outlined text-[20px] transition-all ${
                activeTab === tab ? 'text-white' : 'text-white/40 group-hover:text-white/70'
              }`}>{icon}</span>
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User card at bottom */}
        <div className="mx-3 mb-4 mt-3">
          <div className="rounded-xl p-3 flex items-center gap-3 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white/20 overflow-hidden"
              style={profile.profile_picture ? {} : { background: 'linear-gradient(135deg, #4648d4, #7c7dff)', color: 'white' }}>
              {profile.profile_picture
                ? <img src={profile.profile_picture} alt="" className="w-full h-full object-cover" />
                : (profile.first_name ? profile.first_name[0].toUpperCase() : 'P')
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-semibold truncate">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-[11px] text-white/40">Professional</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 hover:bg-red-500/20"
            style={{ color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)' }}
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[260px] min-h-screen flex flex-col">
        {/* Top App Bar */}
        <header className="sticky top-0 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 flex justify-between items-center h-16 w-full px-gutter z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium">Provider Portal</span>
              <span className="font-bold text-on-surface text-sm">{profile.first_name || 'Professional'} &mdash; {activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('Notifications')}
              className="relative p-2.5 rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[22px]">notifications</span>
              {appNotifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-surface" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('Profile')}
              className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center font-bold text-sm cursor-pointer ring-2 ring-primary/20 hover:ring-primary/60 transition-all"
              style={profile.profile_picture ? {} : { background: 'linear-gradient(135deg, #4648d4, #7c7dff)', color: 'white' }}
            >
              {profile.profile_picture
                ? <img src={profile.profile_picture} alt="" className="w-full h-full object-cover" />
                : (profile.first_name ? profile.first_name[0].toUpperCase() : 'P')
              }
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-gutter max-w-container_max w-full mx-auto flex-1 pb-16">
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Analytics' && renderAnalytics()}
          {activeTab === 'Services' && renderServices()}
          {activeTab === 'Portfolio' && renderPortfolio()}
          {activeTab === 'History' && renderHistory()}
          {activeTab === 'Reviews' && renderReviews()}
          {activeTab === 'Availability' && renderAvailability()}
          {activeTab === 'Messages' && renderMessages()}
          {activeTab === 'Notifications' && renderNotifications()}
          {activeTab === 'Profile' && renderProfile()}
        </div>
      </main>
      {/* Clear Chat Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm border border-outline-variant/20 shadow-xl overflow-hidden animate-[scaleUp_0.2s_ease-out] p-6 space-y-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-bold text-on-surface">Delete Conversation?</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Are you sure you want to delete the entire conversation? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowClearConfirmModal(false);
                  confirmClearConversation(activeChatBookingId);
                }}
                className="px-4 py-2 bg-error text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Booking Confirmation Modal */}
      {declineBookingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm border border-outline-variant/20 shadow-xl overflow-hidden animate-[scaleUp_0.2s_ease-out] p-6 space-y-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-bold text-on-surface">Decline Booking Request?</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Are you sure you want to decline and cancel this booking request? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setDeclineBookingId(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                No, Keep
              </button>
              <button 
                onClick={() => confirmDeclineBooking(declineBookingId)}
                className="px-4 py-2 bg-error text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
              >
                Yes, Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Lightbox Modal ── */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActivePhotoModal(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-surface rounded-2xl overflow-hidden p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 hover:bg-black transition-colors z-10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <img src={activePhotoModal} alt="Problem Area" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
          </div>
        </div>
      )}

      {/* ── Invoice Modal ── */}
      {selectedInvoiceBooking && (
        <InvoiceModal
          booking={selectedInvoiceBooking}
          onClose={() => setSelectedInvoiceBooking(null)}
        />
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

export default ProviderDashboard;
