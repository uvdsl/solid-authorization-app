<script setup lang="ts">
import Dashboard  from './Dashboard.vue';
import { useDataContainers } from '../composables/store/useDataContainers';

const { inbox, accessReceiptContainer } = useDataContainers();

</script>

<template>
    <Dashboard v-if="inbox" :requestContainerUri="inbox" :receiptContainerUri="accessReceiptContainer" />
</template>

<style scoped></style>
