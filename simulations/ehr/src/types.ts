export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  createdAt: number;
  updatedAt: number;
}

export interface Insurance {
  id: string;
  patientId: string;
  provider: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  subscriberRelationship: string;
  effectiveDate: string;
  expirationDate: string;
  copay: number;
  deductible: number;
  createdAt: number;
  updatedAt: number;
}

export interface Provider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  createdAt: number;
  updatedAt: number;
}

export interface DrugReferral {
  id: string;
  patientId: string;
  providerId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  quantity: number;
  refills: number;
  diagnosis: string;
  notes: string;
  status: "pending" | "approved" | "denied" | "filled";
  createdAt: number;
  updatedAt: number;
}

// Row types for SQLite
export interface PatientRow {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  createdAt: number;
  updatedAt: number;
}

export interface InsuranceRow {
  id: string;
  patientId: string;
  provider: string;
  policyNumber: string;
  groupNumber: string;
  subscriberName: string;
  subscriberRelationship: string;
  effectiveDate: string;
  expirationDate: string;
  copay: number;
  deductible: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderRow {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  createdAt: number;
  updatedAt: number;
}

export interface DrugReferralRow {
  id: string;
  patientId: string;
  providerId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  quantity: number;
  refills: number;
  diagnosis: string;
  notes: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}
