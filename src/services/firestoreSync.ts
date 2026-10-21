import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDocFromServer,
} from 'firebase/firestore';
import { db } from '../firebase';
import { SpecimenRecord } from '../types/specimen';
import { compressDataUrl } from '../utils/imageCompress';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  timestamp: string;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString(),
  };
  console.warn('Firestore Operation Status:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Prepares and compresses specimen payload so it strictly conforms to
 * Firestore's 1MB per-document limit and removes undefined values.
 */
async function cleanSpecimenForCloud(specimen: SpecimenRecord): Promise<any> {
  const cleanData = JSON.parse(JSON.stringify(specimen));
  cleanData.updatedAt = new Date().toISOString();

  // Compress hero image if it is a large base64 data URL
  if (cleanData.heroImage && cleanData.heroImage.startsWith('data:image')) {
    try {
      cleanData.heroImage = await compressDataUrl(cleanData.heroImage, 1200, 0.8);
    } catch {}
  }

  // Compress additional photos if any are large base64 data URLs
  if (Array.isArray(cleanData.additionalPhotos)) {
    for (const p of cleanData.additionalPhotos) {
      if (p.url && p.url.startsWith('data:image')) {
        try {
          p.url = await compressDataUrl(p.url, 1200, 0.8);
        } catch {}
      }
    }
  }

  // Compress sighting photos if any are large base64 data URLs
  if (Array.isArray(cleanData.sightings)) {
    for (const s of cleanData.sightings) {
      if (s.curiousFindingPhoto && s.curiousFindingPhoto.startsWith('data:image')) {
        try {
          s.curiousFindingPhoto = await compressDataUrl(s.curiousFindingPhoto, 1200, 0.8);
        } catch {}
      }
    }
  }

  return cleanData;
}

/**
 * Test server-side Firestore connection on initialization
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'specimens', 'cr-bio-2026-0042'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline o sin conectividad directa:', error.message);
      return false;
    }
    return true;
  }
}

/**
 * Real-time subscription to specimens collection
 * Automatically notifies callback whenever iPad, mobile, or laptop makes changes
 */
export function subscribeToSpecimens(
  onUpdate: (specimens: SpecimenRecord[]) => void,
  onStatusChange?: (status: 'connected' | 'syncing' | 'offline' | 'error') => void
): () => void {
  const specimensCol = collection(db, 'specimens');

  onStatusChange?.('syncing');

  const unsubscribe = onSnapshot(
    specimensCol,
    (snapshot) => {
      onStatusChange?.('connected');
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const list: SpecimenRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.scientificName) {
          list.push({
            ...(data as SpecimenRecord),
            id: docSnap.id,
          });
        }
      });

      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'specimens');
      onStatusChange?.('offline');
    }
  );

  return unsubscribe;
}

/**
 * Directly fetch all specimens currently saved in Google Cloud Firestore.
 * Used for forced/bidirectional synchronization.
 */
export async function fetchAllSpecimensFromCloud(): Promise<SpecimenRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'specimens'));
    if (snap.empty) return [];

    const list: SpecimenRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.scientificName) {
        list.push({
          ...(data as SpecimenRecord),
          id: docSnap.id,
        });
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'specimens');
    throw error;
  }
}

/**
 * Save or update single specimen in cloud database
 */
export async function saveSpecimenToCloud(specimen: SpecimenRecord): Promise<void> {
  const path = `specimens/${specimen.id}`;
  try {
    const docRef = doc(db, 'specimens', specimen.id);
    const cleanData = await cleanSpecimenForCloud(specimen);
    await setDoc(docRef, cleanData, { merge: true });
    // Remove from deleted_specimens if it was previously marked deleted
    try {
      await deleteDoc(doc(db, 'deleted_specimens', specimen.id));
    } catch {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete specimen from cloud database and publish tombstone
 * so all linked devices instantly remove it and never resurrect it.
 */
export async function deleteSpecimenFromCloud(specimenId: string): Promise<void> {
  const path = `specimens/${specimenId}`;
  try {
    const docRef = doc(db, 'specimens', specimenId);
    await deleteDoc(docRef);

    // Write tombstone to deleted_specimens collection
    const tombstoneRef = doc(db, 'deleted_specimens', specimenId);
    await setDoc(tombstoneRef, {
      id: specimenId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Real-time subscription to deleted_specimens collection.
 * When any device deletes a specimen, all linked devices get notified immediately.
 */
export function subscribeToDeletedSpecimens(
  onDeletedUpdate: (deletedIds: string[]) => void
): () => void {
  const deletedCol = collection(db, 'deleted_specimens');

  const unsubscribe = onSnapshot(
    deletedCol,
    (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((docSnap) => {
        ids.push(docSnap.id);
      });
      onDeletedUpdate(ids);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'deleted_specimens');
    }
  );

  return unsubscribe;
}

/**
 * Directly fetch all deleted specimen IDs from Firestore tombstones
 */
export async function fetchDeletedSpecimensFromCloud(): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'deleted_specimens'));
    if (snap.empty) return [];
    const ids: string[] = [];
    snap.forEach((docSnap) => {
      ids.push(docSnap.id);
    });
    return ids;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'deleted_specimens');
    return [];
  }
}

/**
 * Seed or batch upload multiple specimens to cloud
 */
export async function batchSyncSpecimensToCloud(specimens: SpecimenRecord[]): Promise<void> {
  if (!Array.isArray(specimens) || specimens.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const s of specimens) {
      if (s && s.id) {
        const ref = doc(db, 'specimens', s.id);
        const clean = await cleanSpecimenForCloud(s);
        batch.set(ref, clean, { merge: true });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'specimens/batch');
    // Fallback: save one by one
    for (const s of specimens) {
      try {
        await saveSpecimenToCloud(s);
      } catch (err) {
        console.warn(`Error al subir espécimen individual ${s?.id}:`, err);
      }
    }
  }
}
