<script setup lang="ts">
import LandingView from './views/LandingView.vue'
import ProfileHeader from './components/ProfileHeader.vue'
import { useSolidSession } from './composables/useSolidSession';
import { useServiceWorkerUpdate } from './composables/useServiceWorkerUpdate';
import ContentPane from './views/ContentPane.vue';
import { useSolidRdfStore } from './composables/store/useSolidRdfStore';
import { watch } from 'vue';
import { useDataContainers } from './composables/store/useDataContainers';
import { useConfirm, useToast } from 'primevue';

const { hasUpdatedAvailable, refreshApp } = useServiceWorkerUpdate();
const { session, state } = useSolidSession();
const { store } = useSolidRdfStore();
store.setConfig({ session })
session.handleRedirectFromLogin();
watch(() => state.isActive, () => console.log("Logged in:", state.webId), { immediate: true });




const toast = useToast();
const confirm = useConfirm();
const { requiredContainers, setUpContainers } = useDataContainers()
watch(() => requiredContainers.value, async () => {
  if (requiredContainers.value.length === 0) {
    return;
  }
  await askForSetUpConsent(requiredContainers.value).catch(() => session.logout());
  await setUpContainers()
  toast.add({
            severity: "success",
            summary: "Setup done.",
            detail: "Inspect your access request inbox!",
            life: 15000,
        });
}, { immediate: true })


async function askForSetUpConsent(required: string[]) {
  return new Promise<void>((resolve, reject) => {
    confirm.require({
      message: `We need to setup your ${required.includes('inbox') ? 'WebId Inbox' : ''}${required.length>1?' and ':''}${required.includes('authz')? 'Authorization Log Containers':''} on your Pod.`,
      header: 'May we quickly set things up?',
      icon: 'pi pi-question-circle',
      rejectLabel: 'Cancel',
      rejectProps: {
        label: 'No: Logout.',
        severity: 'secondary',
        outlined: true
      },
      acceptProps: {
        label: 'Yes, prepare authorizations.',
        severity: 'success'
      },
      accept: resolve,
      reject
    });
  })
}

</script>

<template>
  <div id="content-header">
    <ProfileHeader :uri="state.webId" />
  </div>

  <div id="content-background-pane">
    <LandingView v-if="!state.isActive" />
    <ContentPane v-else />
  </div>

  <Dialog id="update-dialog" header="We updated the App!" v-model:visible="hasUpdatedAvailable" position="bottomright"
    :breakpoints="{ '420px': '100vw' }">
    <div>Save your progress.</div>
    <div>Get the latest version.</div>
    <template #footer>
      <Button label="Update" autofocus @click="refreshApp" />
    </template>
  </Dialog>
  <Toast position="bottom-right" :breakpoints="{ '420px': { width: '100%', right: '0', left: '0' } }" />
  <ConfirmDialog></ConfirmDialog>
</template>

<style>
html {
  width: 100vw;
  height: 100vh;
  overscroll-behavior-y: contain;
}

body {
  overscroll-behavior-y: contain;
  padding: 0px;
  margin: 0px;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  font-weight: 400;
}

#app {
  height: 100%;
  width: 100%;
  padding: 10px;
  background-color: var(--p-primary-200);
}

.no-tap-highlight {
  -webkit-tap-highlight-color: transparent;
}

.p-button {
  -webkit-tap-highlight-color: transparent;
}

#content-header {
  height: 55px;
  padding: 0 15px 5px 15px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

#content-background-pane {
  width: 100%;
  height: calc(100% - 55px);
  background-color: var(--p-surface-800);
  box-sizing: border-box;
  border-radius: 30px;
  padding: 30px;
  overflow: scroll
}

#logo {
  height: 50px;
  width: 50px;
  object-fit: contain;
}

#update-dialog {
  border-radius: 30px;
}

#profile-photo {
  height: 45px;
  width: 45px;
  border-radius: 50%;
}

a:link,
a:visited {
  color: var(--p-primary-400);
}
</style>
