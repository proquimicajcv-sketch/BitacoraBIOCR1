export type TaxonGroup =
  // Vertebrados
  | 'Mammalia'
  | 'Aves'
  | 'Reptilia'
  | 'Amphibia'
  | 'Actinopterygii'
  // Invertebrados y Hongos
  | 'Insecta'
  | 'Mollusca'
  | 'Fungi'
  // Flora (Plantas)
  | 'Orchidaceae'
  | 'Arboles'
  | 'Arbustos_Herbaceas'
  | 'Pteridophyta'
  // Compatibilidad histórica
  | 'Plantae';

export type TaxonCategorySection = 'Vertebrados' | 'Invertebrados y Hongos' | 'Flora (Plantas)';

export interface TaxonGroupMeta {
  key: TaxonGroup;
  category: TaxonCategorySection;
  label: string;
  shortLabel: string;
  scientific: string;
  subdescription?: string;
  icon: string;
  color: string;
  bgLight: string;
  border: string;
  textContrast: string;
  bgDark: string;
  borderDark: string;
  textDark: string;
}

export const TAXON_GROUPS_REGISTRY: TaxonGroupMeta[] = [
  // Vertebrados
  {
    key: 'Mammalia',
    category: 'Vertebrados',
    label: 'Mamífero (Mammalia)',
    shortLabel: 'Mamíferos',
    scientific: 'Mammalia',
    icon: 'pets',
    color: '#d97706',
    bgLight: '#fef3c7',
    border: '#f59e0b',
    textContrast: '#78350f',
    bgDark: '#451a03',
    borderDark: '#92400e',
    textDark: '#fde68a',
  },
  {
    key: 'Aves',
    category: 'Vertebrados',
    label: 'Ave (Aves)',
    shortLabel: 'Aves',
    scientific: 'Aves',
    icon: 'cruelty_free',
    color: '#0284c7',
    bgLight: '#e0f2fe',
    border: '#38bdf8',
    textContrast: '#075985',
    bgDark: '#082f49',
    borderDark: '#0369a1',
    textDark: '#bae6fd',
  },
  {
    key: 'Reptilia',
    category: 'Vertebrados',
    label: 'Reptil (Reptilia)',
    shortLabel: 'Reptiles',
    scientific: 'Reptilia',
    icon: 'pest_control',
    color: '#e11d48',
    bgLight: '#ffe4e6',
    border: '#fb7185',
    textContrast: '#881337',
    bgDark: '#4c0519',
    borderDark: '#be123c',
    textDark: '#fecdd3',
  },
  {
    key: 'Amphibia',
    category: 'Vertebrados',
    label: 'Anfibio (Amphibia)',
    shortLabel: 'Anfibios',
    scientific: 'Amphibia',
    icon: 'water_drop',
    color: '#059669',
    bgLight: '#d1fae5',
    border: '#34d399',
    textContrast: '#064e3b',
    bgDark: '#064e3b',
    borderDark: '#059669',
    textDark: '#a7f3d0',
  },
  {
    key: 'Actinopterygii',
    category: 'Vertebrados',
    label: 'Pez (Actinopterygii / Chondrichthyes)',
    shortLabel: 'Peces',
    scientific: 'Actinopterygii / Chondrichthyes',
    subdescription: 'Para ríos, quebradas y zonas costeras',
    icon: 'set_meal',
    color: '#0891b2',
    bgLight: '#cffafe',
    border: '#22d3ee',
    textContrast: '#155e75',
    bgDark: '#083344',
    borderDark: '#0e7490',
    textDark: '#a5f3fc',
  },

  // Invertebrados y Hongos
  {
    key: 'Insecta',
    category: 'Invertebrados y Hongos',
    label: 'Insecto / Artrópodo (Insecta, Arachnida, Crustacea, etc.)',
    shortLabel: 'Insectos & Artrópodos',
    scientific: 'Insecta, Arachnida, Crustacea',
    icon: 'bug_report',
    color: '#7c3aed',
    bgLight: '#ede9fe',
    border: '#a78bfa',
    textContrast: '#5b21b6',
    bgDark: '#2e1065',
    borderDark: '#7c3aed',
    textDark: '#ddd6fe',
  },
  {
    key: 'Mollusca',
    category: 'Invertebrados y Hongos',
    label: 'Molusco y Otro Invertebrado (Gastropoda, Bivalvia, Annelida)',
    shortLabel: 'Moluscos & Otros Inv.',
    scientific: 'Gastropoda, Bivalvia, Annelida',
    subdescription: 'Caracoles, babosas, lombrices',
    icon: 'egg',
    color: '#c026d3',
    bgLight: '#fae8ff',
    border: '#e879f9',
    textContrast: '#701a75',
    bgDark: '#4a044e',
    borderDark: '#a21caf',
    textDark: '#f5d0fe',
  },
  {
    key: 'Fungi',
    category: 'Invertebrados y Hongos',
    label: 'Hongo y Liquen (Fungi / Lichenes)',
    shortLabel: 'Hongos & Líquenes',
    scientific: 'Fungi / Lichenes',
    subdescription: 'Hongos macroscópicos y líquenes de bosques tropicales',
    icon: 'nature',
    color: '#9333ea',
    bgLight: '#f3e8ff',
    border: '#c084fc',
    textContrast: '#581c87',
    bgDark: '#3b0764',
    borderDark: '#7e22ce',
    textDark: '#e9d5ff',
  },

  // Flora (Plantas)
  {
    key: 'Orchidaceae',
    category: 'Flora (Plantas)',
    label: 'Orquídea (Orchidaceae)',
    shortLabel: 'Orquídeas',
    scientific: 'Orchidaceae',
    subdescription: 'Categoría independiente y prioritaria para identificación',
    icon: 'filter_vintage',
    color: '#db2777',
    bgLight: '#fce7f3',
    border: '#f472b6',
    textContrast: '#831843',
    bgDark: '#500724',
    borderDark: '#be185d',
    textDark: '#fbcfe8',
  },
  {
    key: 'Arboles',
    category: 'Flora (Plantas)',
    label: 'Árbol (Magnoliopsida / Pinopsida / Liliopsida leñosas)',
    shortLabel: 'Árboles',
    scientific: 'Magnoliopsida / Pinopsida / Liliopsida leñosas',
    subdescription: 'Especies forestales y de gran porte',
    icon: 'park',
    color: '#15803d',
    bgLight: '#dcfce7',
    border: '#4ade80',
    textContrast: '#14532d',
    bgDark: '#052e16',
    borderDark: '#16a34a',
    textDark: '#bbf7d0',
  },
  {
    key: 'Arbustos_Herbaceas',
    category: 'Flora (Plantas)',
    label: 'Arbusto y Herbácea (Plantae vasculares)',
    shortLabel: 'Arbustos & Herbáceas',
    scientific: 'Plantae vasculares',
    subdescription: 'Arbustos, plantas de sotobosque y hierbas',
    icon: 'grass',
    color: '#65a30d',
    bgLight: '#ecfccb',
    border: '#a3e635',
    textContrast: '#365314',
    bgDark: '#1a2e05',
    borderDark: '#4d7c0f',
    textDark: '#d9f99d',
  },
  {
    key: 'Pteridophyta',
    category: 'Flora (Plantas)',
    label: 'Helecho y Afines (Pteridophyta / Bryophyta)',
    shortLabel: 'Helechos & Afines',
    scientific: 'Pteridophyta / Bryophyta',
    subdescription: 'Helechos, musgos y hepáticas',
    icon: 'energy_savings_leaf',
    color: '#0d9488',
    bgLight: '#ccfbf1',
    border: '#2dd4bf',
    textContrast: '#115e59',
    bgDark: '#042f2e',
    borderDark: '#0f766e',
    textDark: '#99f6e4',
  },

  // Compatibilidad histórica
  {
    key: 'Plantae',
    category: 'Flora (Plantas)',
    label: 'Flora General (Plantae)',
    shortLabel: 'Flora General',
    scientific: 'Plantae',
    icon: 'local_florist',
    color: '#166534',
    bgLight: '#dcfce7',
    border: '#86efac',
    textContrast: '#14532d',
    bgDark: '#052e16',
    borderDark: '#15803d',
    textDark: '#bbf7d0',
  },
];

