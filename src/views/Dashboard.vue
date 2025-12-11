<script setup lang="ts">
import { Quint, WebReactiveResultError } from '@uvdsl/solid-rdf-store';
import { useSolidRdfStore } from '../composables/store/useSolidRdfStore';
import { computed, ref, watch } from 'vue';
import { INTEROP, LDP, RDF } from '@uvdsl/solid-requests';
import AccessRequestCard from '../components/requests/AccessRequestCard.vue';
import AccessReceiptCard from '../components/receipts/AccessReceiptCard.vue';
import { Store } from 'n3';

const props = defineProps<{
    requestContainerUri: string
    receiptContainerUri: string
}>();

const { store } = useSolidRdfStore();

// TODO - add isLoading indication to store
const refreshInbox = async () => {
    await store.updateFromWeb(props.requestContainerUri)
}

// =========================================================================
// STEP 1 - LOAD THE INBOX (Your existing code)
// =========================================================================

const inboxQueryResult = ref<Quint[]>([])
store.getQuintReactiveFromWeb(props.requestContainerUri, LDP("contains"), null, null, props.requestContainerUri)
    .catch((error: WebReactiveResultError) => error.reactiveResult)
    .then(res => inboxQueryResult.value = res)

const inboxItemURIs = computed(() => inboxQueryResult.value.map(e => e.object));

watch(() => (inboxItemURIs.value), async (newVal, oldVal) => {
    const removedItems = oldVal.filter(v => !(newVal || []).includes(v))
    removedItems.forEach(uri => store.update(uri, new Store())) // quick hack to "delete" a dataset
    // TODO - add graceful deletion (incl queries) to @uvdsl/solid-rdf-store  
    const newItems = newVal.filter(v => !(oldVal || []).includes(v))
    newItems.forEach(uri => store.updateFromWeb(uri))
});


// =========================================================================
// STEP 2 - QUERY FOR ACCESS REQUESTS (Your existing code)
// =========================================================================

const accessRequestsQueryResult = ref<Quint[]>([])
store.getQuintReactiveFromWeb(null, RDF("type"), INTEROP("AccessRequest"), null, null)
    .catch((error: WebReactiveResultError) => error.reactiveResult)
    .then(res => accessRequestsQueryResult.value = res)

// All Access Requests currently sitting in the Inbox
const availableAccessRequestURIs = computed(() =>
    accessRequestsQueryResult.value
        .filter(e => inboxItemURIs.value.includes(e.dataset))
        .map(e => e.subject)
);


// =========================================================================
// STEP 3 - LOAD THE RECEIPTS
// =========================================================================
// We must load the receipt container so the store knows which requests are "done".

const receiptQueryResult = ref<Quint[]>([])
store.getQuintReactiveFromWeb(props.receiptContainerUri, LDP("contains"), null, null, props.receiptContainerUri)
    .catch((error: WebReactiveResultError) => error.reactiveResult)
    .then(res => receiptQueryResult.value = res)

const receiptItemURIs = computed(() => receiptQueryResult.value.map(e => e.object));

// Fetch the actual receipt files when they appear in the container
watch(() => (receiptItemURIs.value), async (newVal, oldVal) => {
    const newItems = newVal.filter(v => !(oldVal || []).includes(v))
    newItems.forEach(uri => store.updateFromWeb(uri))
});


// =========================================================================
// STEP 4 - FIND "PROCESSED" REQUESTS & ACTIVE RECEIPTS
// =========================================================================

// =========================================================================
// QUERIES
// =========================================================================

// 1. Link Receipts to Requests (?subject hasAccessRequest ?object)
const linksQueryResult = ref<Quint[]>([])
store.getQuintReactiveFromWeb(null, INTEROP("hasAccessRequest"), null, null, null)
    .then(res => linksQueryResult.value = res)

// 2. Link Receipts to History (?subject replaces ?object)
const replacementsQueryResult = ref<Quint[]>([])
store.getQuintReactiveFromWeb(null, INTEROP("replaces"), null, null, null)
    .then(res => replacementsQueryResult.value = res)

// 3. Link Receipts to Authorizations (?subject hasAccessAuthorization ?object)
// We use this to check if a receipt is "Empty" (Declined/Revoked) or "Full" (Granting)
const authsQueryResult = ref<Quint[]>([])
store.getQuintReactiveFromWeb(null, INTEROP("hasAccessAuthorization"), null, null, null)
    .then(res => authsQueryResult.value = res)


// =========================================================================
// HELPER SETS
// =========================================================================

// A. All Requests that have *ever* been answered
const answeredRequestURIs = computed(() => linksQueryResult.value.map(e => e.object));

// B. All Receipts that are "History" (Intermediate results)
// If A replaces B, then B is history.
const historicReceiptURIs = computed(() => replacementsQueryResult.value.map(e => e.object));

