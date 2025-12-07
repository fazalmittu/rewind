import { v4 as uuidv4 } from "uuid";
import {
  initDb,
  insertPatient,
  insertInsurance,
  insertProvider,
  clearAllData,
  closeDb,
} from "./db";
import { Patient, Insurance, Provider } from "./types";

const DUMMY_PATIENTS: Omit<Patient, "id" | "mrn" | "createdAt" | "updatedAt">[] = [
  {
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1985-03-15",
    gender: "Male",
    email: "john.smith@email.com",
    phone: "(555) 123-4567",
    address: "123 Main Street",
    city: "Springfield",
    state: "IL",
    zipCode: "62701",
    emergencyContactName: "Jane Smith",
    emergencyContactPhone: "(555) 123-4568",
  },
  {
    firstName: "Sarah",
    lastName: "Johnson",
    dateOfBirth: "1990-07-22",
    gender: "Female",
    email: "sarah.johnson@email.com",
    phone: "(555) 234-5678",
    address: "456 Oak Avenue",
    city: "Chicago",
    state: "IL",
    zipCode: "60601",
    emergencyContactName: "Mike Johnson",
    emergencyContactPhone: "(555) 234-5679",
  },
  {
    firstName: "Michael",
    lastName: "Williams",
    dateOfBirth: "1978-11-30",
    gender: "Male",
    email: "m.williams@email.com",
    phone: "(555) 345-6789",
    address: "789 Pine Road",
    city: "Naperville",
    state: "IL",
    zipCode: "60540",
    emergencyContactName: "Linda Williams",
    emergencyContactPhone: "(555) 345-6780",
  },
  {
    firstName: "Emily",
    lastName: "Brown",
    dateOfBirth: "1995-01-08",
    gender: "Female",
    email: "emily.brown@email.com",
    phone: "(555) 456-7890",
    address: "321 Elm Street",
    city: "Evanston",
    state: "IL",
    zipCode: "60201",
    emergencyContactName: "Robert Brown",
    emergencyContactPhone: "(555) 456-7891",
  },
  {
    firstName: "David",
    lastName: "Garcia",
    dateOfBirth: "1982-09-12",
    gender: "Male",
    email: "david.garcia@email.com",
    phone: "(555) 567-8901",
    address: "654 Maple Lane",
    city: "Aurora",
    state: "IL",
    zipCode: "60502",
    emergencyContactName: "Maria Garcia",
    emergencyContactPhone: "(555) 567-8902",
  },
  {
    firstName: "Jennifer",
    lastName: "Martinez",
    dateOfBirth: "1988-04-25",
    gender: "Female",
    email: "j.martinez@email.com",
    phone: "(555) 678-9012",
    address: "987 Cedar Drive",
    city: "Schaumburg",
    state: "IL",
    zipCode: "60173",
    emergencyContactName: "Carlos Martinez",
    emergencyContactPhone: "(555) 678-9013",
  },
  {
    firstName: "Robert",
    lastName: "Anderson",
    dateOfBirth: "1972-12-03",
    gender: "Male",
    email: "r.anderson@email.com",
    phone: "(555) 789-0123",
    address: "147 Birch Court",
    city: "Joliet",
    state: "IL",
    zipCode: "60431",
    emergencyContactName: "Susan Anderson",
    emergencyContactPhone: "(555) 789-0124",
  },
  {
    firstName: "Lisa",
    lastName: "Thomas",
    dateOfBirth: "1993-06-18",
    gender: "Female",
    email: "lisa.thomas@email.com",
    phone: "(555) 890-1234",
    address: "258 Walnut Way",
    city: "Peoria",
    state: "IL",
    zipCode: "61602",
    emergencyContactName: "Tom Thomas",
    emergencyContactPhone: "(555) 890-1235",
  },
];

