import { ref } from 'vue';
import { Session } from "@uvdsl/solid-oidc-client-browser";
import { revokeAccess } from '../useWebAccessControl';
import { createAccessReceipt, AccessReceiptDraft } from '../useSolidAuthorizations';
import { getAccessAuthorization } from '../../store/receipts/useAccessAuthorization';
import { getDataAuthorization } from '../../store/receipts/useDataAuthorization';



export function useAccessRevokeWorkflow() {
    const isProcessing = ref(false);

    /**
     * Orchestrates the entire Access Revocation transaction.
     * 1. Aggregates data
     * 2. Deletes WAC Rules (ACLs)
     */
    async function executeRevoke(
        accessReceipt: any, // TODO proper typing
        accessReceiptContainer: string,
        grantedBy: string,
        session: Session,
    ) {
        if (!accessReceipt) return;
        isProcessing.value = true;

        try {

            // =========================================================
            // STEP 1 - AGGREGATE DATA (READ PHASE)
            // =========================================================
            const accessAuthPromises = accessReceipt.accessAuthorizations.map((uri: string) => getAccessAuthorization(uri));
            const accessAuthzs = await Promise.all(accessAuthPromises);
            const dataAuthPromises = accessAuthzs.flatMap(accessAuthzs => accessAuthzs.dataAuthorizations.value.map((uri: string) => getDataAuthorization(uri)));
            const dataAuthzs = await Promise.all(dataAuthPromises);

            // =========================================================
            // STEP 2 - ENFORCE WAC (WRITE PHASE - ACLs)
            // =========================================================
            const isDefault = true;
            const aclPromises = dataAuthzs.flatMap(dataAuthz => dataAuthz.enforcedByRules.value.map((wacRule: string) =>
                revokeAccess(
                    wacRule,
                    accessReceipt.grantees,
                    isDefault,
                    dataAuthz.accessModes.value,
                    session)
            ))

            // --- Error Verification ---
            try {
                // "Cheap trick" to check for any rejections
                await Promise.all(aclPromises);
            } catch (err) {
                console.error(`Access Granting Failed - Initiating Rollback: ${err}`);
                // Document Failures
                console.log(await Promise.allSettled(aclPromises))
                // Re-throw so the UI knows it failed
                throw err;
            }


            // =========================================================
            // STEP 3 - RECORD INTEROP (WRITE PHASE - REGISTRY)
            // =========================================================
            const receipt: AccessReceiptDraft = {
                grantees: accessReceipt.grantees,
                grantedBy: grantedBy,
                purposes: accessReceipt.purposes,
                seeAlso: accessReceipt.seeAlso,
                accessRequest: accessReceipt.accessRequests,
                accessAuthorizations: [],
                replaces: accessReceipt.uri
            };

            await createAccessReceipt(accessReceiptContainer, receipt, session);

        } finally {
            isProcessing.value = false;
        }
    }

    return {
        isProcessing,
        executeRevoke
    };
}