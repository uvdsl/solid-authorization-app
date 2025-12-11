import { reactive } from "vue";
import { WebReactiveQuintStore } from "@uvdsl/solid-rdf-store";
import { useSolidSession } from "../useSolidSession";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";
import { LDP } from "@uvdsl/solid-requests";


const store = reactive(new WebReactiveQuintStore());

const { session } = useSolidSession();
session.addEventListener(SessionEvents.STATE_CHANGE, (event: Event) => {
    if (event instanceof CustomEvent) {
        const { isActive } = event.detail as SessionStateChangeDetail;
        if (!isActive) { // If the session becomes inactive (logout/expiration), wipe the cache.
            store.clear()
        }
    }
});

export async function updateContainerItemsFromWeb(uri: string) {
    // look into the container to see if we have any items
    const oldItemURIs = store.getQuint(uri, LDP("contains"), null, null, uri).map(e => e.object)
    await store.updateFromWeb(uri);
    const currentItemURIs = store.getQuint(uri, LDP("contains"), null, null, uri).map(e => e.object)
    // update
    const newItems = currentItemURIs.filter(v => !oldItemURIs.includes(v))
    newItems.forEach(uri => store.updateFromWeb(uri))
    const removedItems = oldItemURIs.filter(v => !currentItemURIs.includes(v))
    // TODO add removal to store... strange I didnt already implement that... oh well.
}

export const useSolidRdfStore = () => {
    return { store };
};

