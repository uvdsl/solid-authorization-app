<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { useAccessNeedGroup } from '../../composables/store/requests/useAccessNeedGroup';
import AccessNeedCard from './AccessNeedCard.vue';
import { INTEROP } from '@uvdsl/solid-requests';

const props = defineProps<{
  uri: string
}>();

const emit = defineEmits<{ (e: 'isSelected', value: boolean): void }>();
const { accessNeedGroup } = useAccessNeedGroup(toRef(props, "uri"));
const isRequired = computed(() => accessNeedGroup.value?.accessNecessity === INTEROP("AccessRequired"))
const isSelected = ref(isRequired.value)
watch(() => isRequired.value, (newVal) => isSelected.value = newVal, { immediate: true })
watch(() => isSelected.value, () => emit('isSelected', isSelected.value), { immediate: true })
</script>

<template>
  <Panel :toggleable="true" collapsed>
    <template #header>
      <div class="flex align-items-center">
        <Checkbox v-model="isSelected" binary :disabled="isRequired" class="mr-2" />
        <Chip :label="isRequired ? 'Required' : 'Optional'" class="text-primary-300" />
      </div>
    </template>

    <div v-for="accessNeed in accessNeedGroup?.accessNeeds" :key="accessNeed">
      <Divider />
      <AccessNeedCard :uri="accessNeed" />
    </div>
  </Panel>
</template>

<style scoped></style>