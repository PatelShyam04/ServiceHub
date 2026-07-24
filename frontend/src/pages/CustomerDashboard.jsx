import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import InvoiceModal from '../components/InvoiceModal';
import PageTransition from '../components/PageTransition';
import MapView from '../components/MapView';
import LocationPickerMap from '../components/LocationPickerMap';
import { Modal } from '../components/Modal';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Wrench, Calendar, MessageSquare, History, User, LogOut, Star, Search, Filter, Clock, MapPin, CheckCircle, AlertCircle, Map as MapIcon, Grid, Navigation } from 'lucide-react';

const INDIAN_CITIES = [
  "Ahmedabad", "Bangalore", "Bhopal", "Chennai", "Coimbatore", "Delhi",
  "Ghaziabad", "Hyderabad", "Indore", "Jaipur", "Kanpur", "Kochi",
  "Kolkata", "Lucknow", "Ludhiana", "Madurai", "Mumbai", "Nagpur",
  "Nashik", "Noida", "Patna", "Pune", "Rajkot", "Surat", "Thane",
  "Vadodara", "Varanasi", "Visakhapatnam"
].sort();

const CustomerDashboard = () => {
  const [customerProfile, setCustomerProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState(null);
  const [providers, setProviders] = useState([]);
  const [providerViewMode, setProviderViewMode] = useState('grid'); // 'grid' or 'map'
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Dashboard');

  const [bookingProvider, setBookingProvider] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [address, setAddress] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [problemPhoto, setProblemPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showCustomerMapModal, setShowCustomerMapModal] = useState(false);
  const [isDetectingCustomerGps, setIsDetectingCustomerGps] = useState(false);

  const handleCustomerGPSDetect = () => {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setIsDetectingCustomerGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              const nameParts = data.display_name.split(',');
              const cleanAddress = nameParts.length > 0 ? nameParts.slice(0, 4).join(',').trim() : data.display_name;
              setAddress(cleanAddress);
              showNotification('GPS location detected and applied to address!');
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsDetectingCustomerGps(false);
        }
      },
      (err) => {
        setIsDetectingCustomerGps(false);
        showNotification('Unable to fetch GPS position. Please check permissions.', 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProblemPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setProblemPhoto(null);
    setPhotoPreview(null);
  };

  // Calendar / availability state
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-indexed
  const [availableSlots, setAvailableSlots] = useState(null); // null = not fetched yet
  const [slotsLoading, setSlotsLoading] = useState(false);

  const fetchAvailableSlots = async (providerId, dateStr) => {
    setSlotsLoading(true);
    setAvailableSlots(null);
    try {
      const res = await api.get(`services/available-slots/?provider_id=${providerId}&date=${dateStr}`);
      setAvailableSlots(res.data);
    } catch (err) {
      console.error('Failed to fetch slots', err);
      setAvailableSlots({ available_slots: [], reason: 'Could not load slots.' });
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleCalendarDateSelect = (providerId, dateStr) => {
    setBookingDate(dateStr);
    setBookingTime('');
    fetchAvailableSlots(providerId, dateStr);
  };

  const [publicProfileData, setPublicProfileData] = useState(null);

  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Payment states
  const [payBooking, setPayBooking] = useState(null);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [upiId, setUpiId] = useState('');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [activePhotoModal, setActivePhotoModal] = useState(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });

  // Chat states
  const [activeChatBookingId, setActiveChatBookingId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = React.useRef(null);

  // Notification tab state
  const [notifications, setNotifications] = useState([]);

  // Filters
  const [sortBy, setSortBy] = useState('');
  const [minRating, setMinRating] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [location, setLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Just for visual hero search

  // Notification toast state
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [galleryLightboxImage, setGalleryLightboxImage] = useState(null);

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
      const [catsRes, bookingsRes, profileRes] = await Promise.all([
        api.get('services/categories/'),
        api.get('services/bookings/'),
        api.get('accounts/customer-profile/')
      ]);
      setCategories(catsRes.data);
      setMyBookings(bookingsRes.data);
      setCustomerProfile(profileRes.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('services/notifications/');
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    let interval;
    if (activeTab === 'Notifications') {
      fetchNotifications();
      interval = setInterval(fetchNotifications, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  const markNotificationRead = async (id) => {
    try {
      await api.patch(`services/notifications/${id}/read/`);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`services/notifications/${id}/delete/`);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('services/notifications/clear/');
      fetchNotifications();
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  useEffect(() => {
    if (selectedService) {
      fetchProviders();
    }
  }, [selectedService, sortBy, minRating, maxPrice, location]);

  const fetchProviders = async () => {
    setSearching(true);
    setProviders([]);
    try {
      let url = `services/search/?service_id=${selectedService.id}`;
      if (sortBy) url += `&sort_by=${sortBy}`;
      if (minRating) url += `&min_rating=${minRating}`;
      if (maxPrice) url += `&max_price=${maxPrice}`;
      if (location) url += `&location=${location}`;
      
      const res = await api.get(url);
      setProviders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleServiceClick = (service) => {
    setSelectedService(service);
    setActiveTab('Dashboard');
    setSortBy('');
    setMinRating('');
    setMaxPrice('');
    setLocation('');
  };

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  const fetchPublicProfile = async (providerUserId) => {
    try {
      const res = await api.get(`accounts/providers/${providerUserId}/public/`);
      setPublicProfileData(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Failed to load profile details.', 'error');
    }
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (isSubmittingBooking) return;

    if (!bookingDate || !bookingTime) {
      showNotification('Please select a date and time slot.', 'error');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const localDateTime = new Date(`${bookingDate}T${bookingTime}`);
      const combinedDateTime = localDateTime.toISOString();

      const formData = new FormData();
      formData.append('provider_service_id', bookingProvider.id);
      formData.append('booking_date', combinedDateTime);
      formData.append('address', address);
      if (problemDescription) {
        formData.append('problem_description', problemDescription);
      }
      if (problemPhoto) {
        formData.append('problem_photo', problemPhoto);
      }

      await api.post('services/bookings/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showNotification('Booking successful!');
      setBookingProvider(null);
      setBookingDate('');
      setBookingTime('');
      setAddress('');
      setProblemDescription('');
      setProblemPhoto(null);
      setPhotoPreview(null);
      setAvailableSlots(null);
      fetchData();
      setActiveTab('Bookings');
    } catch (err) {
      console.error(err);
      const errDetail = err.response?.data?.non_field_errors?.[0] || err.response?.data?.booking_date?.[0] || 'Failed to book. Please try again.';
      showNotification(errDetail, 'error');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelBooking = (id) => {
    setCancelBookingId(id);
  };

  const confirmCancelBooking = async (id) => {
    try {
      await api.patch(`services/bookings/${id}/status/`, { status: 'cancelled' });
      showNotification('Booking cancelled successfully.');
      fetchData(); // Refresh bookings
      setCancelBookingId(null);
    } catch (err) {
      console.error(err);
      showNotification('Failed to cancel booking.', 'error');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put('accounts/customer-profile/', {
        first_name: customerProfile.first_name,
        last_name: customerProfile.last_name,
        phone_number: customerProfile.phone_number
      });
      setCustomerProfile(response.data);
      showNotification('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update profile.', 'error');
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.post('services/reviews/', {
        booking: reviewBooking.id,
        rating: reviewRating,
        comment: reviewComment
      });
      showNotification('Review submitted successfully!');
      setReviewBooking(null);
      setReviewRating(5);
      setReviewComment('');
      fetchData(); // Refresh my bookings
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.non_field_errors?.[0] || 'Failed to submit review.', 'error');
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const payload = { payment_method: selectedPaymentMethod };

    if (selectedPaymentMethod === 'card') {
      const cleanNumber = cardForm.number.replace(/\s+/g, '');
      if (cleanNumber.length !== 16 || isNaN(cleanNumber)) {
        showNotification('Please enter a valid 16-digit card number.', 'error');
        return;
      }
      const expiryPattern = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
      if (!expiryPattern.test(cardForm.expiry)) {
        showNotification('Please enter expiry date in MM/YY format.', 'error');
        return;
      }
      if (cardForm.cvv.length !== 3 || isNaN(cardForm.cvv)) {
        showNotification('Please enter a valid 3-digit CVV.', 'error');
        return;
      }
      if (!cardForm.name.trim()) {
        showNotification('Please enter cardholder name.', 'error');
        return;
      }
    } else if (selectedPaymentMethod === 'upi') {
      if (!upiId.trim() || !upiId.includes('@')) {
        showNotification('Please enter a valid UPI ID (e.g. username@bank).', 'error');
        return;
      }
    }

    try {
      await api.post(`services/bookings/${payBooking.id}/pay/`, payload);
      if (selectedPaymentMethod === 'cash') {
        showNotification('Cash on Service selected. Please pay cash directly to the professional upon completion!');
      } else {
        showNotification('Payment successful! Your booking is paid.');
      }
      setPayBooking(null);
      setCardForm({ number: '', expiry: '', cvv: '', name: '' });
      setUpiId('');
      fetchData(); // Refresh bookings
    } catch (err) {
      console.error(err);
      showNotification('Payment confirmation failed. Please try again.', 'error');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showNotification('New passwords do not match!', 'error');
      return;
    }
    try {
      await api.put('accounts/change-password/', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      });
      showNotification('Password updated successfully!');
      setShowPasswordModal(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.old_password) {
        showNotification(err.response.data.old_password[0], 'error');
      } else {
        showNotification('Failed to change password.', 'error');
      }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Skeleton Sidebar */}
        <div className="w-[260px] h-screen fixed left-0 top-0 bg-surface border-r border-outline-variant/30 p-6 flex flex-col gap-4">
          <div className="skeleton h-8 w-36 mb-2" />
          <div className="skeleton h-4 w-24 mb-6" />
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full rounded-lg" />)}
        </div>
        {/* Skeleton Content */}
        <div className="ml-[260px] flex-1 p-8 space-y-6">
          <div className="skeleton h-48 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // Sub-renders
  const renderDashboardHome = () => (
    <div className="space-y-stack_lg" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      {/* Hero Header */}
      <section className="rounded-2xl p-8 md:p-12 text-on-primary flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #4648d4 100%)' }}>
        {/* Floating orbs */}
        <div className="absolute top-[-20%] left-[-5%] w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7c7dff, transparent)', animation: 'pulse-glow 4s ease-in-out infinite' }} />
        <div className="absolute bottom-[-15%] right-[-5%] w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #a7a5ff, transparent)' }} />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.15)' }} />
        <div className="relative z-10 w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Trusted by thousands across India
          </div>
          <h2 className="text-[36px] font-bold leading-tight text-white mb-4">
            Find Professional Services<br/>Near You
          </h2>
          <p className="text-[16px] font-medium mb-8" style={{ color: 'rgba(192,193,255,0.85)' }}>
            Verified experts for every home need — book instantly, pay securely.
          </p>
          <div className="flex w-full max-w-xl mx-auto rounded-2xl p-1.5 gap-2"
            style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center px-3 text-white/60">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input 
              type="text" 
              placeholder="What do you need help with?" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-white placeholder-white/40 focus:ring-0 focus:outline-none text-[15px]"
            />
            <button className="px-6 py-2 rounded-xl font-semibold text-[14px] cursor-pointer transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #4648d4, #7c7dff)', color: 'white' }}>
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[20px] font-bold text-on-background tracking-tight">Popular Categories</h3>
            <p className="text-[13px] text-on-surface-variant font-medium mt-0.5">Explore certified service categories and book top experts</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-200/60 shadow-2xs">
            {categories.length} Categories
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((category, idx) => {
            const iconName = 
              category.name.includes('Home') ? 'home_repair_service' :
              category.name.includes('Beauty') || category.name.includes('Personal') ? 'spa' :
              category.name.includes('Educat') || category.name.includes('Learn') ? 'school' :
              category.name.includes('Digital') || category.name.includes('IT') ? 'devices' :
              category.name.includes('Vehicle') || category.name.includes('Auto') ? 'directions_car' :
              category.name.includes('Clean') ? 'cleaning_services' : 'handyman';

            return (
              <div key={category.id}
                className="group bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 flex flex-col gap-4 shadow-2xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-300/80 cursor-default relative overflow-hidden"
                style={{ animation: `fadeInUp ${0.1 + idx * 0.05}s ease-out` }}>
                
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shrink-0">
                    <span className="material-symbols-outlined text-2xl">{iconName}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[16px] font-semibold text-on-surface truncate">{category.name}</h4>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant text-[11px] font-bold mt-0.5 border border-outline-variant/20">
                      {category.services.length} services available
                    </span>
                  </div>
                </div>

                {category.description && (
                  <p className="text-[13px] text-on-surface-variant/90 leading-relaxed font-medium line-clamp-2">
                    {category.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/15 mt-auto">
                  {category.services
                    .filter(s => searchQuery ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                    .map(service => (
                      <button 
                        key={service.id} 
                        onClick={() => handleServiceClick(service)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50/80 text-indigo-900 border border-indigo-200/60 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:scale-105 hover:shadow-md transition-all duration-200 cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        <span>{service.name}</span>
                        <span className="material-symbols-outlined text-[13px] opacity-75">chevron_right</span>
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderProvidersList = () => (
    <div className="space-y-stack_lg">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button 
          onClick={() => setSelectedService(null)}
          className="flex items-center gap-1 text-primary hover:underline font-bold text-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Categories
        </button>
        
        <div className="flex items-center gap-4">
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">
            {selectedService.name} Experts
          </h2>

          {/* Grid vs Map View Mode Switcher */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl border border-slate-300/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setProviderViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                providerViewMode === 'grid'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Grid View</span>
            </button>
            <button
              type="button"
              onClick={() => setProviderViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                providerViewMode === 'map'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-on-surface-variant uppercase">📍 City</label>
          <select 
            value={location} 
            onChange={(e) => setLocation(e.target.value)} 
            className="w-full rounded-lg border border-outline-variant/60 p-2 text-sm bg-transparent"
          >
            <option value="">Any City</option>
            {INDIAN_CITIES.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-on-surface-variant uppercase">⭐ Minimum Rating</label>
          <select 
            value={minRating} 
            onChange={(e) => setMinRating(e.target.value)} 
            className="w-full rounded-lg border border-outline-variant/60 p-2 text-sm bg-transparent"
          >
            <option value="">Any Rating</option>
            <option value="4.5">4.5 & up</option>
            <option value="4.0">4.0 & up</option>
            <option value="3.0">3.0 & up</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-on-surface-variant uppercase">💰 Max Price (₹)</label>
          <input 
            type="number" 
            placeholder="e.g. 1000" 
            value={maxPrice} 
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-lg border border-outline-variant/60 p-2 text-sm bg-transparent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-on-surface-variant uppercase">Sort By</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)} 
            className="w-full rounded-lg border border-outline-variant/60 p-2 text-sm bg-transparent"
          >
            <option value="">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Providers Render (Grid or Map View) */}
      <div>
        {searching ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center p-12 bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">person_search</span>
            <h3 className="font-bold text-on-surface">No experts found</h3>
            <p className="text-sm text-on-surface-variant">Try modifying your filter settings or location.</p>
          </div>
        ) : providerViewMode === 'map' ? (
          <MapView 
            providers={providers} 
            onSelectProvider={(ps) => setBookingProvider(ps)} 
            selectedCity={location} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack_md">
            {providers.map(ps => (
              <div key={ps.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col justify-between hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 group">
                <div>
                  <div className="flex gap-4 items-start">
                    <div className="relative shrink-0">
                      {ps.provider_profile_picture ? (
                        <img src={ps.provider_profile_picture} alt={ps.provider_first_name} className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-primary flex items-center justify-center font-bold text-2xl border border-indigo-200/50">
                          {ps.provider_first_name[0].toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Active & Available" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-title-md text-title-md text-on-surface font-bold flex items-center gap-1.5 truncate">
                          {ps.provider_first_name} {ps.provider_last_name}
                          {ps.provider_verified && (
                            <span className="material-symbols-outlined text-indigo-600 text-base font-bold shrink-0" style={{fontVariationSettings: "'FILL' 1"}} title="Verified Provider">verified</span>
                          )}
                        </h4>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-full border border-indigo-200/60 shrink-0 shadow-2xs">
                          ₹{ps.price}/hr
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">location_on</span>
                        {ps.provider_city || 'Location not specified'}
                      </p>
                      <div className="flex items-center gap-1 text-amber-500 mt-1.5">
                        <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                        <span className="text-xs font-extrabold text-on-surface">{ps.average_rating > 0 ? ps.average_rating.toFixed(1) : '5.0'}</span>
                        <span className="text-xs text-on-surface-variant font-medium">({ps.review_count || 1} reviews)</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant font-body-base line-clamp-2 mt-3.5 pt-2 border-t border-outline-variant/10 leading-relaxed">
                    {ps.provider_bio || 'Professional ready to deliver top-tier service.'}
                  </p>
                </div>
                <div className="flex justify-end gap-2.5 mt-4 pt-3 border-t border-outline-variant/20">
                  <button 
                    onClick={() => fetchPublicProfile(ps.provider_id)}
                    className="px-4 py-2 rounded-xl border border-primary/30 text-primary font-bold text-xs hover:bg-primary/5 hover:border-primary transition-all cursor-pointer"
                  >
                    Profile
                  </button>
                  <button 
                    onClick={() => setBookingProvider(ps)}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-surface-tint transition-all cursor-pointer shadow-xs hover:shadow-md flex items-center gap-1"
                  >
                    <span>Book Now</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderMyBookings = () => (
    <div className="space-y-stack_lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">My Bookings</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Manage and track your active and past service appointments.</p>
        </div>
        {myBookings.length > 0 && (
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/30 text-xs font-bold text-on-surface-variant shrink-0">
            <span className="material-symbols-outlined text-[16px] text-primary">calendar_today</span>
            <span>{myBookings.length} Total Bookings</span>
          </div>
        )}
      </div>

      {myBookings.length === 0 ? (
        <div className="text-center p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl">calendar_today</span>
          </div>
          <h3 className="font-bold text-on-surface text-lg">No bookings yet</h3>
          <p className="text-sm text-on-surface-variant mb-5 max-w-sm mx-auto">Find a verified professional and book your first service in seconds!</p>
          <button 
            onClick={() => setActiveTab('Dashboard')}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-surface-tint transition-all cursor-pointer shadow-md"
          >
            Find Services
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {myBookings.map(booking => (
            <div key={booking.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 hover:border-primary/40 transition-all duration-200 shadow-2xs hover:shadow-md group">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3.5 border-b border-outline-variant/15">
                <div className="flex items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                    booking.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    booking.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    <span className="material-symbols-outlined text-[14px]">
                      {booking.status === 'completed' ? 'check_circle' : booking.status === 'cancelled' ? 'cancel' : 'hourglass_empty'}
                    </span>
                    {booking.status}
                  </span>
                  <span className="text-xs font-mono text-on-surface-variant font-bold">#BK-{booking.id}</span>
                </div>
                <span className="text-xs text-on-surface-variant font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">event</span>
                  {formatBookingDate(booking.booking_date)}
                </span>
              </div>
              
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1.5">
                  <h3 className="font-title-md text-title-md text-on-surface font-extrabold flex items-center gap-2">
                    {booking.provider_service_details.service_details.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">person</span>
                    Provider: <span className="font-bold text-on-surface">{booking.provider_service_details.provider_first_name} {booking.provider_service_details.provider_last_name}</span>
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium pt-0.5">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">location_on</span>
                    {booking.address}
                  </p>
                  {booking.problem_description && (
                    <div className="p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/15 text-xs text-on-surface-variant italic font-medium mt-2">
                      "{booking.problem_description}"
                    </div>
                  )}
                  {booking.problem_photo && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Problem Photo:</span>
                      <button
                        type="button"
                        onClick={() => setGalleryLightboxImage(booking.problem_photo)}
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
                
                <div className="flex flex-col sm:items-end justify-between gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-outline-variant/15">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider block">Total Amount</span>
                    <p className="font-title-md text-title-md font-extrabold text-on-surface mt-0.5">
                      ₹{booking.provider_service_details.price}
                    </p>
                    <span className={`text-xs font-bold uppercase inline-block mt-1 px-2.5 py-0.5 rounded-full border ${
                      booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                    }`}>
                      {booking.payment_status} {booking.payment_method && `(${booking.payment_method})`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {booking.payment_status === 'unpaid' && booking.status !== 'cancelled' && (
                      <button 
                        onClick={() => setPayBooking(booking)}
                        className="px-4 py-2 bg-emerald-600 text-on-primary font-bold text-xs rounded-xl hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
                      >
                        💳 Pay Now
                      </button>
                    )}
                    {['pending', 'accepted'].includes(booking.status) && (
                      <button 
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-4 py-2 border border-red-200 text-red-600 font-bold text-xs rounded-xl hover:bg-red-50 transition-all cursor-pointer"
                      >
                        ✕ Cancel Booking
                      </button>
                    )}
                    {booking.status === 'completed' && (
                      <>
                        <button 
                          onClick={() => setSelectedInvoiceBooking(booking)}
                          className="px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                          <span>Invoice</span>
                        </button>
                        {!booking.has_review && (
                          <button 
                            onClick={() => setReviewBooking(booking)}
                            className="px-4 py-2 border border-primary text-primary font-bold text-xs rounded-xl hover:bg-primary/5 transition-all cursor-pointer"
                          >
                            ⭐ Leave Review
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMessages = () => {
    const getUniqueProviderConversations = (bookingsList) => {
      const uniqueProviders = {};
      const sortedBookings = [...bookingsList].sort((a, b) => b.id - a.id);
      
      for (const booking of sortedBookings) {
        if (booking.status === 'cancelled' || booking.status === 'completed') continue;
        
        const providerId = booking.provider_service_details.provider_id;
        if (!uniqueProviders[providerId]) {
          uniqueProviders[providerId] = booking;
        }
      }
      return Object.values(uniqueProviders);
    };

    const chatBookings = getUniqueProviderConversations(myBookings);
    
    return (
      <div className="flex h-[calc(100vh-9.5rem)] border border-outline-variant/30 rounded-3xl overflow-hidden bg-surface-container-lowest shadow-md">
        {/* Chat Sidebar */}
        <div className="w-[320px] border-r border-outline-variant/20 flex flex-col bg-surface-container-low/30">
          <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between">
            <h2 className="font-title-md text-title-md font-extrabold text-on-background flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">forum</span>
              Conversations
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/60">
              {chatBookings.length}
            </span>
          </div>
          {chatBookings.length === 0 ? (
            <div className="p-8 text-center space-y-2 my-auto">
              <span className="material-symbols-outlined text-4xl text-outline-variant/60 block">chat_bubble_outline</span>
              <p className="text-sm font-bold text-on-surface">No active chats</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">Book a service to message active service providers.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10 p-2 space-y-1">
              {chatBookings.map(b => {
                const isActive = activeChatBookingId === b.id;
                return (
                  <div 
                    key={b.id} 
                    className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 ${
                      isActive ? 'bg-indigo-600 text-white shadow-md font-bold' : 'hover:bg-surface-container-high/60 text-on-surface'
                    }`}
                    onClick={() => setActiveChatBookingId(b.id)}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                        isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/50'
                      }`}>
                        {b.provider_service_details.provider_first_name[0].toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-extrabold truncate">
                        {b.provider_service_details.provider_first_name} {b.provider_service_details.provider_last_name}
                      </h4>
                      <p className={`text-xs truncate mt-0.5 ${isActive ? 'text-indigo-100/90' : 'text-on-surface-variant'}`}>
                        {b.provider_service_details.service_details.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex flex-col bg-surface-container-low/10">
          {!activeChatBookingId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-3xl bg-indigo-50/80 border border-indigo-200/60 text-indigo-600 flex items-center justify-center mb-4 shadow-2xs">
                <span className="material-symbols-outlined text-4xl">chat</span>
              </div>
              <h3 className="font-extrabold text-on-surface text-lg">Select a conversation</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mt-1 leading-relaxed">
                Choose an active provider from the left sidebar to start real-time messaging about your booking.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              <div className="p-4 bg-surface border-b border-outline-variant/20 flex justify-between items-center shrink-0 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                    {(myBookings.find(b => b.id === activeChatBookingId)?.provider_service_details?.provider_first_name || 'P')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-title-md text-title-md font-extrabold text-on-surface flex items-center gap-2">
                      Booking #BK-{activeChatBookingId}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {myBookings.find(b => b.id === activeChatBookingId)?.provider_service_details?.service_details?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleClearConversation(activeChatBookingId)}
                  className="px-3.5 py-1.5 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  Clear Chat
                </button>
              </div>
              
              <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
                {chatMessages.length === 0 ? (
                  <div className="my-auto text-center py-12 text-on-surface-variant text-xs space-y-1">
                    <span className="material-symbols-outlined text-3xl text-indigo-300 block mb-1">mark_unread_chat_alt</span>
                    <p className="font-bold">No messages yet</p>
                    <p>Send a message below to start chatting with your provider!</p>
                  </div>
                ) : (() => {
                  const activeBooking = myBookings.find(b => b.id === activeChatBookingId);
                  const providerFirstName = activeBooking?.provider_service_details?.provider_first_name || '?';
                  const myFirstName = customerProfile?.first_name || '?';
                  const providerPic = activeBooking?.provider_service_details?.provider_profile_picture;

                  return chatMessages.map(msg => {
                    const isMe = msg.sender_is_customer;
                    return (
                      <div key={msg.id} className={`group flex items-end gap-2 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className="shrink-0 w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center font-bold text-xs shadow-2xs"
                          style={isMe ? { background: 'var(--color-primary)', color: 'var(--color-on-primary)' } : { background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}
                        >
                          {isMe ? (
                            myFirstName[0].toUpperCase()
                          ) : providerPic ? (
                            <img src={providerPic} alt={providerFirstName} className="w-full h-full object-cover" />
                          ) : (
                            providerFirstName[0].toUpperCase()
                          )}
                        </div>

                        {/* Bubble */}
                        <div className="flex flex-col max-w-[65%]">
                          <span className={`text-[10px] font-bold mb-1 opacity-60 ${isMe ? 'text-right' : 'text-left'} text-on-surface`}>
                            {isMe ? 'You' : providerFirstName}
                          </span>
                          <div className={`p-3.5 rounded-2xl shadow-2xs ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-surface-container-highest text-on-surface rounded-tl-none border border-outline-variant/20'
                          }`}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                            <span className={`text-[10px] mt-1.5 opacity-75 block ${isMe ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>

                        {/* Delete button */}
                        {isMe && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 self-center w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-outline hover:text-red-600 cursor-pointer"
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

              <form className="p-4 bg-surface border-t border-outline-variant/20 flex gap-2.5 shrink-0" onSubmit={sendMessage}>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message here..."
                  className="flex-1 rounded-2xl border border-outline-variant/50 p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 bg-surface-container-lowest transition-all"
                />
                <button type="submit" className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold text-sm cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center gap-1.5">
                  <span>Send</span>
                  <span className="material-symbols-outlined text-base">send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNotifications = () => (
    <div className="max-w-[800px] mx-auto space-y-stack_lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-background">Your Notifications</h2>
          <p className="text-sm text-on-surface-variant mt-1">Stay updated with service progress and messages.</p>
        </div>
        <div className="flex gap-2">
          {notifications.filter(n => !n.is_read).length > 0 && (
            <button 
              onClick={() => notifications.filter(n => !n.is_read).forEach(n => markNotificationRead(n.id))}
              className="px-4 py-2 border border-outline-variant rounded-full font-label-sm text-xs text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearAllNotifications}
              className="px-4 py-2 border border-error text-error rounded-full font-label-sm text-xs hover:bg-error/5 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      
      {notifications.length === 0 ? (
        <div className="text-center p-12 bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">notifications_off</span>
          <h3 className="font-bold text-on-surface">All caught up!</h3>
          <p className="text-sm text-on-surface-variant">You have no notifications at the moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
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
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-10">Customer Portal</span>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10 mb-3" />

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {[
            { tab: 'Dashboard', icon: 'home', label: 'Home', onClick: () => { setActiveTab('Dashboard'); setSelectedService(null); } },
            { tab: 'Bookings', icon: 'calendar_today', label: 'My Bookings', onClick: () => setActiveTab('Bookings') },
            { tab: 'Messages', icon: 'chat_bubble', label: 'Messages', onClick: () => setActiveTab('Messages') },
            { tab: 'Notifications', icon: 'notifications', label: 'Notifications',
              badge: notifications.filter(n => !n.is_read).length,
              onClick: () => setActiveTab('Notifications') },
            { tab: 'Settings', icon: 'manage_accounts', label: 'Profile', onClick: () => setActiveTab('Settings') },
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
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white/20"
              style={{ background: 'linear-gradient(135deg, #4648d4, #7c7dff)', color: 'white' }}>
              {customerProfile?.first_name ? customerProfile.first_name[0].toUpperCase() : 'C'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-semibold truncate">
                {customerProfile?.first_name} {customerProfile?.last_name}
              </p>
              <p className="text-[11px] text-white/40">Customer Account</p>
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
              <span className="text-xs text-on-surface-variant font-medium">Good day,</span>
              <span className="font-bold text-on-surface text-sm">{customerProfile?.first_name || 'Customer'} &mdash; {activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('Notifications')}
              className="relative p-2.5 rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[22px]">notifications</span>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-surface" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('Settings')}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm cursor-pointer ring-2 ring-primary/20 hover:ring-primary/60 transition-all"
              style={{ background: 'linear-gradient(135deg, #4648d4, #7c7dff)', color: 'white' }}
            >
              {customerProfile?.first_name ? customerProfile.first_name[0].toUpperCase() : 'C'}
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-gutter max-w-container_max w-full mx-auto flex-1 pb-16">
          {activeTab === 'Dashboard' && !selectedService && renderDashboardHome()}
          {activeTab === 'Dashboard' && selectedService && renderProvidersList()}
          {activeTab === 'Bookings' && renderMyBookings()}
          {activeTab === 'Messages' && renderMessages()}
          {activeTab === 'Notifications' && renderNotifications()}
          {activeTab === 'Settings' && (
            <div className="max-w-[850px] mx-auto space-y-stack_lg">
              {/* Account Settings Header Card */}
              <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-extrabold text-3xl ring-4 ring-white/30 shadow-xl shrink-0">
                    {customerProfile?.first_name ? customerProfile.first_name[0].toUpperCase() : 'C'}
                  </div>
                  <div className="text-center sm:text-left space-y-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h2 className="text-2xl font-extrabold tracking-tight text-white">{customerProfile?.first_name} {customerProfile?.last_name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold">Active Customer</span>
                    </div>
                    <p className="text-xs text-indigo-200/80 font-medium">Manage your personal profile and account credentials.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Form */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs space-y-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">manage_accounts</span>
                    <h3 className="font-title-md text-title-md font-extrabold text-on-surface">Personal Information</h3>
                  </div>
                  
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">First Name</label>
                        <input 
                          type="text" 
                          value={customerProfile?.first_name || ''} 
                          onChange={(e) => setCustomerProfile({...customerProfile, first_name: e.target.value})}
                          className="rounded-2xl border border-outline-variant/40 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Last Name</label>
                        <input 
                          type="text" 
                          value={customerProfile?.last_name || ''} 
                          onChange={(e) => setCustomerProfile({...customerProfile, last_name: e.target.value})}
                          className="rounded-2xl border border-outline-variant/40 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Phone Number</label>
                      <input 
                        type="tel" 
                        value={customerProfile?.phone_number || ''} 
                        onChange={(e) => setCustomerProfile({...customerProfile, phone_number: e.target.value})}
                        className="rounded-2xl border border-outline-variant/40 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                    
                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-2xl text-sm font-extrabold hover:bg-indigo-700 transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 mt-2">
                      <span className="material-symbols-outlined text-lg">save</span>
                      Save Changes
                    </button>
                  </form>
                </div>

                {/* Password Setting Card */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-2xs space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">shield</span>
                      <h3 className="font-title-md text-title-md font-extrabold text-on-surface">Security & Privacy</h3>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Keep your account credentials safe. Change your password regularly to protect your personal data.
                    </p>
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2 text-xs text-indigo-900 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600 text-base">check_circle</span>
                        <span>Password Protection Active</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600 text-base">check_circle</span>
                        <span>Secure JWT Session Tokens</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPasswordModal(true)}
                    className="w-full py-3 border border-indigo-600/40 text-indigo-700 font-extrabold text-sm rounded-2xl hover:bg-indigo-50 transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">lock_reset</span>
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Book Service Modal — Calendar Picker */}
      {bookingProvider && (() => {
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

        // Build availability set from provider's availability_slots
        const availabilitySlots = bookingProvider.provider_availability_slots || [];
        const availableDaySet = new Set(
          availabilitySlots.filter(s => s.is_available).map(s => s.day_of_week)
        );
        // Fallback: if no slots, use provider_available_days string
        const hasNewSlots = availabilitySlots.length > 0;
        const legacyDays = bookingProvider.provider_available_days
          ? bookingProvider.provider_available_days.split(',')
          : [];
        const LEGACY_DAY_MAP = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5, Sunday:6 };
        const legacyDaySet = new Set(legacyDays.map(d => LEGACY_DAY_MAP[d.trim()]).filter(d => d !== undefined));

        const isDayAvailable = (jsWeekday) => {
          // jsWeekday: 0=Sun,6=Sat → convert to Mon=0,Sun=6
          const mondayBased = jsWeekday === 0 ? 6 : jsWeekday - 1;
          if (hasNewSlots) return availableDaySet.has(mondayBased);
          if (legacyDays.length > 0) return legacyDaySet.has(mondayBased);
          return true; // no restriction
        };

        // Calendar days
        const firstDay = new Date(calendarYear, calendarMonth, 1);
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        // Mon-based offset
        const startOffset = (firstDay.getDay() + 6) % 7;
        const today = new Date(); today.setHours(0,0,0,0);

        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        const formatDateStr = (d) => {
          const mm = String(calendarMonth + 1).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          return `${calendarYear}-${mm}-${dd}`;
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-surface-container-lowest rounded-3xl w-full max-w-xl border border-outline-variant/20 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
              
              {/* Header Banner */}
              <div className="relative bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-6 pt-6 text-white shrink-0 overflow-hidden shadow-md">
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="relative z-10 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                      <span className="material-symbols-outlined text-xl">event_available</span>
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-white leading-tight">Book Service Appointment</h2>
                      <p className="text-xs text-indigo-200/80 font-medium">Select a date & time for your service</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setBookingProvider(null); setBookingDate(''); setBookingTime(''); setAvailableSlots(null); }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer font-bold text-base backdrop-blur-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[82vh] flex-1">
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-indigo-50/70 via-surface-container-low to-indigo-100/40 rounded-2xl p-4 border border-indigo-200/50 grid grid-cols-2 gap-3 text-xs shadow-2xs">
                  <div>
                    <span className="text-[10px] text-on-surface-variant font-bold block uppercase tracking-wider mb-0.5">Service</span>
                    <span className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-indigo-600 text-base">home_repair_service</span>
                      {bookingProvider.service_details.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant font-bold block uppercase tracking-wider mb-0.5">Service Provider</span>
                    <span className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-indigo-600 text-base">person</span>
                      {bookingProvider.provider_first_name} {bookingProvider.provider_last_name}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2.5 border-t border-indigo-200/40 flex justify-between items-center font-extrabold text-indigo-900 text-sm">
                    <span className="text-xs uppercase font-bold text-on-surface-variant">Rate / Fee</span>
                    <span className="text-base text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200 shadow-2xs">₹{bookingProvider.price}</span>
                  </div>
                </div>

                {/* ── Calendar ── */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">calendar_month</span>
                    Select Appointment Date
                  </label>
                  <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-2xs">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low/70 border-b border-outline-variant/20">
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
                          else setCalendarMonth(m => m - 1);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-container-high text-on-surface cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>
                      <span className="font-extrabold text-on-surface text-sm">{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
                          else setCalendarMonth(m => m + 1);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-container-high text-on-surface cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-surface-container-low/30">
                      {DAY_NAMES.map(d => (
                        <div key={d} className="text-center text-[11px] font-bold text-on-surface-variant/80 py-2 uppercase tracking-wider">{d}</div>
                      ))}
                    </div>

                    {/* Cells */}
                    <div className="grid grid-cols-7 p-2.5 gap-1.5">
                      {cells.map((day, idx) => {
                        if (!day) return <div key={`e-${idx}`} />;
                        const cellDate = new Date(calendarYear, calendarMonth, day);
                        const isPast = cellDate < today;
                        const jsWeekday = cellDate.getDay();
                        const isAvail = !isPast && isDayAvailable(jsWeekday);
                        const dateStr = formatDateStr(day);
                        const isSelected = bookingDate === dateStr;

                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!isAvail}
                            onClick={() => handleCalendarDateSelect(bookingProvider.provider_id, dateStr)}
                            className={`rounded-xl py-2 text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center
                              ${isSelected ? 'bg-indigo-600 text-white font-extrabold shadow-md scale-105 ring-2 ring-indigo-300' : ''}
                              ${!isSelected && isAvail ? 'hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 hover:font-bold' : ''}
                              ${!isAvail ? 'text-slate-300 cursor-not-allowed line-through bg-slate-50/50' : ''}
                            `}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Time Slot Picker ── */}
                {bookingDate && (
                  <div className="space-y-2 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-base">schedule</span>
                        Available 1-Hour Time Slots — {new Date(bookingDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })}
                      </label>
                      <span className="text-[11px] font-semibold text-slate-500">1-hour slots</span>
                    </div>
                    {slotsLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
                      </div>
                    ) : availableSlots === null ? null : (availableSlots.slots ? availableSlots.slots.length === 0 : availableSlots.available_slots.length === 0) ? (
                      <div className="text-center py-5 text-xs font-medium text-on-surface-variant bg-amber-50/60 border border-amber-200/60 rounded-2xl">
                        <span className="material-symbols-outlined text-2xl text-amber-600 block mb-1">event_busy</span>
                        {availableSlots.reason || 'No available slots on this day. Please choose another date.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {availableSlots.slots ? (
                          availableSlots.slots.map(slotItem => {
                            const isSelected = bookingTime === slotItem.start_time;
                            if (slotItem.is_past) {
                              return (
                                <button
                                  key={`past-${slotItem.start_time}`}
                                  type="button"
                                  disabled
                                  title="This time slot has already passed"
                                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-400 bg-slate-100/60 cursor-not-allowed flex items-center justify-between"
                                >
                                  <span className="flex items-center gap-1.5 line-through">
                                    <span className="material-symbols-outlined text-[15px] text-slate-400">history</span>
                                    {slotItem.label}
                                  </span>
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-500 uppercase tracking-wider">Passed</span>
                                </button>
                              );
                            }
                            if (slotItem.is_booked) {
                              return (
                                <button
                                  key={`booked-${slotItem.start_time}`}
                                  type="button"
                                  disabled
                                  title="Slot already booked by another customer"
                                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-amber-200/80 text-amber-800/60 bg-amber-50/50 cursor-not-allowed flex items-center justify-between"
                                >
                                  <span className="flex items-center gap-1.5 line-through">
                                    <span className="material-symbols-outlined text-[15px] text-amber-600/70">block</span>
                                    {slotItem.label}
                                  </span>
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">Booked</span>
                                </button>
                              );
                            }
                            return (
                              <button
                                key={slotItem.start_time}
                                type="button"
                                onClick={() => setBookingTime(slotItem.start_time)}
                                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-[1.02]'
                                    : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className={`material-symbols-outlined text-[15px] ${isSelected ? 'text-white' : 'text-indigo-600'}`}>schedule</span>
                                  {slotItem.label}
                                </span>
                                {isSelected && (
                                  <span className="material-symbols-outlined text-[16px] text-white">check_circle</span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          availableSlots.available_slots.map(slot => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setBookingTime(slot)}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                                bookingTime === slot
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-105'
                                  : 'border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:border-indigo-400 hover:bg-indigo-50/50'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">schedule</span>
                              {slot}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Address + Submit ── */}
                <form onSubmit={submitBooking} className="space-y-4">
                  {/* ── Service Address Section with Prominent Location Options Bar ── */}
                  <div className="flex flex-col gap-2 bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-indigo-600 text-base">location_on</span>
                        Service Address <span className="text-red-500">*</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCustomerGPSDetect}
                          disabled={isDetectingCustomerGps}
                          className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          <Navigation className={`w-3.5 h-3.5 text-indigo-600 ${isDetectingCustomerGps ? 'animate-spin' : ''}`} />
                          <span>{isDetectingCustomerGps ? 'Detecting...' : '📍 Use GPS'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowCustomerMapModal(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                          <MapPin className="w-3.5 h-3.5 text-white" />
                          <span>🗺️ Select on Map</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter full home address (house/flat no, street, landmark)..."
                      className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none"
                      required
                      rows="2"
                    />
                  </div>

                  {/* Problem Description & Photo Upload */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-base">edit_note</span>
                      Describe the Issue (Optional)
                    </label>
                    <textarea
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      placeholder="Explain what needs fixing (e.g. leaking faucet, flickering switch)..."
                      className="rounded-2xl border border-outline-variant/40 p-3.5 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none"
                      rows="2"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-base">photo_camera</span>
                      Attach Problem Photo (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-indigo-400/80 bg-indigo-50/50 text-indigo-800 rounded-2xl text-xs font-bold cursor-pointer hover:bg-indigo-100/60 transition-all shadow-2xs">
                        <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                        {photoPreview ? 'Change Photo' : 'Upload Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                      {photoPreview && (
                        <div className="relative group">
                          <img src={photoPreview} alt="Problem Preview" className="w-12 h-12 rounded-xl object-cover border border-outline-variant/40 shadow-xs" />
                          <button
                            type="button"
                            onClick={removePhoto}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 text-[12px] flex items-center justify-center cursor-pointer shadow hover:bg-red-700 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confirmation summary */}
                  {bookingDate && bookingTime && (
                    <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs font-bold text-emerald-900 shadow-2xs animate-[fadeIn_0.2s_ease-out]">
                      <span className="material-symbols-outlined text-emerald-600 text-xl">event_available</span>
                      <span>
                        Appointment set for <span className="underline">{new Date(bookingDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</span> ({availableSlots?.slots?.find(s => s.start_time === bookingTime)?.label || bookingTime})
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!bookingDate || !bookingTime || !address || isSubmittingBooking}
                    className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-extrabold text-sm hover:bg-indigo-700 transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmittingBooking ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        Submitting Booking...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Confirm Booking
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Public Profile Modal */}
      {publicProfileData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-2xl border border-outline-variant/20 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            
            {/* Header Banner */}
            <div className="relative bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-6 pt-7 text-white shrink-0 overflow-hidden shadow-md">
              {/* Subtle background glow graphics */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-indigo-500/20 blur-xl pointer-events-none" />

              <div className="relative z-10 flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                  <span className="material-symbols-outlined text-[15px] text-amber-300" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span className="text-xs font-semibold tracking-wide text-white/90">Verified Professional</span>
                </div>
                <button
                  onClick={() => setPublicProfileData(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer font-bold text-base backdrop-blur-sm"
                >
                  ✕
                </button>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-5">
                <div className="relative shrink-0">
                  {publicProfileData.profile_picture ? (
                    <img
                      src={publicProfileData.profile_picture}
                      alt={publicProfileData.first_name}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover ring-4 ring-white/30 shadow-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-extrabold text-4xl ring-4 ring-white/30 shadow-xl">
                      {publicProfileData.first_name[0].toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 ring-2 ring-white shadow-sm" title="Active & Available" />
                </div>

                <div className="text-center sm:text-left flex-1 space-y-1.5">
                  <h3 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                    {publicProfileData.first_name} {publicProfileData.last_name}
                    {publicProfileData.is_verified && (
                      <span className="material-symbols-outlined text-amber-300 text-xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    )}
                  </h3>
                  <p className="text-xs text-indigo-100/80 font-medium flex items-center justify-center sm:justify-start gap-1">
                    <span className="material-symbols-outlined text-[15px] text-indigo-200">location_on</span>
                    {publicProfileData.city || 'Location not specified'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 divide-x divide-outline-variant/15 bg-surface-container-low border-b border-outline-variant/20 py-3.5 text-center shrink-0">
              <div>
                <p className="text-lg font-extrabold text-primary">{publicProfileData.experience_years || 0} <span className="text-xs font-semibold">yrs</span></p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Experience</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-amber-600 flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-base text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  {publicProfileData.reviews && publicProfileData.reviews.length > 0 ? (publicProfileData.reviews.reduce((acc, r) => acc + r.rating, 0) / publicProfileData.reviews.length).toFixed(1) : '5.0'}
                </p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Rating ({publicProfileData.reviews?.length || 0})</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-emerald-600">{publicProfileData.services?.length || 0}</p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Services</p>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1">
              
              {/* About Me */}
              <div className="space-y-2">
                <h4 className="font-bold text-on-surface text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">person</span>
                  About Me
                </h4>
                <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20 text-sm text-on-surface-variant leading-relaxed">
                  {publicProfileData.bio || 'This professional has not added a bio yet.'}
                </div>
              </div>

              {/* Skills */}
              {publicProfileData.skills && (
                <div className="space-y-2">
                  <h4 className="font-bold text-on-surface text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">construction</span>
                    Specialized Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {publicProfileData.skills.split(',').map((skill, idx) => (
                      <span key={idx} className="px-3.5 py-1.5 rounded-xl bg-indigo-50/80 text-indigo-900 text-xs font-bold border border-indigo-200/60 shadow-2xs">
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Services Offered */}
              <div className="space-y-2">
                <h4 className="font-bold text-on-surface text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-base">home_repair_service</span>
                  Services & Pricing
                </h4>
                <div className="divide-y divide-outline-variant/10 border border-outline-variant/20 rounded-2xl overflow-hidden shadow-2xs">
                  {publicProfileData.services?.map(svc => (
                    <div key={svc.id} className="flex justify-between items-center p-4 bg-surface-container-lowest hover:bg-surface-container-low/40 transition-colors">
                      <div>
                        <span className="font-bold text-on-surface text-sm block">{svc.service_details.name}</span>
                        <span className="text-xs text-on-surface-variant font-medium">Standard Service Package</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-primary text-base">₹{svc.price}</span>
                        <button
                          onClick={() => {
                            setPublicProfileData(null);
                            setBookingProvider({
                              id: svc.id,
                              provider_id: publicProfileData.id,
                              provider_first_name: publicProfileData.first_name,
                              provider_last_name: publicProfileData.last_name,
                              service_details: svc.service_details,
                              price: svc.price
                            });
                          }}
                          className="px-3.5 py-1.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-surface-tint transition-all cursor-pointer shadow-xs"
                        >
                          Book Service
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Portfolio / Gallery */}
              {publicProfileData.gallery_images && publicProfileData.gallery_images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-on-surface text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">photo_library</span>
                    Portfolio & Past Work
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {publicProfileData.gallery_images.map(img => (
                      <div
                        key={img.id}
                        onClick={() => setGalleryLightboxImage(img.image)}
                        className="group relative aspect-square overflow-hidden rounded-2xl border border-outline-variant/20 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                      >
                        <img src={img.image} alt="Portfolio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                          <span className="material-symbols-outlined text-white text-2xl">zoom_in</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Reviews */}
              <div className="space-y-3">
                <h4 className="font-bold text-on-surface text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  Customer Reviews
                </h4>
                {publicProfileData.reviews && publicProfileData.reviews.length > 0 ? (
                  <div className="space-y-3">
                    {publicProfileData.reviews.map(rev => (
                      <div key={rev.id} className="p-4 bg-surface-container-low/40 rounded-2xl border border-outline-variant/15 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {rev.customer_name ? rev.customer_name[0].toUpperCase() : 'C'}
                            </div>
                            <span className="text-xs font-bold text-on-surface">{rev.customer_name}</span>
                          </div>
                          <span className="text-xs text-on-surface-variant font-medium">{new Date(rev.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 text-sm">
                          {[...Array(rev.rating)].map((_, i) => (
                            <span key={i} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          ))}
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed italic">"{rev.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-surface-container-low/30 rounded-2xl text-center text-xs text-on-surface-variant font-medium">
                    No customer reviews yet for this professional.
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Modal */}
      {galleryLightboxImage && (
        <div
          onClick={() => setGalleryLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-[fadeIn_0.2s_ease-out]"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={galleryLightboxImage} alt="Enlarged Work Portfolio" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
            <button
              onClick={() => setGalleryLightboxImage(null)}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center font-bold text-xl hover:bg-black/80 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Review & Rating Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md border border-outline-variant/30 shadow-2xl overflow-hidden animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex justify-between items-center relative overflow-hidden">
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight">Rate Your Service</h2>
                  <p className="text-[11px] text-indigo-200/80 font-medium">Booking #BK-{reviewBooking.id} &bull; {reviewBooking.provider_service_details?.service_details?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setReviewBooking(null)} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <form onSubmit={submitReview} className="space-y-5">
                {/* Provider Card */}
                <div className="p-3.5 bg-surface-container-low/60 rounded-2xl border border-outline-variant/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {reviewBooking.provider_service_details?.provider_first_name?.[0]?.toUpperCase() || 'P'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-on-surface truncate">
                      {reviewBooking.provider_service_details?.provider_first_name} {reviewBooking.provider_service_details?.provider_last_name}
                    </p>
                    <p className="text-[11px] text-on-surface-variant font-medium">Verified Service Professional</p>
                  </div>
                </div>

                {/* Interactive Star Rating Picker */}
                <div className="flex flex-col items-center justify-center gap-2 py-2 bg-amber-500/5 rounded-2xl border border-amber-500/15">
                  <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">
                    Tap Stars To Rate
                  </span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-1 cursor-pointer transition-transform hover:scale-125 focus:outline-none"
                      >
                        <span 
                          className={`material-symbols-outlined text-3xl transition-colors ${
                            star <= Number(reviewRating) ? 'text-amber-500' : 'text-slate-300'
                          }`}
                          style={{ fontVariationSettings: star <= Number(reviewRating) ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-extrabold text-amber-600">
                    {Number(reviewRating) === 5 && '⭐⭐⭐⭐⭐ 5/5 — Outstanding Experience!'}
                    {Number(reviewRating) === 4 && '⭐⭐⭐⭐ 4/5 — Very Good Service'}
                    {Number(reviewRating) === 3 && '⭐⭐⭐ 3/5 — Average Experience'}
                    {Number(reviewRating) === 2 && '⭐⭐ 2/5 — Needs Improvement'}
                    {Number(reviewRating) === 1 && '⭐ 1/5 — Poor Service'}
                  </span>
                </div>

                {/* Comment Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Your Detailed Feedback</label>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      {150 - reviewComment.length} chars left
                    </span>
                  </div>
                  <textarea 
                    value={reviewComment} 
                    onChange={(e) => {
                      if (e.target.value.length <= 150) setReviewComment(e.target.value);
                    }}
                    placeholder="Describe your experience, quality of work, punctuality, and professionalism..."
                    className="w-full rounded-2xl border border-outline-variant/40 p-3.5 text-xs bg-surface-container-lowest focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none transition-all"
                    required
                    rows="4"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3.5 rounded-2xl font-extrabold text-sm transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span>Submit Star Review</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md border border-outline-variant/30 shadow-2xl overflow-hidden animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs">
                  <span className="material-symbols-outlined text-xl">lock_reset</span>
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight">Secure Checkout</h2>
                  <p className="text-[11px] text-indigo-200/80 font-medium">Encrypted SSL Payment Gateway</p>
                </div>
              </div>
              <button 
                onClick={() => setPayBooking(null)} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer relative z-10"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Service Price Summary */}
              <div className="bg-emerald-50/80 text-emerald-950 p-4 rounded-2xl border border-emerald-200/60 flex justify-between items-center shadow-2xs">
                <div>
                  <span className="text-[11px] text-emerald-700 font-extrabold uppercase tracking-wider block">Selected Service</span>
                  <span className="text-sm font-extrabold text-emerald-950">{payBooking.provider_service_details.service_details.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Total</span>
                  <span className="text-xl font-extrabold text-emerald-800">₹{payBooking.provider_service_details.price}</span>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div className="flex gap-1.5 p-1.5 bg-surface-container-low/60 rounded-2xl border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('card')}
                  className={`flex-1 py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPaymentMethod === 'card' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">credit_card</span>
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('upi')}
                  className={`flex-1 py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPaymentMethod === 'upi' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">qr_code_2</span>
                  <span>UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('cash')}
                  className={`flex-1 py-2.5 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    selectedPaymentMethod === 'cash' 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  <span>Cash</span>
                </button>
              </div>

              <form onSubmit={submitPayment} className="space-y-4">
                {selectedPaymentMethod === 'card' && (
                  <div className="space-y-3.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cardholder Name</label>
                      <input 
                        type="text" 
                        value={cardForm.name} 
                        onChange={(e) => setCardForm({...cardForm, name: e.target.value})}
                        placeholder="John Doe"
                        className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Card Number</label>
                      <input 
                        type="text" 
                        maxLength="16"
                        value={cardForm.number} 
                        onChange={(e) => setCardForm({...cardForm, number: e.target.value})}
                        placeholder="1234 5678 9101 1121"
                        className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all font-mono"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Expiry (MM/YY)</label>
                        <input 
                          type="text" 
                          maxLength="5"
                          value={cardForm.expiry} 
                          onChange={(e) => setCardForm({...cardForm, expiry: e.target.value})}
                          placeholder="12/29"
                          className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all font-mono"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">CVV</label>
                        <input 
                          type="password" 
                          maxLength="3"
                          value={cardForm.cvv} 
                          onChange={(e) => setCardForm({...cardForm, cvv: e.target.value})}
                          placeholder="123"
                          className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === 'upi' && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Enter Virtual Payment Address (VPA)</label>
                      <input 
                        type="text" 
                        value={upiId} 
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="username@bank"
                        className="rounded-2xl border border-outline-variant/50 p-3.5 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all font-mono"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant/80 font-medium bg-surface-container-low p-3 rounded-xl border border-outline-variant/20">
                      <span className="material-symbols-outlined text-indigo-600 text-base">verified</span>
                      <span>Accepting Google Pay, PhonePe, Paytm, BHIM & all major UPI apps</span>
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === 'cash' && (
                  <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/70 text-xs text-amber-950 leading-relaxed space-y-2">
                    <p className="font-extrabold text-amber-900 flex items-center gap-1.5 text-sm">
                      <span className="material-symbols-outlined text-amber-700 text-lg">info</span>
                      Cash on Service (COD)
                    </p>
                    <p className="font-medium">
                      Pay cash directly to the service provider upon completion of work at your address.
                    </p>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
                >
                  <span className="material-symbols-outlined text-lg">verified_user</span>
                  <span>{selectedPaymentMethod === 'cash' ? 'Confirm Cash on Service' : `Pay ₹${payBooking.provider_service_details.price}`}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md border border-outline-variant/30 shadow-2xl overflow-hidden animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs">
                  <span className="material-symbols-outlined text-xl">lock_reset</span>
                </div>
                <h2 className="text-base font-extrabold tracking-tight">Change Password</h2>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)} 
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Current Password</label>
                  <input 
                    type="password"
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({...passwordForm, old_password: e.target.value})}
                    className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">New Password</label>
                  <input 
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                    className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Confirm New Password</label>
                  <input 
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                    className="rounded-2xl border border-outline-variant/50 p-3 text-sm bg-surface-container-lowest focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-extrabold text-sm transition-all cursor-pointer shadow-md hover:shadow-lg mt-2 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">save</span>
                  <span>Update Password</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

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

      {/* Cancel Booking Confirmation Modal */}
      {cancelBookingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm border border-outline-variant/20 shadow-xl overflow-hidden animate-[scaleUp_0.2s_ease-out] p-6 space-y-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-bold text-on-surface">Cancel Booking?</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setCancelBookingId(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                No, Keep
              </button>
              <button 
                onClick={() => confirmCancelBooking(cancelBookingId)}
                className="px-4 py-2 bg-error text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
              >
                Yes, Cancel
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

      {/* ── Customer Map Location Picker Modal ── */}
      {showCustomerMapModal && (
        <Modal
          isOpen={showCustomerMapModal}
          onClose={() => setShowCustomerMapModal(false)}
          title="Select Your Service Delivery Location on Map"
          maxWidth="max-w-3xl"
        >
          <div className="p-1">
            <LocationPickerMap
              onLocationChange={(lat, lng, cleanAddress) => {
                if (cleanAddress) setAddress(cleanAddress);
              }}
              onConfirm={(selectedAddress) => {
                if (selectedAddress) setAddress(selectedAddress);
                setShowCustomerMapModal(false);
                showNotification('Service address updated from map!');
              }}
            />
          </div>
        </Modal>
      )}

      {/* ── Invoice Modal ── */}
      {selectedInvoiceBooking && (
        <InvoiceModal
          booking={selectedInvoiceBooking}
          onClose={() => setSelectedInvoiceBooking(null)}
        />
      )}
    </div>
  );
};

export default CustomerDashboard;