// C. All Receipts that are "Heads" (Current state of reality)
// They exist, and nothing has replaced them yet.
const allReceiptURIs = computed(() => linksQueryResult.value.map(e => e.subject));
const activeHeadReceiptURIs = computed(() =>
    allReceiptURIs.value.filter(uri => !historicReceiptURIs.value.includes(uri))
);

// D. Receipts that actually have data attached (Grants)
const grantingReceiptURIs = computed(() => authsQueryResult.value.map(e => e.subject));


// =========================================================================
// THE FINAL RESULT SETS
// =========================================================================

/**
 * 1. PENDING REQUESTS
 * Requests in the Inbox that have never been answered.
 */
const pendingAccessRequestURIs = computed(() => {
    return availableAccessRequestURIs.value.filter(reqUri =>
        !answeredRequestURIs.value.includes(reqUri)
    );
});

/**
 * 2. ACTIVELY GRANTING RECEIPTS
 * Current receipts (not history) that have > 0 Access Authorizations.
 */
const activeGrantingReceiptURIs = computed(() => {
    return activeHeadReceiptURIs.value.filter(receiptUri =>
        grantingReceiptURIs.value.includes(receiptUri)
    );
});

/**
 * 3. DONE / CLOSED RECEIPTS (Declined or Revoked)
 * Current receipts (not history) that have 0 Access Authorizations.
 * This covers both "Initially Declined" and "Revoked via update".
 */
const closedReceiptURIs = computed(() => {
    return activeHeadReceiptURIs.value.filter(receiptUri =>
        !grantingReceiptURIs.value.includes(receiptUri)
    );
});


// TODO in general UI (i.e. Access Overview - why is an .acl set the way it is)
// show matching between 
// data authorizations (and linked access authorizations / access requests) 
// and actual .acl rules found in any .acl in the storage
//
// highlight dangling .acls
const activeView = ref('inbox'); // Options: 'inbox', 'active', 'done'
</script>

<template>
    <!-- <Button @click="refreshInbox">Refresh</Button> -->
    <div class="grid">
        <div class="col-12 md:col-6 md:col-offset-3">

            <div class="flex gap-2 mb-4">
                <Button @click="activeView = 'inbox'" :outlined="activeView !== 'inbox'"
                    v-tooltip.top="'View Request Inbox'"
                    class="flex-1 flex align-items-center justify-content-center">
                    <i class="hidden md:block pi pi-inbox mr-2"></i>
                    <span>Inbox</span>
                    <Badge v-if="pendingAccessRequestURIs.length > 0" :value="pendingAccessRequestURIs.length" />
                </Button>

                <Button @click="activeView = 'active'" :outlined="activeView !== 'active'"
                    v-tooltip.top="'View Active Receipts'"
                    class="flex-1 flex align-items-center justify-content-center">
                    <i class="hidden md:block pi pi-check-circle mr-2"></i>
                    <span>Active</span>
                </Button>

                <Button @click="activeView = 'done'" :outlined="activeView !== 'done'"
                    v-tooltip.top="'View Receipt History'"
                    class="flex-1 flex align-items-center justify-content-center">
                    <i class="hidden md:block  pi pi-history mr-2"></i>
                    <span>History</span>
                </Button>
                <Button @click="refreshInbox" outlined rounded icon="pi pi-refresh" severity="secondary"
                    v-tooltip.top="'Refresh Inbox'" />
            </div>

            <div v-if="activeView === 'inbox'">
                <div v-if="pendingAccessRequestURIs.length === 0"
                    class="text-center p-4 text-500 surface-card border-round">
                    <i class="pi pi-check-circle text-4xl mb-3"></i>
                    <div>All caught up! No pending requests.</div>
                </div>
                <div v-else class="flex flex-column gap-3">
                    <div v-for="uri in pendingAccessRequestURIs" :key="uri">
                        <AccessRequestCard :uri="uri" />
                    </div>
                </div>
            </div>

            <div v-if="activeView === 'active'">
                <div v-if="activeGrantingReceiptURIs.length === 0"
                    class="text-center p-4 text-500 surface-card border-round">
                    <i class="pi pi-check-circle text-4xl mb-3"></i>
                    <div>No active access grants found.</div>
                </div>
                <div v-else class="flex flex-column gap-3">
                    <div v-for="uri in activeGrantingReceiptURIs" :key="uri">
                        <AccessReceiptCard :uri="uri" />
                    </div>
                </div>
            </div>

            <div v-if="activeView === 'done'">
                <div v-if="closedReceiptURIs.length === 0" class="text-center p-4 text-500 surface-card border-round">
                    <i class="pi pi-check-circle text-4xl mb-3"></i>
                    <div>No history of completed or revoked requests.</div>
                </div>
                <div v-else class="flex flex-column gap-3">
                    <div v-for="uri in closedReceiptURIs" :key="uri">
                        <AccessReceiptCard :uri="uri" />
                    </div>
                </div>
            </div>

        </div>
    </div>

</template>

<style scoped></style>
