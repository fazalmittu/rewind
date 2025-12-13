import { Database } from "bun:sqlite";
import path from "path";
import {
  Patient,
  Insurance,
  Provider,
  DrugReferral,
  PatientRow,
  InsuranceRow,
  ProviderRow,
  DrugReferralRow,
} from "./types";

let db: Database;

export const getDb = () => db;

export const initDb = (dbPath?: string): void => {
  const finalPath = dbPath || path.join(import.meta.dir, "..", "ehr.db");
  db = new Database(finalPath, { create: true });

  // Patients table
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      mrn TEXT NOT NULL UNIQUE,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      dateOfBirth TEXT NOT NULL,
      gender TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zipCode TEXT NOT NULL,
      emergencyContactName TEXT NOT NULL,
      emergencyContactPhone TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Insurance table
  db.run(`
    CREATE TABLE IF NOT EXISTS insurance (
      id TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      provider TEXT NOT NULL,
      policyNumber TEXT NOT NULL,
      groupNumber TEXT NOT NULL,
      subscriberName TEXT NOT NULL,
      subscriberRelationship TEXT NOT NULL,
      effectiveDate TEXT NOT NULL,
      expirationDate TEXT NOT NULL,
      copay REAL NOT NULL,
      deductible REAL NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (patientId) REFERENCES patients(id)
    )
  `);

  // Providers table
  db.run(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      npi TEXT NOT NULL UNIQUE,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      specialty TEXT NOT NULL,
      phone TEXT NOT NULL,
      fax TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zipCode TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `);

  // Drug referrals table
  db.run(`
    CREATE TABLE IF NOT EXISTS drug_referrals (
      id TEXT PRIMARY KEY,
      patientId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      drugName TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      refills INTEGER NOT NULL,
      diagnosis TEXT NOT NULL,
      notes TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (patientId) REFERENCES patients(id),
      FOREIGN KEY (providerId) REFERENCES providers(id)
    )
  `);

  console.log("[EHR DB] Database initialized");
};

export const closeDb = (): void => {
  if (db) {
    db.close();
  }
};

// ============================================
// PATIENTS
// ============================================

export const insertPatient = (patient: Patient): void => {
  db.run(
    `INSERT INTO patients (id, mrn, firstName, lastName, dateOfBirth, gender, email, phone, address, city, state, zipCode, emergencyContactName, emergencyContactPhone, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patient.id,
      patient.mrn,
      patient.firstName,
      patient.lastName,
      patient.dateOfBirth,
      patient.gender,
      patient.email,
      patient.phone,
      patient.address,
      patient.city,
      patient.state,
      patient.zipCode,
      patient.emergencyContactName,
      patient.emergencyContactPhone,
      patient.createdAt,
      patient.updatedAt,
    ]
  );
};

export const updatePatient = (patient: Patient): void => {
  db.run(
    `UPDATE patients SET 
      firstName = ?, lastName = ?, dateOfBirth = ?, gender = ?, email = ?, phone = ?,
      address = ?, city = ?, state = ?, zipCode = ?, emergencyContactName = ?, emergencyContactPhone = ?, updatedAt = ?
     WHERE id = ?`,
    [
      patient.firstName,
      patient.lastName,
      patient.dateOfBirth,
      patient.gender,
      patient.email,
      patient.phone,
      patient.address,
      patient.city,
      patient.state,
      patient.zipCode,
      patient.emergencyContactName,
      patient.emergencyContactPhone,
      Date.now(),
      patient.id,
    ]
  );
};

export const deletePatient = (id: string): void => {
  db.run(`DELETE FROM drug_referrals WHERE patientId = ?`, [id]);
  db.run(`DELETE FROM insurance WHERE patientId = ?`, [id]);
  db.run(`DELETE FROM patients WHERE id = ?`, [id]);
};

export const getAllPatients = (): Patient[] => {
  return db.query(`SELECT * FROM patients ORDER BY lastName, firstName`).all() as PatientRow[];
};

export const getPatientById = (id: string): Patient | null => {
  return (db.query(`SELECT * FROM patients WHERE id = ?`).get(id) as Patient) || null;
};

export const searchPatients = (query: string): Patient[] => {
  const searchTerm = `%${query}%`;
  return db
    .query(
      `SELECT * FROM patients WHERE firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR mrn LIKE ? ORDER BY lastName, firstName`
    )
    .all(searchTerm, searchTerm, searchTerm, searchTerm) as PatientRow[];
};

export const getNextMrn = (): string => {
  const row = db.query(`SELECT MAX(CAST(SUBSTR(mrn, 4) AS INTEGER)) as maxNum FROM patients`).get() as {
    maxNum: number | null;
  } | null;
  const maxNum = row?.maxNum || 0;
  const nextNum = maxNum + 1;
  return `MRN${String(nextNum).padStart(6, "0")}`;
};

// ============================================
// INSURANCE
// ============================================

