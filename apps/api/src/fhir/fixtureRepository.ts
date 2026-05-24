import { readdirSync, readFileSync } from "node:fs";
import { resolveFromRepoRoot } from "../config/paths.js";

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

interface BundleEntry {
  resource?: FhirResource;
}

interface FhirBundle {
  entry?: BundleEntry[];
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

export class FixtureFhirRepository {
  private readonly resources: FhirResource[];

  constructor(bundlePath?: string) {
    this.resources = (bundlePath ? [bundlePath] : defaultBundlePaths())
      .flatMap((path) => {
        const bundle = JSON.parse(readFileSync(resolveFromRepoRoot(path), "utf8")) as FhirBundle;
        return (bundle.entry ?? [])
          .map((entry) => entry.resource)
          .filter((resource): resource is FhirResource => Boolean(resource?.resourceType));
      });
  }

  getResource(resourceType: string, id: string): FhirResource | null {
    return this.resources.find((resource) => resource.resourceType === resourceType && resource.id === id) ?? null;
  }

  getPatientContext(patientId: string, coverageId?: string, requestResourceType?: string, requestResourceId?: string): PatientContext {
    const patient = this.getResource("Patient", patientId);
    const coverage = coverageId ? this.getResource("Coverage", coverageId) : this.findByPatient("Coverage", patientId)[0] ?? null;
    const request = requestResourceType && requestResourceId
      ? this.getResource(requestResourceType, requestResourceId)
      : this.findByPatient("ServiceRequest", patientId)[0] ?? null;
    const encounter = this.resolveReference((request?.encounter as { reference?: string } | undefined)?.reference);
    const practitioner = this.resolveReference((request?.requester as { reference?: string } | undefined)?.reference);
    const organization = this.resolveReference((encounter?.serviceProvider as { reference?: string } | undefined)?.reference);

    return {
      patient,
      coverage,
      request,
      encounter,
      practitioner,
      organization,
      conditions: this.findByPatient("Condition", patientId),
      observations: this.findByPatient("Observation", patientId)
    };
  }

  private findByPatient(resourceType: string, patientId: string): FhirResource[] {
    return this.resources.filter((resource) => {
      if (resource.resourceType !== resourceType) {
        return false;
      }
      const subject = resource.subject as { reference?: string } | undefined;
      const beneficiary = resource.beneficiary as { reference?: string } | undefined;
      return subject?.reference === `Patient/${patientId}` || beneficiary?.reference === `Patient/${patientId}`;
    });
  }

  private resolveReference(reference?: string): FhirResource | null {
    if (!reference) {
      return null;
    }
    const [resourceType, id] = reference.split("/");
    if (!resourceType || !id) {
      return null;
    }
    return this.getResource(resourceType, id);
  }
}

function defaultBundlePaths(): string[] {
  const directory = resolveFromRepoRoot("data/fixtures/golden-scenarios");
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(`${directory}/${file}`, "utf8")) as { bundlePath?: string })
    .map((scenario) => scenario.bundlePath)
    .filter((path): path is string => Boolean(path));
}
