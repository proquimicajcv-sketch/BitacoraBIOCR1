import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  SpecimenRecord,
  TaxonGroup,
  BioacousticRecord,
  PhotoRecord,
  SightingEntry,
  SympatricSpecies,
  TAXON_GROUPS_REGISTRY,
  getTaxonMeta,
} from '../types/specimen';
import { CostaRicaMap } from './CostaRicaMap';
import {
  COSTA_RICA_HOTSPOTS,
  HOLDRIDGE_LIFE_ZONES_CR,
  estimateHoldridgeZone,
  formatCoordinatesDMS,
  findNearestHotspot,
  detectLocationAndLifeZone,
} from '../data/costaRicaData';
import { saveImageOfflineAndServer, handleImageOfflineFallback } from '../utils/offlineImageCache';
import { compressDataUrl } from '../utils/imageCompress';

interface NewSpecimenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (specimen: SpecimenRecord) => void;
  onDelete?: (id: string) => void;
  initialCoords?: { lat: number; lng: number; locality?: string; lifeZone?: string };
  editingSpecimen?: SpecimenRecord | null;
  defaultCollector?: string;
}

const SAMPLE_FIELD_IMAGES = [
  {
    name: 'Rana de las Nacientes (Los Santos)',
    url: '/isthmohyla_nacientes.jpg',
  },
  {
    name: 'Salamandra (Tapantí)',
    url: '/bolitoglossa_colonnea.jpg',
  },
  {
    name: 'Rana Ojos Rojos (Sarapiquí)',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvI7_6fTqgfYbPLKbGn0dFeW7hmnuRolqzd7Q_i2tcUFhIQO5UPw2MQBrfoR_PjDM-c7sqT6CdtQVsyoIP_fnDU9RXrw8NvRVtpA7JOiYHRcmwErrYso4uiDIH7IO1HdniMZq4nm1LM36RywajGzBnMXJI6ZBv8MEGSO_anGlnFjpGLL2LtKkDeBkJ6bAZ8qKDSvDv2NczPj54ygoDcje8UU6V8oi7EG7ddl-wRYqrXNZecg1XCf3y',
  },
  {
    name: 'Ranita Blue Jeans (La Selva)',
    url: 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Quetzal (Talamanca)',
    url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Mariposa Morfo (Monteverde)',
    url: 'https://images.unsplash.com/photo-1551085254-e96b210df58a?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Terciopelo (Caribe)',
    url: 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?auto=format&fit=crop&w=1000&q=80',
  },
  {
    name: 'Danta / Tapir (Corcovado)',
    url: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1000&q=80',
  },
];

