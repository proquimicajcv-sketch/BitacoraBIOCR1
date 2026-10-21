import React, { useState, useMemo } from 'react';
import {
  SpecimenRecord,
  TaxonGroup,
  TAXON_GROUPS_REGISTRY,
  getTaxonMeta,
  TaxonCategorySection,
} from '../types/specimen';
import { ThemeSwitcher } from './ThemeSwitcher';
import { handleImageOfflineFallback } from '../utils/offlineImageCache';

interface SpecimenCatalogViewProps {
  specimens: SpecimenRecord[];
  onSelectSpecimen: (specimen: SpecimenRecord) => void;
  onOpenNew: () => void;
  onOpenMap: () => void;
  onOpenDarwinCore: () => void;
  onOpenSyncBackup?: () => void;
  onOpenStatistics?: () => void;
  onGoHome?: () => void;
  onDeleteSpecimen?: (id: string) => void;
}

export const SpecimenCatalogView: React.FC<SpecimenCatalogViewProps> = ({
  specimens,
  onSelectSpecimen,
  onOpenNew,
  onOpenMap,
  onOpenDarwinCore,
  onOpenSyncBackup,
  onOpenStatistics,
  onGoHome,
  onDeleteSpecimen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Quick stats calculation for all registered taxonomic groups
  const groupStats = useMemo(() => {
    let totalSightings = 0;
    let totalIndividuals = 0;
    const counts: Record<string, { species: number; individuals: number; sightings: number }> = {};

    TAXON_GROUPS_REGISTRY.forEach((g) => {
      counts[g.key] = { species: 0, individuals: 0, sightings: 0 };
    });

    specimens.forEach((spec) => {
      if (!counts[spec.taxonGroup]) {
        counts[spec.taxonGroup] = { species: 0, individuals: 0, sightings: 0 };
      }
      const sList = spec.sightings || [];
      const sCount = sList.length;
      let indCount = 0;
      if (sCount > 0) {
        sList.forEach((s) => (indCount += s.individualsCount || 1));
      } else {
        indCount = 1;
      }

      totalSightings += sCount;
      totalIndividuals += indCount;

      counts[spec.taxonGroup].species += 1;
      counts[spec.taxonGroup].individuals += indCount;
      counts[spec.taxonGroup].sightings += sCount;
    });

    return { counts, totalSightings, totalIndividuals };
  }, [specimens]);

  const filtered = useMemo(() => {
    return specimens.filter((spec) => {
      // Group filter
      if (selectedGroup !== 'ALL' && spec.taxonGroup !== selectedGroup) {
        return false;
      }
      // Section filter
      if (selectedSection !== 'ALL') {
        const meta = getTaxonMeta(spec.taxonGroup);
        if (meta.category !== selectedSection) {
          return false;
        }
      }
      // Search query
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const meta = getTaxonMeta(spec.taxonGroup);
      return (
        spec.scientificName.toLowerCase().includes(query) ||
        spec.commonName.toLowerCase().includes(query) ||
        spec.catalogNumber.toLowerCase().includes(query) ||
        spec.georeference.locality.toLowerCase().includes(query) ||
        meta.shortLabel.toLowerCase().includes(query) ||
        meta.label.toLowerCase().includes(query) ||
        meta.scientific.toLowerCase().includes(query)
      );
    });
  }, [specimens, selectedGroup, selectedSection, searchQuery]);

  const categoriesList: { id: string; label: string; icon: string }[] = [
    { id: 'ALL', label: 'Todos los Reinos', icon: 'apps' },
    { id: 'Vertebrados', label: 'Vertebrados', icon: 'pets' },
    { id: 'Invertebrados y Hongos', label: 'Invertebrados & Hongos', icon: 'bug_report' },
    { id: 'Flora (Plantas)', label: 'Flora (Plantas)', icon: 'local_florist' },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#f8faf4] pb-20">
      {/* Top Header */}
      <header className="sticky top-0 inset-x-0 z-40 bg-[#f8faf4]/90 backdrop-blur-xl border-b border-[#e1e3dd]">
        <div className="h-16 px-4 flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2.5 text-left hover:opacity-85 transition-all cursor-pointer group"
            title="Ir a Inicio / Portada"
          >
            <div className="w-9 h-9 rounded-xl bg-[#002217] flex items-center justify-center text-[#6cf8bb] group-hover:bg-[#006c49] transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">cottage</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-[18px] text-[#002217] tracking-tight leading-tight group-hover:text-[#006c49] transition-colors">
                  BioBitácora Costa Rica
                </h1>
                <span className="text-[10px] font-mono text-[#006c49] font-bold bg-[#006c49]/10 px-1.5 py-0.5 rounded">
                  Inicio
                </span>
              </div>
              <p className="text-[11px] text-[#414844]">
                Elaborado por: <strong className="text-[#006c49] font-bold">Ing. Carvajal V.</strong>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            {onOpenStatistics && (
              <button
                onClick={onOpenStatistics}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3] text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                title="Ver estadísticas y gráficas detalladas"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">analytics</span>
                <span className="hidden sm:inline">Estadísticas</span>
              </button>
            )}
            <button
              onClick={onOpenMap}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#f2f4ee] text-[#002217] border border-[#c1c8c3] text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">map</span>
              <span className="hidden sm:inline">Mapa Costa Rica</span>
            </button>
            <button
              onClick={onOpenNew}
              className="px-3.5 py-1.5 rounded-xl bg-[#002217] hover:bg-[#0f382a] text-white text-xs font-bold flex items-center gap-1 shadow active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">add</span>
              <span>Nuevo Registro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {/* Banner with Stats & Darwin Core pill */}
        <div className="p-4 rounded-2xl bg-[#0f382a] text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6cf8bb] font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#6cf8bb] animate-pulse" />
              Base de Datos Científica Activa
            </span>
            <h2 className="text-[20px] font-bold leading-tight">
              Catálogo de Especímenes y Registros de Campo
            </h2>
            <p className="text-xs text-[#79a28f]">
              {specimens.length} especies curadas • {groupStats.totalSightings} avistamientos de campo • {groupStats.totalIndividuals} individuos contabilizados • Darwin Core
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {onOpenStatistics && (
              <button
                onClick={onOpenStatistics}
                className="px-3 py-2 rounded-xl bg-[#6cf8bb] hover:bg-[#85f9c9] text-[#002116] text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                <span>Gráficas &amp; Estadísticas</span>
              </button>
            )}
            {onOpenSyncBackup && (
              <button
                onClick={onOpenSyncBackup}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#6cf8bb] text-xs font-mono font-bold flex items-center gap-1.5 border border-[#6cf8bb]/30 transition-all cursor-pointer"
                title="Copia de seguridad en JSON y sincronización"
              >
                <span className="material-symbols-outlined text-[16px]">sync_saved_locally</span>
                <span>Respaldo JSON</span>
              </button>
            )}
            <button
              onClick={onOpenDarwinCore}
              className="px-3 py-2 rounded-xl bg-[#002217] hover:bg-black text-[#c1ecd7] text-xs font-mono font-bold flex items-center gap-1.5 border border-[#6cf8bb]/30 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#6cf8bb]">download</span>
              <span>Darwin Core</span>
            </button>
          </div>
        </div>

        {/* ESPACIO DENTRO DE LA COLECCIÓN PARA CONTEO GENERAL Y AGRUPACIÓN TAXONÓMICA */}
        <div className="p-4 rounded-2xl bg-white border border-[#c1c8c3]/80 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#f0f2ec] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">calculate</span>
              <div>
                <h3 className="font-bold text-sm text-[#002217] leading-tight">
                  Panel de Conteo de Biodiversidad en la Colección
                </h3>
                <span className="text-[11px] text-[#717974]">
                  Conteo general: <strong>{specimens.length}</strong> especies registradas | <strong>{groupStats.totalSightings}</strong> avistamientos en campo | <strong>{groupStats.totalIndividuals}</strong> individuos
                </span>
              </div>
            </div>

            {onOpenStatistics && (
              <button
                onClick={onOpenStatistics}
                className="text-xs font-bold text-[#006c49] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver estadísticas y gráficas</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            )}
          </div>

          {/* Selector de Gran Categoría: Vertebrados, Invertebrados & Hongos, Flora */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[#f0f2ec]/80 pb-2">
            {categoriesList.map((cat) => {
              const isSelected = selectedSection === cat.id;
              const countInCat = cat.id === 'ALL'
                ? specimens.length
                : specimens.filter((s) => getTaxonMeta(s.taxonGroup).category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedSection(cat.id);
                    // If the currently selected group doesn't belong to this section, reset group to ALL
                    if (cat.id !== 'ALL' && selectedGroup !== 'ALL') {
                      const meta = getTaxonMeta(selectedGroup);
                      if (meta.category !== cat.id) {
                        setSelectedGroup('ALL');
                      }
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                      : 'bg-[#f4f6f0] text-[#414844] hover:bg-[#e7eae1]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-[#6cf8bb]/20 text-[#6cf8bb]' : 'bg-[#e1e3dd] text-[#191c19]'}`}>
                    {countInCat}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mini Cards con Conteos y Pequeñas Gráficas de Barra para cada Grupo Taxonómico */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
            {TAXON_GROUPS_REGISTRY
              .filter((tax) => selectedSection === 'ALL' || tax.category === selectedSection)
              .map((tax) => {
                const data = groupStats.counts[tax.key] || { species: 0, individuals: 0, sightings: 0 };
                const pct = specimens.length > 0 ? (data.species / specimens.length) * 100 : 0;
                const isSelected = selectedGroup === tax.key;

                return (
                  <button
                    key={tax.key}
                    onClick={() => setSelectedGroup(isSelected ? 'ALL' : tax.key)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'ring-2 ring-[#006c49] bg-white border-[#006c49] shadow-sm'
                        : 'bg-[#fcfdfa] hover:bg-white border-[#e1e3dd] hover:border-[#006c49]/40'
                    }`}
                    title={`${tax.label}: ${tax.scientific}${tax.subdescription ? ' - ' + tax.subdescription : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[19px]" style={{ color: tax.color }}>
                        {tax.icon}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{ backgroundColor: tax.bgLight, color: tax.textContrast }}
                      >
                        {data.species}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-[#002217] block leading-tight truncate">
                        {tax.shortLabel}
                      </span>
                      <span className="text-[10px] text-[#717974] block font-mono truncate">
                        {data.sightings} avist. • {data.individuals} inds.
                      </span>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="w-full bg-[#f0f2ec] rounded-full h-1.5 overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, data.species > 0 ? 10 : 0)}%`,
                          backgroundColor: tax.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#717974] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por especie, nombre común, orquídea, insecto, localidad..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#c1c8c3] text-xs text-[#191c19] focus:outline-none focus:ring-2 focus:ring-[#006c49]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717974] hover:text-[#191c19]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Taxon Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedGroup === 'ALL'
                  ? 'bg-[#002217] text-[#6cf8bb] shadow-sm'
                  : 'bg-white text-[#414844] border border-[#c1c8c3]/60 hover:bg-[#edefe9]'
              }`}
            >
              Todos ({filtered.length})
            </button>
            {TAXON_GROUPS_REGISTRY
              .filter((tax) => selectedSection === 'ALL' || tax.category === selectedSection)
              .map((tax) => {
                const count = groupStats.counts[tax.key]?.species || 0;
                const isSelected = selectedGroup === tax.key;
                return (
                  <button
                    key={tax.key}
                    onClick={() => setSelectedGroup(isSelected ? 'ALL' : tax.key)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#002217] text-white shadow-sm'
                        : 'bg-white text-[#414844] border border-[#c1c8c3]/60 hover:bg-[#edefe9]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ color: tax.color }}>
                      {tax.icon}
                    </span>
                    <span>{tax.shortLabel}</span>
                    <span className="text-[10px] font-mono text-[#717974]">({count})</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Specimen Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {filtered.map((specimen) => {
            const sightingsCount = specimen.sightings?.length || 0;
            const meta = getTaxonMeta(specimen.taxonGroup);
            return (
              <div
                key={specimen.id}
                onClick={() => onSelectSpecimen(specimen)}
                className="bg-white rounded-2xl border border-[#c1c8c3]/70 overflow-hidden shadow-sm hover:shadow-md hover:border-[#006c49]/50 transition-all cursor-pointer flex flex-col group"
              >
                {/* Card Photo Header */}
                <div className="relative w-full h-44 bg-[#0f382a] overflow-hidden">
                  <img
                    src={specimen.heroImage || '/isthmohyla_nacientes.jpg'}
                    alt={specimen.scientificName}
                    onError={(e) => {
                      handleImageOfflineFallback(e.currentTarget as HTMLImageElement, '/isthmohyla_nacientes.jpg');
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  {/* Catalog Pill */}
                  <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md text-[#002217] font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {specimen.catalogNumber}
                  </span>

                  {/* Group & Sightings badges */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 flex-wrap justify-end">
                    {sightingsCount > 0 && (
                      <span className="bg-[#0284c7] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">visibility</span>
                        <span>{sightingsCount} avist.</span>
                      </span>
                    )}
                    <span
                      className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-md border border-white/20"
                      style={{ backgroundColor: `${meta.color}ee`, color: '#ffffff' }}
                      title={`${meta.label}: ${meta.scientific}`}
                    >
                      <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
                      <span>{meta.shortLabel}</span>
                    </span>
                  </div>

                  {/* Bottom Image Caption */}
                  <div className="absolute bottom-2 left-2.5 right-2.5">
                    <h3 className="text-white font-bold text-sm italic truncate">
                      {specimen.scientificName}
                    </h3>
                    <p className="text-[#e1e3dd] text-xs truncate">
                      {specimen.commonName}
                    </p>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2.5 text-xs text-[#414844]">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[11px] text-[#717974] truncate">
                      <span className="material-symbols-outlined text-[14px] text-[#006c49]">place</span>
                      <span className="truncate">{specimen.georeference.locality}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[#717974] truncate">
                      <span className="material-symbols-outlined text-[14px] text-[#16a34a]">landscape</span>
                      <span className="truncate">{specimen.georeference.lifeZone || 'Zona de Vida Holdridge'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f2ec] text-[11px]">
                    <span className="font-mono text-[#006c49] font-bold">
                      {specimen.georeference.elevationMeters} msnm
                    </span>
                    <span className="text-[#002217] font-bold group-hover:text-[#006c49] flex items-center gap-0.5">
                      <span>Ver Ficha</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#c1c8c3]/60 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-[#717974]">search_off</span>
            <p className="font-bold text-sm text-[#002217]">No se encontraron especímenes</p>
            <p className="text-xs text-[#717974]">
              Prueba con otro término de búsqueda o selecciona "Todos".
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
