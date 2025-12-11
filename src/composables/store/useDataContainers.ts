import { LDP, putResource, SPACE } from '@uvdsl/solid-requests';
import { useSolidSession } from '../useSolidSession';
import { Quint, WebReactiveResultError } from '@uvdsl/solid-rdf-store';
import { computed, watch, ref } from 'vue';
import { useSolidRdfStore } from './useSolidRdfStore';


const { state, session } = useSolidSession();

const { store } = useSolidRdfStore();


/** 
 * Somehow find the access request inbox...
 * 1. use ldp:inbox.
 * 2. use interop:access-inbox
 * 3. use type index
 * 4. use data registry
 * 
 * we just choose (1) ldp:inbox as a simple starting point.
 */
async function getAccessRequestInboxes(webId: string) {
  const inboxes = await store.getQuintReactiveFromWeb(webId, LDP("inbox"), null, null, webId)
    .catch((error: WebReactiveResultError) => error.reactiveResult);
  // TODO make sure that there exsits at least one... 
  return inboxes;
}

// via type indicies or data registries or data catalogs
function getAccessReceiptContainers() {
  // TODO
  return ["/authz/receipts/"];
}

function getAccessAuthorizationContainers() {
  // TODO
  return ["/authz/access/"];
}

function getDataAuthorizationContainers() {
  // TODO
  return ["/authz/data/"];
}

//
// ----
//

let storageQueryResult = ref<Quint[]>([])
let inboxQueryResult = ref<Quint[]>([])

watch(() => (state.webId), async (webId, _) => {
  if (!webId) { // only watching the webId to not query the store with webId being undefined
    return;
  }
  storageQueryResult.value = await store.getQuintReactiveFromWeb(webId, SPACE("storage"), null, null, webId)
    .catch((error: WebReactiveResultError) => error.reactiveResult); // if network or parsing error occurs, dont do anything for now, just get the reactive result :)
  inboxQueryResult.value = await getAccessRequestInboxes(webId)
}, { immediate: true });

const storage = computed(() => storageQueryResult.value.map(e => e.object)[0]);
const inbox = computed(() => inboxQueryResult.value.map(e => e.object)[0]);

const dataAuthorizationContainer = computed(() => new URL(getDataAuthorizationContainers()[0], storage.value).href)
const accessAuthorizationContainer = computed(() => new URL(getAccessAuthorizationContainers()[0], storage.value).href)
const accessReceiptContainer = computed(() => new URL(getAccessReceiptContainers()[0], storage.value).href)

export const useDataContainers = () => {
  return {
    storage,
    inbox,
    dataAuthorizationContainer,
    accessAuthorizationContainer,
    accessReceiptContainer
  }
}

// hack for the data containers to exist -- not nice but workable for a demo
watch(() => (storage.value), async () => {
  if (!storage.value) { // only watching the webId to not query the store with webId being undefined
    return;
  }
  await putResource(new URL("/authz/", storage.value).href, "", session).catch(() => { })
  putResource(new URL("/authz/receipts/", storage.value).href, "", session).catch(() => { })
  putResource(new URL("/authz/access/", storage.value).href, "", session).catch(() => { })
  putResource(new URL("/authz/data/", storage.value).href, "", session).catch(() => { })
})