import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { getCostaRicaBiologicalData } from './src/utils/costaRicaSpeciesKnowledge';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.resolve('public')));

// Initialize GoogleGenAI with mandatory telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DB_DIR = path.resolve('data');
const DB_FILE = path.join(DB_DIR, 'specimens-database.json');
const DELETED_FILE = path.join(DB_DIR, 'deleted-specimens.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

function getDeletedIds(): Set<string> {
  if (fs.existsSync(DELETED_FILE)) {
    try {
      const arr = JSON.parse(fs.readFileSync(DELETED_FILE, 'utf-8'));
      if (Array.isArray(arr)) return new Set(arr);
    } catch {}
  }
  return new Set();
}

function saveDeletedId(id: string) {
  if (!id) return;
  const current = getDeletedIds();
  current.add(id);
  try {
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(current), null, 2), 'utf-8');
  } catch {}
}

function removeDeletedId(id: string) {
  if (!id) return;
  const current = getDeletedIds();
  if (current.delete(id)) {
    try {
      fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(current), null, 2), 'utf-8');
    } catch {}
  }
}

/**
 * Server JSON Database Endpoints for Cross-Device Persistence
 */
let serverDbLastModified = Date.now();
const DEVICES_DIR = path.join(process.cwd(), 'data', 'devices');
if (!fs.existsSync(DEVICES_DIR)) {
  fs.mkdirSync(DEVICES_DIR, { recursive: true });
}

function getTargetDbFile(deviceId?: string): string {
  if (!deviceId || typeof deviceId !== 'string') {
    return DB_FILE;
  }
  const safeId = deviceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(DEVICES_DIR, `${safeId}.json`);
}

app.get('/api/database/specimens', (req: Request, res: Response): void => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const deletedSet = getDeletedIds();

    // Check central shared database first for cross-device synchronization
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        const stats = fs.statSync(DB_FILE);
        const filteredData = data.filter((s: any) => s && s.id && !deletedSet.has(s.id));
        res.json({
          success: true,
          data: filteredData,
          deletedIds: Array.from(deletedSet),
          deviceId: deviceId || 'global',
          lastModified: Math.max(serverDbLastModified, stats.mtimeMs),
        });
        return;
      }
    }

    // Fallback to device-specific file if central not found
    if (deviceId) {
      const targetFile = getTargetDbFile(deviceId);
      if (fs.existsSync(targetFile)) {
        const content = fs.readFileSync(targetFile, 'utf-8');
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          const stats = fs.statSync(targetFile);
          const filteredData = data.filter((s: any) => s && s.id && !deletedSet.has(s.id));
          res.json({
            success: true,
            data: filteredData,
            deletedIds: Array.from(deletedSet),
            deviceId,
            lastModified: stats.mtimeMs,
          });
          return;
        }
      }
    }

    res.json({ success: true, data: [], deletedIds: Array.from(deletedSet), lastModified: 0 });
  } catch (err: any) {
    console.warn('Error reading database file:', err);
    res.json({ success: true, data: [], deletedIds: Array.from(getDeletedIds()), lastModified: 0 });
  }
});

