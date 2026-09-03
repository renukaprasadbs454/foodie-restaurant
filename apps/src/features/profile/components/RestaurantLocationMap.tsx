import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'foodie-shared-rn';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { formatCoordinates, isValidCoordinate } from '../location/locationTypes';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBef3prJr9YvHFDYczEJ-mzZfSlLd2vHbE';

if (Platform.OS === 'web') {
  // Fix for blank map on web using teovilla
  try {
    const { default: WebMap } = require('@teovilla/react-native-web-maps');
    WebMap.init({ apiKey: GOOGLE_MAPS_API_KEY });
  } catch (e) {
    console.error('Failed to init react-native-web-maps', e);
  }
}

interface Props {
  latitude: number;
  longitude: number;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: number;
}

const MARKER_COLOR = '#F59E0B'; // Amber Accent Color

export function RestaurantLocationMap({
  latitude,
  longitude,
  onLocationSelect,
  height = 280,
}: Props) {
  const mapRef = useRef<MapView>(null);

  // Safe validation fallback to default Bengaluru coordinates (NEVER NaN)
  const safeLat = isValidCoordinate(latitude, longitude) ? Number(latitude) : 12.9352;
  const safeLng = isValidCoordinate(latitude, longitude) ? Number(longitude) : 77.6245;
  const [zoomLevel, setZoomLevel] = useState(15);

  const handleRecenter = () => {
    mapRef.current?.animateToRegion({
      latitude: safeLat,
      longitude: safeLng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    onLocationSelect(safeLat, safeLng);
  };

  const handleZoomIn = () => {
    mapRef.current?.animateCamera({ zoom: Math.min(zoomLevel + 1, 20) });
    setZoomLevel((prev) => Math.min(prev + 1, 20));
  };

  const handleZoomOut = () => {
    mapRef.current?.animateCamera({ zoom: Math.max(zoomLevel - 1, 5) });
    setZoomLevel((prev) => Math.max(prev - 1, 5));
  };

  return (
    <View style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#E2E8F0', position: 'relative' }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: safeLat,
          longitude: safeLng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={(e) => {
          if (e.nativeEvent.coordinate) {
            onLocationSelect(
              e.nativeEvent.coordinate.latitude,
              e.nativeEvent.coordinate.longitude
            );
          }
        }}
      >
        <Marker
          coordinate={{ latitude: safeLat, longitude: safeLng }}
          draggable
          onDragEnd={(e) => {
            onLocationSelect(
              e.nativeEvent.coordinate.latitude,
              e.nativeEvent.coordinate.longitude
            );
          }}
          pinColor={MARKER_COLOR}
          title="Restaurant Location"
        />
      </MapView>

      {/* TOP-LEFT COORDINATES BANNER OVERLAY - NEVER DISPLAYS NaN */}
      <View style={styles.coordOverlay} pointerEvents="none">
        <Text style={{ color: MARKER_COLOR, fontSize: 11, fontWeight: '700' }}>
          ● Google Maps
        </Text>
        <Text style={{ color: '#F8FAFC', fontSize: 11, fontWeight: '600' }}>
          {formatCoordinates(safeLat, safeLng)}
        </Text>
      </View>

      {/* FUNCTIONAL ZOOM & RECENTER CONTROLS */}
      <View style={styles.controlsContainer} pointerEvents="box-none">
        <Pressable
          onPress={handleRecenter}
          style={({ pressed }) => [styles.controlButton, pressed && { backgroundColor: '#FEF3C7' }]}
        >
          <Text style={{ fontSize: 16 }}>🎯</Text>
        </Pressable>
        <Pressable
          onPress={handleZoomIn}
          style={({ pressed }) => [styles.controlButton, pressed && { backgroundColor: '#FEF3C7' }]}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>+</Text>
        </Pressable>
        <Pressable
          onPress={handleZoomOut}
          style={({ pressed }) => [styles.controlButton, pressed && { backgroundColor: '#FEF3C7' }]}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>−</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeFallbackContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    gap: 8,
    zIndex: 20,
  },
  controlButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
