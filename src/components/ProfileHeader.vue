<script setup lang="ts">
import LogoutButton from './LogoutButton.vue';

import { useSolidWebId } from '../composables/store/useSolidWebId';
import { toRef } from 'vue';

const props = defineProps<{
  uri?: string
}>();
const { user } = useSolidWebId(toRef(props, "uri"));
</script>

<template>
  <div class="md:col-2 col-6">
    <img id="logo" src="/src/assets/logo.svg" alt="Icon" />
  </div>
  <div class="hidden md:block md:col-5 text-center" style="color:black; font-weight: bold;">
    <div>Hi, your are in control</div>
    <span>{{ user?.names[0] || uri }}</span>
  </div>
  <div id="right-header" class="md:col-2 col-6 flex justify-content-end align-items-center">
    <img v-if="user" id="profile-photo" class="overlap" :src="user.photos[0]" />
    <LogoutButton />
  </div>
</template>

<style scoped>
.overlap {
  border-radius: 50%;
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
  margin-right: -10%;
}

/* Default overlap on large screens */
@media (min-width: 1024px) {
  .overlap {
    margin-right: -10%;
  }

  #right-header:hover .overlap {
    margin-right: 2px;
  }
}

/* No overlap on small screens */
@media (max-width: 1023px) {
  .overlap {
    margin-right: 8px;
    /* Space instead of overlap */
  }
}
</style>