function mergeSpecimens(existingList: any[], incomingList: any[]): any[] {
  const deletedSet = getDeletedIds();
  const cleanExisting = (Array.isArray(existingList) ? existingList : []).filter(
    (e: any) => e && e.id && !deletedSet.has(e.id)
  );
  const cleanIncoming = (Array.isArray(incomingList) ? incomingList : []).filter(
    (i: any) => i && i.id && !deletedSet.has(i.id)
  );

  if (cleanExisting.length === 0) return cleanIncoming;
  if (cleanIncoming.length === 0) return cleanExisting;

  const result: any[] = [...cleanExisting];

  for (const incoming of cleanIncoming) {
    const idx = result.findIndex(
      (e) => (incoming.id && e.id === incoming.id) ||
             (incoming.scientificName && e.scientificName === incoming.scientificName)
    );

    if (idx === -1) {
      result.push(incoming);
    } else {
      const existing = result[idx];

      // Merge sightings: UNION by id, NEVER LOSE A SIGHTING!
      const existingSightings = Array.isArray(existing.sightings) ? existing.sightings : [];
      const incomingSightings = Array.isArray(incoming.sightings) ? incoming.sightings : [];

      const getSightingKey = (s: any) => {
        if (s && s.id) return String(s.id);
        const loc = s?.locality || '';
        const dt = s?.date || s?.timestamp || '';
        const cnt = s?.individualsCount ?? s?.count ?? '';
        return `sight_${dt}_${loc}_${cnt}`;
      };

      const sightingMap = new Map<string, any>();
      for (const s of existingSightings) {
        if (s) {
          const key = getSightingKey(s);
          const c = Number(s.individualsCount ?? s.count) || 1;
          sightingMap.set(key, { ...s, id: s.id || key, count: c, individualsCount: c });
        }
      }
      for (const s of incomingSightings) {
        if (s) {
          const key = getSightingKey(s);
          const old = sightingMap.get(key);
          const c = Number(s.individualsCount ?? s.count ?? old?.individualsCount ?? old?.count) || 1;
          const incomingCurious = s.curiousFindingPhoto;
          const oldCurious = old?.curiousFindingPhoto;
          const isMacho = s.id === 'sight-dota-20261009' || s.isCuriousFinding || s.curiousFindingTitle?.includes('Macho');
          let finalCuriousPhoto = incomingCurious;
          if (isMacho) {
            if (incomingCurious && !incomingCurious.includes('isthmohyla_nacientes') && !incomingCurious.includes('eye_zoom')) {
              finalCuriousPhoto = incomingCurious;
            } else if (oldCurious && !oldCurious.includes('isthmohyla_nacientes') && !oldCurious.includes('eye_zoom')) {
              finalCuriousPhoto = oldCurious;
            } else {
              finalCuriousPhoto = '/hallazgo_macho_un_ojo.jpg';
            }
          } else {
            const incomingIsCustom = incomingCurious && (incomingCurious.startsWith('/uploads/') || incomingCurious.startsWith('data:') || incomingCurious.startsWith('blob:'));
            const oldIsCustom = oldCurious && (oldCurious.startsWith('/uploads/') || oldCurious.startsWith('data:') || oldCurious.startsWith('blob:'));
            finalCuriousPhoto = incomingIsCustom ? incomingCurious : (incomingCurious || (oldIsCustom ? oldCurious : incomingCurious));
          }

          const mergedItem = old
            ? { ...old, ...s, id: s.id || old.id || key, count: c, individualsCount: c, curiousFindingPhoto: finalCuriousPhoto, photoUrls: finalCuriousPhoto ? [finalCuriousPhoto] : s.photoUrls }
            : { ...s, id: s.id || key, count: c, individualsCount: c, curiousFindingPhoto: finalCuriousPhoto, photoUrls: finalCuriousPhoto ? [finalCuriousPhoto] : s.photoUrls };
          sightingMap.set(key, mergedItem);
        }
      }

      const mergedSightings = Array.from(sightingMap.values()).sort((a, b) => {
        const dateA = a.date || a.timestamp || '';
        const dateB = b.date || b.timestamp || '';
        return dateB.localeCompare(dateA);
      });

      // Merge additional photos: UNION by id/label with custom photo preservation
      const existingPhotos = Array.isArray(existing.additionalPhotos) ? existing.additionalPhotos : [];
      const incomingPhotos = Array.isArray(incoming.additionalPhotos) ? incoming.additionalPhotos : [];
      const photoMap = new Map<string, any>();
      for (const p of existingPhotos) {
        if (p && (p.id || p.label)) photoMap.set(p.id || p.label, p);
      }
      for (const p of incomingPhotos) {
        if (p && (p.id || p.label)) {
          const key = p.id || p.label;
          const old = photoMap.get(key);
          if (!old) {
            photoMap.set(key, p);
          } else {
            const isMacho = key === 'photo-4' || (old.label && old.label.toLowerCase().includes('macho tuerto')) || (p.label && p.label.toLowerCase().includes('macho tuerto'));
            let finalUrl = p.url;
            if (isMacho) {
              if (p.url && !p.url.includes('isthmohyla_nacientes') && !p.url.includes('eye_zoom')) {
                finalUrl = p.url;
              } else if (old.url && !old.url.includes('isthmohyla_nacientes') && !old.url.includes('eye_zoom')) {
                finalUrl = old.url;
              } else {
                finalUrl = '/hallazgo_macho_un_ojo.jpg';
              }
            } else {
              const incomingIsCustom = p.url && (p.url.startsWith('/uploads/') || p.url.startsWith('data:') || p.url.startsWith('blob:'));
              const oldIsCustom = old.url && (old.url.startsWith('/uploads/') || old.url.startsWith('data:') || old.url.startsWith('blob:'));
              finalUrl = incomingIsCustom ? p.url : (p.url || (oldIsCustom ? old.url : p.url));
            }
            photoMap.set(key, { ...old, ...p, url: finalUrl });
          }
        }
      }
      const mergedPhotos = Array.from(photoMap.values());

      const incomingHero = incoming.heroImage;
      const oldHero = existing.heroImage;
      const incomingHeroCustom = incomingHero && (incomingHero.startsWith('/uploads/') || incomingHero.startsWith('data:'));
      const oldHeroCustom = oldHero && (oldHero.startsWith('/uploads/') || oldHero.startsWith('data:'));
      const finalHero = incomingHeroCustom ? incomingHero : (oldHeroCustom ? oldHero : incomingHero || oldHero);

      result[idx] = {
        ...existing,
        ...incoming,
        heroImage: finalHero,
        sightings: mergedSightings,
        additionalPhotos: mergedPhotos,
      };
    }
  }

  return result;
}

