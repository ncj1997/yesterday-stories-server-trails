/**
 * JSON Data Store Utility
 * Handles reading and writing data to JSON files for mock server
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const draftTrailsFile = path.join(dataDir, 'draftTrails.json');

/**
 * Initialize JSON file with empty array if it doesn't exist
 */
const initializeFile = (filePath, initialData = []) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf8');
  }
};

/**
 * Read all draft trails from JSON file
 */
const readDraftTrails = () => {
  try {
    initializeFile(draftTrailsFile, []);
    const data = fs.readFileSync(draftTrailsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error reading draft trails:', error);
    return [];
  }
};

/**
 * Write draft trails to JSON file
 */
const writeDraftTrails = (drafts) => {
  try {
    fs.writeFileSync(draftTrailsFile, JSON.stringify(drafts, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('❌ Error writing draft trails:', error);
    return false;
  }
};

/**
 * Get a single draft trail by reference code
 */
const getDraftTrail = (referenceCode) => {
  const drafts = readDraftTrails();
  return drafts.find(d => d.referenceCode === referenceCode);
};

/**
 * Save a new draft trail
 */
const saveDraftTrail = (draftData) => {
  const drafts = readDraftTrails();
  
  // Check if draft already exists and update it
  const existingIndex = drafts.findIndex(d => d.referenceCode === draftData.referenceCode);
  if (existingIndex > -1) {
    drafts[existingIndex] = draftData;
  } else {
    drafts.push(draftData);
  }
  
  return writeDraftTrails(drafts);
};

/**
 * Delete a draft trail
 */
const deleteDraftTrail = (referenceCode) => {
  const drafts = readDraftTrails();
  const filtered = drafts.filter(d => d.referenceCode !== referenceCode);
  return writeDraftTrails(filtered);
};

/**
 * Update draft trail status
 */
const updateDraftStatus = (referenceCode, status) => {
  const drafts = readDraftTrails();
  const draftIndex = drafts.findIndex(d => d.referenceCode === referenceCode);
  
  if (draftIndex === -1) {
    return false;
  }
  
  drafts[draftIndex].status = status;
  return writeDraftTrails(drafts);
};

/**
 * Clean up expired drafts
 */
const cleanupExpiredDrafts = () => {
  const drafts = readDraftTrails();
  const now = Date.now();
  const filtered = drafts.filter(d => d.expiresAt > now);
  
  if (filtered.length < drafts.length) {
    writeDraftTrails(filtered);
    const removed = drafts.length - filtered.length;
    console.log(`🧹 Cleaned up ${removed} expired draft(s)`);
  }
};

module.exports = {
  readDraftTrails,
  writeDraftTrails,
  getDraftTrail,
  saveDraftTrail,
  deleteDraftTrail,
  updateDraftStatus,
  cleanupExpiredDrafts,
};
