import { createContainer, createResource, deleteResource, getLocationHeader, getResource, LDP, patchResource, putResource, SPACE } from '@uvdsl/solid-requests';
import { useSolidSession } from '../useSolidSession';
import { Quint, WebReactiveResultError } from '@uvdsl/solid-rdf-store';
import { computed, watch, ref } from 'vue';
import { useSolidRdfStore } from './useSolidRdfStore';
import { Session } from '@uvdsl/solid-oidc-client-browser';


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





//
// ----
//
// Setup Hacks
//
// ----
//

const requiredContainers = ref<string[]>([])

watch(() => (storage.value), async () => {
  const todo = []
  if (!storage.value) { // only watching the webId to not query the store with webId being undefined
    return;
  }
  // the following exists purely to allow the store time to update the inbox URI when the WebID is loaded. This is not nice but it works for now.
  const reactivityTickPromise = await new Promise((resolve, _) => { setTimeout(resolve, 0) });
  if (!inbox.value) {
    todo.push("inbox")
  } else {
    try {
      await getResource(inbox.value, session)
    } catch {
      todo.push("inbox")
    }
  }

  try {
    await getResource(new URL("/authz/", storage.value).href, session)
    await getResource(new URL("/authz/receipts/", storage.value).href, session)
    await getResource(new URL("/authz/access/", storage.value).href, session)
    await getResource(new URL("/authz/data/", storage.value).href, session)
  } catch {
    todo.push('authz');
  }
  requiredContainers.value = todo;
})

const setUpContainers = async () => {
  if (requiredContainers.value.includes('inbox')) {
    const inboxLoc = await createContainer(storage.value, "inbox", session).then(resp => getLocationHeader(resp));
    await patchWebIdWithInbox(state.webId!, inboxLoc, session)
      .catch(() => deleteResource(inboxLoc))
      .then(() => store.updateFromWeb(state.webId!))
      .then(() => requestPublicAppend(inboxLoc, state.webId!, session))
      .then(() => store.updateFromWeb(inboxLoc))

  }
  if (requiredContainers.value.includes('authz')) {
    // hack for the data containers to exist -- not nice but workable for a demo
    await putResource(new URL("/authz/", storage.value).href, "", session).catch(() => { })
    putResource(new URL("/authz/receipts/", storage.value).href, "", session).catch(() => { })
    putResource(new URL("/authz/access/", storage.value).href, "", session).catch(() => { })
    putResource(new URL("/authz/data/", storage.value).href, "", session).catch(() => { })
  }

}

async function patchWebIdWithInbox(
  webid: string,
  inbox: string,
  session: Session
) {
  const patchBody = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix ldp: <${LDP()}> .

_:patch a solid:InsertDeletePatch;
    solid:inserts {
        <${webid}> ldp:inbox <${inbox}> .
    } .`;
  return patchResource(webid, patchBody, session);
}

export async function requestPublicAppend(
  accessTo: string,
  webId: string,
  session: Session
) {
  const requestBody = `
   @prefix interop: <http://www.w3.org/ns/solid/interop#> .
    @prefix ldp: <http://www.w3.org/ns/ldp#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix acl: <http://www.w3.org/ns/auth/acl#> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix dpv: <https://w3id.org/dpv#> .
    
    <#AccessNeed-0-0>
      a interop:AccessNeed ;
      interop:accessMode acl:Append ;
      interop:hasDataInstance <${accessTo}> ;
      interop:accessNecessity interop:AccessRequired .
    
    <#AccessNeedGroup-0>
      a interop:AccessNeedGroup ;
      interop:accessNecessity interop:AccessRequired ;
      interop:hasAccessNeed <#AccessNeed-0-0> .
    
    <#AccessRequest>
      a interop:AccessRequest ;
      interop:fromSocialAgent <${webId}> ;
      interop:toSocialAgent <${webId}> ;
      interop:forSocialAgent <http://xmlns.com/foaf/0.1/Agent> ;
      interop:hasAccessNeedGroup <#AccessNeedGroup-0> ;
      dpv:purpose "Users should be able to send you Access Requests!"  ;
      rdfs:seeAlso <https://github.com/uvdsl/solid-authorization-app> .
      `
  return createResource(accessTo, requestBody, session);
}




//
// ----
//


export const useDataContainers = () => {
  return {
    storage,
    inbox,
    dataAuthorizationContainer,
    accessAuthorizationContainer,
    accessReceiptContainer,
    requiredContainers,
    setUpContainers,
  }
}