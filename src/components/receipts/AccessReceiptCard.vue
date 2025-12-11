<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import AccessAuthorizationCard from './AccessAuthorizationCard.vue';
import ContactCard from '../ContactCard.vue';
import { useSolidSession } from '../../composables/useSolidSession';
import { useToast } from 'primevue';
import { useAccessRevokeWorkflow } from '../../composables/accesscontrol/workflows/useAccessRevokeWorkflow';
import { useAccessReceipt } from '../../composables/store/receipts/useAccessReceipt';
import { useDataContainers } from '../../composables/store/useDataContainers';
import { updateContainerItemsFromWeb } from '../../composables/store/useSolidRdfStore';

const props = defineProps<{
    uri: string
}>();

// const { session, state } = useSolidSession();
const toast = useToast();
const { session, state } = useSolidSession();
const { accessReceipt } = useAccessReceipt(toRef(props, "uri"));


const { executeRevoke, isProcessing: isProcessingRevoke } = useAccessRevokeWorkflow();
const isLoading = ref(false);
const isProcessing = computed(() => !!(isProcessingRevoke.value || isLoading.value))

const { accessReceiptContainer } = useDataContainers()

async function onRevokeClick() {
    if (!accessReceipt || !accessReceipt.value) { return }

    try {
        await executeRevoke(
            accessReceipt.value,
            accessReceiptContainer.value,
            state.webId!,
            session
        );
        isLoading.value = true;
        toast.add({
            severity: "success",
            summary: "Access Revoked",
            detail: "Permissions deleted and new receipt created.",
            life: 5000,
        });
        await updateContainerItemsFromWeb(accessReceiptContainer.value!);
    } catch (err) {
        toast.add({
            severity: "warn",
            summary: "Process Failed",
            detail: err,
            life: 5000,
        });
    } finally {
        setTimeout(() => isLoading.value = false, 1500);
    }
}

</script>

<template>
    <Card class="access-receipt-card w-full">
        <template #title>
            <div class="flex align-items-center">
                <i class="pi pi-shield text-primary mr-2 text-2xl"></i>
                <span class="p-card-title"> Access Receipt ({{ accessReceipt?.grantedAt[0] }})</span>
            </div>
        </template>

        <template #subtitle>
            <div class="col-12">
                <h6 class="mt-0 mb-2 text-600">Grantees</h6>
                <div class="flex flex-column gap-2">
                    <ContactCard v-for="grantee in accessReceipt?.grantees" :key="grantee" :uri="grantee" />
                </div>
            </div>
            <div class="col-12">
                <h6 class="mt-0 mb-2 text-600">Granted By</h6>
                <div class="flex flex-column gap-2">
                    <ContactCard v-for="grantedBy in accessReceipt?.grantedBy" :key="grantedBy" :uri="grantedBy" />
                </div>
            </div>
        </template>

        <template #content>
            <div class="grid m-0 row-gap-2">

                <div class="col-12">
                    <h6 class="mt-0 mb-2 text-600">Purpose</h6>
                    <div class="flex flex-wrap gap-2">
                        <Chip v-for="purpose in accessReceipt?.purposes" :key="purpose"
                            :label="purpose.split('#').pop()" class="text-primary-300" />
                    </div>
                </div>

                <div class="col-12">
                    <h6 class="mt-0 mb-2 text-600">Context Information</h6>
                    <div class="flex flex-column gap-2">
                        <a v-for="reference in accessReceipt?.seeAlso" :key="reference" :href="reference"
                            target="_blank" class="p-link">
                            <i class="pi pi-external-link mr-2"></i>{{ reference }}
                        </a>
                    </div>
                </div>

                <Divider layout="horizontal" />

                <div class="col-12 " v-if="accessReceipt && accessReceipt.accessAuthorizations.length > 0">
                    <h6 class="mt-0 mb-2 text-600">Authorized Data</h6>
                    <div class="flex flex-column gap-3">
                        <AccessAuthorizationCard :uri="accessAuthorization"
                            v-for="accessAuthorization in accessReceipt?.accessAuthorizations"
                            :key="accessAuthorization" />
                    </div>
                </div>
                <div class="col-12 " v-else>
                    <h6 class="mt-0 mb-2 text-600">Access Request</h6>
                    <div class="flex flex-column gap-2">
                        <a v-for="reference in accessReceipt?.accessRequests" :key="reference" :href="reference"
                            target="_blank" class="p-link">
                            <i class="pi pi-external-link mr-2"></i>{{ reference }}
                        </a>
                    </div>
                </div>

                <div class="col-12 " v-if="accessReceipt && accessReceipt.replaces.length > 0">
                    <h6 class="mt-0 mb-2 text-600">Revoked Access Granted in</h6>
                    <div class="flex flex-column gap-2">
                        <a v-for="reference in accessReceipt?.replaces" :key="reference" :href="reference"
                            target="_blank" class="p-link">
                            <i class="pi pi-external-link mr-2"></i>{{ reference }}
                        </a>
                    </div>
                </div>

            </div>
        </template>
        <template #footer>
            <div class="flex gap-3 mt-1">
                <Button v-if="accessReceipt && accessReceipt.accessAuthorizations.length > 0" label="Revoke"
                    @click="onRevokeClick" :loading="isProcessing" class="w-full" />
                <Button v-else-if="accessReceipt && accessReceipt.replaces.length === 0" label="ACCESS DECLINED"
                    severity="danger" disabled class="w-full" />
                <Button v-else label="PERMISSIONS REVOKED" severity="danger" disabled class="w-full" />
            </div>
        </template>
    </Card>
</template>



<style scoped></style>