<script setup lang="ts">
import { useSolidWebId } from '../composables/store/useSolidWebId';

const props = defineProps<{
    uri: string
}>();

const { user, isLoading } = useSolidWebId(props.uri)
</script>

<template>
    <div v-if="isLoading" class="contact-card-skeleton">
        <Skeleton shape="circle" size="3rem" class="mr-2"></Skeleton>
        <div style="width: 70%">
            <Skeleton width="100%" class="mb-2"></Skeleton>
            <Skeleton width="50%"></Skeleton>
        </div>
    </div>

    <div v-else-if="uri" class="contact-card">
        <Panel :toggleable="true" collapsed>
            <template #header>
                <div class="flex flex-column">
                    <div class="flex align-items-center gap-3">
                        <Avatar v-if="user && user.photos.length > 0" :image="user.photos[0]" size="large"
                            shape="circle" class="flex-shrink-0" />
                        <Avatar v-else icon="pi pi-user" size="large" shape="circle" class="flex-shrink-0" />
                        <div class="flex flex-column align-justify-center">
                            <span class="font-bold">{{ user?.names[0] || uri }}</span>
                            <span v-if="user && user.types.length > 0" class="text-sm text-500">
                                {{ user.types[0].split('#').pop()?.split('/').pop() }}
                            </span>
                        </div>
                    </div>
                    <span class="text-xs text-500 mt-1" style="word-break: break-all;">
                        {{ uri }}
                    </span>
                </div>
            </template>

            <div class="contact-details">
                <Divider />

                <h6 class="mb-2 text-600">This contact is also of type:</h6>
                <div v-if="user?.types.length" class="flex flex-wrap gap-2">
                    <Chip v-for="type in user.types" :key="type" :label="type.split('#').pop()?.split('/').pop()" />
                </div>
            </div>
        </Panel>
    </div>
</template>

<style scoped></style>