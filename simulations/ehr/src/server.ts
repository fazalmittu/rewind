import express from "express";
import cors from "cors";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  initDb,
  getAllPatients,
  getPatientById,
  insertPatient,
  updatePatient,
  deletePatient,
  searchPatients,
  getNextMrn,
  getInsuranceByPatientId,
  getInsuranceById,
  insertInsurance,
  updateInsurance,
  deleteInsurance,
  getAllProviders,
  getProviderById,
  insertProvider,
  updateProvider,
  deleteProvider,
  searchProviders,
  getDrugReferralsByPatientId,
  getDrugReferralById,
  insertDrugReferral,
  updateDrugReferral,
  deleteDrugReferral,
} from "./db";
import { seedDatabase } from "./seed";
import { Patient, Insurance, Provider, DrugReferral } from "./types";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ============================================
// PATIENT ROUTES
// ============================================

// Get all patients
app.get("/api/patients", async (req, res) => {
  try {
    const search = req.query.search as string;
    const patients = search ? await searchPatients(search) : await getAllPatients();
    res.json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// Get next MRN
app.get("/api/patients/next-mrn", async (req, res) => {
  try {
    const mrn = await getNextMrn();
    res.json({ mrn });
  } catch (error) {
    console.error("Error getting next MRN:", error);
    res.status(500).json({ error: "Failed to get next MRN" });
  }
});

// Get patient by ID
app.get("/api/patients/:id", async (req, res) => {
  try {
    const patient = await getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(patient);
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ error: "Failed to fetch patient" });
  }
});

// Create new patient
app.post("/api/patients", async (req, res) => {
  try {
    const now = Date.now();
    const mrn = await getNextMrn();
    const patient: Patient = {
      ...req.body,
      id: uuidv4(),
      mrn,
      createdAt: now,
      updatedAt: now,
    };
    await insertPatient(patient);
    console.log(`[EHR] Created patient: ${patient.firstName} ${patient.lastName} (${patient.mrn})`);
    res.status(201).json(patient);
  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(500).json({ error: "Failed to create patient" });
  }
});

// Update patient
app.put("/api/patients/:id", async (req, res) => {
  try {
    const existing = await getPatientById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const patient: Patient = {
      ...existing,
      ...req.body,
      id: req.params.id,
      mrn: existing.mrn, // MRN cannot be changed
      updatedAt: Date.now(),
    };
    await updatePatient(patient);
    console.log(`[EHR] Updated patient: ${patient.firstName} ${patient.lastName}`);
    res.json(patient);
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({ error: "Failed to update patient" });
  }
});

// Delete patient
app.delete("/api/patients/:id", async (req, res) => {
  try {
    const existing = await getPatientById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Patient not found" });
    }
    await deletePatient(req.params.id);
    console.log(`[EHR] Deleted patient: ${existing.firstName} ${existing.lastName}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({ error: "Failed to delete patient" });
  }
});

// ============================================
// INSURANCE ROUTES
// ============================================

// Get insurance for a patient
app.get("/api/patients/:patientId/insurance", async (req, res) => {
  try {
    const insurance = await getInsuranceByPatientId(req.params.patientId);
    res.json(insurance);
  } catch (error) {
    console.error("Error fetching insurance:", error);
    res.status(500).json({ error: "Failed to fetch insurance" });
  }
});

// Get insurance by ID
app.get("/api/insurance/:id", async (req, res) => {
  try {
    const insurance = await getInsuranceById(req.params.id);
    if (!insurance) {
      return res.status(404).json({ error: "Insurance not found" });
    }
    res.json(insurance);
  } catch (error) {
    console.error("Error fetching insurance:", error);
    res.status(500).json({ error: "Failed to fetch insurance" });
  }
});

// Create new insurance
app.post("/api/patients/:patientId/insurance", async (req, res) => {
  try {
    const patient = await getPatientById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const now = Date.now();
    const insurance: Insurance = {
      ...req.body,
      id: uuidv4(),
      patientId: req.params.patientId,
      createdAt: now,
      updatedAt: now,
    };
    await insertInsurance(insurance);
    console.log(`[EHR] Created insurance for patient: ${patient.firstName} ${patient.lastName}`);
    res.status(201).json(insurance);
  } catch (error) {
    console.error("Error creating insurance:", error);
    res.status(500).json({ error: "Failed to create insurance" });
  }
});

// Update insurance
app.put("/api/insurance/:id", async (req, res) => {
  try {
    const existing = await getInsuranceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Insurance not found" });
    }
    const insurance: Insurance = {
      ...existing,
      ...req.body,
      id: req.params.id,
      updatedAt: Date.now(),
    };
    await updateInsurance(insurance);
    console.log(`[EHR] Updated insurance: ${insurance.id}`);
    res.json(insurance);
  } catch (error) {
    console.error("Error updating insurance:", error);
    res.status(500).json({ error: "Failed to update insurance" });
  }
});

// Delete insurance
app.delete("/api/insurance/:id", async (req, res) => {
  try {
    const existing = await getInsuranceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Insurance not found" });
    }
    await deleteInsurance(req.params.id);
    console.log(`[EHR] Deleted insurance: ${existing.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting insurance:", error);
    res.status(500).json({ error: "Failed to delete insurance" });
  }
});

// ============================================
// PROVIDER ROUTES
// ============================================

// Get all providers
app.get("/api/providers", async (req, res) => {
  try {
    const search = req.query.search as string;
    const providers = search ? await searchProviders(search) : await getAllProviders();
    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});

// Get provider by ID
app.get("/api/providers/:id", async (req, res) => {
  try {
    const provider = await getProviderById(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.json(provider);
  } catch (error) {
    console.error("Error fetching provider:", error);
    res.status(500).json({ error: "Failed to fetch provider" });
  }
});

// Create new provider
app.post("/api/providers", async (req, res) => {
  try {
    const now = Date.now();
    const provider: Provider = {
      ...req.body,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    await insertProvider(provider);
    console.log(`[EHR] Created provider: Dr. ${provider.firstName} ${provider.lastName} (NPI: ${provider.npi})`);
    res.status(201).json(provider);
  } catch (error: any) {
    console.error("Error creating provider:", error);
    if (error?.code === "SQLITE_CONSTRAINT") {
      res.status(400).json({ error: "A provider with this NPI already exists" });
    } else {
      res.status(500).json({ error: "Failed to create provider" });
    }
  }
});

// Update provider
app.put("/api/providers/:id", async (req, res) => {
  try {
    const existing = await getProviderById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Provider not found" });
    }
    const provider: Provider = {
      ...existing,
      ...req.body,
      id: req.params.id,
      updatedAt: Date.now(),
    };
    await updateProvider(provider);
    console.log(`[EHR] Updated provider: Dr. ${provider.firstName} ${provider.lastName}`);
    res.json(provider);
  } catch (error) {
    console.error("Error updating provider:", error);
    res.status(500).json({ error: "Failed to update provider" });
  }
});

// Delete provider
app.delete("/api/providers/:id", async (req, res) => {
  try {
    const existing = await getProviderById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Provider not found" });
    }
    await deleteProvider(req.params.id);
    console.log(`[EHR] Deleted provider: Dr. ${existing.firstName} ${existing.lastName}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting provider:", error);
    res.status(500).json({ error: "Failed to delete provider" });
  }
});

// ============================================
// DRUG REFERRAL ROUTES
// ============================================

// Get drug referrals for a patient
app.get("/api/patients/:patientId/referrals", async (req, res) => {
  try {
    const referrals = await getDrugReferralsByPatientId(req.params.patientId);
    res.json(referrals);
  } catch (error) {
    console.error("Error fetching referrals:", error);
    res.status(500).json({ error: "Failed to fetch referrals" });
  }
});

// Get drug referral by ID
app.get("/api/referrals/:id", async (req, res) => {
  try {
    const referral = await getDrugReferralById(req.params.id);
    if (!referral) {
      return res.status(404).json({ error: "Referral not found" });
    }
    res.json(referral);
  } catch (error) {
    console.error("Error fetching referral:", error);
    res.status(500).json({ error: "Failed to fetch referral" });
  }
});

// Create new drug referral
app.post("/api/patients/:patientId/referrals", async (req, res) => {
  try {
    const patient = await getPatientById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    const provider = await getProviderById(req.body.providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    const now = Date.now();
    const referral: DrugReferral = {
      ...req.body,
      id: uuidv4(),
      patientId: req.params.patientId,
      status: req.body.status || "pending",
      createdAt: now,
      updatedAt: now,
    };
    await insertDrugReferral(referral);
    console.log(`[EHR] Created drug referral for patient: ${patient.firstName} ${patient.lastName} - ${referral.drugName}`);
    res.status(201).json(referral);
  } catch (error) {
    console.error("Error creating referral:", error);
    res.status(500).json({ error: "Failed to create referral" });
  }
});

// Update drug referral
app.put("/api/referrals/:id", async (req, res) => {
  try {
    const existing = await getDrugReferralById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Referral not found" });
    }
    const referral: DrugReferral = {
      ...existing,
      ...req.body,
      id: req.params.id,
      updatedAt: Date.now(),
    };
    await updateDrugReferral(referral);
    console.log(`[EHR] Updated drug referral: ${referral.id}`);
    res.json(referral);
  } catch (error) {
    console.error("Error updating referral:", error);
    res.status(500).json({ error: "Failed to update referral" });
  }
});

// Delete drug referral
app.delete("/api/referrals/:id", async (req, res) => {
  try {
    const existing = await getDrugReferralById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Referral not found" });
    }
    await deleteDrugReferral(req.params.id);
    console.log(`[EHR] Deleted drug referral: ${existing.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting referral:", error);
    res.status(500).json({ error: "Failed to delete referral" });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Reseed database
app.post("/api/admin/reseed", async (req, res) => {
  try {
    await seedDatabase();
    res.json({ success: true, message: "Database reseeded" });
  } catch (error) {
    console.error("Error reseeding database:", error);
    res.status(500).json({ error: "Failed to reseed database" });
  }
});

// ============================================
// START SERVER
// ============================================

async function start() {
  try {
    await initDb();
    console.log("[EHR] Database initialized");

    // Only seed if database is empty
    const patients = await getAllPatients();
    if (patients.length === 0) {
      console.log("[EHR] Database empty, seeding with sample data...");
      await seedDatabase();
    } else {
      console.log(`[EHR] Database has ${patients.length} patients, skipping seed`);
    }

    app.listen(PORT, () => {
      console.log(`[EHR] Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("[EHR] Failed to start server:", error);
    process.exit(1);
  }
}

start();
