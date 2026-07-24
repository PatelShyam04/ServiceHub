import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, CheckCircle2, Loader2 } from 'lucide-react';

const DEFAULT_CENTER = [19.0760, 72.8777];

export const LocationPickerMap = ({ latitude, longitude, onLocationChange, onConfirm }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addressName, setAddressName] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Fix default marker icon assets for Leaflet
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  // Fetch human-readable address from coordinates using Nominatim API
  const fetchAddressName = async (lat, lng) => {
    try {
      setIsGeocoding(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          // Format clean address (area, road, city)
          const parts = data.display_name.split(',');
          const cleanName = parts.slice(0, 3).join(',').trim();
          setAddressName(cleanName);
        }
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Initialize Map Instance once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = latitude ? parseFloat(latitude) : DEFAULT_CENTER[0];
    const initialLng = longitude ? parseFloat(longitude) : DEFAULT_CENTER[1];

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Custom Draggable Pin
    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      title: 'Your Service Location Pin',
    }).addTo(map);

    marker.bindPopup('<div class="font-sans font-bold text-xs p-1 text-slate-800">📍 Your Service Base Location<br/><span class="text-[10px] text-indigo-600 font-medium">Drag or click map to move</span></div>').openPopup();

    const handlePosChange = (newLat, newLng) => {
      const roundedLat = Math.round(newLat * 100000) / 100000;
      const roundedLng = Math.round(newLng * 100000) / 100000;
      if (onLocationChange) onLocationChange(roundedLat, roundedLng);
      fetchAddressName(roundedLat, roundedLng);
    };

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      handlePosChange(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      handlePosChange(lat, lng);
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    if (latitude && longitude) {
      fetchAddressName(latitude, longitude);
    }

    // Force Leaflet to recalculate container size when opened inside a Modal dialog
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 150);

    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position if external latitude/longitude changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const curPos = marker.getLatLng();
      if (Math.abs(curPos.lat - lat) > 0.0001 || Math.abs(curPos.lng - lng) > 0.0001) {
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng], { animate: true });
        fetchAddressName(lat, lng);
      }
    }
  }, [latitude, longitude]);

  // Handle GPS "Locate Me" Button
  const handleGPSDetect = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const roundedLat = Math.round(lat * 100000) / 100000;
        const roundedLng = Math.round(lng * 100000) / 100000;

        if (onLocationChange) onLocationChange(roundedLat, roundedLng);
        if (mapInstanceRef.current && markerRef.current) {
          markerRef.current.setLatLng([roundedLat, roundedLng]);
          mapInstanceRef.current.flyTo([roundedLat, roundedLng], 14, { duration: 1 });
        }
        fetchAddressName(roundedLat, roundedLng);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

