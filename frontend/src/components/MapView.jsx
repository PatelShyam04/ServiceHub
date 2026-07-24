import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Star, ShieldCheck } from 'lucide-react';

// Default center coordinates (Mumbai default)
const DEFAULT_CENTER = [19.0760, 72.8777];

// Haversine formula to compute distance in km between two lat/lng pairs
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const MapView = ({ providers = [], onSelectProvider, selectedCity = '' }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState('all');
  const [geoError, setGeoError] = useState('');

  // Fix default marker icon assets for Leaflet in bundlers
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  // Initialize Map Instance once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      zoomControl: true,
    });

    // Add OpenStreetMap tile layer (CartoDB voyager for modern light aesthetic)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle GPS "Locate Me" button click
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = [latitude, longitude];
        setUserLocation(coords);
        setIsLocating(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(coords, 13, { duration: 1.2 });
        }
      },
      (err) => {
        setIsLocating(false);
        setGeoError('Unable to fetch your GPS position. Please allow location permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Render & update markers whenever providers, location, or distance filters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Add User Location Marker if active
    if (userLocation) {
      const userHtml = `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
          <div class="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
            You
          </div>
        </div>
      `;
      const userIcon = L.divIcon({
        html: userHtml,
        className: 'custom-user-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker(userLocation, { icon: userIcon })
        .addTo(layerGroup)
        .bindPopup('<div class="font-sans font-bold text-xs p-1 text-slate-800">Your Current GPS Location</div>');
    }

    const bounds = L.latLngBounds();

    // Filter providers with coordinates and distance constraint
    const validProviders = providers.filter((p) => {
      if (!p.provider_latitude || !p.provider_longitude) return false;
      if (userLocation && maxDistanceKm !== 'all') {
        const dist = calculateDistanceKm(
          userLocation[0],
          userLocation[1],
          p.provider_latitude,
          p.provider_longitude
        );
        if (dist !== null && dist > parseFloat(maxDistanceKm)) return false;
      }
      return true;
    });

    validProviders.forEach((ps) => {
      const lat = ps.provider_latitude;
      const lng = ps.provider_longitude;
      bounds.extend([lat, lng]);

      const dist = userLocation
        ? calculateDistanceKm(userLocation[0], userLocation[1], lat, lng)
        : null;

      // Custom marker pill displaying price
      const pricePillHtml = `
        <div class="group cursor-pointer transform hover:scale-110 transition-all duration-200">
          <div class="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg border-2 border-white flex items-center gap-1 hover:bg-indigo-700">
            <span>₹${ps.price}/hr</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: pricePillHtml,
        className: 'custom-provider-pin',
        iconSize: [70, 30],
        iconAnchor: [35, 15],
      });

      // Build rich HTML popup content
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1 font-sans min-w-[240px] text-slate-900';

      const initial = (ps.provider_first_name || 'E')[0].toUpperCase();
      const ratingVal = ps.average_rating ? ps.average_rating.toFixed(1) : 'New';

      popupDiv.innerHTML = `
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center gap-3">
            ${
              ps.provider_profile_picture
                ? `<img src="${ps.provider_profile_picture}" class="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500/20 shrink-0" />`
                : `<div class="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-lg flex items-center justify-center shrink-0 border border-indigo-200">${initial}</div>`
            }
            <div class="min-w-0 flex-1">
              <h4 class="font-bold text-sm text-slate-900 leading-tight flex items-center gap-1">
                ${ps.provider_first_name || ''} ${ps.provider_last_name || ''}
                ${ps.provider_verified ? '<span class="text-indigo-600 text-xs font-extrabold" title="Verified">✓</span>' : ''}
              </h4>
              <p class="text-xs text-slate-500 font-medium truncate mt-0.5">${ps.service_details?.name || 'Professional Service'}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                  ★ ${ratingVal}
                </span>
                <span class="text-[11px] text-slate-400 font-medium">(${ps.review_count || 0} reviews)</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span class="font-bold text-indigo-700 text-sm">₹${ps.price}<span class="text-[11px] font-normal text-slate-400">/hr</span></span>
            ${ps.provider_city ? `<span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">📍 ${ps.provider_city}</span>` : ''}
          </div>

          ${dist !== null ? `<p class="text-[11px] text-emerald-600 font-semibold">📍 Approx. ${dist} km from you</p>` : ''}

          <button id="book-btn-${ps.id}" class="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
            <span>Book Expert</span>
            <span>→</span>
          </button>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(layerGroup);
      const popup = L.popup({ closeButton: true, maxWidth: 280 }).setContent(popupDiv);
      marker.bindPopup(popup);

      // Attach click event to the dynamically generated "Book Expert" button inside popup
      marker.on('popupopen', () => {
        const btn = document.getElementById(`book-btn-${ps.id}`);
        if (btn) {
          btn.onclick = () => {
            if (onSelectProvider) onSelectProvider(ps);
          };
        }
      });
    });

    // Automatically adjust map zoom/bounds to show all markers
    if (validProviders.length > 0 && map) {
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [providers, userLocation, maxDistanceKm]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Map Control Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Interactive Experts Map</h4>
            <p className="text-[11px] text-slate-500">
              Showing <span className="font-bold text-indigo-600">{providers.filter(p => p.provider_latitude).length}</span> experts on map
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Distance Filter */}
          {userLocation && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-semibold">Radius:</span>
              <select
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Distances</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
              </select>
            </div>
          )}

          {/* Locate Me GPS Button */}
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating...' : userLocation ? 'GPS Active' : 'Locate Me'}</span>
          </button>
        </div>
      </div>

      {geoError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-medium">
          ⚠️ {geoError}
        </div>
      )}

      {/* Map Container */}
      <div className="relative w-full h-[480px] rounded-3xl overflow-hidden border border-slate-200 shadow-md">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>
    </div>
  );
};

export default MapView;
