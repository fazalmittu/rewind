import sqlite3 from "sqlite3";
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

sqlite3.verbose();

let db: sqlite3.Database;

export const getDb = () => db;

export const initDb = (dbPath?: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const finalPath = dbPath || path.join(__dirname, "..", "ehr.db");
    db = new sqlite3.Database(finalPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
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
        db.run(
          `
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
        `,
          (err) => {
            if (err) reject(err);
            else {
              console.log("[EHR DB] Database initialized");
              resolve();
            }
          }
        );
      });
    });
  });
};

export const closeDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
};

// ============================================
// PATIENTS
// ============================================

export const insertPatient = (patient: Patient): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const updatePatient = (patient: Patient): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const deletePatient = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DELETE FROM drug_referrals WHERE patientId = ?`, [id]);
      db.run(`DELETE FROM insurance WHERE patientId = ?`, [id]);
      db.run(`DELETE FROM patients WHERE id = ?`, [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const getAllPatients = (): Promise<Patient[]> => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM patients ORDER BY lastName, firstName`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((rows as PatientRow[]) || []);
    });
  });
};

export const getPatientById = (id: string): Promise<Patient | null> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM patients WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((row as Patient) || null);
    });
  });
};

export const searchPatients = (query: string): Promise<Patient[]> => {
  return new Promise((resolve, reject) => {
    const searchTerm = `%${query}%`;
    db.all(
      `SELECT * FROM patients WHERE firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR mrn LIKE ? ORDER BY lastName, firstName`,
      [searchTerm, searchTerm, searchTerm, searchTerm],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows as PatientRow[]) || []);
      }
    );
  });
};

export const getNextMrn = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(CAST(SUBSTR(mrn, 4) AS INTEGER)) as maxNum FROM patients`, [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      const maxNum = (row as { maxNum: number | null })?.maxNum || 0;
      const nextNum = maxNum + 1;
      resolve(`MRN${String(nextNum).padStart(6, "0")}`);
    });
  });
};

// ============================================
// INSURANCE
// ============================================

export const insertInsurance = (insurance: Insurance): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const updateInsurance = (insurance: Insurance): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const deleteInsurance = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM insurance WHERE id = ?`, [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getInsuranceByPatientId = (patientId: string): Promise<Insurance[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM insurance WHERE patientId = ? ORDER BY effectiveDate DESC`,
      [patientId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows as InsuranceRow[]) || []);
      }
    );
  });
};

export const getInsuranceById = (id: string): Promise<Insurance | null> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM insurance WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((row as Insurance) || null);
    });
  });
};

// ============================================
// PROVIDERS
// ============================================

export const insertProvider = (provider: Provider): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const updateProvider = (provider: Provider): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const deleteProvider = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM providers WHERE id = ?`, [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getAllProviders = (): Promise<Provider[]> => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM providers ORDER BY lastName, firstName`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((rows as ProviderRow[]) || []);
    });
  });
};

export const getProviderById = (id: string): Promise<Provider | null> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM providers WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((row as Provider) || null);
    });
  });
};

export const searchProviders = (query: string): Promise<Provider[]> => {
  return new Promise((resolve, reject) => {
    const searchTerm = `%${query}%`;
    db.all(
      `SELECT * FROM providers WHERE firstName LIKE ? OR lastName LIKE ? OR npi LIKE ? OR specialty LIKE ? ORDER BY lastName, firstName`,
      [searchTerm, searchTerm, searchTerm, searchTerm],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows as ProviderRow[]) || []);
      }
    );
  });
};

// ============================================
// DRUG REFERRALS
// ============================================

export const insertDrugReferral = (referral: DrugReferral): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const updateDrugReferral = (referral: DrugReferral): Promise<void> => {
  return new Promise((resolve, reject) => {
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
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const deleteDrugReferral = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM drug_referrals WHERE id = ?`, [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getDrugReferralsByPatientId = (patientId: string): Promise<DrugReferral[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM drug_referrals WHERE patientId = ? ORDER BY createdAt DESC`,
      [patientId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows as DrugReferralRow[]) as DrugReferral[]);
      }
    );
  });
};

export const getDrugReferralById = (id: string): Promise<DrugReferral | null> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM drug_referrals WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve((row as DrugReferral) || null);
    });
  });
};

// ============================================
// DATABASE RESET
// ============================================

export const clearAllData = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DELETE FROM drug_referrals`);
      db.run(`DELETE FROM insurance`);
      db.run(`DELETE FROM patients`);
      db.run(`DELETE FROM providers`, (err) => {
        if (err) reject(err);
        else {
          console.log("[EHR DB] All data cleared");
          resolve();
        }
      });
    });
  });
};
