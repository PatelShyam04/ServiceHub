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

// Famous Indian Landmarks & Educational Institutions Quick-Lookup Dictionary
const FAMOUS_INDIAN_LANDMARKS = [
  { keywords: ['lj university', 'lj college', 'lj institute', 'lj campus', 'lok jagruti', 'lj engineering'], lat: 22.9878, lon: 72.5020, name: 'L.J. University Campus, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['iim ahmedabad', 'iim-a', 'iim campus', 'iim vastrapur'], lat: 23.0315, lon: 72.5312, name: 'Indian Institute of Management (IIM), Vastrapur, Ahmedabad, Gujarat' },
  { keywords: ['nirma university', 'nirma college', 'nirma campus'], lat: 23.1287, lon: 72.5445, name: 'Nirma University, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['gujarat university', 'gu campus'], lat: 23.0371, lon: 72.5444, name: 'Gujarat University, Navrangpura, Ahmedabad, Gujarat' },
  { keywords: ['parul university'], lat: 22.2887, lon: 73.3634, name: 'Parul University, Vadodara, Gujarat' },
  { keywords: ['gtu', 'gujarat technological university'], lat: 23.1060, lon: 72.5950, name: 'Gujarat Technological University (GTU), Chandkheda, Ahmedabad' },
  { keywords: ['ahmedabad airport', 'svpi airport', 'airport ahmedabad'], lat: 23.0772, lon: 72.6347, name: 'Sardar Vallabhbhai Patel International Airport, Ahmedabad' },
  { keywords: ['kalupur railway station', 'ahmedabad railway station'], lat: 23.0232, lon: 72.6006, name: 'Ahmedabad Junction Railway Station, Kalupur, Ahmedabad' },
  { keywords: ['prahlad nagar', 'prahladnagar'], lat: 23.0130, lon: 72.5117, name: 'Prahlad Nagar, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['satellite ahmedabad', 'satellite area'], lat: 23.0300, lon: 72.5180, name: 'Satellite, Ahmedabad, Gujarat' },
  { keywords: ['navrangpura'], lat: 23.0360, lon: 72.5600, name: 'Navrangpura, Ahmedabad, Gujarat' },
  { keywords: ['vastrapur'], lat: 23.0350, lon: 72.5280, name: 'Vastrapur, Ahmedabad, Gujarat' },
  { keywords: ['bodakdev'], lat: 23.0400, lon: 72.5150, name: 'Bodakdev, S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['sg highway', 'sarkhej gandhinagar highway'], lat: 23.0250, lon: 72.5080, name: 'S.G. Highway, Ahmedabad, Gujarat' },
  { keywords: ['science city ahmedabad', 'science city'], lat: 23.0780, lon: 72.5020, name: 'Gujarat Science City, Hebatpur, Ahmedabad, Gujarat' },
];

  const [searchError, setSearchError] = useState('');

  // Multi-Strategy Search Area Query (Instant Landmark Dictionary + Acronym Dotted Query + India Nominatim Fallback)
  const executeAreaSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);

    const cleanQuery = searchQuery.trim().toLowerCase();

    // Strategy 1: Check Famous Indian Landmark Dictionary
    const matchedLandmark = FAMOUS_INDIAN_LANDMARKS.find((lm) =>
      lm.keywords.some((kw) => cleanQuery.includes(kw) || kw.includes(cleanQuery))
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

    // Strategy 2: Query Nominatim with Dotted Acronym Variations & India Restriction
    try {
      const dottedQuery = cleanQuery.replace(/\blj\b/gi, 'L.J.').replace(/\biim\b/gi, 'I.I.M.');
      const searchQueries = [
        `${dottedQuery}, India`,
        `${cleanQuery}, India`,
        cleanQuery
      ];

      let results = [];
      for (const q of searchQueries) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&addressdetails=1&limit=5`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            results = data;
            break;
          }
        }
      }

      // Strategy 3: Global Nominatim Fallback
      if (!results || results.length === 0) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&addressdetails=1&limit=5`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en-US,en;q=0.9' },
        });
        if (res.ok) {
          results = await res.json();
        }
      }

      if (results && results.length > 0) {
        setSearchResults(results);
        handleSelectSearchResult(results[0]);
      } else {
        setSearchError(`No locations found for "${searchQuery}". Please check the spelling or add your city name (e.g. "${searchQuery}, Ahmedabad").`);
      }
    } catch (err) {
      console.error('Search area error:', err);
      setSearchError('Unable to perform search. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
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