export function getTaxonMeta(key?: string): TaxonGroupMeta {
  const found = TAXON_GROUPS_REGISTRY.find((item) => item.key === key);
  if (found) return found;
  // Default to Amphibia or Flora fallback
  return TAXON_GROUPS_REGISTRY[3]; // Amphibia
}

export interface TaxonomicHierarchy {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  taxonId?: string;
}

export interface Georeference {
  latitude: number;
  longitude: number;
  latitudeDMS: string;
  longitudeDMS: string;
  datum: 'WGS84';
  accuracyMeters: number;
  elevationMeters: number;
  locality: string;
  canton?: string;
  province: string;
  conservationArea: string; // SINAC: e.g. Área de Conservación Huetar Norte
  lifeZone: string; // Holdridge: e.g. Bosque Tropical Húmedo (bmh-T)
  microhabitat: string;
}

export interface SympatricSpecies {
  scientificName: string;
  commonName: string;
  count: number;
}

export interface Morphometrics {
  snoutVentLengthMm?: number; // LHC
  totalLengthMm?: number;
  weightGrams?: number;
  colorationAndAnatomy: string;
  ethologyAndReproduction: string;
  courtshipAndMating?: string; // Cortejo, rituales nupciales y selección sexual
  interspecificRelations?: string; // Relaciones intra/interespecíficas, territorialidad, depredación, defensas/toxinas
  confirmedScientificData?: string; // Datos de investigación científica confirmada (UCR/OET/SINAC/literatura)
  sympatricSpecies: SympatricSpecies[];
}

