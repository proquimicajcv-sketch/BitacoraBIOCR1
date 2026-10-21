/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TaxonGroup } from '../types/specimen';

export type TaxonMacroCategory = 'Vertebrados' | 'Invertebrados y Hongos' | 'Flora (Plantas)';

export interface TaxonCategoryMeta {
  id: TaxonGroup;
  macroCategory: TaxonMacroCategory;
  label: string;
  scientificSubtitle: string;
  fullLabel: string;
  description: string;
  icon: string;
  color: string;
  bgLight: string;
  border: string;
  textContrast: string;
}

export const TAXON_MACRO_CATEGORIES: TaxonMacroCategory[] = [
  'Vertebrados',
  'Invertebrados y Hongos',
  'Flora (Plantas)',
];

export const TAXON_CATEGORIES: TaxonCategoryMeta[] = [
  // 1. VERTEBRADOS
  {
    id: 'Mammalia',
    macroCategory: 'Vertebrados',
    label: 'Mamíferos',
    scientificSubtitle: 'Mammalia',
    fullLabel: 'Mamífero (Mammalia)',
    description: 'Mamíferos terrestres, arborícolas y acuáticos de Costa Rica (felinos, monos, perezosos, dantas, murciélagos).',
    icon: 'pets',
    color: '#d97706', // Ámbar dorado
    bgLight: '#fef3c7',
    border: '#f59e0b',
    textContrast: '#78350f',
  },
  {
    id: 'Aves',
    macroCategory: 'Vertebrados',
    label: 'Aves',
    scientificSubtitle: 'Aves',
    fullLabel: 'Ave (Aves)',
    description: 'Avifauna de dosel, sotobosque, humedales y costas (trogones, tucanes, colibríes, tangaras).',
    icon: 'flutter_dash',
    color: '#0284c7', // Azul cielo
    bgLight: '#e0f2fe',
    border: '#0369a1',
    textContrast: '#075985',
  },
  {
    id: 'Reptilia',
    macroCategory: 'Vertebrados',
    label: 'Reptiles',
    scientificSubtitle: 'Reptilia',
    fullLabel: 'Reptil (Reptilia)',
    description: 'Serpientes venenosas y no venenosas, lagartijas, tortugas marinas/continentales y cocodrilos.',
    icon: 'pest_control',
    color: '#e11d48', // Carmesí
    bgLight: '#ffe4e6',
    border: '#be123c',
    textContrast: '#881337',
  },
  {
    id: 'Amphibia',
    macroCategory: 'Vertebrados',
    label: 'Anfibios',
    scientificSubtitle: 'Amphibia',
    fullLabel: 'Anfibio (Amphibia)',
    description: 'Ranas de torrente y de hojarasca, sapos, salamandras de montaña y cecilias de Costa Rica.',
    icon: 'flutter_dash',
    color: '#10b981', // Verde esmeralda
    bgLight: '#d1fae5',
    border: '#059669',
    textContrast: '#064e3b',
  },
  {
    id: 'Actinopterygii',
    macroCategory: 'Vertebrados',
    label: 'Peces',
    scientificSubtitle: 'Actinopterygii / Chondrichthyes',
    fullLabel: 'Pez (Actinopterygii / Chondrichthyes)',
    description: 'Ictiofauna dulceacuícola y marina (ríos de montaña, quebradas cristalinas, manglares y arrecifes).',
    icon: 'phishing',
    color: '#06b6d4', // Cian río
    bgLight: '#cffafe',
    border: '#0891b2',
    textContrast: '#164e63',
  },

  // 2. INVERTEBRADOS Y HONGOS
  {
    id: 'Insecta',
    macroCategory: 'Invertebrados y Hongos',
    label: 'Insectos / Artrópodos',
    scientificSubtitle: 'Insecta, Arachnida, Crustacea',
    fullLabel: 'Insecto / Artrópodo (Insecta, Arachnida, etc.)',
    description: 'Lepidópteros (mariposas/polillas), coleópteros (escarabajos), arácnidos, crustáceos y miriápodos.',
    icon: 'bug_report',
    color: '#8b5cf6', // Violeta
    bgLight: '#ede9fe',
    border: '#7c3aed',
    textContrast: '#5b21b6',
  },
  {
    id: 'Mollusca',
    macroCategory: 'Invertebrados y Hongos',
    label: 'Moluscos / Invertebrados',
    scientificSubtitle: 'Gastropoda, Bivalvia, Annelida',
    fullLabel: 'Molusco y Otro Invertebrado (Gastropoda, Bivalvia, Annelida)',
    description: 'Caracoles terrestres, babosas de bosque húmedo, bivalvos de río y anélidos (lombrices de tierra tropicales).',
    icon: 'grain',
    color: '#ec4899', // Fucsia/rosa
    bgLight: '#fce7f3',
    border: '#db2777',
    textContrast: '#831843',
  },
  {
    id: 'Fungi',
    macroCategory: 'Invertebrados y Hongos',
    label: 'Hongos y Líquenes',
    scientificSubtitle: 'Fungi / Lichenes',
    fullLabel: 'Hongo y Liquen (Fungi / Lichenes)',
    description: 'Hongos macroscópicos de descomposición, hongos bioluminiscentes, micorrizas y líquenes epífitos de bosques nubosos.',
    icon: 'spa',
    color: '#a855f7', // Púrpura micelio
    bgLight: '#f3e8ff',
    border: '#9333ea',
    textContrast: '#581c87',
  },

  // 3. FLORA (PLANTAS)
  {
    id: 'Orchidaceae',
    macroCategory: 'Flora (Plantas)',
    label: 'Orquídeas',
    scientificSubtitle: 'Orchidaceae',
    fullLabel: 'Orquídea (Orchidaceae)',
    description: 'Familia Orchidaceae: orquídeas epífitas y terrestres de alta diversidad en Costa Rica (Guaria Morada, Epidendrum, Pleurothallis).',
    icon: 'filter_vintage',
    color: '#f43f5e', // Rosa flor/magenta
    bgLight: '#ffe4e6',
    border: '#e11d48',
    textContrast: '#9f1239',
  },
  {
    id: 'Arboles',
    macroCategory: 'Flora (Plantas)',
    label: 'Árboles',
    scientificSubtitle: 'Magnoliopsida / Pinopsida / Liliopsida',
    fullLabel: 'Árbol (Magnoliopsida / Pinopsida leñosas)',
    description: 'Especies forestales y árboles de gran porte del dosel y subdosel (robles, ceibas, cedros amargos, higuerones).',
    icon: 'park',
    color: '#15803d', // Verde bosque profundo
    bgLight: '#dcfce7',
    border: '#16a34a',
    textContrast: '#14532d',
  },
  {
    id: 'Arbustos_Herbaceas',
    macroCategory: 'Flora (Plantas)',
    label: 'Arbustos y Herbáceas',
    scientificSubtitle: 'Plantae vasculares',
    fullLabel: 'Arbusto y Herbácea (Plantae vasculares)',
    description: 'Plantas de sotobosque, arbustos riparios, heliconias, bromelias terrestres y hierbas perennes tropicales.',
    icon: 'psychiatry',
    color: '#16a34a', // Verde vegetación
    bgLight: '#e8f5e9',
    border: '#2e7d32',
    textContrast: '#1b5e20',
  },
  {
    id: 'Pteridophyta',
    macroCategory: 'Flora (Plantas)',
    label: 'Helechos y Afines',
    scientificSubtitle: 'Pteridophyta / Bryophyta',
    fullLabel: 'Helecho y Afines (Pteridophyta / Bryophyta)',
    description: 'Helechos arborescentes (Cyatheaceae), licófitas, musgos y hepáticas epífitas de microcuencas y nacientes.',
    icon: 'nature',
    color: '#0d9488', // Verde azulado / teal
    bgLight: '#ccfbf1',
    border: '#0f766e',
    textContrast: '#115e59',
  },
];

