import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Phone,
  Navigation,
  Map as MapIcon,
  List,
  X,
  Search,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  HeartPulse,
  Star,
  Activity,
  Clock,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import AppMapView, { Marker, PROVIDER_GOOGLE } from '../../src/components/MapWrapper';
import { searchHospitals, getNearbyHospitals } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { colors, radius, spacing, shadows, fontWeights } from '../../src/theme';
import { t } from '../../src/i18n';
import AnimatedPressable from '../../src/components/AnimatedPressable';

// --- Types ---
type Hospital = {
  id: string;
  name: string;
  type: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  departments: string[];
  rating: number;
  is_24_7: boolean;
  distance_m?: number;
};

const FILTER_OPTIONS = [500, 1000, 2000, 5000];

// Default Istanbul coordinates
const DEFAULT_LOC = { lat: 41.0082, lon: 28.9784 };

const FALLBACK_CITIES = [
  { name: 'İstanbul', slug: 'istanbul' },
  { name: 'Ankara', slug: 'ankara' },
  { name: 'İzmir', slug: 'izmir' },
  { name: 'Bursa', slug: 'bursa' },
  { name: 'Antalya', slug: 'antalya' },
  { name: 'Adana', slug: 'adana' },
  { name: 'Konya', slug: 'konya' },
  { name: 'Gaziantep', slug: 'gaziantep' },
  { name: 'Kocaeli', slug: 'kocaeli' },
  { name: 'Mersin', slug: 'mersin' },
];

const FALLBACK_DISTRICTS: Record<string, { name: string; slug: string }[]> = {
  istanbul: [
    { name: 'Kadıköy', slug: 'kadikoy' }, { name: 'Fatih', slug: 'fatih' },
    { name: 'Beşiktaş', slug: 'besiktas' }, { name: 'Şişli', slug: 'sisli' },
    { name: 'Üsküdar', slug: 'uskudar' }, { name: 'Esenyurt', slug: 'esenyurt' },
    { name: 'Bakırköy', slug: 'bakirkoy' }, { name: 'Maltepe', slug: 'maltepe' }
  ],
  ankara: [
    { name: 'Çankaya', slug: 'cankaya' }, { name: 'Keçiören', slug: 'kecioren' },
    { name: 'Yenimahalle', slug: 'yenimahalle' }, { name: 'Mamak', slug: 'mamak' },
    { name: 'Etimesgut', slug: 'etimesgut' }
  ],
  izmir: [
    { name: 'Konak', slug: 'konak' }, { name: 'Karşıyaka', slug: 'karsiyaka' },
    { name: 'Bornova', slug: 'bornova' }, { name: 'Buca', slug: 'buca' },
    { name: 'Çeşme', slug: 'cesme' }
  ]
};

const SkeletonCard = () => {
  const animatedValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: animatedValue }]}>
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,0,0,0.05)' }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: '70%', height: 16, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 }} />
        <View style={{ width: '90%', height: 12, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 }} />
        <View style={{ width: '40%', height: 12, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1, height: 32, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 16 }} />
          <View style={{ flex: 1, height: 32, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 16 }} />
        </View>
      </View>
    </Animated.View>
  );
};