// Famous Indian Landmarks, Hostels & Educational Institutions Quick-Lookup Dictionary (Pan-India)
const FAMOUS_INDIAN_LANDMARKS = [
  // 🎓 Hostels & Educational Institutions (Gujarat & Pan-India)
  { keywords: ['kp vidyarthi bhavan', 'k p vidhyarthi bhavan', 'kp hostel', 'vidhyarthi bhavan ahmedabad', 'vidyarthi bhavan paldi', 'kp vidhyarthi'], lat: 23.0225, lon: 72.5714, name: 'Shree K.P. Vidyarthi Bhavan Hostel, Paldi / Ellisbridge, Ahmedabad, Gujarat' },
  { keywords: ['lj university', 'lj college', 'lj institute', 'lj campus', 'lok jagruti', 'lj engineering'], lat: 22.9878, lon: 72.5020, name: 'L.J. University Campus, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['iim ahmedabad', 'iim-a', 'iim campus', 'iim vastrapur'], lat: 23.0315, lon: 72.5312, name: 'Indian Institute of Management (IIM), Vastrapur, Ahmedabad, Gujarat' },
  { keywords: ['nirma university', 'nirma college', 'nirma campus'], lat: 23.1287, lon: 72.5445, name: 'Nirma University, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['gujarat university', 'gu campus'], lat: 23.0371, lon: 72.5444, name: 'Gujarat University, Navrangpura, Ahmedabad, Gujarat' },
  { keywords: ['parul university'], lat: 22.2887, lon: 73.3634, name: 'Parul University, Vadodara, Gujarat' },
  { keywords: ['gtu', 'gujarat technological university'], lat: 23.1060, lon: 72.5950, name: 'Gujarat Technological University (GTU), Chandkheda, Ahmedabad' },
  { keywords: ['iit gandhinagar', 'iit gn'], lat: 23.2125, lon: 72.6844, name: 'Indian Institute of Technology (IIT) Gandhinagar, Palaj, Gujarat' },
  { keywords: ['ms university', 'msu baroda', 'msu vadodara'], lat: 22.3106, lon: 73.1926, name: 'Maharaja Sayajirao University of Baroda, Vadodara, Gujarat' },

  // 🎓 Premier All-India Educational Institutions (IITs, IIMs, AIIMS, Central Varsities)
  { keywords: ['iit delhi', 'iit d', 'iit hauz khas'], lat: 28.5450, lon: 77.1926, name: 'Indian Institute of Technology (IIT) Delhi, Hauz Khas, New Delhi' },
  { keywords: ['iit bombay', 'iit b', 'iit powai'], lat: 19.1334, lon: 72.9133, name: 'Indian Institute of Technology (IIT) Bombay, Powai, Mumbai, Maharashtra' },
  { keywords: ['iit madras', 'iit m', 'iit chennai'], lat: 12.9915, lon: 80.2337, name: 'Indian Institute of Technology (IIT) Madras, Adyar, Chennai, Tamil Nadu' },
  { keywords: ['iit kharagpur', 'iit kgp'], lat: 22.3193, lon: 87.3099, name: 'Indian Institute of Technology (IIT) Kharagpur, West Bengal' },
  { keywords: ['iit kanpur', 'iit k'], lat: 26.5123, lon: 80.2329, name: 'Indian Institute of Technology (IIT) Kanpur, Uttar Pradesh' },
  { keywords: ['iit roorkee'], lat: 29.8649, lon: 77.8965, name: 'Indian Institute of Technology (IIT) Roorkee, Uttarakhand' },
  { keywords: ['iit guwahati'], lat: 26.1878, lon: 91.6916, name: 'Indian Institute of Technology (IIT) Guwahati, Assam' },
  { keywords: ['iisc bangalore', 'iisc bengaluru'], lat: 13.0184, lon: 77.5672, name: 'Indian Institute of Science (IISc), Malleshwaram, Bengaluru, Karnataka' },
  { keywords: ['iim bangalore', 'iim-b'], lat: 12.8948, lon: 77.6006, name: 'Indian Institute of Management (IIM) Bangalore, Bannerghatta Road, Bengaluru' },
  { keywords: ['iim calcutta', 'iim-c', 'iim kolkata'], lat: 22.4348, lon: 88.3074, name: 'Indian Institute of Management (IIM) Calcutta, Joka, Kolkata' },
  { keywords: ['iim lucknow', 'iim-l'], lat: 26.9248, lon: 80.9575, name: 'Indian Institute of Management (IIM) Lucknow, Uttar Pradesh' },
  { keywords: ['iim kozhikode', 'iim-k'], lat: 11.2894, lon: 75.8762, name: 'Indian Institute of Management (IIM) Kozhikode, Kerala' },
  { keywords: ['iim indore'], lat: 22.6247, lon: 75.8016, name: 'Indian Institute of Management (IIM) Indore, Madhya Pradesh' },
  { keywords: ['aiims delhi', 'aiims new delhi'], lat: 28.5672, lon: 77.2100, name: 'All India Institute of Medical Sciences (AIIMS), Ansari Nagar, New Delhi' },
  { keywords: ['du', 'delhi university', 'north campus du'], lat: 28.6892, lon: 77.2106, name: 'University of Delhi (North Campus), New Delhi' },
  { keywords: ['jnu', 'jawaharlal nehru university'], lat: 28.5400, lon: 77.1670, name: 'Jawaharlal Nehru University (JNU), New Delhi' },
  { keywords: ['bhu', 'banaras hindu university'], lat: 25.2677, lon: 82.9913, name: 'Banaras Hindu University (BHU), Varanasi, Uttar Pradesh' },
  { keywords: ['bits pilani'], lat: 28.3639, lon: 75.5869, name: 'BITS Pilani, Vidya Vihar, Pilani, Rajasthan' },

  // ✈️ Major Airports & Transportation Hubs across India
  { keywords: ['ahmedabad airport', 'svpi airport', 'airport ahmedabad'], lat: 23.0772, lon: 72.6347, name: 'Sardar Vallabhbhai Patel International Airport, Ahmedabad' },
  { keywords: ['delhi airport', 'igi airport', 'indira gandhi airport'], lat: 28.5562, lon: 77.1000, name: 'Indira Gandhi International Airport (DEL), New Delhi' },
  { keywords: ['mumbai airport', 'csmi airport', 'mumbai t2'], lat: 19.0896, lon: 72.8656, name: 'Chhatrapati Shivaji Maharaj International Airport (BOM), Mumbai' },
  { keywords: ['bangalore airport', 'kempegowda airport', 'bengaluru airport'], lat: 13.1986, lon: 77.7066, name: 'Kempegowda International Airport (BLR), Bengaluru' },
  { keywords: ['hyderabad airport', 'rgia', 'shamshabad airport'], lat: 17.2403, lon: 78.4294, name: 'Rajiv Gandhi International Airport (HYD), Shamshabad, Hyderabad' },
  { keywords: ['chennai airport', 'maa airport'], lat: 12.9941, lon: 80.1709, name: 'Chennai International Airport (MAA), Meenambakkam, Chennai' },
  { keywords: ['kolkata airport', 'netaji subhash airport'], lat: 22.6547, lon: 88.4467, name: 'Netaji Subhash Chandra Bose International Airport (CCU), Kolkata' },
  { keywords: ['pune airport'], lat: 18.5822, lon: 73.9197, name: 'Pune Airport (PNQ), Lohegaon, Pune' },
  { keywords: ['kalupur railway station', 'ahmedabad railway station'], lat: 23.0232, lon: 72.6006, name: 'Ahmedabad Junction Railway Station, Kalupur, Ahmedabad' },
  { keywords: ['new delhi railway station', 'ndls'], lat: 28.6430, lon: 77.2194, name: 'New Delhi Railway Station (NDLS), Paharganj, New Delhi' },
  { keywords: ['csmt', 'vt station', 'chhatrapati shivaji terminus'], lat: 18.9400, lon: 72.8353, name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Fort, Mumbai' },
  { keywords: ['howrah railway station', 'howrah junction'], lat: 22.5839, lon: 88.3426, name: 'Howrah Junction Railway Station, Howrah, West Bengal' },

  // 🏙️ Famous City Hubs & Commercial Districts (Pan-India)
  { keywords: ['prahlad nagar', 'prahladnagar'], lat: 23.0130, lon: 72.5117, name: 'Prahlad Nagar, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['satellite ahmedabad', 'satellite area'], lat: 23.0300, lon: 72.5180, name: 'Satellite, Ahmedabad, Gujarat' },
  { keywords: ['navrangpura'], lat: 23.0360, lon: 72.5600, name: 'Navrangpura, Ahmedabad, Gujarat' },
  { keywords: ['vastrapur'], lat: 23.0350, lon: 72.5280, name: 'Vastrapur, Ahmedabad, Gujarat' },
  { keywords: ['bodakdev'], lat: 23.0400, lon: 72.5150, name: 'Bodakdev, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['sg highway', 'sarkhej gandhinagar highway'], lat: 23.0250, lon: 72.5080, name: 'S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['science city ahmedabad', 'science city'], lat: 23.0780, lon: 72.5020, name: 'Gujarat Science City, Hebatpur, Ahmedabad, Gujarat' },
  { keywords: ['connaught place', 'cp delhi'], lat: 28.6315, lon: 77.2167, name: 'Connaught Place (CP), Rajiv Chowk, New Delhi' },
  { keywords: ['cyber hub', 'cyber city gurgaon'], lat: 28.4950, lon: 77.0895, name: 'DLF Cyber City, Phase 2, Gurugram, Haryana' },
  { keywords: ['bkc', 'bandra kurla complex'], lat: 19.0657, lon: 72.8687, name: 'Bandra Kurla Complex (BKC), Bandra East, Mumbai' },
  { keywords: ['indiranagar bangalore', 'indiranagar bengaluru'], lat: 12.9784, lon: 77.6408, name: 'Indiranagar, 100 Feet Road, Bengaluru, Karnataka' },
  { keywords: ['electronic city bangalore', 'electronic city'], lat: 12.8399, lon: 77.6770, name: 'Electronic City, Bengaluru, Karnataka' },
  { keywords: ['hitec city', 'cyberabad hyderabad'], lat: 17.4435, lon: 78.3772, name: 'HITEC City, Madhapur, Hyderabad, Telangana' },
  { keywords: ['viman nagar pune'], lat: 18.5679, lon: 73.9143, name: 'Viman Nagar, Pune, Maharashtra' },
];

  // Helper function to sanitize user search query & correct common Indian city/area typos
  const sanitizeIndianQuery = (queryStr) => {
    if (!queryStr) return '';
    return queryStr
      .trim()
      .toLowerCase()
      // Fix common city spelling typos
      .replace(/\bahemadabad\b/g, 'ahmedabad')
      .replace(/\bahemdabad\b/g, 'ahmedabad')
      .replace(/\bahmadabad\b/g, 'ahmedabad')
      .replace(/\bamdavad\b/g, 'ahmedabad')
      .replace(/\bbaroda\b/g, 'vadodara')
      .replace(/\bbengaluru\b/g, 'bangalore')
      .replace(/\bgurugram\b/g, 'gurgaon')
      // Fix common word variations
      .replace(/\bvidhyarthi\b/g, 'vidyarthi')
      .replace(/\bvidhyarthi bhavan\b/g, 'vidyarthi bhavan')
      .replace(/\bk p\b/g, 'kp')
      .replace(/\bk\.p\.\b/g, 'kp')
      // Standardize acronyms
      .replace(/\blj\b/g, 'L.J.')
      .replace(/\biim\b/g, 'I.I.M.')
      .replace(/\biit\b/g, 'I.I.T.')
      .replace(/\baiims\b/g, 'A.I.I.M.S.');
  };

  const [searchError, setSearchError] = useState('');

  // Debounced live suggestion fetch on typing (Photon Fuzzy + Nominatim + Local Dictionary)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const sanitized = sanitizeIndianQuery(searchQuery);

      // 1. Check instant landmark dictionary
      const localMatches = FAMOUS_INDIAN_LANDMARKS.filter((lm) =>
        lm.keywords.some((kw) => sanitized.includes(kw) || kw.includes(sanitized) || searchQuery.toLowerCase().includes(kw))
      ).map(lm => ({
        lat: lm.lat,
        lon: lm.lon,
        display_name: lm.name,
        isLocal: true,
      }));

      const apiResults = [];

      // 2. Query Photon Fuzzy Search API (Handles typos, hostels, local places across India)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(sanitized)}&limit=6&bbox=68.0,8.0,97.0,37.0`;
        const photonRes = await fetch(photonUrl);
        if (photonRes.ok) {
          const photonData = await photonRes.json();
          if (photonData && photonData.features) {
            photonData.features.forEach(f => {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates || [];
              if (coords.length === 2) {
                const nameStr = [props.name, props.street, props.district, props.city || props.county, props.state, 'India']
                  .filter(Boolean)
                  .join(', ');
                apiResults.push({
                  lat: coords[1],
                  lon: coords[0],
                  display_name: nameStr,
                });
              }
            });
          }
        }
      } catch (err) {
        // Fallback silently to Nominatim if Photon is unreachable
      }

      // 3. Query Nominatim API with India restriction
      if (apiResults.length < 3) {
        try {
          const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitized)}&countrycodes=in&addressdetails=1&limit=5`;
          const nomRes = await fetch(nomUrl, {
            headers: { 'Accept-Language': 'en-US,en;q=0.9' },
          });

          if (nomRes.ok) {
            const nomData = await nomRes.json();
            (nomData || []).forEach(item => {
              if (!apiResults.some(r => Math.abs(parseFloat(r.lat) - parseFloat(item.lat)) < 0.003 && Math.abs(parseFloat(r.lon) - parseFloat(item.lon)) < 0.003)) {
                apiResults.push(item);
              }
            });
          }
        } catch (e) {}
      }

      // Merge local dictionary matches + API results without duplicates
      const combined = [...localMatches];
      apiResults.forEach(item => {
        if (!combined.some(c => Math.abs(parseFloat(c.lat) - parseFloat(item.lat)) < 0.003 && Math.abs(parseFloat(c.lon) - parseFloat(item.lon)) < 0.003)) {
          combined.push(item);
        }
      });

      setSearchResults(combined);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Universal Multi-Engine Search Area Execution (Handles hostels, typos, streets, and areas across all of India)
  const executeAreaSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');

    const rawQuery = searchQuery.trim();
    const sanitized = sanitizeIndianQuery(rawQuery);

    // Strategy 1: Local Instant Dictionary Lookup
    const matchedLandmark = FAMOUS_INDIAN_LANDMARKS.find((lm) =>
      lm.keywords.some((kw) => sanitized.includes(kw) || kw.includes(sanitized) || rawQuery.toLowerCase().includes(kw))
    );

    if (matchedLandmark) {
      const landmarkResult = {
        lat: matchedLandmark.lat,
        lon: matchedLandmark.lon,
        display_name: matchedLandmark.name,
      };
      setSearchResults([landmarkResult]);
      handleSelectSearchResult(landmarkResult);
      setIsSearching(false);
      return;
    }

    let collectedResults = [];

    // Strategy 2: Photon OpenStreetMap Fuzzy Search Engine (Handles local hostels, shops, buildings, and typos)
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(sanitized)}&limit=6&bbox=68.0,8.0,97.0,37.0`;
      const photonRes = await fetch(photonUrl);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData && photonData.features && photonData.features.length > 0) {
          photonData.features.forEach(f => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates || [];
            if (coords.length === 2) {
              const nameStr = [props.name, props.street, props.district, props.city || props.county, props.state, 'India']
                .filter(Boolean)
                .join(', ');
              collectedResults.push({
                lat: coords[1],
                lon: coords[0],
                display_name: nameStr,
              });
            }
          });
        }
      }
    } catch (e) {}

    // Strategy 3: Query Nominatim with progressive query fallback variations
    if (collectedResults.length === 0) {
      try {
        // Build progressive query variations (e.g., full sanitized, without typos, extracted key words)
        const searchQueries = [
          `${sanitized}, India`,
          `${rawQuery}, India`,
          sanitized.replace(/ahmedabad|mumbai|delhi|bangalore|hyderabad|chennai|kolkata|pune|vadodara/g, '').trim() + ', India',
          rawQuery
        ].filter(Boolean);

        for (const q of searchQueries) {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&addressdetails=1&limit=5`;
          const res = await fetch(url, {
            headers: { 'Accept-Language': 'en-US,en;q=0.9' },
          });

          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              collectedResults = data;
              break;
            }
          }
        }
      } catch (err) {
        console.error('Search area error:', err);
      }
    }

    if (collectedResults && collectedResults.length > 0) {
      setSearchResults(collectedResults);
      handleSelectSearchResult(collectedResults[0]);
    } else {
      setSearchError(`No locations found for "${searchQuery}". Please check the spelling or enter your city name (e.g. "${searchQuery}, Ahmedabad").`);
    }

    setIsSearching(false);
  };

  const handleSelectSearchResult = (result) => {
    if (!result) return;
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;

    if (onLocationChange) onLocationChange(roundedLat, roundedLng);
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([roundedLat, roundedLng]);
      mapInstanceRef.current.flyTo([roundedLat, roundedLng], 14, { duration: 1.2 });
    }

    // Clean address format
    const nameParts = result.display_name ? result.display_name.split(',') : [];
    const cleanAddress = nameParts.length > 0 ? nameParts.slice(0, 3).join(',').trim() : result.display_name;
    setAddressName(cleanAddress);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError('');
  };

  return (
    <div className="flex flex-col gap-3 w-full font-sans">
      {/* Top Search & GPS Control Bar */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        {/* Search Area Bar (div container, not form) */}
        <div className="relative flex-1 w-full">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
            <input
              type="text"
              placeholder="Search area, landmark, or street name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  executeAreaSearch();
                }
              }}
              className="w-full pl-10 pr-20 py-2.5 bg-white rounded-xl border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={executeAreaSearch}
              disabled={isSearching}
              className="absolute right-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left px-3.5 py-2.5 text-xs text-slate-800 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detect GPS Location Button */}
        <button
          type="button"
          onClick={handleGPSDetect}
          disabled={isLocating}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          <span>{isLocating ? 'Detecting Location...' : 'Use My Current GPS Location'}</span>
        </button>
      </div>

      {searchError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl font-medium">
          ⚠️ {searchError}
        </div>
      )}

      {/* Selected Address Display Badge (Non-technical format) */}
      <div className="bg-indigo-50/80 border border-indigo-200/80 p-3 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Selected Base Location</span>
            <p className="text-xs font-bold text-slate-900 truncate">
              {isGeocoding ? 'Loading address name...' : addressName || 'Click map or search area to set your location'}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Active Pin</span>
        </span>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[360px] min-h-[360px] rounded-3xl overflow-hidden border border-slate-300 shadow-md bg-slate-100 z-0">
        <div ref={mapContainerRef} className="w-full h-full min-h-[360px] z-0" />
      </div>
      <p className="text-[11px] text-slate-500 font-medium text-center">
        📍 <span className="font-semibold text-slate-700">How to use:</span> Click anywhere on the map or drag the blue pin to your service shop/area location.
      </p>

      {onConfirm && (
        <button
          type="button"
          onClick={() => onConfirm(addressName, latitude, longitude)}
          className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Confirm & Apply Location</span>
          <span>✓</span>
        </button>
      )}
    </div>
  );
};

export default LocationPickerMap;
