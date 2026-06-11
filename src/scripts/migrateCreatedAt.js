/**
 * Migration Script: Backfill createdAt field on all documents
 * 
 * This script adds a `createdAt` field to documents that don't have one.
 * Run this once to ensure all documents are indexed properly.
 * 
 * Usage:
 * 1. Import and call in browser console or an admin tool
 * 2. Or run from a Node.js admin script with Firebase Admin SDK
 * 
 * Example (browser):
 *   import { migrateCollectionCreatedAt } from './src/scripts/migrateCreatedAt.js'
 *   await migrateCollectionCreatedAt('customers')
 *   await migrateCollectionCreatedAt('products')
 *   ... etc
 */

import {
  collection,
  getDocs,
  updateDoc,
  doc,
  writeBatch,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../services/firestoreService";

/**
 * Backfill createdAt on documents missing it
 * @param {string} collectionName - Collection to migrate
 * @returns {Promise<{total: number, updated: number, skipped: number}>}
 */
export const migrateCollectionCreatedAt = async (collectionName) => {
  console.log(`[Migration] Starting ${collectionName}...`);

  try {
    // Get all documents
    const snapshot = await getDocs(collection(db, collectionName));
    const docs = snapshot.docs;
    
    console.log(`[Migration] Found ${docs.length} total documents in ${collectionName}`);

    let updated = 0;
    let skipped = 0;

    // Use batch for up to 500 updates at a time
    const batchSize = 500;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, i + batchSize);

      batchDocs.forEach((d) => {
        if (!d.data().createdAt) {
          // Use current timestamp or estimate based on Firebase docId
          const createdAt = new Date().toISOString();
          batch.update(doc(db, collectionName, d.id), { createdAt });
          updated++;
        } else {
          skipped++;
        }
      });

      if (updated > (i / batchSize) * batchSize) {
        await batch.commit();
        console.log(`[Migration] Batch ${Math.floor(i / batchSize) + 1} committed`);
      }
    }

    console.log(
      `[Migration] ✓ ${collectionName} complete: ${updated} updated, ${skipped} already had createdAt`
    );
    return { total: docs.length, updated, skipped };
  } catch (error) {
    console.error(`[Migration] ✗ ${collectionName} failed:`, error);
    throw error;
  }
};

/**
 * Migrate all core collections
 * @returns {Promise<Object>} Summary of migration
 */
export const migrateAllCollections = async () => {
  const collections = [
    "customers",
    "products",
    "purchases",
    "inventory",
    "grn",
    "returns",
    "vendors",
    "admins",
    "users",
  ];

  const results = {};

  for (const col of collections) {
    try {
      const count = await getCountFromServer(collection(db, col));
      if (count.data().count > 0) {
        results[col] = await migrateCollectionCreatedAt(col);
      } else {
        console.log(`[Migration] Skipping ${col} (empty collection)`);
        results[col] = { total: 0, updated: 0, skipped: 0 };
      }
    } catch (error) {
      console.error(`[Migration] Skipping ${col}:`, error.message);
      results[col] = { error: error.message };
    }
  }

  console.log("[Migration] ✓ All collections migrated:", results);
  return results;
};

/**
 * Check migration status - find collections with missing createdAt
 * @returns {Promise<Object>} Status report
 */
export const checkMigrationStatus = async () => {
  const collections = [
    "customers",
    "products",
    "purchases",
    "inventory",
    "grn",
    "returns",
  ];

  const report = {};

  for (const col of collections) {
    try {
      const snapshot = await getDocs(collection(db, col));
      const total = snapshot.docs.length;
      const withoutCreatedAt = snapshot.docs.filter(
        (d) => !d.data().createdAt
      ).length;

      report[col] = {
        total,
        withoutCreatedAt,
        percentComplete: ((total - withoutCreatedAt) / total * 100).toFixed(2) + "%"
      };
    } catch (error) {
      report[col] = { error: error.message };
    }
  }

  console.table(report);
  return report;
};