app.post('/api/database/specimens', (req: Request, res: Response): void => {
  try {
    const { specimens, lastModified, deviceId, deletedIds } = req.body;
    if (!Array.isArray(specimens)) {
      res.status(400).json({ success: false, error: 'Formato inválido' });
      return;
    }

    if (Array.isArray(deletedIds)) {
      for (const dId of deletedIds) {
        if (typeof dId === 'string' && dId) {
          saveDeletedId(dId);
        }
      }
    }

    // If any incoming specimen was explicitly provided, un-delete it
    for (const s of specimens) {
      if (s && s.id) {
        removeDeletedId(s.id);
      }
    }

    const updatedTime = Number(lastModified) || Date.now();
    serverDbLastModified = updatedTime;

    // Smart-merge with existing DB so sightings from ANY device are never lost
    let finalSpecimens = specimens;
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const currentData = JSON.parse(content);
        if (Array.isArray(currentData) && currentData.length > 0) {
          finalSpecimens = mergeSpecimens(currentData, specimens);
        }
      } catch (err) {
        console.warn('Error reading DB_FILE for merge:', err);
      }
    }

    // Strictly filter out any deleted specimen
    const currentDeleted = getDeletedIds();
    finalSpecimens = finalSpecimens.filter((s: any) => s && s.id && !currentDeleted.has(s.id));

    // CRITICAL: Always write merged database to DB_FILE so all devices stay updated
    fs.writeFileSync(DB_FILE, JSON.stringify(finalSpecimens, null, 2), 'utf-8');

    // Also write device backup if specified
    if (deviceId) {
      const targetFile = getTargetDbFile(deviceId);
      try {
        fs.writeFileSync(targetFile, JSON.stringify(finalSpecimens, null, 2), 'utf-8');
      } catch {}
    }

    res.json({
      success: true,
      data: finalSpecimens,
      count: finalSpecimens.length,
      deletedIds: Array.from(currentDeleted),
      deviceId: deviceId || 'global',
      lastModified: updatedTime,
      message: 'Base de datos y avistamientos sincronizados permanentemente para todos los dispositivos',
    });
  } catch (err: any) {
    console.error('Error writing database file:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/database/specimens/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'ID requerido' });
      return;
    }

    saveDeletedId(id);
    serverDbLastModified = Date.now();

    // 1. Purge from central DB_FILE
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const currentData = JSON.parse(content);
        if (Array.isArray(currentData)) {
          const filtered = currentData.filter((s: any) => s && s.id !== id);
          fs.writeFileSync(DB_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
        }
      } catch (err) {
        console.warn('Error purging from DB_FILE on delete:', err);
      }
    }

    // 2. Purge from all device-specific backup files
    if (fs.existsSync(DEVICES_DIR)) {
      try {
        const files = fs.readdirSync(DEVICES_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(DEVICES_DIR, file);
            try {
              const devContent = fs.readFileSync(filePath, 'utf-8');
              const devData = JSON.parse(devContent);
              if (Array.isArray(devData)) {
                const devFiltered = devData.filter((s: any) => s && s.id !== id);
                fs.writeFileSync(filePath, JSON.stringify(devFiltered, null, 2), 'utf-8');
              }
            } catch {}
          }
        }
      } catch {}
    }

    res.json({
      success: true,
      deletedId: id,
      deletedIds: Array.from(getDeletedIds()),
      lastModified: serverDbLastModified,
      message: 'Espécimen eliminado permanentemente en servidor y dispositivos vinculados',
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/database/specimens/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to export central JSON file directly
app.get('/api/database/export-json', (_req: Request, res: Response): void => {
  try {
    if (fs.existsSync(DB_FILE)) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="BioBitacora_CR_Respaldo_${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.setHeader('Content-Type', 'application/json');
      res.sendFile(DB_FILE);
      return;
    }
    res.status(404).json({ success: false, error: 'No existe archivo central de base de datos' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to import and broadcast a JSON database file
app.post('/api/database/import-json', (req: Request, res: Response): void => {
  try {
    const payload = req.body;
    let recordsToImport: any[] | null = null;
    if (Array.isArray(payload)) {
      recordsToImport = payload;
    } else if (payload && Array.isArray(payload.specimens)) {
      recordsToImport = payload.specimens;
    }

    if (!recordsToImport || recordsToImport.length === 0) {
      res.status(400).json({ success: false, error: 'El archivo JSON no contiene una lista válida de especímenes' });
      return;
    }

    let finalImport = recordsToImport;
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const currentData = JSON.parse(content);
        if (Array.isArray(currentData) && currentData.length > 0) {
          finalImport = mergeSpecimens(currentData, recordsToImport);
        }
      } catch {}
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(finalImport, null, 2), 'utf-8');
    serverDbLastModified = Date.now();

    res.json({
      success: true,
      data: finalImport,
      count: finalImport.length,
      lastModified: serverDbLastModified,
      message: `¡Archivo JSON importado y sincronizado! ${finalImport.length} registros y todos los avistamientos actualizados en todos los dispositivos.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to upload and persist photos locally in public folder
const UPLOADS_DIR = path.resolve('public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

// Resilient model candidate list using official current Gemini models
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

async function generateWithFallback(options: {
  contents: any;
  config?: any;
}): Promise<any> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout de 6s en ${model}`)), 6000)
      );

      const response: any = await Promise.race([callPromise, timeoutPromise]);
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[AI Gemini] Modelo ${model} (${err?.message?.slice(0, 60)}...)`);
      lastError = err;
      // If project quota is exhausted (429), all candidate models on this key will fail with 429; fall back immediately
      if (err?.status === 429 || (err?.message && (err.message.includes('quota') || err.message.includes('429')))) {
        break;
      }
    }
  }
  throw lastError || new Error('No se pudo generar respuesta con ninguno de los modelos de IA disponibles.');
}

app.post('/api/upload-photo', (req: Request, res: Response): void => {
  try {
    const { base64Data, filename, prefix } = req.body;
    if (!base64Data) {
      res.status(400).json({ success: false, error: 'No se envió imagen' });
      return;
    }
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const ext = base64Data.startsWith('data:image/png') ? 'png' : base64Data.startsWith('data:image/webp') ? 'webp' : 'jpg';
    const cleanPrefix = (prefix || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseName = filename ? filename.replace(/[^a-zA-Z0-9_.-]/g, '_') : `foto.${ext}`;
    const safeName = `${cleanPrefix}_${Date.now()}_${baseName}`;
    const targetPath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(targetPath, buffer);
    const publicUrl = `/uploads/${safeName}`;
    res.json({ success: true, url: publicUrl, filename: safeName, size: buffer.length });
  } catch (err: any) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Helper to fetch image and convert to base64 if an HTTP URL or local path is supplied
 */
async function getImagePart(imageUrl?: string, imageBase64?: string): Promise<{ mimeType: string; data: string } | null> {
  if (imageBase64) {
    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      return {
        mimeType: matches[1],
        data: matches[2],
      };
    }
    return {
      mimeType: 'image/jpeg',
      data: imageBase64,
    };
  }

  if (imageUrl && imageUrl.startsWith('/')) {
    const localRel = imageUrl.replace(/^\//, '');
    let localPath = path.join(process.cwd(), 'public', localRel);
    if (!fs.existsSync(localPath) && localRel.startsWith('uploads/')) {
      localPath = path.join(UPLOADS_DIR, path.basename(localRel));
    }
    if (fs.existsSync(localPath)) {
      try {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase().replace('.', '');
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return {
          mimeType: mime,
          data: buffer.toString('base64'),
        };
      } catch (err) {
        console.warn('Error reading local image:', err);
      }
    }
  }

  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    try {
      const resp = await fetch(imageUrl);
      if (!resp.ok) return null;
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        mimeType: contentType.split(';')[0],
        data: buffer.toString('base64'),
      };
    } catch (err) {
      console.warn('Error fetching image from URL:', err);
      return null;
    }
  }

  return null;
}

interface LocationContext {
  locality?: string;
  province?: string;
  elevation?: number | string;
  lifeZone?: string;
  microhabitat?: string;
  coordinates?: { lat: number; lng: number };
}

function getCostaRicanFallbackSpecies(term: string, taxonGroupHint?: string, locCtx?: LocationContext) {
  return getCostaRicaBiologicalData(term, taxonGroupHint, {
    locality: locCtx?.locality,
    province: locCtx?.province,
    elevation: locCtx?.elevation ? Number(locCtx.elevation) : undefined,
    lifeZone: locCtx?.lifeZone,
    microhabitat: locCtx?.microhabitat,
  });
}

/**
 * AI Species Recognition & Scientific Auto-Fill API Endpoint
 */
app.post('/api/ai/identify-specimen', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl, imageBase64, userNotes, locationHint } = req.body;
    const imagePart = await getImagePart(imageUrl, imageBase64);

    const promptText = `
Eres un distinguido biólogo taxónomo y curador de museo especializado en la biodiversidad de Costa Rica y el Neotrópico (UCR, INBio, OET, SINAC).
Analiza detalladamente esta fotografía de campo del espécimen biológico.
${locationHint ? `Pista de ubicación en Costa Rica: ${locationHint}` : ''}
${userNotes ? `Notas de campo adicionales: ${userNotes}` : ''}

Tu tarea es proveer información científica fidedigna sobre:
1. Identificación taxonómica completa (género, especie, nombre común en español/inglés, reino, filo, clase, orden, familia, género, taxon ID ITIS/NCBI).
2. Estado de conservación UICN y CITES con distribución biogeográfica en Costa Rica.
3. Cromática y Anatomía detallada.
4. Etología y Comportamiento diario (forrajeo, horarios de actividad, termorregulación).
5. Cortejo y Reproducción (rituales nupciales, amplexo/cortejo, oviposición o anidación, masa de huevos/crías, cuidado parental).
6. Relaciones intra e interespecíficas (territorialidad entre individuos, competencia simpátrica, depredadores naturales en Costa Rica y defensas químicas/alcaloides/veneno/aposematismo).
7. Datos importantes de investigación científica confirmada (estudios de campo UCR, OET, SINAC, Smithsonian o descubrimientos publicados sobre la especie).
8. Zona de vida de Holdridge en Costa Rica (código y nombre: bmh-T, bp-PM, bs-T, bp-MB, etc.), rango de elevación y microhábitat específico.
9. Bioacústica si emite sonidos.
10. Puntaje de confianza (0.0 a 1.0) y explicación diagnóstica.

Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "scientificName": "Género especie",
  "commonName": "Nombre común en español / Common English name",
  "taxonGroup": "Amphibia" | "Aves" | "Mammalia" | "Insecta" | "Reptilia" | "Plantae",
  "realm": "Neotropical",
  "taxonomy": {
    "kingdom": "Animalia",
    "phylum": "Chordata",
    "class": "Amphibia",
    "order": "Anura",
    "family": "Hylidae",
    "genus": "Agalychnis",
    "species": "callidryas",
    "taxonId": "8408"
  },
  "iucnStatus": {
    "code": "LC",
    "label": "Preocupación Menor",
    "trend": "Población Estable"
  },
  "citesStatus": {
    "appendix": "Apéndice II",
    "distribution": "Nativa Mesoamericana"
  },
  "morphometrics": {
    "snoutVentLengthMm": 58.0,
    "totalLengthMm": 58.0,
    "weightGrams": 15.0,
    "colorationAndAnatomy": "Descripción cromática y diagnóstica detallada...",
    "ethologyAndReproduction": "Descripción de comportamiento general...",
    "courtshipAndMating": "Ritual de cortejo, vocalizaciones nupciales, amplexo axilar y anidación sobre hojas suspendidas...",
    "interspecificRelations": "Territorialidad entre machos por sitios de canto, depredación por serpientes Leptodeira septentrionalis y avispas Polybia, defensas...",
    "confirmedScientificData": "Investigaciones de la OET en La Selva y Boston University demostraron eclosión inducida por vibraciones sísmicas de depredadores...",
    "sympatricSpecies": [
      { "scientificName": "Nombre científico", "commonName": "Nombre común", "count": 2 }
    ]
  },
  "suggestedHabitat": {
    "lifeZone": "Bosque Muy Húmedo Tropical (bmh-T)",
    "microhabitat": "Estrato arbustivo sobre charca temporal de lluvia...",
    "elevationMeters": 68,
    "locality": "Estación La Selva, Sarapiquí",
    "province": "Heredia, Costa Rica",
    "conservationArea": "Área de Conservación Arenal Huetar Norte (ACAHN)"
  },
  "bioacoustics": {
    "title": "Canto de Anuncio",
    "callType": "Vocalización Territorial",
    "dominantFrequencyRange": "1.8 - 2.4 kHz",
    "durationSeconds": 24,
    "audioPatternDescription": "\\"Chack-chack\\" gutural monotonal"
  },
  "confidenceScore": 0.95,
  "identificationRationale": "La imagen muestra pupilas verticales rojas y membrana nictitante reticulada diagnóstica."
}
`;

    const contents: Array<{
      role?: string;
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }> = [];

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: promptText },
    ];

    if (imagePart) {
      parts.push({
        inlineData: {
          mimeType: imagePart.mimeType,
          data: imagePart.data,
        },
      });
    }

    contents.push({ parts });

    const response = await generateWithFallback({
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(textOutput);
    } catch {
      const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.warn('[AI Gemini Fallback] Error en identificación de imagen, aplicando catálogo taxonómico de Costa Rica:', error?.message);
    const hint = req.body.locationHint || req.body.userNotes || 'Rana de ojos rojos';
    const fallbackData = getCostaRicanFallbackSpecies(hint, 'Amphibia');
    res.json({
      success: true,
      data: fallbackData,
      isOfflineFallback: true,
    });
  }
});

/**
 * AI Scientific Enrichment Endpoint: Nombre científico, Nombre común, Taxonomía,
 * Anatomía, Cortejo, Etología, Relaciones ecológicas y Datos confirmados
 * Incorporates site-specific geography, elevation, Holdridge life zones and academic citations
 */
app.post('/api/ai/enrich-scientific-data', async (req: Request, res: Response): Promise<void> => {
  const {
    scientificName,
    commonName,
    taxonGroup,
    query,
    locality,
    province,
    elevation,
    lifeZone,
    coordinates,
    microhabitat,
  } = req.body;
  const queryTerm = (query || scientificName || commonName || '').trim();
  const locCtx: LocationContext = { locality, province, elevation, lifeZone, coordinates, microhabitat };

  try {
    if (!queryTerm) {
      res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos el nombre común o el nombre científico de la especie.',
      });
      return;
    }

    const hasLocation = locality || province || elevation || lifeZone;
    const locationPromptBlock = hasLocation
      ? `
DATOS DEL SITIO ESPECÍFICO DE OBSERVACIÓN EN COSTA RICA:
- Localidad reportada: "${locality || 'No indicada'}"
- Provincia / Región: "${province || 'No indicada'}"
- Elevación: ${elevation ? `${elevation} m.s.n.m.` : 'No indicada'}
- Zona de vida de Holdridge: "${lifeZone || 'Determinar con precisión para este punto geográfico'}"
- Microhábitat / Sustrato de observación: "${microhabitat || 'Determinar según el sitio'}"
- Coordenadas GPS: ${coordinates ? `${coordinates.lat}, ${coordinates.lng}` : 'No indicadas'}
`
      : `
UBICACIÓN GENERAL: Costa Rica (Neotrópico). Sugiere la localidad tipo o sitio más representativo de registro de esta especie en el país.
`;

    const promptText = `
Eres un distinguido biólogo taxónomo, ecólogo de campo y curador científico especialista en la biodiversidad de Costa Rica (Universidad de Costa Rica - UCR, Organización para Estudios Tropicales - OET, Instituto Clodomiro Picado - ICP, SINAC-MINAE).

El usuario solicita completar la ficha biológica y ecológica para este espécimen:
- Especie u organismo solicitado: "${queryTerm}"
- Nombre científico proporcionado: "${scientificName || (/^[A-Za-z]+ [a-z]+/i.test(queryTerm) ? queryTerm : 'Determinar con precisión taxonómica')}"
- Nombre común proporcionado: "${commonName || (!/^[A-Za-z]+ [a-z]+/i.test(queryTerm) ? queryTerm : 'Determinar nombre común vernáculo en Costa Rica')}"
- Grupo taxonómico aproximado: "${taxonGroup || 'Determinar automáticamente'}"

${locationPromptBlock}

INSTRUCCIONES CRÍTICAS DE PRECISIÓN Y RIGOR CIENTÍFICO:
1. INFORMACIÓN ESPECÍFICA Y NUNCA GENÉRICA:
   No proporciones generalidades superficiales. Describe cómo se comporta y se adapta esta especie ESPECÍFICAMENTE en la localidad indicada (${locality || 'Costa Rica'}, ${elevation ? `${elevation} m.s.n.m.` : ''}, ${lifeZone || ''}):
   - Variaciones morfológicas y fenotípicas asociadas a la elevación o vertiente (Pacífico vs Caribe, morfos cromáticos locales, adaptaciones térmicas).
   - Etología y ritmos circadianos locales condicionados por el régimen de precipitación, niebla y temperatura de este sitio específico.
   - Fenología reproductiva y meses clave de actividad nupcial o floración en este microclima específico.
   - Relaciones interespecíficas reales: nombra especies simpátricas, competidores, presas/hospederos y depredadores que cohabitan verdaderamente en esta zona de vida y área geográfica de Costa Rica.

2. FUENTES CIENTÍFICAS CONFIABLES Y CITAS ACADÉMICAS OBLIGATORIAS:
   En el campo "confirmedScientificData", debes suministrar referencias científicas formales y verificables de Costa Rica:
   - Citas formales (Autor, Año, Título, Revista o Editorial). Ejemplos: Savage (2002) The Amphibians and Reptiles of Costa Rica; Stiles & Skutch (1989) A Guide to the Birds of Costa Rica; Janzen (1983) Costa Rican Natural History; Leenders (2016) Amphibians of Costa Rica; Solórzano (2004) Serpientes de Costa Rica; Wainwright (2007) The Mammals of Costa Rica; DeVries (1987) The Butterflies of Costa Rica; publicaciones de la Revista de Biología Tropical, Zootaxa, Biotropica, Brenesia.
   - Programas de investigación e instituciones científicas costarricenses (UCR, OET estaciones La Selva / Las Cruces / Palo Verde, Instituto Clodomiro Picado, SINAC-MINAE, Jardín Botánico Lankester).
   - Descubrimientos ecológicos y fisiológicos comprobados en campo.

Responde ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "scientificName": "Género epíteto (nombre válido según catálogo taxonómico oficial)",
  "commonName": "Nombre común en Costa Rica / Nombre en inglés",
  "taxonGroup": "Amphibia" | "Aves" | "Mammalia" | "Insecta" | "Reptilia" | "Plantae",
  "taxonomy": {
    "kingdom": "Animalia" o "Plantae",
    "phylum": "Chordata" | "Arthropoda" | "Tracheophyta",
    "class": "Amphibia" | "Aves" | "Mammalia" | "Insecta" | "Reptilia" | "Liliopsida" | "Magnoliopsida",
    "order": "Orden taxonómico",
    "family": "Familia",
    "genus": "Género",
    "species": "epíteto"
  },
  "morphometrics": {
    "snoutVentLengthMm": 58.0,
    "totalLengthMm": 58.0,
    "weightGrams": 15.0
  },
  "colorationAndAnatomy": "Morfología diagnóstica, detalles cromáticos específicos para la población de esta región/elevación, adaptaciones esqueléticas, tegumento o plumaje.",
  "ethologyAndReproduction": "Patrones etológicos, ritmos circadianos, estrategias de forrajeo y termorregulación en el microclima de este sitio específico.",
  "courtshipAndMating": "Rituales de cortejo, señales visuales/bioacústicas de atracción, amplexo/cópula, modo reproductivo, fecundación, cuidados parentales y meses de pico reproductivo en esta vertiente.",
  "interspecificRelations": "Territorialidad intraespecífica, especies simpátricas con las que coexiste en esta zona de vida, principales depredadores en Costa Rica, defensas adaptativas.",
  "confirmedScientificData": "Citas académicas formales (Autor, Año, Título, Revista/Libro) e investigaciones científicas de la UCR, OET, SINAC o ICP que han documentado la especie y sus poblaciones en Costa Rica.",
  "suggestedHoldridgeZone": "${lifeZone || 'Nombre completo de la zona de vida de Holdridge en Costa Rica'}",
  "microhabitat": "${microhabitat || 'Microhábitat exacto donde suele registrarse en esta localidad'}",
  "elevationMeters": ${elevation ? Number(elevation) : 100},
  "hasBioacoustics": true,
  "bioacoustics": {
    "title": "Canto de Anuncio o Llamado",
    "callType": "Vocalización Territorial / Reproductiva",
    "dominantFrequencyRange": "1.8 - 2.4 kHz",
    "audioPatternDescription": "Descripción de la pauta bioacústica o sonido emitido"
  }
}
`;

    const response = await generateWithFallback({
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(textOutput);
    } catch {
      const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.warn('[AI Gemini Fallback] Servidor AI no disponible o sin conexión, usando catálogo taxonómico de Costa Rica:', error?.message);
    const fallbackData = getCostaRicanFallbackSpecies(queryTerm, taxonGroup, locCtx);
    res.json({ success: true, data: fallbackData, isOfflineFallback: true });
  }
});

// Configure Vite middleware or static serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BioBitácora CR] Servidor iniciado en http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