const DEFAULT_TAXON_META: TaxonCategoryMeta = {
  id: 'Plantae',
  macroCategory: 'Flora (Plantas)',
  label: 'Plantas / Flora',
  scientificSubtitle: 'Plantae',
  fullLabel: 'Flora (Plantae)',
  description: 'Registro vegetal o botánico general en Costa Rica.',
  icon: 'local_florist',
  color: '#16a34a',
  bgLight: '#dcfce7',
  border: '#15803d',
  textContrast: '#14532d',
};

/**
 * Recupera los metadatos completos para cualquier grupo taxonómico con fallback resiliente.
 */
export function getTaxonMeta(group?: string): TaxonCategoryMeta {
  if (!group) return DEFAULT_TAXON_META;

  const found = TAXON_CATEGORIES.find(
    (c) => c.id === group || c.label.toLowerCase() === group.toLowerCase()
  );
  if (found) return found;

  const gLower = group.toLowerCase();

  // Mapeos heurísticos inteligentes
  if (gLower.includes('orquid') || gLower.includes('orchid')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Orchidaceae')!;
  }
  if (gLower.includes('árbol') || gLower.includes('arbol') || gLower.includes('tree')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Arboles')!;
  }
  if (gLower.includes('helecho') || gLower.includes('fern') || gLower.includes('pterido') || gLower.includes('musgo') || gLower.includes('bryo')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Pteridophyta')!;
  }
  if (gLower.includes('pez') || gLower.includes('peces') || gLower.includes('fish') || gLower.includes('actino') || gLower.includes('chondri')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Actinopterygii')!;
  }
  if (gLower.includes('molusc') || gLower.includes('caracol') || gLower.includes('babosa') || gLower.includes('lombriz') || gLower.includes('annelid')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Mollusca')!;
  }
  if (gLower.includes('hongo') || gLower.includes('fung') || gLower.includes('liquen') || gLower.includes('lichen')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Fungi')!;
  }
  if (gLower.includes('arbust') || gLower.includes('hierba') || gLower.includes('herb') || gLower.includes('sotobosque')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Arbustos_Herbaceas')!;
  }
  if (gLower.includes('plant') || gLower.includes('flora')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Arbustos_Herbaceas') || DEFAULT_TAXON_META;
  }
  if (gLower.includes('anfib') || gLower.includes('rana') || gLower.includes('salamand') || gLower.includes('sapo')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Amphibia')!;
  }
  if (gLower.includes('ave') || gLower.includes('pájaro') || gLower.includes('bird')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Aves')!;
  }
  if (gLower.includes('mam') || gLower.includes('mono') || gLower.includes('felino')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Mammalia')!;
  }
  if (gLower.includes('rept') || gLower.includes('serpient') || gLower.includes('lagart')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Reptilia')!;
  }
  if (gLower.includes('insect') || gLower.includes('artróp') || gLower.includes('maripos') || gLower.includes('araña')) {
    return TAXON_CATEGORIES.find((c) => c.id === 'Insecta')!;
  }

  return DEFAULT_TAXON_META;
}