export const insertInsurance = (insurance: Insurance): void => {
  db.run(
    `INSERT INTO insurance (id, patientId, provider, policyNumber, groupNumber, subscriberName, subscriberRelationship, effectiveDate, expirationDate, copay, deductible, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      insurance.id,
      insurance.patientId,
      insurance.provider,
      insurance.policyNumber,
      insurance.groupNumber,
      insurance.subscriberName,
      insurance.subscriberRelationship,
      insurance.effectiveDate,
      insurance.expirationDate,
      insurance.copay,
      insurance.deductible,
      insurance.createdAt,
      insurance.updatedAt,
    ]
  );
};

export const updateInsurance = (insurance: Insurance): void => {
  db.run(
    `UPDATE insurance SET 
      provider = ?, policyNumber = ?, groupNumber = ?, subscriberName = ?, subscriberRelationship = ?,
      effectiveDate = ?, expirationDate = ?, copay = ?, deductible = ?, updatedAt = ?
     WHERE id = ?`,
    [
      insurance.provider,
      insurance.policyNumber,
      insurance.groupNumber,
      insurance.subscriberName,
      insurance.subscriberRelationship,
      insurance.effectiveDate,
      insurance.expirationDate,
      insurance.copay,
      insurance.deductible,
      Date.now(),
      insurance.id,
    ]
  );
};

export const deleteInsurance = (id: string): void => {
  db.run(`DELETE FROM insurance WHERE id = ?`, [id]);
};

export const getInsuranceByPatientId = (patientId: string): Insurance[] => {
  return db
    .query(`SELECT * FROM insurance WHERE patientId = ? ORDER BY effectiveDate DESC`)
    .all(patientId) as InsuranceRow[];
};

export const getInsuranceById = (id: string): Insurance | null => {
  return (db.query(`SELECT * FROM insurance WHERE id = ?`).get(id) as Insurance) || null;
};

// ============================================
// PROVIDERS
// ============================================

export const insertProvider = (provider: Provider): void => {
  db.run(
    `INSERT INTO providers (id, npi, firstName, lastName, specialty, phone, fax, email, address, city, state, zipCode, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      provider.id,
      provider.npi,
      provider.firstName,
      provider.lastName,
      provider.specialty,
      provider.phone,
      provider.fax,
      provider.email,
      provider.address,
      provider.city,
      provider.state,
      provider.zipCode,
      provider.createdAt,
      provider.updatedAt,
    ]
  );
};

export const updateProvider = (provider: Provider): void => {
  db.run(
    `UPDATE providers SET 
      npi = ?, firstName = ?, lastName = ?, specialty = ?, phone = ?, fax = ?,
      email = ?, address = ?, city = ?, state = ?, zipCode = ?, updatedAt = ?
     WHERE id = ?`,
    [
      provider.npi,
      provider.firstName,
      provider.lastName,
      provider.specialty,
      provider.phone,
      provider.fax,
      provider.email,
      provider.address,
      provider.city,
      provider.state,
      provider.zipCode,
      Date.now(),
      provider.id,
    ]
  );
};

export const deleteProvider = (id: string): void => {
  db.run(`DELETE FROM providers WHERE id = ?`, [id]);
};

export const getAllProviders = (): Provider[] => {
  return db.query(`SELECT * FROM providers ORDER BY lastName, firstName`).all() as ProviderRow[];
};

export const getProviderById = (id: string): Provider | null => {
  return (db.query(`SELECT * FROM providers WHERE id = ?`).get(id) as Provider) || null;
};

export const searchProviders = (query: string): Provider[] => {
  const searchTerm = `%${query}%`;
  return db
    .query(
      `SELECT * FROM providers WHERE firstName LIKE ? OR lastName LIKE ? OR npi LIKE ? OR specialty LIKE ? ORDER BY lastName, firstName`
    )
    .all(searchTerm, searchTerm, searchTerm, searchTerm) as ProviderRow[];
};

// ============================================
// DRUG REFERRALS
// ============================================

export const insertDrugReferral = (referral: DrugReferral): void => {
  db.run(
    `INSERT INTO drug_referrals (id, patientId, providerId, drugName, dosage, frequency, quantity, refills, diagnosis, notes, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      referral.id,
      referral.patientId,
      referral.providerId,
      referral.drugName,
      referral.dosage,
      referral.frequency,
      referral.quantity,
      referral.refills,
      referral.diagnosis,
      referral.notes,
      referral.status,
      referral.createdAt,
      referral.updatedAt,
    ]
  );
};

export const updateDrugReferral = (referral: DrugReferral): void => {
  db.run(
    `UPDATE drug_referrals SET 
      providerId = ?, drugName = ?, dosage = ?, frequency = ?, quantity = ?, refills = ?,
      diagnosis = ?, notes = ?, status = ?, updatedAt = ?
     WHERE id = ?`,
    [
      referral.providerId,
      referral.drugName,
      referral.dosage,
      referral.frequency,
      referral.quantity,
      referral.refills,
      referral.diagnosis,
      referral.notes,
      referral.status,
      Date.now(),
      referral.id,
    ]
  );
};

export const deleteDrugReferral = (id: string): void => {
  db.run(`DELETE FROM drug_referrals WHERE id = ?`, [id]);
};

export const getDrugReferralsByPatientId = (patientId: string): DrugReferral[] => {
  return db
    .query(`SELECT * FROM drug_referrals WHERE patientId = ? ORDER BY createdAt DESC`)
    .all(patientId) as DrugReferralRow[] as DrugReferral[];
};

export const getDrugReferralById = (id: string): DrugReferral | null => {
  return (db.query(`SELECT * FROM drug_referrals WHERE id = ?`).get(id) as DrugReferral) || null;
};

// ============================================
// DATABASE RESET
// ============================================

export const clearAllData = (): void => {
  db.run(`DELETE FROM drug_referrals`);
  db.run(`DELETE FROM insurance`);
  db.run(`DELETE FROM patients`);
  db.run(`DELETE FROM providers`);
  console.log("[EHR DB] All data cleared");
};
