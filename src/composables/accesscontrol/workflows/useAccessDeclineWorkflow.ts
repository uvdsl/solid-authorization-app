import { ref } from 'vue';
import { Session } from "@uvdsl/solid-oidc-client-browser";
import { createAccessReceipt, AccessReceiptDraft } from '../useSolidAuthorizations';


export function useAccessDeclineWorkflow() {
    const isProcessing = ref(false);

    async function executeDecline(
        accessRequest: any, // TODO proper typing
        accessReceiptContainer: string,
        grantedBy: string,
        session: Session,
    ) {
        if (!accessRequest) return;
        isProcessing.value = true;

        try {

            // =========================================================
            // STEP 1 - RECORD INTEROP (WRITE PHASE - REGISTRY)
            // =========================================================
            const receipt: AccessReceiptDraft = {
                grantees: accessRequest.grantees,
                grantedBy: grantedBy,
                purposes: accessRequest.purposes,
                seeAlso: accessRequest.seeAlso,
                accessRequest: accessRequest.uri,
                accessAuthorizations: []
            };

            await createAccessReceipt(accessReceiptContainer, receipt, session);

        } finally {
            isProcessing.value = false;
        }
    }

    return {
        isProcessing,
        executeDecline
    };
}