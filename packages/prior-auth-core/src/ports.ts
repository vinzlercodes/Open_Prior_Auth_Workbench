export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

export interface PatientContext {
  patient: FhirResource | null;
  coverage: FhirResource | null;
  request: FhirResource | null;
  encounter: FhirResource | null;
  practitioner: FhirResource | null;
  organization: FhirResource | null;
  conditions: FhirResource[];
  observations: FhirResource[];
}

export interface ClinicalContextRepository {
  getPatientContext(
    patientId: string,
    coverageId?: string,
    requestResourceType?: string,
    requestResourceId?: string
  ): PatientContext;
}

export interface Clock {
  nowIso(): string;
}

export interface IdGenerator {
  generateId(prefix?: string): string;
}
