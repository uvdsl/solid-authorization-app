import { Session } from "@uvdsl/solid-oidc-client-browser";
import { INTEROP, LDP, XSD, ACL, RDFS, createResource, getLocationHeader } from "@uvdsl/solid-requests";

export interface DataAuthorizationDraft {
  grantees: string[];           // WebIDs (acl:agent)
  accessModes: string[];        // URIs (acl:mode)
  dataInstances: string[];      // URIs (acl:accessTo)
  satisfiesAccessNeed: string;  // URI of the Access Need
  enforcedByRules?: string[];   // WAC Rule URI that enforces this
}

/**
 * pure Factory function: Takes data, creates RDF, saves to Pod.
 * Returns the URI of the new Data Authorization.
 */
export async function createDataAuthorization(
  containerUri: string,
  input: DataAuthorizationDraft,
  session: Session
): Promise<string> {
  const uuid = self.crypto.randomUUID();
  const subject = `#data-authorization-${uuid}`;


  const payload = `
    @prefix interop: <${INTEROP()}> .
    @prefix ldp: <${LDP()}> .
    @prefix xsd: <${XSD()}> .
    @prefix acl: <${ACL()}> .
    @prefix rdfs: <${RDFS()}> .

    <${subject}>
      a interop:DataAuthorization ;
      interop:grantee ${input.grantees.map(t => `<${t}>`).join(", ")} ;
      interop:accessMode ${input.accessModes.map(t => `<${t}>`).join(", ")} ;
      ${input.dataInstances.length > 0
      ? `interop:hasDataInstance ${input.dataInstances.map(t => `<${t}>`).join(", ")} ;`
      : ""}
      ${input.enforcedByRules && input.enforcedByRules.length > 0
      ? input.enforcedByRules.map(ruleUri => `rdfs:seeAlso <${ruleUri}>`).join(" ; \n      ") + " ;"
      : ""}
      interop:satisfiesAccessNeed <${input.satisfiesAccessNeed}> .
    `;

  const response = await createResource(containerUri, payload, session);
  const location = getLocationHeader(response)
  // Handle relative vs absolute URLs if necessary (Solid servers usually return absolute)
  return new URL(location + subject, containerUri).href;
}

export interface AccessAuthorizationDraft {
  accessNeedGroup: string;      // URI (interop:hasAccessNeedGroup)
  dataAuthorizations: string[]; // URIs (interop:hasDataAuthorization)
}

/**
 * Pure Factory function: Creates an Access Authorization.
 * Returns the URI of the new resource.
 */
export async function createAccessAuthorization(
  containerUri: string,
  input: AccessAuthorizationDraft,
  session: Session
): Promise<string> {
  const uuid = self.crypto.randomUUID();
  const subject = `#access-authorization-${uuid}`;

  const payload = `
    @prefix interop: <${INTEROP()}> .
    @prefix xsd: <${XSD()}> .

    <${subject}>
      a interop:AccessAuthorization ;
      interop:hasAccessNeedGroup <${input.accessNeedGroup}>
      ${input.dataAuthorizations.length > 0
      ? `; interop:hasDataAuthorization ${input.dataAuthorizations.map(t => `<${t}>`).join(", ")}`
      : ""
    } .
    `;

  const response = await createResource(containerUri, payload, session);
  const location = getLocationHeader(response);
  return new URL(location + subject, containerUri).href;
}

export interface AccessReceiptDraft {
  grantees: string[];           // WebIDs (interop:grantee)
  grantedBy: string;            // WebID (interop:grantedBy) - likely the current user
  purposes: string[];             // DPV
  seeAlso: string[];
  accessRequest: string;           // URI of the request being fulfilled
  accessAuthorizations: string[];  // List of URIs for the granted authorizations
  replaces?: string; // the access receipt that is being supreseeded by another access receipt
}

/**
 * Pure Factory function: Creates an Access Receipt.
 * Returns the URI of the new resource.
 */
export async function createAccessReceipt(
  containerUri: string,
  input: AccessReceiptDraft,
  session: Session
): Promise<string> {
  const uuid = self.crypto.randomUUID();
  const subject = `#access-receipt-${uuid}`;
  const date = new Date().toISOString();

  const payload = `
    @prefix interop: <${INTEROP()}> .
    @prefix xsd: <${XSD()}> .
    @prefix dpv: <https://w3id.org/dpv#> .
    @prefix rdfs: <${RDFS()}> .

    <${subject}>
      a interop:AccessReceipt ;
      interop:grantedBy <${input.grantedBy}> ;
      interop:grantee ${input.grantees.map(t => `<${t}>`).join(", ")} ;
      interop:grantedAt "${date}"^^xsd:dateTime 
      ${input.purposes.length > 0
      ? `; dpv:purpose ${input.purposes.map(t => t.startsWith('http') ? `<${t}>` : `"${t}"`).join(", ")}`
      : ""} 
      ${input.seeAlso.length > 0
      ? `; rdfs:seeAlso ${input.seeAlso.map(t =>  t.startsWith('http') ? `<${t}>` : `"${t}"`).join(", ")}`
      : ""} 
      ${input.replaces
      ? `; interop:replaces <${input.replaces}>`
      : ""} ;
      interop:hasAccessRequest <${input.accessRequest}> 
      ${input.accessAuthorizations.length > 0
      ? `; interop:hasAccessAuthorization ${input.accessAuthorizations.map(t => `<${t}>`).join(", ")}`
      : ""} 
      .
    `;

  const response = await createResource(containerUri, payload, session);
  const location = getLocationHeader(response);
  return new URL(location + subject, containerUri).href;
}