const DUMMY_PROVIDERS: Omit<Provider, "id" | "createdAt" | "updatedAt">[] = [
  {
    npi: "1234567890",
    firstName: "James",
    lastName: "Wilson",
    specialty: "Internal Medicine",
    phone: "(555) 100-0001",
    fax: "(555) 100-0002",
    email: "j.wilson@clinic.com",
    address: "100 Medical Plaza",
    city: "Chicago",
    state: "IL",
    zipCode: "60601",
  },
  {
    npi: "2345678901",
    firstName: "Elizabeth",
    lastName: "Chen",
    specialty: "Cardiology",
    phone: "(555) 200-0001",
    fax: "(555) 200-0002",
    email: "e.chen@heartcare.com",
    address: "200 Heart Center Dr",
    city: "Chicago",
    state: "IL",
    zipCode: "60602",
  },
  {
    npi: "3456789012",
    firstName: "Marcus",
    lastName: "Johnson",
    specialty: "Family Medicine",
    phone: "(555) 300-0001",
    fax: "(555) 300-0002",
    email: "m.johnson@familymed.com",
    address: "300 Family Health Way",
    city: "Naperville",
    state: "IL",
    zipCode: "60540",
  },
  {
    npi: "4567890123",
    firstName: "Priya",
    lastName: "Patel",
    specialty: "Endocrinology",
    phone: "(555) 400-0001",
    fax: "(555) 400-0002",
    email: "p.patel@endocare.com",
    address: "400 Diabetes Center",
    city: "Evanston",
    state: "IL",
    zipCode: "60201",
  },
  {
    npi: "5678901234",
    firstName: "David",
    lastName: "Kim",
    specialty: "Psychiatry",
    phone: "(555) 500-0001",
    fax: "(555) 500-0002",
    email: "d.kim@mentalhealth.com",
    address: "500 Wellness Blvd",
    city: "Chicago",
    state: "IL",
    zipCode: "60603",
  },
  {
    npi: "6789012345",
    firstName: "Maria",
    lastName: "Rodriguez",
    specialty: "Oncology",
    phone: "(555) 600-0001",
    fax: "(555) 600-0002",
    email: "m.rodriguez@cancercenter.com",
    address: "600 Oncology Way",
    city: "Chicago",
    state: "IL",
    zipCode: "60604",
  },
  {
    npi: "7890123456",
    firstName: "William",
    lastName: "Thompson",
    specialty: "Orthopedics",
    phone: "(555) 700-0001",
    fax: "(555) 700-0002",
    email: "w.thompson@ortho.com",
    address: "700 Bone & Joint Center",
    city: "Schaumburg",
    state: "IL",
    zipCode: "60173",
  },
  {
    npi: "8901234567",
    firstName: "Susan",
    lastName: "Lee",
    specialty: "Dermatology",
    phone: "(555) 800-0001",
    fax: "(555) 800-0002",
    email: "s.lee@skincare.com",
    address: "800 Dermatology Plaza",
    city: "Aurora",
    state: "IL",
    zipCode: "60502",
  },
];

const INSURANCE_PROVIDERS = [
  "Blue Cross Blue Shield",
  "Aetna",
  "UnitedHealthcare",
  "Cigna",
  "Humana",
  "Kaiser Permanente",
];

const RELATIONSHIPS = ["Self", "Spouse", "Child", "Parent", "Other"];

function generateMrn(index: number): string {
  return `MRN${String(index + 1).padStart(6, "0")}`;
}

function generateInsurance(patientId: string, patientName: string): Insurance {
  const provider = INSURANCE_PROVIDERS[Math.floor(Math.random() * INSURANCE_PROVIDERS.length)];
  const relationship = RELATIONSHIPS[Math.floor(Math.random() * RELATIONSHIPS.length)];
  const now = Date.now();

  return {
    id: uuidv4(),
    patientId,
    provider,
    policyNumber: `POL${Math.floor(Math.random() * 900000 + 100000)}`,
    groupNumber: `GRP${Math.floor(Math.random() * 9000 + 1000)}`,
    subscriberName: relationship === "Self" ? patientName : `${patientName} (${relationship})`,
    subscriberRelationship: relationship,
    effectiveDate: "2024-01-01",
    expirationDate: "2024-12-31",
    copay: [20, 25, 30, 35, 40][Math.floor(Math.random() * 5)],
    deductible: [500, 1000, 1500, 2000, 2500][Math.floor(Math.random() * 5)],
    createdAt: now,
    updatedAt: now,
  };
}

export async function seedDatabase(): Promise<void> {
  console.log("[Seed] Starting database seeding...");

  try {
    await clearAllData();
    console.log("[Seed] Cleared existing data");

    // Seed providers first
    for (const providerData of DUMMY_PROVIDERS) {
      const now = Date.now();
      const provider: Provider = {
        ...providerData,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      await insertProvider(provider);
      console.log(`[Seed] Created provider: Dr. ${provider.firstName} ${provider.lastName} (NPI: ${provider.npi})`);
    }

    // Seed patients with MRNs
    for (let i = 0; i < DUMMY_PATIENTS.length; i++) {
      const patientData = DUMMY_PATIENTS[i];
      const now = Date.now();
      const patient: Patient = {
        ...patientData,
        id: uuidv4(),
        mrn: generateMrn(i),
        createdAt: now,
        updatedAt: now,
      };

      await insertPatient(patient);
      console.log(`[Seed] Created patient: ${patient.firstName} ${patient.lastName} (${patient.mrn})`);

      // Add insurance for each patient
      const insurance = generateInsurance(patient.id, `${patient.firstName} ${patient.lastName}`);
      await insertInsurance(insurance);
      console.log(`[Seed] Created insurance for: ${patient.firstName} ${patient.lastName}`);
    }

    console.log("[Seed] Database seeding complete!");
  } catch (error) {
    console.error("[Seed] Error seeding database:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initDb()
    .then(() => seedDatabase())
    .then(() => closeDb())
    .then(() => {
      console.log("[Seed] Done!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed] Fatal error:", err);
      process.exit(1);
    });
}
