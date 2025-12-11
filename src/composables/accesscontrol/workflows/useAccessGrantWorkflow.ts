import { ref } from 'vue';
import { Session } from "@uvdsl/solid-oidc-client-browser";
import { getAccessNeedGroup } from '../../store/requests/useAccessNeedGroup';
import { getAccessNeed } from '../../store/requests/useAccessNeed';
import { grantAccess, rollBackAccess } from '../useWebAccessControl';
import {
    createDataAuthorization,
    createAccessAuthorization,
    createAccessReceipt,
    DataAuthorizationDraft,
    AccessAuthorizationDraft,
    AccessReceiptDraft
} from '../useSolidAuthorizations';

// Type definitions for clear inputs
export interface GrantContainers {
    dataAuthorization: string;
    accessAuthorization: string;
    accessReceipt: string;
}

export function useAccessGrantWorkflow() {
    const isProcessing = ref(false);

    /**
     * Orchestrates the entire Access Granting transaction.
     * 1. Aggregates data
     * 2. Enforces WAC (ACLs)
     * 3. Records Interop (Data Auth -> Access Auth -> Receipt)
     * 4. Handles Rollback on failure
     */
    async function executeGrant(
        accessRequest: any, // TODO proper typing
        selectedGroupUris: Set<string>,
        containers: GrantContainers,
        grantedBy: string,
        session: Session
    ) {
        if (!accessRequest || selectedGroupUris.size === 0) return;

        isProcessing.value = true;

        try {
            // =========================================================
            // STEP 1 - AGGREGATE DATA (READ PHASE)
            // =========================================================
            const accessNeedGroups = await Promise.all([...selectedGroupUris].map(uri => getAccessNeedGroup(uri)));
            const accessNeedsToGrant = accessNeedGroups.flatMap(group => group.accessNeeds.value);
            const accessNeeds = await Promise.all(accessNeedsToGrant.map(uri => getAccessNeed(uri)));


            // =========================================================
            // STEP 2 - ENFORCE WAC (WRITE PHASE - ACLs)
            // =========================================================
            const isDefault = true;

            // Flatten needs to resources
            const aclTargets = accessNeeds.flatMap(need =>
                need.dataInstances.value.map(resource => ({
                    resource,
                    need,
                    grantees: accessRequest.grantees
                }))
            );

            const aclPromises = aclTargets.map((target) => {
                return grantAccess(
                    target.grantees,
                    target.resource,
                    isDefault,
                    target.need.accessModes.value,
                    session
                );
            });

            const aclResults = await Promise.allSettled(aclPromises);

            // --- Error Verification & Rollback Block ---
            try {
                // "Cheap trick" to check for any rejections
                await Promise.all(aclPromises);
            } catch (err) {
                console.error(`Access Granting Failed - Initiating Rollback: ${err}`);

                // Rollback Loop
                await Promise.all(
                    aclTargets.map((target, index) => {
                        const previousResult = aclResults[index];
                        if (previousResult.status === 'fulfilled') {
                            return rollBackAccess(
                                (previousResult as PromiseFulfilledResult<string>).value, // The ACL Rule URI
                                target.grantees,
                                target.resource,
                                isDefault,
                                target.need.accessModes.value,
                                session
                            );
                        }
                        return Promise.resolve();
                    })
                );

                // Re-throw so the UI knows it failed
                throw err;
            }


            // =========================================================
            // STEP 3 - RECORD INTEROP (WRITE PHASE - REGISTRY)
            // =========================================================

            const needToDataAuthzMap = new Map<string, string>();
            const dataAuthzPromises: Promise<void>[] = [];
            let offset = 0;

            // A. Create Data Authorizations
            for (const need of accessNeeds) {
                const count = need.dataInstances.value.length;
                const relevantResults = aclResults.slice(offset, offset + count);
                offset += count;

                // Extract successful WAC Rule URIs
                const wacRuleURIs = relevantResults.map(r => (r as PromiseFulfilledResult<string>).value);

                const dataAuthz: DataAuthorizationDraft = {
                    grantees: accessRequest.grantees,
                    accessModes: need.accessModes.value,
                    dataInstances: need.dataInstances.value,
                    satisfiesAccessNeed: need.uri,
                    enforcedByRules: wacRuleURIs // Note: updated key based on our discussion
                };

                const creationPromise = createDataAuthorization(containers.dataAuthorization, dataAuthz, session)
                    .then(dataAuthUri => {
                        needToDataAuthzMap.set(need.uri, dataAuthUri);
                    });

                dataAuthzPromises.push(creationPromise);
            }
            await Promise.all(dataAuthzPromises);

            // B. Create Access Authorizations
            const accessAuthzPromises: Promise<string>[] = [];

            for (const group of accessNeedGroups) {
                const groupDataAuthzURIs = group.accessNeeds.value
                    .map(needUri => needToDataAuthzMap.get(needUri))
                    .filter((uri): uri is string => uri !== undefined);

                if (groupDataAuthzURIs.length === 0) continue;

                const accessAuthz: AccessAuthorizationDraft = {
                    accessNeedGroup: group.uri,
                    dataAuthorizations: groupDataAuthzURIs
                };

                accessAuthzPromises.push(
                    createAccessAuthorization(containers.accessAuthorization, accessAuthz, session)
                );
            }
            const createdAccessAuthzURIs = await Promise.all(accessAuthzPromises);

            // C. Create Access Receipt
            const receipt: AccessReceiptDraft = {
                grantees: accessRequest.grantees,
                grantedBy: grantedBy,
                purposes: accessRequest.purposes,
                seeAlso: accessRequest.seeAlso,
                accessRequest: accessRequest.uri,
                accessAuthorizations: createdAccessAuthzURIs
            };

            await createAccessReceipt(containers.accessReceipt, receipt, session);

        } finally {
            isProcessing.value = false;
        }
    }

    return {
        isProcessing,
        executeGrant
    };
}