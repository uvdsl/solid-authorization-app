<script setup lang="ts">
import { toRef } from 'vue';
import { useAccessAuthorization } from '../../composables/store/receipts/useAccessAuthorization';
import DataAuthorizationCard from './DataAuthorizationCard.vue';

const props = defineProps<{
  uri: string
}>();

const emit = defineEmits<{ (e: 'isSelected', value: boolean): void }>();
const { accessAuthorization } = useAccessAuthorization(toRef(props, "uri"));

</script>

<template>
  <Panel :toggleable="true" collapsed>
     <template #header>
      <div class="flex align-items-center">
        <Chip :label="`${accessAuthorization?.dataAuthorizations.length} Data Authorizations`" class="text-primary-300" />
      </div>
    </template>
    <div v-for="dataAuthorization in accessAuthorization?.dataAuthorizations" :key="dataAuthorization">
      <Divider />
      <DataAuthorizationCard :uri="dataAuthorization" />
    </div>
  </Panel>
</template>

<style scoped></style>