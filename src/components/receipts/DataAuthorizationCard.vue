<script setup lang="ts">
import { toRef } from 'vue';
import { useDataAuthorization } from '../../composables/store/receipts/useDataAuthorization';

const props = defineProps<{
    uri: string
}>();

const { dataAuthorization } = useDataAuthorization(toRef(props, "uri"));
</script>

<template>
    <div class="grid align-items-start text-sm">
        <div class="col-12 sm:col-4">
            <p class="font-bold mb-2">Access Mode</p>
            <div class="flex flex-wrap gap-2">
                <Chip v-for="accessMode in dataAuthorization?.accessModes" 
                      :key="accessMode" 
                      :label="accessMode.split('#')[1]" />
            </div>
        </div>

        <!-- <div  class="col-12 sm:col-4">
            <p class="font-bold mb-2">Required Data</p>
            <div class="flex flex-wrap gap-2">
                <a v-for="shapeTree in dataAuthorization?.registeredShapeTrees" 
                   :key="shapeTree" 
                   :href="shapeTree"
                   class="no-underline">
                    <Chip :label="shapeTree.split('#').pop()" 
                          class="cursor-pointer hover:surface-200" />
                </a>
            </div>
        </div> -->

        <div class="col-12 sm:col-8">
            <p class="font-bold mb-2">Resources</p>
            <div class="flex flex-wrap gap-2">
                <a v-for="dataInstance in dataAuthorization?.dataInstances" 
                   :key="dataInstance" 
                   :href="dataInstance"
                   class="no-underline">
                    <Chip :label="dataInstance" 
                          class="cursor-pointer hover:surface-200" />
                </a>
            </div>
        </div>

    </div>
</template>

<style scoped>
.no-underline {
    text-decoration: none;
}
</style>