export default function HospitalsScreen() {
  const { language } = useAuth();
  const L = t(language);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchMode, setSearchMode] = useState<'gps' | 'city'>('gps');
  const [radiusM, setRadiusM] = useState(2000);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [textQuery, setTextQuery] = useState('');
  const mapRef = useRef<any>(null);

  // Search & Dropdown States
  const [selectedCity, setSelectedCity] = useState<{ name: string; slug: string } | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<{ name: string; slug: string } | null>(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocDenied(true);
        return DEFAULT_LOC;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setCoords(c);
      setLocDenied(false);
      return c;
    } catch {
      setLocDenied(true);
      return DEFAULT_LOC;
    }
  };

  // Main Query
  const { data: list = [], isLoading, isError, error, refetch, isRefetching } = useQuery<Hospital[]>({
    queryKey: ['hospitals', searchMode, radiusM, selectedCity?.slug, selectedDistrict?.slug, textQuery],
    queryFn: async () => {
      if (searchMode === 'gps') {
        let c = coords;
        if (!c) {
          c = await fetchLocation();
        }
        const res = await getNearbyHospitals({
          lat: c.lat,
          lon: c.lon,
          radius_m: radiusM,
          query: textQuery.trim() || undefined,
        });
        return res.data;
      } else {
        if (!selectedCity) return [];
        const res = await searchHospitals({
          city: selectedCity.name,
          district: selectedDistrict?.name || undefined,
          query: textQuery.trim() || undefined,
        });
        return res.data;
      }
    },
    enabled: searchMode === 'gps' || !!selectedCity,
    staleTime: 1000 * 60 * 5,
  });

  const handleCall = (phone: string) => {
    if (!phone) return Alert.alert(L.error, language === 'tr' ? 'Telefon numarası bulunamadı' : 'Phone number not found');
    const url = `tel:${phone.replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => Alert.alert(L.error, 'Cannot open dialer'));
  };

  const handleDirections = (h: Hospital) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${h.name}@${h.latitude},${h.longitude}`,
      android: `geo:0,0?q=${h.latitude},${h.longitude}(${h.name})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`
    });
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert(L.error, 'Harita uygulaması açılamadı'));
    }
  };

  // Center map on search results
  useEffect(() => {
    if (viewMode === 'map' && list.length > 0 && mapRef.current) {
      const first = list[0];
      if (first.latitude && first.longitude) {
        mapRef.current.animateToRegion({
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: searchMode === 'gps' ? 0.04 : 0.08,
          longitudeDelta: searchMode === 'gps' ? 0.04 : 0.08,
        }, 1000);
      }
    }
  }, [list, viewMode, searchMode]);

  // Dropdown list filters
  const filteredCities = useMemo(() => {
    return FALLBACK_CITIES.filter((c) =>
      c.name.toLowerCase().includes(citySearch.toLowerCase())
    );
  }, [citySearch]);

  const filteredDistricts = useMemo(() => {
    if (!selectedCity) return [];
    const distList = FALLBACK_DISTRICTS[selectedCity.slug] || [{ name: 'Merkez', slug: 'merkez' }];
    return distList.filter((d) =>
      d.name.toLowerCase().includes(districtSearch.toLowerCase())
    );
  }, [selectedCity, districtSearch]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{L.hospitals || 'Hastaneler'}</Text>
          {locDenied && searchMode === 'gps' && (
            <Text style={styles.locDenied}>
              {language === 'tr' ? 'Varsayılan İstanbul konumu kullanılıyor' : 'Using default Istanbul location'}
            </Text>
          )}
        </View>

        <View style={styles.viewToggle}>
          <AnimatedPressable
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
            disableHaptic
          >
            <List size={20} color={viewMode === 'list' ? colors.textMain : colors.textMuted} />
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
            onPress={() => setViewMode('map')}
            disableHaptic
          >
            <MapIcon size={20} color={viewMode === 'map' ? colors.textMain : colors.textMuted} />
          </AnimatedPressable>
        </View>
      </View>

      {/* TEXT QUERY INPUT */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={L.searchHospital || 'Hastane arayın...'}
          value={textQuery}
          onChangeText={setTextQuery}
          placeholderTextColor={colors.textMuted}
        />
        {textQuery.length > 0 && (
          <TouchableOpacity onPress={() => setTextQuery('')}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* SEARCH MODE SELECTOR */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeTab, searchMode === 'gps' && styles.modeTabActive]}
          onPress={() => setSearchMode('gps')}
        >
          <MapPin size={16} color={searchMode === 'gps' ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeTabText, searchMode === 'gps' && styles.modeTabTextActive]}>
            {L.nearbyHospitals || 'Yakınımdakiler'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, searchMode === 'city' && styles.modeTabActive]}
          onPress={() => {
            setSearchMode('city');
            if (!selectedCity) {
              setCityModalVisible(true);
            }
          }}
        >
          <Search size={16} color={searchMode === 'city' ? '#fff' : colors.textMuted} />
          <Text style={[styles.modeTabText, searchMode === 'city' && styles.modeTabTextActive]}>
            {language === 'tr' ? 'İl/İlçe Seç' : 'Select City'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CITY & DISTRICT CHIPS */}
      {searchMode === 'city' && (
        <View style={styles.dropdownsRow}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => {
              setCitySearch('');
              setCityModalVisible(true);
            }}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {selectedCity ? selectedCity.name : (L.selectCity || 'İl Seçin')}
            </Text>
            <ChevronDown size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropdownBtn, !selectedCity && styles.dropdownBtnDisabled]}
            disabled={!selectedCity}
            onPress={() => {
              setDistrictSearch('');
              setDistrictModalVisible(true);
            }}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {selectedDistrict ? selectedDistrict.name : (L.selectDistrict || 'İlçe Seçin')}
            </Text>
            <ChevronDown size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* RADIUS (ONLY GPS MODE) */}
      {searchMode === 'gps' && (
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((r) => (
            <AnimatedPressable
              key={r}
              style={[styles.filterChip, radiusM === r && styles.filterChipActive]}
              onPress={() => setRadiusM(r)}
            >
              <Text style={[styles.filterText, radiusM === r && styles.filterTextActive]}>
                {r < 1000 ? `${r}m` : `${r / 1000}km`}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      )}

      {/* BODY CONTENT */}
      {isLoading && list.length === 0 && viewMode === 'list' ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <View style={styles.centerState}>
          <AlertCircle size={48} color={colors.error} style={{ marginBottom: spacing.md }} />
          <Text style={styles.centerTitle}>{language === 'tr' ? 'Hata Oluştu' : 'Error Occurred'}</Text>
          <Text style={styles.centerSub}>
            {(error as any)?.response?.data?.detail || error.message || 'Hastaneler yüklenemedi'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <RefreshCw size={16} color="#fff" />
            <Text style={styles.retryBtnText}>{language === 'tr' ? 'Yeniden Dene' : 'Try Again'}</Text>
          </TouchableOpacity>
        </View>
      ) : searchMode === 'city' && !selectedCity ? (
        <View style={styles.centerState}>
          <Search size={48} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
          <Text style={styles.centerTitle}>{L.findHospital || 'Hastane Bul'}</Text>
          <Text style={styles.centerSub}>
            {language === 'tr' ? 'Hastaneleri listelemek için lütfen yukarıdan il seçin.' : 'Please select a city from above to search.'}
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => setCityModalVisible(true)}>
            <Text style={styles.retryBtnText}>{L.selectCity || 'İl Seçin'}</Text>
          </TouchableOpacity>
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centerState}>
          <HeartPulse size={48} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
          <Text style={styles.centerTitle}>{L.noHospitals || 'Hastane Bulunamadı'}</Text>
          <Text style={styles.centerSub}>
            {language === 'tr' ? 'Arama kriterlerinize uygun hastane kaydı bulunamadı.' : 'No hospitals found matching your criteria.'}
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <RefreshCw size={16} color="#fff" />
            <Text style={styles.retryBtnText}>{language === 'tr' ? 'Yenile' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'map' && Platform.OS !== 'web' ? (
        <View style={{ flex: 1, position: 'relative' }}>
          <AppMapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: coords?.lat || DEFAULT_LOC.lat,
              longitude: coords?.lon || DEFAULT_LOC.lon,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
            showsUserLocation={searchMode === 'gps'}
            onPress={() => setSelectedHospital(null)}
          >
            {list.map((h) => {
              if (!h.latitude || !h.longitude) return null;
              return (
                <Marker
                  key={h.id}
                  coordinate={{ latitude: h.latitude, longitude: h.longitude }}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedHospital(h);
                  }}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.markerIconBg}>
                      <HeartPulse size={16} color={colors.error} />
                    </View>
                    <Text style={styles.markerName} numberOfLines={1}>{h.name}</Text>
                  </View>
                </Marker>
              );
            })}
          </AppMapView>

          {isRefetching && (
            <View style={styles.mapLoadingOverlay}>
              <RefreshCw size={16} color={colors.primary} />
            </View>
          )}

          {selectedHospital && (
            <View style={styles.mapBottomCard}>
              <TouchableOpacity style={styles.closeCardBtn} onPress={() => setSelectedHospital(null)}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.name}>{selectedHospital.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{selectedHospital.type}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Star size={12} color={colors.warning} fill={colors.warning} style={{ marginRight: 2 }} />
                  <Text style={styles.ratingText}>{selectedHospital.rating}</Text>
                </View>
              </View>
              <Text style={styles.addr} numberOfLines={1}>{selectedHospital.address}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(selectedHospital.phone)}>
                  <Phone size={14} color={colors.textMain} />
                  <Text style={styles.callText}>{L.call}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mapBtn} onPress={() => handleDirections(selectedHospital)}>
                  <Navigation size={14} color={colors.primary} />
                  <Text style={styles.mapText}>{language === 'tr' ? 'Yol Tarifi' : 'Directions'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.textMuted} />
          }
          renderItem={({ item, index }) => (
            <Animated.View style={styles.card}>
              {/* Top Details */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={styles.iconWrap}>
                  <HeartPulse size={24} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Star size={14} color={colors.warning} fill={colors.warning} />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{item.type}</Text>
                    </View>
                    {item.is_24_7 && (
                      <View style={styles.openBadge}>
                        <Clock size={10} color={colors.success} style={{ marginRight: 2 }} />
                        <Text style={styles.openBadgeText}>{L.is247 || '7/24 Açık'}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.addr}>{item.address}</Text>

                  {/* Departments */}
                  <View style={styles.departmentsContainer}>
                    <Text style={styles.departmentsTitle}>{L.departments || 'Bölümler'}:</Text>
                    <View style={styles.deptChipsRow}>
                      {item.departments.map((d, i) => (
                        <View key={i} style={styles.deptChip}>
                          <Text style={styles.deptChipText}>{d}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item.phone)}>
                      <Phone size={14} color={colors.textMain} />
                      <Text style={styles.callText}>{L.call}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.mapBtn} onPress={() => handleDirections(item)}>
                      <Navigation size={14} color={colors.primary} />
                      <Text style={styles.mapText}>{language === 'tr' ? 'Yol Tarifi' : 'Directions'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        />
      )}

      {/* CITY MODAL */}
      <Modal visible={cityModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={45} style={StyleSheet.absoluteFill} tint="dark" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
          )}
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{L.selectCity || 'İl Seçin'}</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <X size={20} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearch}>
              <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={language === 'tr' ? 'İl adı arayın...' : 'Search city...'}
                value={citySearch}
                onChangeText={setCitySearch}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item.slug}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedCity?.slug === item.slug && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedCity(item);
                    setSelectedDistrict(null);
                    setCityModalVisible(false);
                    setDistrictSearch('');
                    setTimeout(() => setDistrictModalVisible(true), 300);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedCity?.slug === item.slug && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* DISTRICT MODAL */}
      <Modal visible={districtModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={45} style={StyleSheet.absoluteFill} tint="dark" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
          )}
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedCity?.name} - {L.selectDistrict || 'İlçe Seçin'}
              </Text>
              <TouchableOpacity onPress={() => setDistrictModalVisible(false)}>
                <X size={20} color={colors.textMain} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearch}>
              <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={language === 'tr' ? 'İlçe adı arayın...' : 'Search district...'}
                value={districtSearch}
                onChangeText={setDistrictSearch}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <FlatList
              data={filteredDistricts}
              keyExtractor={(item) => item.slug}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedDistrict?.slug === item.slug && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedDistrict(item);
                    setDistrictModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedDistrict?.slug === item.slug && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeights.extrabold,
    color: colors.textMain,
    letterSpacing: -0.5,
  },
  locDenied: {
    fontSize: 11,
    color: colors.warning,
    marginTop: 2,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  toggleBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textMain,
    padding: 0,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.sm,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: '#fff',
  },
  dropdownsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.xs,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    ...shadows.card,
  },
  dropdownBtnDisabled: {
    opacity: 0.5,
  },
  dropdownBtnText: {
    fontSize: 13,
    fontWeight: fontWeights.semibold,
    color: colors.textMain,
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipActive: {
    backgroundColor: colors.secondary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.textMain,
  },
  listScroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xs,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...shadows.card,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: fontWeights.bold,
    color: colors.textMain,
    flex: 1,
    flexWrap: 'wrap',
    paddingRight: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: fontWeights.bold,
    color: colors.textMain,
  },
  typeBadge: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: fontWeights.bold,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  openBadgeText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: fontWeights.bold,
  },
  addr: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  departmentsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    paddingTop: 8,
  },
  departmentsTitle: {
    fontSize: 12,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    marginBottom: 4,
  },
  deptChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  deptChip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  deptChipText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fontWeights.medium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    paddingVertical: 9,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  callText: {
    color: colors.textMain,
    fontWeight: fontWeights.bold,
    fontSize: 13,
  },
  mapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5FA',
    paddingVertical: 9,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  mapText: {
    color: colors.primary,
    fontWeight: fontWeights.bold,
    fontSize: 13,
  },
  // Map layouts
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  markerName: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.textMain,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 20,
    ...shadows.card,
  },
  mapBottomCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...shadows.card,
    overflow: 'hidden',
  },
  closeCardBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    minHeight: '60%',
    maxHeight: '85%',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: fontWeights.extrabold,
    color: colors.textMain,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: spacing.md,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalItemActive: {
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  modalItemText: {
    fontSize: 15,
    color: colors.textMain,
    fontWeight: fontWeights.medium,
  },
  modalItemTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: fontWeights.bold,
    color: colors.textMain,
    marginBottom: 4,
  },
  centerSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.error,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: fontWeights.bold,
    fontSize: 14,
  },
});
