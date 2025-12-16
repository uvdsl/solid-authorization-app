<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import AccessNeedGroupCard from './AccessNeedGroupCard.vue';
import ContactCard from '../ContactCard.vue';
import { useSolidSession } from '../../composables/useSolidSession';
import { useConfirm, useToast } from 'primevue';
import { useDataContainers } from '../../composables/store/useDataContainers';
import { useAccessGrantWorkflow } from '../../composables/accesscontrol/workflows/useAccessGrantWorkflow';
import { useAccessRequest } from '../../composables/store/requests/useAccessRequest';
import { updateContainerItemsFromWeb } from '../../composables/store/useSolidRdfStore';
import { useAccessDeclineWorkflow } from '../../composables/accesscontrol/workflows/useAccessDeclineWorkflow';
import { getUser } from '../../composables/store/useSolidWebId';

const props = defineProps<{
    uri: string
}>();

const { session, state } = useSolidSession();
const { dataAuthorizationContainer, accessAuthorizationContainer, accessReceiptContainer } = useDataContainers();
const toast = useToast();

const { accessRequest } = useAccessRequest(toRef(props, "uri"));
const selectedAccessNeedGroups = ref<Set<string>>(new Set());
const handleSelection = (uri: string, isSelected: boolean) => {
    if (isSelected) {
        selectedAccessNeedGroups.value.add(uri);
    } else {
        selectedAccessNeedGroups.value.delete(uri);
    }
}
const isLoading = ref(false);
const { executeGrant, isProcessing: isProcessingGrant } = useAccessGrantWorkflow();
const { executeDecline, isProcessing: isProcessingDecline } = useAccessDeclineWorkflow();
const isProcessing = computed(() => !!(isProcessingGrant.value || isProcessingDecline.value || isLoading.value))

async function onApproveClick() {
    if (!accessRequest || !accessRequest.value) { return }
    try {
        await checkForUnKnownGranteesWithUser()
    } catch {
        // user changed their mind
        toast.add({
            severity: "info",
            summary: "Process Stopped",
            detail: "No access was granted at all.",
            life: 5000,
        });
        return;
    }

    try {
        await executeGrant(
            accessRequest.value,
            selectedAccessNeedGroups.value,
            {
                dataAuthorization: dataAuthorizationContainer.value!,
                accessAuthorization: accessAuthorizationContainer.value!,
                accessReceipt: accessReceiptContainer.value!
            },
            state.webId!,
            session,
        );

        isLoading.value = true
        toast.add({
            severity: "success",
            summary: "Access Granted",
            detail: "Permissions enforced and receipt created.",
            life: 5000,
        });
        await updateContainerItemsFromWeb(accessReceiptContainer.value!);

    } catch (err) {
        toast.add({
            severity: "warn",
            summary: "Process Failed - Roll Back",
            detail: err,
            life: 5000,
        });
    } finally {
        setTimeout(() => isLoading.value = false, 1500);
    }
}

async function onDeclineClick() {
    await executeDecline(
        accessRequest.value,
        accessReceiptContainer.value!,
        state.webId!,
        session,
    )
    await updateContainerItemsFromWeb(accessReceiptContainer.value!);
    toast.add({
        severity: "info",
        summary: "Declined Access",
        detail: "They shall not pass.",
        life: 5000,
    })
}

const confirm = useConfirm();
async function checkForUnKnownGranteesWithUser() {
    const user = await getUser(state.webId!)
    const unkownGrantees = accessRequest.value!.grantees.filter(grantee => !user.knows.value.includes(grantee));
    if (unkownGrantees?.length === 0) {
        return;
    }
    return new Promise<void>((resolve, reject) => {
        confirm.require({
            message: `Could not find ${unkownGrantees.map((a) => "<" + a + ">").join(", ")} in your contact list!`,
            header: 'Are you sure?',
            icon: 'pi pi-question-circle',
            rejectLabel: 'Cancel',
            rejectProps: {
                label: 'Cancel',
                severity: 'secondary',
                outlined: true
            },
            acceptProps: {
                label: 'Grant Access Anyway',
                severity: 'danger'
            },
            accept: resolve,
            reject
        });
    })
}

</script>

<template>
    <Card class="access-request-card w-full">
        <template #title>
            <div class="flex align-items-center">
                <i class="pi pi-shield text-primary mr-2 text-2xl"></i>
                <span class="p-card-title"> Access Request</span>
            </div>
        </template>
        <template #subtitle>
            <div class="col-12 md:col-6">
                <h6 class="mt-0 mb-2 text-600">Recipients</h6>
                <div class="flex flex-column gap-2">
                    <ContactCard v-for="recipient in accessRequest?.recipients" :key="recipient" :uri="recipient" />
                </div>
            </div>
        </template>
        <template #content>
            <div class="grid m-0 row-gap-2">

                <div class="col-12">
                    <h6 class="mt-0 mb-2 text-600">Purpose</h6>
                    <div class="flex flex-wrap gap-2">
                        <p v-if="accessRequest?.seeAlso && accessRequest?.seeAlso.length === 0">
                            No purpose information provided.
                        </p>
                        <div v-else>
                            <Chip v-for="purpose in accessRequest?.purposes" :key="purpose"
                                :label="purpose.split('#').pop()" class="text-primary-300" />
                        </div>
                    </div>
                </div>

                <div class="col-12">
                    <h6 class="mt-0 mb-2 text-600">Context Information</h6>
                    <div class="flex flex-column gap-2">
                        <p v-if="accessRequest?.seeAlso && accessRequest?.seeAlso.length === 0">
                            No context information provided.
                        </p>
                        <div v-else>
                            <a v-for="reference in accessRequest?.seeAlso" :key="reference" :href="reference"
                                target="_blank" class="p-link">
                                <i class="pi pi-external-link mr-2"></i>{{ reference }}
                            </a>
                        </div>
                    </div>
                </div>

                <Divider layout="horizontal" />

                <div class="col-12 md:col-6">
                    <h6 class="mt-0 mb-2 text-600">Requesters</h6>
                    <div class="flex flex-column gap-2">
                        <ContactCard v-for="sender in accessRequest?.senders" :key="sender" :uri="sender" />
                    </div>
                </div>

                <div class="col-12 md:col-6">
                    <h6 class="mt-0 mb-2 text-600">Grantees</h6>
                    <div class="flex flex-column gap-2">
                        <ContactCard v-for="grantee in accessRequest?.grantees" :key="grantee" :uri="grantee" />
                    </div>
                </div>


                <Divider layout="horizontal" />

                <div class="col-12 ">
                    <h6 class="mt-0 mb-2 text-600">Requested Data</h6>
                    <div class="flex flex-column gap-3">
                        <AccessNeedGroupCard :uri="accessNeedGroup"
                            @is-selected="(isSelected) => handleSelection(accessNeedGroup, isSelected)"
                            v-for="accessNeedGroup in accessRequest?.accessNeedGroups" :key="accessNeedGroup" />
                    </div>
                </div>
            </div>
        </template>
        <template #footer>
            <div class="flex gap-3 mt-1">
                <Button label="Decline" @click="onDeclineClick" :loading="isProcessing" severity="danger" outlined
                    class="w-full" />
                <Button label="Approve" @click="onApproveClick" :loading="isProcessing" class="w-full" />
            </div>
        </template>
    </Card>
</template>



<style scoped></style>