export const NewSpecimenModal: React.FC<NewSpecimenModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCoords,
  editingSpecimen,
  defaultCollector,
}) => {
  if (!isOpen) return null;

  // Online / Offline GPS Mode State
  const [isOnlineMode, setIsOnlineMode] = useState<boolean>(true);

  // Initial Coordinates
  const defaultLat = initialCoords?.lat || editingSpecimen?.georeference.latitude || 10.4304;
  const defaultLng = initialCoords?.lng || editingSpecimen?.georeference.longitude || -84.0095;

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [locality, setLocality] = useState(
    initialCoords?.locality || editingSpecimen?.georeference.locality || 'Estación Biológica La Selva, Sarapiquí'
  );
  const [province, setProvince] = useState(
    editingSpecimen?.georeference.province || 'Heredia, Costa Rica'
  );
  const [elevation, setElevation] = useState<number>(
    editingSpecimen?.georeference.elevationMeters || 68
  );
  const [lifeZone, setLifeZone] = useState(
    initialCoords?.lifeZone ||
      editingSpecimen?.georeference.lifeZone ||
      'Bosque Muy Húmedo Tropical (bmh-T)'
  );
  const [microhabitat, setMicrohabitat] = useState(
    editingSpecimen?.georeference.microhabitat || 'Estrato arbustivo / Arroyo de aguas lénticas'
  );

  // Ubicación & Modo de selección (Mapa automático vs Entrada manual)
  const [locationTab, setLocationTab] = useState<'map' | 'manual'>('map');
  const [autoLocationDetectedMsg, setAutoLocationDetectedMsg] = useState<string | null>(null);

  // Scientific taxonomy form state
  const [scientificName, setScientificName] = useState(
    editingSpecimen?.scientificName || ''
  );
  const [commonName, setCommonName] = useState(
    editingSpecimen?.commonName || ''
  );
  const [taxonGroup, setTaxonGroup] = useState<TaxonGroup>(
    editingSpecimen?.taxonGroup || 'Amphibia'
  );
  const [genus, setGenus] = useState(editingSpecimen?.taxonomy.genus || '');
  const [family, setFamily] = useState(editingSpecimen?.taxonomy.family || '');
  const [collector, setCollector] = useState(
    editingSpecimen?.collector || defaultCollector || 'Ing. Carvajal V.'
  );
  const [heroImage, setHeroImage] = useState(
    editingSpecimen?.heroImage || ''
  );
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [lhcMm, setLhcMm] = useState<number>(
    editingSpecimen?.morphometrics.snoutVentLengthMm || 0
  );

  // Deep Scientific Fields Requested by User
  const [colorationNotes, setColorationNotes] = useState(
    editingSpecimen?.morphometrics.colorationAndAnatomy || ''
  );
  const [ethologyNotes, setEthologyNotes] = useState(
    editingSpecimen?.morphometrics.ethologyAndReproduction || ''
  );
  const [courtshipNotes, setCourtshipNotes] = useState(
    editingSpecimen?.morphometrics.courtshipAndMating || ''
  );
  const [interspecificNotes, setInterspecificNotes] = useState(
    editingSpecimen?.morphometrics.interspecificRelations || ''
  );
  const [confirmedScienceNotes, setConfirmedScienceNotes] = useState(
    editingSpecimen?.morphometrics.confirmedScientificData || ''
  );

  // Especies Simpátricas Registradas (Entrada manual u opción de omitir dato)
  const [sympatricList, setSympatricList] = useState<SympatricSpecies[]>(
    editingSpecimen?.morphometrics.sympatricSpecies || []
  );
  const [newSympSciName, setNewSympSciName] = useState('');
  const [newSympCommonName, setNewSympCommonName] = useState('');
  const [newSympCount, setNewSympCount] = useState<number>(1);

  // BIOACOUSTICS MANAGEMENT
  const [hasBioacoustics, setHasBioacoustics] = useState<boolean>(
    editingSpecimen ? !!editingSpecimen.bioacoustics : true
  );
  const [audioTitle, setAudioTitle] = useState(
    editingSpecimen?.bioacoustics?.title || 'Canto de Anuncio'
  );
  const [audioCallType, setAudioCallType] = useState(
    editingSpecimen?.bioacoustics?.callType || 'Vocalización Territorial / Canto'
  );
  const [audioFrequency, setAudioFrequency] = useState(
    editingSpecimen?.bioacoustics?.dominantFrequencyRange || '1.8 - 2.4 kHz'
  );
  const [audioPattern, setAudioPattern] = useState(
    editingSpecimen?.bioacoustics?.audioPatternDescription || '"Chack-chack" gutural monotonal'
  );
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(
    editingSpecimen?.bioacoustics?.audioDataUrl || null
  );

  // Live recording in form
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micIntervalRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Additional Photos by URL & Local Capture
  const [additionalPhotosList, setAdditionalPhotosList] = useState<PhotoRecord[]>(
    editingSpecimen?.additionalPhotos || [
      {
        id: 'p1',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDmGUVTb0cZNrQIy7d2kzAqkjo8reoJH1-m7Jq1KGQViK-JC4o4iBAgurcuMq32V-vTc_Tkm78xKpt_mBTogei0s7FFYCFaWYqs6URyffV2JUPVqp5EKLtRssA_cFs7gAn9UVpmWNnc2KlDkfxv-MF0jCFqXgfwKwt2GsYbhVuOuE9i0rTCa1a9JNYOxgjjbUHiEU9KMNZ0pRDAe7RB90yjf9U8diZY8agcW98GU6r_61NmLaCpSiAP',
        label: 'Ojo / Membrana',
        description: 'Detalle de la membrana nictitante dorada.',
      },
    ]
  );
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoLabel, setNewPhotoLabel] = useState('');
  const [newPhotoDesc, setNewPhotoDesc] = useState('');
  const [isUploadingGalleryPhoto, setIsUploadingGalleryPhoto] = useState(false);
  const [galleryErrorMsg, setGalleryErrorMsg] = useState<string | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sightings / Entradas de Vistas
  const [sightingsList, setSightingsList] = useState<SightingEntry[]>(
    editingSpecimen?.sightings || [
      {
        id: 's-init',
        timestamp: new Date().toLocaleString('es-CR'),
        date: new Date().toISOString().slice(0, 10),
        observer: editingSpecimen?.collector || 'Biol. M. Cordero (UCR-MZ)',
        locality: locality,
        count: 1,
        behaviorObserved: 'Ejemplar en actividad sobre follaje.',
        microhabitat: microhabitat,
      },
    ]
  );
  const [newSightingLocality, setNewSightingLocality] = useState('');
  const [newSightingCount, setNewSightingCount] = useState(1);
  const [newSightingDate, setNewSightingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSightingTime, setNewSightingTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [newSightingBehavior, setNewSightingBehavior] = useState('');
  const [newSightingNotes, setNewSightingNotes] = useState('');
  const [showAddSighting, setShowAddSighting] = useState(false);
  const [editingSightingId, setEditingSightingId] = useState<string | null>(null);
  const [newSightingSympatrics, setNewSightingSympatrics] = useState<SympatricSpecies[]>([]);
  const [newSightSympSciName, setNewSightSympSciName] = useState('');
  const [newSightSympCommonName, setNewSightSympCommonName] = useState('');
  const [newSightSympCount, setNewSightSympCount] = useState<number>(1);

  const [collectionDate, setCollectionDate] = useState<string>(
    editingSpecimen?.collectionDate || new Date().toISOString().slice(0, 10)
  );
  const [collectionTime, setCollectionTime] = useState<string>(
    editingSpecimen?.collectionTime ||
      `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} CST`
  );

  // Delete confirmation modal state
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  // AI Biological Auto-Fill State (Gemini 3.8 Flash + Resilient Costa Rica Biological Engine)
  const [isEnrichingWithAI, setIsEnrichingWithAI] = useState(false);
  const [aiEnrichSuccessMsg, setAiEnrichSuccessMsg] = useState<string | null>(null);
  const [aiEnrichErrorMsg, setAiEnrichErrorMsg] = useState<string | null>(null);

  const handleEnrichWithAI = async (speciesOverride?: string) => {
    const term = (speciesOverride || scientificName || commonName || '').trim();
    if (!term) {
      setAiEnrichErrorMsg(
        'Por favor ingresa primero el Nombre Científico (ej. Bothriechis schlegelii) o el Nombre Común (ej. Oropel, Danta, Quetzal, Jaguar, Rana de ojos rojos) para autocompletar la ficha.'
      );
      setTimeout(() => setAiEnrichErrorMsg(null), 6000);
      return;
    }

    setIsEnrichingWithAI(true);
    setAiEnrichErrorMsg(null);
    setAiEnrichSuccessMsg(null);

    try {
      const response = await fetch('/api/ai/enrich-scientific-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scientificName: speciesOverride || scientificName.trim(),
          commonName: commonName.trim(),
          taxonGroup,
          query: term,
        }),
      });

      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || 'No se obtuvieron datos taxonómicos');
      }

      const bio = resData.data;

      // 1. Identificación binomial y nombres
      if (bio.scientificName) {
        setScientificName(bio.scientificName);
      }
      if (bio.commonName) {
        setCommonName(bio.commonName);
      }
      if (bio.taxonGroup) {
        setTaxonGroup(bio.taxonGroup as TaxonGroup);
      }
      if (bio.taxonomy?.family) {
        setFamily(bio.taxonomy.family);
      }
      if (bio.taxonomy?.genus) {
        setGenus(bio.taxonomy.genus);
      }

      // 2. Cromática, Anatomía, Etología, Reproducción, Interespecíficas y Ciencia confirmada
      if (bio.colorationAndAnatomy) {
        setColorationNotes(bio.colorationAndAnatomy);
      }
      if (bio.ethologyAndReproduction) {
        setEthologyNotes(bio.ethologyAndReproduction);
      }
      if (bio.courtshipAndMating) {
        setCourtshipNotes(bio.courtshipAndMating);
      }
      if (bio.interspecificRelations) {
        setInterspecificNotes(bio.interspecificRelations);
      }
      if (bio.confirmedScientificData) {
        setConfirmedScienceNotes(bio.confirmedScientificData);
      }

      // 3. Morfometría y Hábitat
      if (bio.morphometrics?.snoutVentLengthMm && (!lhcMm || lhcMm === 0)) {
        setLhcMm(bio.morphometrics.snoutVentLengthMm);
      }
      if (bio.suggestedHoldridgeZone) {
        setLifeZone(bio.suggestedHoldridgeZone);
      }
      if (bio.microhabitat) {
        setMicrohabitat(bio.microhabitat);
      }
      if (bio.elevationMeters) {
        setElevation(bio.elevationMeters);
      }

      // 4. Bioacústica
      if (bio.hasBioacoustics && bio.bioacoustics) {
        setHasBioacoustics(true);
        if (bio.bioacoustics.title) setAudioTitle(bio.bioacoustics.title);
        if (bio.bioacoustics.callType) setAudioCallType(bio.bioacoustics.callType);
        if (bio.bioacoustics.dominantFrequencyRange) setAudioFrequency(bio.bioacoustics.dominantFrequencyRange);
        if (bio.bioacoustics.audioPatternDescription) setAudioPattern(bio.bioacoustics.audioPatternDescription);
      }

      const speciesLabel = bio.scientificName || bio.commonName || term;
      const isOffline = resData.isOfflineFallback;
      setAiEnrichSuccessMsg(
        isOffline
          ? `✅ Datos biológicos completados desde el catálogo biológico de Costa Rica para ${speciesLabel}.`
          : `✨ ¡Biología completada con éxito por IA (Gemini 3.8 Flash) para ${speciesLabel}! Cromática, anatomía, etología, reproducción, relaciones interespecíficas y datos de campo cargados.`
      );
      setTimeout(() => setAiEnrichSuccessMsg(null), 9000);
    } catch (err: any) {
      console.warn('Error en autocompletar biología con IA:', err);
      setAiEnrichErrorMsg('No se pudo autocompletar en este momento. Verifica tu conexión o intenta nuevamente.');
      setTimeout(() => setAiEnrichErrorMsg(null), 6000);
    } finally {
      setIsEnrichingWithAI(false);
    }
  };

  // Synchronize modal state whenever opened with an existing specimen or new coords
  useEffect(() => {
    if (isOpen) {
      if (editingSpecimen) {
        setCoords({
          lat: editingSpecimen.georeference.latitude,
          lng: editingSpecimen.georeference.longitude,
        });
        setLocality(editingSpecimen.georeference.locality);
        setProvince(editingSpecimen.georeference.province);
        setElevation(editingSpecimen.georeference.elevationMeters);
        setLifeZone(editingSpecimen.georeference.lifeZone);
        setMicrohabitat(editingSpecimen.georeference.microhabitat);
        setScientificName(editingSpecimen.scientificName);
        setCommonName(editingSpecimen.commonName);
        setTaxonGroup(editingSpecimen.taxonGroup);
        setGenus(editingSpecimen.taxonomy.genus);
        setFamily(editingSpecimen.taxonomy.family);
        setCollector(editingSpecimen.collector);
        setCollectionDate(editingSpecimen.collectionDate || new Date().toISOString().slice(0, 10));
        setCollectionTime(
          editingSpecimen.collectionTime ||
            `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} CST`
        );
        setHeroImage(editingSpecimen.heroImage);
        setUploadedBase64(null);
        setLhcMm(editingSpecimen.morphometrics.snoutVentLengthMm || 50.0);
        setColorationNotes(editingSpecimen.morphometrics.colorationAndAnatomy || '');
        setEthologyNotes(editingSpecimen.morphometrics.ethologyAndReproduction || '');
        setCourtshipNotes(editingSpecimen.morphometrics.courtshipAndMating || '');
        setInterspecificNotes(editingSpecimen.morphometrics.interspecificRelations || '');
        setConfirmedScienceNotes(editingSpecimen.morphometrics.confirmedScientificData || '');
        setSympatricList(editingSpecimen.morphometrics.sympatricSpecies || []);
        setNewSympSciName('');
        setNewSympCommonName('');
        setNewSympCount(1);
        setHasBioacoustics(!!editingSpecimen.bioacoustics);
        setAudioTitle(editingSpecimen.bioacoustics?.title || 'Canto de Anuncio');
        setAudioCallType(editingSpecimen.bioacoustics?.callType || 'Vocalización Territorial');
        setAudioFrequency(editingSpecimen.bioacoustics?.dominantFrequencyRange || '1.8 - 2.4 kHz');
        setAudioPattern(editingSpecimen.bioacoustics?.audioPatternDescription || '');
        setAudioDataUrl(editingSpecimen.bioacoustics?.audioDataUrl || null);
        setAdditionalPhotosList(editingSpecimen.additionalPhotos || []);
        setSightingsList(editingSpecimen.sightings || []);
        setShowAddSighting(false);
        setEditingSightingId(null);
        setNewSightingSympatrics([]);
      } else {
        // Reset to clean state for a new specimen registration
        const defaultCoords = initialCoords
          ? { lat: initialCoords.lat, lng: initialCoords.lng }
          : { lat: 9.6608, lng: -84.0205 }; // Default Zona de los Santos / Dota
        setCoords(defaultCoords);
        const locInfo = detectLocationAndLifeZone(defaultCoords.lat, defaultCoords.lng);
        setLocality(initialCoords?.locality || locInfo.locality);
        setProvince(locInfo.province);
        setElevation(locInfo.elevation);
        setLifeZone(initialCoords?.lifeZone || locInfo.lifeZone);
        setMicrohabitat('Vegetación riparia y ramas caídas');
        setScientificName('');
        setCommonName('');
        setTaxonGroup('Amphibia');
        setGenus('');
        setFamily('');
        setCollector(defaultCollector || 'Ing. Carvajal V.');
        setCollectionDate(new Date().toISOString().slice(0, 10));
        setCollectionTime(
          `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')} CST`
        );
        setHeroImage('');
        setUploadedBase64(null);
        setLhcMm(0);
        setColorationNotes('');
        setEthologyNotes('');
        setCourtshipNotes('');
        setInterspecificNotes('');
        setConfirmedScienceNotes('');
        setSympatricList([]); // Limpio por defecto, sin autollenar especies simpátricas
        setNewSympSciName('');
        setNewSympCommonName('');
        setNewSympCount(1);
        setHasBioacoustics(true);
        setAudioTitle('Canto de Anuncio');
        setAudioCallType('Vocalización Territorial');
        setAudioFrequency('2.0 - 3.0 kHz');
        setAudioPattern('');
        setAudioDataUrl(null);
        setAdditionalPhotosList([]);
        setSightingsList([]);
        setShowAddSighting(false);
        setEditingSightingId(null);
        setNewSightingSympatrics([]);
      }
    }
  }, [isOpen, editingSpecimen, initialCoords]);

  // Coords change handler from the interactive map
  const handleCoordsChange = (newCoords: { lat: number; lng: number; dms: string }) => {
    setCoords({ lat: newCoords.lat, lng: newCoords.lng });
    const detected = detectLocationAndLifeZone(newCoords.lat, newCoords.lng);
    setLocality(detected.locality);
    setProvince(detected.province);
    setElevation(detected.elevation);
    setLifeZone(detected.lifeZone);

    setAutoLocationDetectedMsg(`📍 Ubicación leída automáticamente del mapa: ${detected.locality} (${detected.province}) • Zona de Vida Holdridge: ${detected.lifeZone}`);
    setTimeout(() => setAutoLocationDetectedMsg(null), 6000);
  };

  // Handler to apply manual coordinates to map and estimate Holdridge
  const handleApplyManualCoordsToMapAndHoldridge = () => {
    const detected = detectLocationAndLifeZone(coords.lat, coords.lng, elevation);
    setLifeZone(detected.lifeZone);
    if (!locality || locality === 'Estación Biológica La Selva, Sarapiquí') {
      setLocality(detected.locality);
      setProvince(detected.province);
    }
    setAutoLocationDetectedMsg(`✅ Coordenadas manuales aplicadas • Ubicación: ${detected.locality} • Zona de Vida: ${detected.lifeZone}`);
    setTimeout(() => setAutoLocationDetectedMsg(null), 5000);
  };

  // Auto-detect Holdridge based on current coords & elevation
  const handleAutoDetectHoldridge = () => {
    const predicted = estimateHoldridgeZone(elevation, coords.lat, coords.lng);
    setLifeZone(predicted.name);
    setAutoLocationDetectedMsg(`🌿 Zona de Vida de Holdridge actualizada: ${predicted.name}`);
    setTimeout(() => setAutoLocationDetectedMsg(null), 3500);
  };

  // File Upload Handler (camera / gallery)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      let result = reader.result as string;
      if (result && result.startsWith('data:image')) {
        try {
          result = await compressDataUrl(result, 1200, 0.8);
        } catch {}
      }
      setUploadedBase64(result);
      setHeroImage(result);

      // Guardar de inmediato en el servidor y caché offline para que sea visible en todos los dispositivos
      try {
        const permanentUrl = await saveImageOfflineAndServer(result, 'especie_nueva');
        if (permanentUrl) {
          setHeroImage(permanentUrl);
        }
      } catch (err) {
        console.warn('Servidor offline o subiendo en segundo plano:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Audio Upload Handler
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAudioDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Live Mic Recording
  const startRecordingMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioDataUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingMic(true);
      setMicSeconds(0);

      micIntervalRef.current = setInterval(() => {
        setMicSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('No se pudo acceder al micrófono. Por favor verifique los permisos de audio.');
    }
  };

  const stopRecordingMic = () => {
    if (mediaRecorderRef.current && isRecordingMic) {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
    }
  };



  const handleAddCustomPhoto = () => {
    setGalleryErrorMsg(null);
    let url = newPhotoUrl.trim();
    if (!url) {
      // Si el usuario no especificó URL, abre directamente el explorador de archivos para subir una foto
      galleryFileInputRef.current?.click();
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      url = 'https://' + url;
    }

    const newEntry: PhotoRecord = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url,
      label: newPhotoLabel.trim() || 'Vista adicional',
      description: newPhotoDesc.trim() || 'Fotografía de campo agregada a la bitácora.',
    };
    setAdditionalPhotosList([...additionalPhotosList, newEntry]);
    setNewPhotoUrl('');
    setNewPhotoLabel('');
    setNewPhotoDesc('');
  };

  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingGalleryPhoto(true);
    setGalleryErrorMsg(null);

    try {
      const addedPhotos: PhotoRecord[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        let base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        if (base64.startsWith('data:image')) {
          try {
            base64 = await compressDataUrl(base64, 1200, 0.82);
          } catch {}
        }

        let finalUrl = base64;
        try {
          const savedUrl = await saveImageOfflineAndServer(base64, 'gallery');
          if (savedUrl) finalUrl = savedUrl;
        } catch (err) {
          console.warn('Fallback guardando imagen en galería:', err);
        }

        const labelText =
          newPhotoLabel.trim() ||
          (files.length === 1 ? 'Vista de Campo' : `Vista de Campo ${additionalPhotosList.length + i + 1}`);
        const descText =
          newPhotoDesc.trim() || `Fotografía de campo capturada para la bitácora (${file.name}).`;

        addedPhotos.push({
          id: `photo-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          url: finalUrl,
          label: labelText,
          description: descText,
        });
      }

      if (addedPhotos.length > 0) {
        setAdditionalPhotosList((prev) => [...prev, ...addedPhotos]);
        setNewPhotoUrl('');
        setNewPhotoLabel('');
        setNewPhotoDesc('');
      }
    } catch (err) {
      console.error('Error al subir fotos a la galería:', err);
      setGalleryErrorMsg('No se pudo procesar la fotografía. Intenta nuevamente.');
    } finally {
      setIsUploadingGalleryPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveCustomPhoto = (id: string) => {
    setAdditionalPhotosList(additionalPhotosList.filter((p) => p.id !== id));
  };

  const handleAddSighting = () => {
    const dateFormatted = newSightingDate || new Date().toISOString().slice(0, 10);
    const timeFormatted = newSightingTime ? `${newSightingTime} CST` : '';
    const timestampFormatted = `${dateFormatted}${timeFormatted ? ` • ${timeFormatted}` : ''}`;

    const sightingPayload: SightingEntry = {
      id: editingSightingId || `sight-${Date.now()}`,
      timestamp: timestampFormatted,
      date: dateFormatted,
      observer: collector || 'Investigador de Campo',
      locality: newSightingLocality.trim() || locality,
      count: newSightingCount > 0 ? newSightingCount : 1,
      behaviorObserved: newSightingBehavior.trim() || 'Observación registrada en campo.',
      microhabitat: microhabitat,
      notes: newSightingNotes.trim() || undefined,
      sympatricSpecies: newSightingSympatrics.length > 0 ? newSightingSympatrics : undefined,
    };

    let updated: SightingEntry[] = [];
    if (editingSightingId) {
      updated = sightingsList.map((s) => (s.id === editingSightingId ? sightingPayload : s));
    } else {
      updated = [sightingPayload, ...sightingsList];
    }
    updated.sort((a, b) => (b.date || b.timestamp || '').localeCompare(a.date || a.timestamp || ''));

    setSightingsList(updated);
    setNewSightingLocality('');
    setNewSightingBehavior('');
    setNewSightingNotes('');
    setEditingSightingId(null);
    setNewSightingSympatrics([]);
    setShowAddSighting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalHero = heroImage || '/isthmohyla_nacientes.jpg';
    if (uploadedBase64 && uploadedBase64.startsWith('data:')) {
      try {
        finalHero = await saveImageOfflineAndServer(uploadedBase64, 'especie_nueva');
      } catch (err) {
        console.warn('Fallback al guardar foto offline:', err);
      }
    } else if (heroImage && heroImage.startsWith('data:')) {
      try {
        finalHero = await saveImageOfflineAndServer(heroImage, 'especie_nueva');
      } catch (err) {
        console.warn('Fallback al guardar foto offline:', err);
      }
    }

    const dms = formatCoordinatesDMS(coords.lat, coords.lng);
    const nearest = findNearestHotspot(coords.lat, coords.lng);

    const bioacousticsRecord: BioacousticRecord | undefined = hasBioacoustics
      ? {
          title: audioTitle,
          callType: audioCallType,
          dominantFrequencyRange: audioFrequency,
          durationSeconds: micSeconds > 0 ? micSeconds : 24,
          audioPatternDescription: audioPattern,
          audioDataUrl: audioDataUrl || undefined,
        }
      : undefined;

    const newRecord: SpecimenRecord = {
      id: editingSpecimen?.id || `cr-bio-${Date.now().toString().slice(-4)}`,
      catalogNumber:
        editingSpecimen?.catalogNumber ||
        `CAT. CR-BIO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      scientificName,
      commonName,
      taxonGroup,
      realm: 'Neotropical',
      collector,
      collectionDate:
        collectionDate.trim() ||
        editingSpecimen?.collectionDate ||
        new Date().toLocaleDateString('es-CR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      collectionTime:
        collectionTime.trim() ||
        editingSpecimen?.collectionTime ||
        `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')} CST`,
      institutionCode: 'UCR-MZ',
      curationStatus: 'Verificada',
      darwinCoreSync: true,
      fieldFolio: editingSpecimen?.fieldFolio || `Ficha Folio #${Math.floor(10 + Math.random() * 90)}`,

      iucnStatus: editingSpecimen?.iucnStatus || {
        code: 'LC',
        label: 'Preocupación Menor',
        trend: 'Población Estable',
      },
      citesStatus: editingSpecimen?.citesStatus || {
        appendix: 'Apéndice II',
        distribution: 'Nativa Mesoamericana',
      },

      taxonomy: {
        kingdom: 'Animalia',
        phylum: 'Chordata',
        class: taxonGroup,
        order: 'Anura',
        family,
        genus,
        species: scientificName.split(' ')[1] || 'sp.',
        taxonId: editingSpecimen?.taxonomy.taxonId || '8408',
      },

      heroImage: finalHero,
      heroImageDescription: `Espécimen de campo de ${scientificName} registrado en ${locality}.`,
      bioacoustics: bioacousticsRecord,

      georeference: {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDMS: dms.latDMS,
        longitudeDMS: dms.lngDMS,
        datum: 'WGS84',
        accuracyMeters: isOnlineMode ? 3.2 : 12.0,
        elevationMeters: elevation,
        locality,
        province,
        conservationArea: nearest.conservationArea,
        lifeZone,
        microhabitat,
      },

      morphometrics: {
        snoutVentLengthMm: Number(lhcMm) || 58.0,
        colorationAndAnatomy: colorationNotes,
        ethologyAndReproduction: ethologyNotes,
        courtshipAndMating: courtshipNotes,
        interspecificRelations: interspecificNotes,
        confirmedScientificData: confirmedScienceNotes,
        sympatricSpecies: sympatricList,
      },

      additionalPhotos: additionalPhotosList,
      sightings: sightingsList,
    };

    onSave(newRecord);
    onClose();
  };

  const coordsDMS = formatCoordinatesDMS(coords.lat, coords.lng);

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div
        className="w-full max-w-3xl bg-[#f8faf4] rounded-2xl shadow-2xl border border-[#c1c8c3] overflow-hidden flex flex-col my-auto max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#002217] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6cf8bb] text-[24px]">edit_note</span>
            <div>
              <h2 className="font-bold text-[17px] leading-tight">
                {editingSpecimen ? 'Editar Registro Científico' : 'Nuevo Registro de Espécimen'}
              </h2>
              <p className="text-[11px] text-[#79a28f] font-mono">
                BioBitácora CR • Catálogo de Campo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-5">
          {/* FOTOGRAFÍA PRINCIPAL DEL ESPÉCIMEN */}
          <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">add_a_photo</span>
                Fotografía Principal de Campo
              </label>
              {heroImage && (
                <span className="text-[11px] font-mono text-[#006c49] font-bold bg-[#6cf8bb]/20 px-2.5 py-0.5 rounded-full border border-[#006c49]/20">
                  Fotografía cargada
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-48 h-36 rounded-xl bg-[#0f382a] overflow-hidden border border-[#c1c8c3] flex-shrink-0 shadow-inner group">
                {heroImage ? (
                  <img src={heroImage} alt="Espécimen preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#79a28f] gap-1 p-2 text-center text-xs">
                    <span className="material-symbols-outlined text-3xl">image</span>
                    <span>Sin fotografía</span>
                  </div>
                )}
                {heroImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setHeroImage('');
                      setUploadedBase64(null);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/90 text-white cursor-pointer transition-colors"
                    title="Quitar fotografía"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5 flex-1 w-full justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-lg bg-[#002217] hover:bg-[#0f382a] text-[#6cf8bb] text-xs font-bold flex items-center gap-1.5 border border-[#6cf8bb]/40 cursor-pointer transition-colors shadow-xs">
                      <span className="material-symbols-outlined text-[18px]">upload_file</span>
                      <span>Subir Fotografía del Dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-[#717974]">o ingresar enlace web:</span>
                  </div>

                  <input
                    type="url"
                    value={heroImage}
                    onChange={(e) => {
                      setHeroImage(e.target.value);
                      setUploadedBase64(null);
                    }}
                    placeholder="https://ejemplo.com/fotografia.jpg"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
                  />
                </div>

                {/* Fotografías de muestra en Costa Rica */}
                <div className="flex flex-col gap-1 pt-1.5 border-t border-[#e1e3dd]">
                  <span className="text-[11px] font-mono text-[#414844]">
                    O selecciona una fotografía de muestra de campo:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {SAMPLE_FIELD_IMAGES.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setHeroImage(sample.url);
                          setUploadedBase64(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                          heroImage === sample.url
                            ? 'bg-[#002217] text-white border-[#002217]'
                            : 'bg-[#f2f4ee] hover:bg-[#e7e9e3] text-[#191c19] border-[#c1c8c3]/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px] text-[#006c49]">photo</span>
                        <span>{sample.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BIOACÚSTICA */}
          <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">graphic_eq</span>
                Registro Bioacústico (Canto / Llamado)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasBioacoustics}
                  onChange={(e) => setHasBioacoustics(e.target.checked)}
                  className="w-4 h-4 rounded text-[#006c49] focus:ring-[#006c49] accent-[#006c49]"
                />
                <span className="text-xs font-semibold text-[#191c19]">
                  {hasBioacoustics ? 'Canto Activo' : 'Suprimido (Sin canto)'}
                </span>
              </label>
            </div>

            {!hasBioacoustics ? (
              <div className="p-3 rounded-xl bg-[#f2f4ee] border border-[#e1e3dd] text-xs text-[#414844] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#717974] text-[18px]">volume_off</span>
                <span>Organismo sin canto o llamado emitido (suprimido para plantas, mariposas, reptiles mudos, etc.).</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#002217] block">Micrófono en Campo</span>
                      <span className="text-[11px] text-[#414844]">
                        {isRecordingMic ? `Grabando: 00:${String(micSeconds).padStart(2, '0')}` : 'Grabar audio en vivo'}
                      </span>
                    </div>
                    {isRecordingMic ? (
                      <button
                        type="button"
                        onClick={stopRecordingMic}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shadow active:scale-95 flex items-center gap-1 cursor-pointer animate-pulse"
                      >
                        <span className="material-symbols-outlined text-[16px]">stop</span>
                        <span>Detener</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecordingMic}
                        className="px-3 py-1.5 rounded-lg bg-[#002217] text-white text-xs font-bold shadow active:scale-95 flex items-center gap-1 hover:bg-[#0f382a] cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">mic</span>
                        <span>Grabar</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#002217] block">Subir Archivo</span>
                      <span className="text-[11px] text-[#414844]">
                        {audioDataUrl ? 'Audio cargado con éxito' : 'MP3, WAV o M4A'}
                      </span>
                    </div>
                    <label className="px-3 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-[#002217] text-xs font-bold shadow-sm hover:bg-[#edefe9] flex items-center gap-1 cursor-pointer">
                      <span className="material-symbols-outlined text-[16px] text-[#006c49]">upload_file</span>
                      <span>Subir</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {audioDataUrl && (
                  <div className="p-2.5 rounded-lg bg-[#c1ecd7]/30 border border-[#006c49]/30 flex items-center justify-between text-xs">
                    <span className="text-[#002116] font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#006c49]">audio_file</span>
                      Grabación personalizada vinculada
                    </span>
                    <button
                      type="button"
                      onClick={() => setAudioDataUrl(null)}
                      className="text-red-600 font-bold hover:underline"
                    >
                      Remover audio
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GEORREFERENCIACIÓN Y ZONA DE VIDA (HOLDRIDGE) - MAPA AUTOMÁTICO & ENTRADA MANUAL */}
          <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">location_on</span>
                Ubicación Geográfica y Zona de Vida (Holdridge)
              </label>
              <span className="text-[11px] font-mono text-[#006c49] font-bold bg-[#6cf8bb]/20 px-2.5 py-0.5 rounded-full border border-[#006c49]/20">
                Datum WGS84 • Costa Rica
              </span>
            </div>

            {/* Selector de Modo: Automático por Mapa vs Entrada Manual */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#edefe9] rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setLocationTab('map')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  locationTab === 'map'
                    ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                    : 'text-[#414844] hover:text-[#191c19]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">map</span>
                <span>Opción 1: Marcar en el Mapa (Automático)</span>
              </button>

              <button
                type="button"
                onClick={() => setLocationTab('manual')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  locationTab === 'manual'
                    ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                    : 'text-[#414844] hover:text-[#191c19]'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">edit_location_alt</span>
                <span>Opción 2: Entrada Manual (Coordenadas y Lugar)</span>
              </button>
            </div>

            {locationTab === 'map' ? (
              <div className="flex flex-col gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#f0f4ee] border border-[#c1ecd7] text-xs text-[#002116] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">touch_app</span>
                    <span className="text-[11px]">
                      <strong>Modo Automático:</strong> Toca o haz clic sobre cualquier punto del mapa de Costa Rica para colocar la marca. El sistema leerá las coordenadas exactas y calculará de forma automática el lugar, altitud y la zona de vida de Holdridge.
                    </span>
                  </div>
                </div>

                {/* Mapa Interactivo */}
                <div className="rounded-xl overflow-hidden border border-[#c1c8c3] h-72 sm:h-80 relative shadow-sm">
                  <CostaRicaMap
                    pickerMode={true}
                    initialCoords={coords}
                    onCoordsChange={handleCoordsChange}
                    isOnlineMode={isOnlineMode}
                  />
                </div>
              </div>
            ) : (
              /* ENTRADA MANUAL DE COORDENADAS Y LUGAR */
              <div className="p-3.5 rounded-xl bg-[#f8faf4] border border-[#c1c8c3] flex flex-col gap-3">
                <div className="p-2.5 rounded-lg bg-[#fff8e1] border border-[#ffe082] text-xs text-[#78350f] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#d97706] text-[18px]">edit_note</span>
                  <span>
                    <strong>Modo Manual:</strong> Puedes ingresar las coordenadas en grados decimales y el nombre del sitio. Luego haz clic en "Calcular Zona de Vida" o "Posicionar en el Mapa".
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Latitud (grados decimales N) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={coords.lat}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setCoords((prev) => ({ ...prev, lat: val }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono font-bold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
                      placeholder="ej. 9.6542"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Longitud (grados decimales W) *
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={coords.lng}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setCoords((prev) => ({ ...prev, lng: val }));
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono font-bold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
                      placeholder="ej. -83.9214"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Localidad / Sitio Específico *
                    </label>
                    <input
                      type="text"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      placeholder="Ej: Quebrada Las Nacientes, Santa María de Dota"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Provincia / Región *
                    </label>
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Ej: San José, Costa Rica"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Altitud aproximada (msnm)
                    </label>
                    <input
                      type="number"
                      value={elevation}
                      onChange={(e) => setElevation(Number(e.target.value) || 0)}
                      placeholder="ej. 1650"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002217] mb-1">
                      Microhábitat / Estrato
                    </label>
                    <input
                      type="text"
                      value={microhabitat}
                      onChange={(e) => setMicrohabitat(e.target.value)}
                      placeholder="ej. Follaje ribereño a 45 cm del caudal"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#e1e3dd]">
                  <button
                    type="button"
                    onClick={handleApplyManualCoordsToMapAndHoldridge}
                    className="py-2 px-3 rounded-lg bg-[#006c49] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">auto_fix_high</span>
                    <span>Calcular Zona de Vida y Lugar con estas Coordenadas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationTab('map')}
                    className="py-2 px-3 rounded-lg bg-white border border-[#c1c8c3] text-[#002217] text-xs font-bold flex items-center gap-1.5 hover:bg-[#f0f2ec] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">pin_drop</span>
                    <span>Ver punto fijado en el mapa</span>
                  </button>
                </div>
              </div>
            )}

            {/* Resumen / Tarjeta de Confirmación de Ubicación y Zona de Vida */}
            <div className="p-3 bg-gradient-to-r from-[#f0f4ee] to-[#e7ece4] rounded-xl border border-[#c1ecd7] text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[#006c49] font-bold text-[11px] uppercase">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Coordenadas Geográficas (DMS &amp; Decimal):</span>
                </div>
                <span className="font-bold text-[#002217] text-[13px] font-mono truncate">
                  {coordsDMS.combined}
                </span>
                <span className="text-[11px] text-[#414844] truncate">
                  📍 {locality} • {province} • {elevation} msnm
                </span>
              </div>

              {/* Zona de Vida de Holdridge Selector / Display */}
              <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[280px]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#002217] uppercase flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-[#006c49]">forest</span>
                    Zona de Vida Holdridge:
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoDetectHoldridge}
                    className="text-[10px] text-[#006c49] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Calcular automáticamente según coordenadas y altitud"
                  >
                    <span className="material-symbols-outlined text-[12px]">sync</span>
                    <span>Auto-detectar</span>
                  </button>
                </div>

                <select
                  value={lifeZone}
                  onChange={(e) => setLifeZone(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs font-semibold text-[#002217] focus:ring-2 focus:ring-[#006c49] shadow-xs"
                >
                  {HOLDRIDGE_LIFE_ZONES_CR.map((zone) => (
                    <option key={zone.code} value={zone.name}>
                      {zone.code} - {zone.name} ({zone.elevationRange})
                    </option>
                  ))}
                  <option value={lifeZone}>{lifeZone} (Actual)</option>
                </select>
                <span className="text-[10px] text-[#414844] italic truncate">
                  {HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.name === lifeZone)?.typicalRegions || 'Región ecológica de Costa Rica'}
                </span>
              </div>
            </div>

            {autoLocationDetectedMsg && (
              <div className="p-2.5 rounded-xl bg-[#c1ecd7]/40 border border-[#006c49]/40 text-xs text-[#002116] flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                <span className="font-medium">{autoLocationDetectedMsg}</span>
              </div>
            )}
          </div>

          {/* Taxonomy Grid con botones directos de búsqueda rápida con IA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Nombre Científico <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={scientificName}
                onChange={(e) => setScientificName(e.target.value)}
                placeholder="p. ej. Bothriechis schlegelii"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-sm italic font-semibold text-[#002217] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1">
                Nombre Común / Vernáculo
              </label>
              <input
                type="text"
                value={commonName}
                onChange={(e) => setCommonName(e.target.value)}
                placeholder="p. ej. Víbora de pestañas / Oropel"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-sm text-[#191c19]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191c19] mb-1 flex items-center justify-between">
                <span>Grupo Taxonómico</span>
                <span className="text-[10px] text-[#006c49] font-mono font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">{getTaxonMeta(taxonGroup).icon}</span>
                  {getTaxonMeta(taxonGroup).shortLabel}
                </span>
              </label>
              <select
                value={taxonGroup}
                onChange={(e) => setTaxonGroup(e.target.value as TaxonGroup)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-semibold text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              >
                <optgroup label="Vertebrados">
                  <option value="Mammalia">Mamífero (Mammalia)</option>
                  <option value="Aves">Ave (Aves)</option>
                  <option value="Reptilia">Reptil (Reptilia)</option>
                  <option value="Amphibia">Anfibio (Amphibia)</option>
                  <option value="Actinopterygii">Pez (Actinopterygii / Chondrichthyes) — Ríos, quebradas y zonas costeras</option>
                </optgroup>
                <optgroup label="Invertebrados y Hongos">
                  <option value="Insecta">Insecto / Artrópodo (Insecta, Arachnida, Crustacea, etc.)</option>
                  <option value="Mollusca">Molusco y Otro Invertebrado (Gastropoda, Bivalvia, Annelida) — Caracoles, babosas, lombrices</option>
                  <option value="Fungi">Hongo y Liquen (Fungi / Lichenes) — Hongos macroscópicos y líquenes</option>
                </optgroup>
                <optgroup label="Flora (Plantas)">
                  <option value="Orchidaceae">Orquídea (Orchidaceae) — Categoría independiente y prioritaria</option>
                  <option value="Arboles">Árbol (Magnoliopsida / Pinopsida / Liliopsida leñosas) — Forestales</option>
                  <option value="Arbustos_Herbaceas">Arbusto y Herbácea (Plantae vasculares) — Sotobosque y hierbas</option>
                  <option value="Pteridophyta">Helecho y Afines (Pteridophyta / Bryophyta) — Helechos y musgos</option>
                  <option value="Plantae">Flora General (Plantae)</option>
                </optgroup>
              </select>
              {getTaxonMeta(taxonGroup).subdescription && (
                <p className="text-[10px] text-[#717974] mt-1 italic flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-[#006c49]">info</span>
                  <span>{getTaxonMeta(taxonGroup).subdescription}</span>
                </p>
              )}
            </div>
          </div>

          {/* ASISTENTE BIOLÓGICO CON IA (GEMINI 3.8 FLASH & MOTOR DE BIODIVERSIDAD CR) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#002217] via-[#053828] to-[#001810] text-white shadow-md border border-[#6cf8bb]/30 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#6cf8bb]/20 border border-[#6cf8bb]/40 flex items-center justify-center shrink-0 text-[#6cf8bb]">
                  <span className="material-symbols-outlined text-[22px] animate-pulse">auto_awesome</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-[14px] text-white tracking-tight">
                      Autocompletar Biología con IA
                    </h4>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#6cf8bb] text-[#002217]">
                      Gemini 3.8 Flash • 100% Funcional
                    </span>
                  </div>
                  <p className="text-xs text-[#a5d0bc] mt-0.5 leading-snug">
                    Escribe el nombre común o científico y presiona el botón para llenar automáticamente cromática, anatomía, etología, reproducción, cortejo, relaciones interespecíficas y datos de campo de Costa Rica.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleEnrichWithAI()}
                disabled={isEnrichingWithAI}
                className="px-4 py-2.5 rounded-xl bg-[#6cf8bb] hover:bg-[#8affd0] active:scale-95 text-[#002217] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-60 shrink-0"
                title="Autocompletar todos los campos biológicos de esta especie con IA"
              >
                {isEnrichingWithAI ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Analizando biología...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">temp_preferences_custom</span>
                    <span>✨ Autocompletar con IA</span>
                  </>
                )}
              </button>
            </div>

            {/* Sugerencias rápidas de fauna y flora de Costa Rica */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
              <span className="text-[10px] font-mono text-[#a5d0bc] flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">lightbulb</span>
                <span>Ejemplos de Costa Rica (haz clic para probar):</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { name: 'Bothriechis schlegelii', label: 'Bocaracá / Oropel' },
                  { name: 'Tapirus bairdii', label: 'Danta centroamericana' },
                  { name: 'Pharomachrus mocinno', label: 'Quetzal resplandeciente' },
                  { name: 'Agalychnis callidryas', label: 'Rana de ojos rojos' },
                  { name: 'Morpho helenor', label: 'Mariposa Morpho azul' },
                  { name: 'Guarianthe skinneri', label: 'Guaria morada' },
                  { name: 'Alouatta palliata', label: 'Mono congo / Aullador' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setScientificName(item.name);
                      setCommonName(item.label);
                      handleEnrichWithAI(item.name);
                    }}
                    disabled={isEnrichingWithAI}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-[#6cf8bb]/30 text-white text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer border border-white/15 flex items-center gap-1"
                  >
                    <span className="italic">{item.name}</span>
                    <span className="text-[#6cf8bb] font-normal text-[10px]">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mensajes de confirmación o alerta */}
            {aiEnrichSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-[#6cf8bb]/20 border border-[#6cf8bb]/50 text-white text-xs flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[#6cf8bb] text-[18px]">check_circle</span>
                <span className="font-medium text-[#d1fae5]">{aiEnrichSuccessMsg}</span>
              </div>
            )}

            {aiEnrichErrorMsg && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-white text-xs flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-red-400 text-[18px]">error</span>
                <span className="font-medium text-red-200">{aiEnrichErrorMsg}</span>
              </div>
            )}
          </div>

          {/* Temporalidad y Colector del Espécimen (Fecha y Hora de Colecta/Avistamiento) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#f0f4ee] border border-[#d1dcd4]">
            <div>
              <label className="block text-xs font-bold text-[#002217] mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006c49]">calendar_today</span>
                Fecha de Colecta *
              </label>
              <input
                type="text"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                placeholder="ej. 2026-10-09 o 15 Febrero 2026"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-medium text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#002217] mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006c49]">schedule</span>
                Hora de Colecta
              </label>
              <input
                type="text"
                value={collectionTime}
                onChange={(e) => setCollectionTime(e.target.value)}
                placeholder="ej. 20:15 CST o 06:15 CST"
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-medium text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#002217] mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006c49]">person</span>
                Colector / Observador
              </label>
              <input
                type="text"
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                placeholder="Nombre del investigador..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs font-medium text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>
          </div>

          {/* CAMPOS CIENTÍFICOS DETALLADOS */}
          <div className="flex flex-col gap-3.5">
            {/* Anatomía y Cromática */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">biotech</span>
                Cromática y Anatomía del Espécimen
              </label>
              <textarea
                rows={2}
                value={colorationNotes}
                onChange={(e) => setColorationNotes(e.target.value)}
                placeholder="Morfología diagnóstica, patrones de color, escamación/plumaje..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Etología y Comportamiento */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">psychology_alt</span>
                Etología y Comportamiento en Sitio
              </label>
              <textarea
                rows={2}
                value={ethologyNotes}
                onChange={(e) => setEthologyNotes(e.target.value)}
                placeholder="Horario de actividad diurna/nocturna, termorregulación, forrajeo..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Cortejo y Reproducción */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">favorite</span>
                Cortejo, Reproducción y Cuidado Parental
              </label>
              <textarea
                rows={2}
                value={courtshipNotes}
                onChange={(e) => setCourtshipNotes(e.target.value)}
                placeholder="Rituales nupciales, señales de atracción, amplexo/cópula, postura de huevos o gestación..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Relaciones Intra e Interespecíficas */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">group_work</span>
                Relaciones Intra e Interespecíficas (Competencia, Depredación y Defensas)
              </label>
              <textarea
                rows={2}
                value={interspecificNotes}
                onChange={(e) => setInterspecificNotes(e.target.value)}
                placeholder="Territorialidad entre machos, especies simpátricas, principales depredadores en CR y toxinas/defensas..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* Datos Científicos Confirmados */}
            <div>
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">menu_book</span>
                Datos Importantes de Investigación Científica Confirmada (UCR / OET / SINAC)
              </label>
              <textarea
                rows={2}
                value={confirmedScienceNotes}
                onChange={(e) => setConfirmedScienceNotes(e.target.value)}
                placeholder="Descubrimientos biológicos publicados, citas de estudios en La Selva, Monteverde, Sirena o UCR..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
              />
            </div>

            {/* ESPECIES SIMPÁTRICAS DE LA ZONA (OPCIONAL / ENTRADA MANUAL) */}
            <div className="p-4 rounded-xl bg-white border border-[#c1c8c3] flex flex-col gap-3 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-[#002217] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006c49] text-[20px]">group_work</span>
                  Especies Simpátricas de la Zona (Opcional)
                </label>
                <div className="flex items-center gap-2">
                  {sympatricList.length === 0 ? (
                    <span className="text-[11px] font-mono text-[#717974] bg-[#f0f2ec] px-2.5 py-0.5 rounded-full border border-[#c1c8c3]/60">
                      Dato omitido en este registro
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-[#006c49] font-bold bg-[#c1ecd7] px-2.5 py-0.5 rounded-full border border-[#006c49]/30">
                      {sympatricList.length} {sympatricList.length === 1 ? 'especie registrada' : 'especies registradas'}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-[#414844] leading-relaxed">
                Este campo es completamente opcional. Puedes omitir este dato o ingresar manualmente las especies simpátricas con las que comparte microhábitat si fueron constatadas en campo.
              </p>

              {/* Lista de especies simpátricas añadidas */}
              {sympatricList.length > 0 && (
                <div className="flex flex-col gap-2">
                  {sympatricList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8faf4] border border-[#c1c8c3]/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold italic text-[#002217] text-xs">
                            {item.scientificName}
                          </span>
                          {item.commonName && (
                            <span className="text-[11px] text-[#414844]">
                              ({item.commonName})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] font-bold text-[#006c49] bg-white px-2 py-0.5 rounded border border-[#e1e3dd]">
                          N={item.count || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSympatricList(sympatricList.filter((_, i) => i !== idx))}
                          className="w-7 h-7 rounded bg-white border border-[#c1c8c3] text-[#717974] hover:text-red-600 hover:border-red-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar esta especie simpátrica"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSympatricList([])}
                      className="text-[11px] text-[#717974] hover:text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">clear_all</span>
                      <span>Omitir todas (limpiar lista)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario manual para agregar especie simpátrica */}
              <div className="p-3 rounded-lg bg-[#f2f5ef] border border-[#d1dcd4] flex flex-col gap-2">
                <span className="text-[11px] font-bold text-[#002217] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-[#006c49]">add_circle</span>
                  Agregar especie simpátrica manualmente:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newSympSciName}
                      onChange={(e) => setNewSympSciName(e.target.value)}
                      placeholder="Nombre científico (ej. Craugastor podiciferus)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs italic text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newSympCommonName}
                      onChange={(e) => setNewSympCommonName(e.target.value)}
                      placeholder="Nombre común (ej. Ranita de hojarasca)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={newSympCount}
                      onChange={(e) => setNewSympCount(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="N°"
                      title="Cantidad de individuos observados"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs font-mono font-bold text-[#191c19] focus:ring-2 focus:ring-[#006c49]"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSympSciName.trim() && !newSympCommonName.trim()) return;
                      setSympatricList([
                        ...sympatricList,
                        {
                          scientificName: newSympSciName.trim() || newSympCommonName.trim(),
                          commonName: newSympCommonName.trim() || newSympSciName.trim(),
                          count: newSympCount > 0 ? newSympCount : 1,
                        },
                      ]);
                      setNewSympSciName('');
                      setNewSympCommonName('');
                      setNewSympCount(1);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#006c49] hover:bg-[#005236] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>+ Agregar Especie Simpátrica</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GALERÍA DE VISTAS Y FOTOGRAFÍAS */}
          <div className="p-4 rounded-xl bg-white border border-[#c1c8c3] flex flex-col gap-3.5 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined text-[#006c49] text-[20px]">photo_library</span>
                <span>Galería de Vistas & Fotografías ({additionalPhotosList.length})</span>
              </label>
              <span className="text-[11px] text-[#717974] font-mono">
                Sincronización permanente en todos los dispositivos
              </span>
            </div>

            {/* List of current additional photos */}
            {additionalPhotosList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {additionalPhotosList.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative rounded-xl overflow-hidden border border-[#c1c8c3] bg-[#f8faf4] p-1.5 flex flex-col gap-1.5 group shadow-2xs hover:border-[#006c49] transition-all"
                  >
                    <div className="relative w-full h-24 bg-[#0f382a] rounded-lg overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          handleImageOfflineFallback(e.currentTarget as HTMLImageElement, '/isthmohyla_nacientes.jpg');
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomPhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                        title="Eliminar esta fotografía de la galería"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                    <div className="flex flex-col px-0.5">
                      <span className="font-bold text-[#002217] text-[11px] truncate" title={photo.label}>
                        {photo.label}
                      </span>
                      {photo.description && (
                        <span className="text-[10px] text-[#717974] truncate" title={photo.description}>
                          {photo.description}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[#c1c8c3] bg-[#fcfdfa] text-center flex flex-col items-center gap-1.5 text-xs text-[#717974]">
                <span className="material-symbols-outlined text-2xl text-[#006c49]">add_photo_alternate</span>
                <span className="font-semibold text-[#002217]">No hay vistas adicionales registradas todavía</span>
                <span className="text-[11px]">Sube fotografías desde tu dispositivo (cámara/galería) o ingresa un enlace web abajo.</span>
              </div>
            )}

            {/* Add new photo: File Upload (Camera/Device) or URL input */}
            <div className="p-3 rounded-xl bg-[#f4f6f0] border border-[#c1c8c3]/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-[#002217] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#006c49]">add_circle</span>
                  <span>Agregar Fotografía o Vista de Campo:</span>
                </span>
                {isUploadingGalleryPhoto && (
                  <span className="text-xs text-[#006c49] font-bold flex items-center gap-1 animate-pulse">
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Procesando y optimizando imagen...</span>
                  </span>
                )}
              </div>

              {/* Input de archivo oculto */}
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleGalleryFileUpload}
                className="hidden"
              />

              {/* Botón principal: Subir desde Dispositivo / Cámara */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isUploadingGalleryPhoto}
                  onClick={() => galleryFileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-[#6cf8bb] text-xs font-bold flex items-center gap-2 border border-[#6cf8bb]/40 cursor-pointer transition-all shadow-xs active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                  <span>Subir Foto(s) desde este Dispositivo</span>
                </button>
                <span className="text-[11px] text-[#717974]">o ingresar datos / enlace web:</span>
              </div>

              {/* Inputs para etiqueta, descripción y URL opcional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#414844] mb-0.5">
                    Etiqueta / Vista (ej. Juvenil, Detalle Ocular, Flanco):
                  </label>
                  <input
                    type="text"
                    value={newPhotoLabel}
                    onChange={(e) => setNewPhotoLabel(e.target.value)}
                    placeholder="Etiqueta (ej. Juvenil, Vista Dorsal)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-1 focus:ring-[#006c49]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#414844] mb-0.5">
                    URL o enlace web de la imagen (opcional si subes archivo):
                  </label>
                  <input
                    type="text"
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                    placeholder="https://... o ruta de imagen"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-1 focus:ring-[#006c49]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  value={newPhotoDesc}
                  onChange={(e) => setNewPhotoDesc(e.target.value)}
                  placeholder="Descripción científica de la toma (ej. Morfo juvenil observado en sotobosque)..."
                  className="w-full sm:flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-1 focus:ring-[#006c49]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomPhoto}
                  className="px-4 py-2 rounded-xl bg-[#006c49] hover:bg-[#005236] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs active:scale-[0.98] transition-all"
                  title="Agregar foto por URL o abrir explorador de archivos"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>+ Agregar Foto</span>
                </button>
              </div>

              {galleryErrorMsg && (
                <span className="text-[11px] text-red-600 font-medium">{galleryErrorMsg}</span>
              )}
            </div>
          </div>

          {/* REGISTRO DE AVISTAMIENTOS (ENTRADAS DE VISTAS) */}
          <div className="p-3.5 rounded-xl bg-white border border-[#c1c8c3] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#002217] flex items-center gap-1.5 uppercase">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">visibility</span>
                Registro de Avistamientos / Entradas de Vistas ({sightingsList.length})
              </label>
              <button
                type="button"
                onClick={() => setShowAddSighting(!showAddSighting)}
                className="text-xs font-bold text-[#006c49] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>{showAddSighting ? 'Cancelar' : 'Nuevo Avistamiento'}</span>
              </button>
            </div>

            {/* Sightings List */}
            {sightingsList.length > 0 && (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {sightingsList.map((sight) => (
                  <div key={sight.id} className="p-2.5 rounded-lg bg-[#f8faf4] border border-[#c1c8c3]/60 flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#002217] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-[#006c49]">pin_drop</span>
                        {sight.locality}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[10px] text-[#006c49] font-bold bg-white px-2 py-0.5 rounded border border-[#e1e3dd]">
                          N={sight.count || 1} ind. • {sight.timestamp}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSightingId(sight.id);
                            setNewSightingLocality(sight.locality);
                            setNewSightingCount(sight.count || 1);
                            setNewSightingDate(sight.date || new Date().toISOString().slice(0, 10));
                            setNewSightingTime(
                              sight.timestamp?.match(/\b([0-9]{1,2}:[0-9]{2})\b/)?.[1] || '20:00'
                            );
                            setNewSightingBehavior(sight.behaviorObserved || '');
                            setNewSightingNotes(sight.notes || '');
                            setNewSightingSympatrics(sight.sympatricSpecies ? [...sight.sympatricSpecies] : []);
                            setShowAddSighting(true);
                          }}
                          className="w-6 h-6 rounded bg-white border border-[#c1c8c3] text-[#006c49] hover:bg-[#006c49] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="Editar día, hora y datos de este avistamiento"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSightingsList(sightingsList.filter((s) => s.id !== sight.id))}
                          className="w-6 h-6 rounded bg-white border border-[#c1c8c3] text-[#717974] hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar este avistamiento"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[#414844]">{sight.behaviorObserved}</p>
                    {sight.notes && <p className="text-[11px] text-[#717974] italic">{sight.notes}</p>}
                    {sight.sympatricSpecies && sight.sympatricSpecies.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[#006c49] font-medium pt-1 border-t border-[#e1e3dd]/80">
                        <span className="material-symbols-outlined text-[14px]">group_work</span>
                        <span className="font-bold text-[10px] uppercase">Simpátricas observadas:</span>
                        {sight.sympatricSpecies.map((sym, sIdx) => (
                          <span
                            key={sIdx}
                            className="bg-white px-2 py-0.5 rounded border border-[#c1ecd7] text-[10px] font-mono"
                          >
                            <span className="italic font-semibold">{sym.scientificName}</span>
                            {sym.commonName && <span className="text-[#414844]"> ({sym.commonName})</span>}
                            <span className="text-[#006c49] font-bold"> N={sym.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit Sighting Form */}
            {showAddSighting && (
              <div className="p-3 rounded-lg bg-[#f0f4ee] border border-[#c1d0c4] flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#002217] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">
                      {editingSightingId ? 'edit_calendar' : 'add_location_alt'}
                    </span>
                    {editingSightingId ? 'Editar Observación en Sitio:' : 'Registrar Nueva Observación en Sitio:'}
                  </span>
                  {editingSightingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSightingId(null);
                        setNewSightingLocality('');
                        setNewSightingBehavior('');
                        setNewSightingNotes('');
                        setShowAddSighting(false);
                      }}
                      className="text-[11px] text-[#717974] hover:text-red-600 cursor-pointer"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>

                {/* Día y Hora para avistamientos anteriores o presentes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-[#c1c8c3]">
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-0.5">
                      Día / Fecha del Avistamiento *
                    </label>
                    <input
                      type="date"
                      value={newSightingDate}
                      onChange={(e) => setNewSightingDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#f8faf4] border border-[#c1c8c3] text-xs font-mono font-bold text-[#191c19]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#414844] uppercase mb-0.5">
                      Hora del Avistamiento (CST) *
                    </label>
                    <input
                      type="time"
                      value={newSightingTime}
                      onChange={(e) => setNewSightingTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-[#f8faf4] border border-[#c1c8c3] text-xs font-mono font-bold text-[#191c19]"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[#717974]">Atajos:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setNewSightingDate(now.toISOString().slice(0, 10));
                        setNewSightingTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#e6f4ea] text-[#006c49] font-medium hover:bg-[#d2edd9]"
                    >
                      Hoy (Ahora)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = new Date(Date.now() - 86400000);
                        setNewSightingDate(y.toISOString().slice(0, 10));
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#e1e3dd] text-[#414844] hover:bg-[#d0d3cb]"
                    >
                      Ayer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newSightingLocality}
                    onChange={(e) => setNewSightingLocality(e.target.value)}
                    placeholder={`Localidad (por defecto: ${locality})`}
                    className="px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newSightingCount}
                    onChange={(e) => setNewSightingCount(parseInt(e.target.value) || 1)}
                    placeholder="Cantidad de individuos"
                    className="px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                  />
                </div>
                <input
                  type="text"
                  value={newSightingBehavior}
                  onChange={(e) => setNewSightingBehavior(e.target.value)}
                  placeholder="Comportamiento observado (ej. Forrajeo nocturno, percha a 2m, en amplexo...)"
                  className="px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                />

                {/* Especies simpátricas en este avistamiento (Opcional) */}
                <div className="p-2.5 rounded-lg bg-white border border-[#c1c8c3] flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-[10px] font-bold text-[#002217] uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-[#006c49]">group_work</span>
                      Especies simpátricas en este avistamiento (Opcional):
                    </span>
                    <span className="text-[10px] font-mono text-[#717974]">
                      {newSightingSympatrics.length === 0 ? 'Dato omitido' : `${newSightingSympatrics.length} añadida(s)`}
                    </span>
                  </div>
                  {newSightingSympatrics.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {newSightingSympatrics.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-2 py-1 rounded bg-[#f8faf4] border border-[#e1e3dd] text-[11px]"
                        >
                          <span className="italic font-semibold text-[#002217]">
                            {item.scientificName}{' '}
                            {item.commonName && <span className="not-italic text-[#414844]">({item.commonName})</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#006c49] font-bold">N={item.count}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewSightingSympatrics(newSightingSympatrics.filter((_, idx) => idx !== i))
                              }
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                              title="Quitar de este avistamiento"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newSightSympSciName}
                      onChange={(e) => setNewSightSympSciName(e.target.value)}
                      placeholder="Nombre científico..."
                      className="sm:col-span-5 px-2 py-1 rounded bg-[#f8faf4] border border-[#c1c8c3] text-[11px] italic text-[#191c19]"
                    />
                    <input
                      type="text"
                      value={newSightSympCommonName}
                      onChange={(e) => setNewSightSympCommonName(e.target.value)}
                      placeholder="Nombre común..."
                      className="sm:col-span-5 px-2 py-1 rounded bg-[#f8faf4] border border-[#c1c8c3] text-[11px] text-[#191c19]"
                    />
                    <div className="sm:col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={newSightSympCount}
                        onChange={(e) => setNewSightSympCount(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="N"
                        title="Cantidad observada"
                        className="w-12 px-1.5 py-1 rounded bg-[#f8faf4] border border-[#c1c8c3] text-[11px] font-mono text-center text-[#191c19]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newSightSympSciName.trim() && !newSightSympCommonName.trim()) return;
                          setNewSightingSympatrics([
                            ...newSightingSympatrics,
                            {
                              scientificName: newSightSympSciName.trim() || newSightSympCommonName.trim(),
                              commonName: newSightSympCommonName.trim() || newSightSympSciName.trim(),
                              count: newSightSympCount > 0 ? newSightSympCount : 1,
                            },
                          ]);
                          setNewSightSympSciName('');
                          setNewSightSympCommonName('');
                          setNewSightSympCount(1);
                        }}
                        className="px-2 py-1 rounded bg-[#006c49] text-white font-bold text-[11px] hover:bg-[#005236] cursor-pointer shadow-2xs"
                        title="Agregar especie a este avistamiento"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={newSightingNotes}
                    onChange={(e) => setNewSightingNotes(e.target.value)}
                    placeholder="Notas ecológicas adicionales..."
                    className="flex-1 px-2.5 py-1.5 rounded bg-white border border-[#c1c8c3] text-xs text-[#191c19]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSighting}
                    className="px-3.5 py-1.5 rounded bg-[#006c49] hover:bg-[#005236] text-white font-bold text-xs cursor-pointer whitespace-nowrap shadow-xs"
                  >
                    {editingSightingId ? 'Actualizar Entrada' : 'Guardar Entrada'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e1e3dd]">
            {editingSpecimen && onDelete ? (
              <button
                type="button"
                onClick={() => setShowDeletePrompt(true)}
                className="px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">delete</span>
                <span>Eliminar Registro</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#c1c8c3] text-[#414844] hover:bg-[#f2f4ee] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1.5 shadow active:scale-[0.98] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-[#6cf8bb]">save</span>
                <span>Guardar en Bitácora Científica</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Alert */}
      {showDeletePrompt && editingSpecimen && onDelete && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h4 className="font-bold text-center text-[#002217] text-base">
              ¿Eliminar este registro científico?
            </h4>
            <p className="text-xs text-center text-[#414844]">
              Se eliminará definitivamente la ficha de <strong className="italic">{editingSpecimen.scientificName}</strong> ({editingSpecimen.catalogNumber}). Esta acción no se puede deshacer.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeletePrompt(false)}
                className="py-2.5 px-3 rounded-xl border border-[#c1c8c3] text-xs font-bold text-[#414844] hover:bg-[#f2f4ee] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(editingSpecimen.id);
                  setShowDeletePrompt(false);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