export interface BioacousticRecord {
  title: string;
  callType: string;
  dominantFrequencyRange: string;
  durationSeconds: number;
  audioPatternDescription: string;
  audioFileUrl?: string;
  audioDataUrl?: string; // Base64 data URL for recorded microphone audio or uploaded MP3/WAV
}

export interface PhotoRecord {
  id: string;
  url: string;
  label: string;
  description: string;
}

export type VitalityStatus = 'VIVO' | 'MUERTO';
export type VitalityCause = 'ATROPELLO' | 'DEPREDACION' | 'DESECACION' | 'ENFERMEDAD_HONGOS' | 'CAUSA_DESCONOCIDA' | 'OTRO';
export type LifeStage = 'HUEVO' | 'LARVA_RENACUAJO' | 'METAMORFO_JUVENIL' | 'SUBADULTO' | 'ADULTO' | 'NO_APLICA';
export type BiologicalSex = 'MACHO' | 'HEMBRA' | 'INDETERMINADO' | 'NO_APLICA';

export interface SightingEntry {
  id: string;
  timestamp: string; // e.g. 2026-10-10 21:15 CST
  date: string;
  observer: string;
  locality: string;
  coordinates?: string;
  count?: number;
  individualsCount?: number; // Alias for count
  microhabitat?: string;
  weather?: string;
  weatherConditions?: string; // Alias for weather
  temperatureC?: number;
  behaviorObserved: string;
  photoUrls?: string[];
  notes?: string;
  isCuriousFinding?: boolean;
  curiousFindingTitle?: string;
  curiousFindingDescription?: string;
  curiousFindingPhoto?: string;
  vitalityStatus?: VitalityStatus; // VIVO o MUERTO
  vitalityCause?: VitalityCause; // e.g. ATROPELLO
  vitalityCauseDetail?: string; // e.g. Atropello en carretera ruta 32
  lifeStage?: LifeStage; // Adulto, Renacuajo, Larva, Huevo, etc. o NO_APLICA
  sex?: BiologicalSex; // Macho, Hembra, Indeterminado o NO_APLICA
}

export interface SpecimenRecord {
  id: string;
  catalogNumber: string; // e.g. CAT. CR-BIO-2024-8842
  scientificName: string;
  commonName: string;
  taxonGroup: TaxonGroup;
  realm: string; // e.g. Neotropical
  collector: string;
  collectionDate: string; // e.g. 2024-10-24
  collectionTime: string; // e.g. 21:14 CST
  institutionCode: string; // e.g. UCR-MZ
  curationStatus: 'Verificada' | 'Pendiente' | 'En Revisión';
  darwinCoreSync: boolean;
  
  iucnStatus: {
    code: 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX' | 'DD';
    label: string;
    trend: string;
  };
  citesStatus: {
    appendix: string; // e.g. Apéndice II
    distribution: string; // e.g. Nativa Mesoamericana
  };

  taxonomy: TaxonomicHierarchy;
  heroImage: string;
  heroImageDescription: string;
  bioacoustics?: BioacousticRecord;
  georeference: Georeference;
  morphometrics: Morphometrics;
  additionalPhotos: PhotoRecord[];
  sightings?: SightingEntry[];
  fieldFolio: string;
  notes?: string;
}
