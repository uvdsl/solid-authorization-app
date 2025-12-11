import { Quint } from "@uvdsl/solid-rdf-store";
import { INTEROP, RDFS } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, toValue, watchEffect } from "vue";
import { useSolidRdfStore } from "../useSolidRdfStore";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";
import { useSolidSession } from "../../useSolidSession";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<AccessRequest>>();
const { session } = useSolidSession();
session.addEventListener(SessionEvents.STATE_CHANGE, (event: Event) => {
    if (event instanceof CustomEvent) {
        const { isActive } = event.detail as SessionStateChangeDetail;
        if (!isActive) { // If the session becomes inactive (logout/expiration), wipe the cache.
            objectPromiseCache.clear()
        }
    }
});

/**
 * Along the lines of {@link https://solid.github.io/data-interoperability-panel/specification/#access-request}.
 * We choose to extend the access request model: forSocialAgent (i.e. the grantee), dpv:purpose, and rdfs:seeAlso
 */
class AccessRequest {
    uri: string;
    // Public properties 
    accessNeedGroups: ComputedRef<string[]>;
    senders: ComputedRef<string[]>;
    recipients: ComputedRef<string[]>;
    grantees: ComputedRef<string[]>;
    purposes: ComputedRef<string[]>;
    seeAlso: ComputedRef<string[]>;
    // Private reactive data sources
    private readonly accessNeedGroupsData: Ref<Quint[]>;
    private readonly sendersData: Ref<Quint[]>;
    private readonly recipientsData: Ref<Quint[]>;
    private readonly granteesData: Ref<Quint[]>;
    private readonly purposesData: Ref<Quint[]>;
    private readonly seeAlsoData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs 
        this.accessNeedGroupsData = ref([]);
        this.sendersData = ref([]);
        this.recipientsData = ref([]);
        this.granteesData = ref([]);
        this.purposesData = ref([]);
        this.seeAlsoData = ref([]);
        // Initialize all computed properties
        this.accessNeedGroups = computed(() => this.accessNeedGroupsData.value.map(e => e.object));
        this.senders = computed(() => this.sendersData.value.map(e => e.object));
        this.recipients = computed(() => this.recipientsData.value.map(e => e.object));
        this.grantees = computed(() => this.granteesData.value.map(e => e.object));
        this.purposes = computed(() => this.purposesData.value.map(e => e.object));
        this.seeAlso = computed(() => this.seeAlsoData.value.map(e => e.object));
    }

    private async init() {
        [
            this.accessNeedGroupsData.value,
            this.sendersData.value,
            this.recipientsData.value,
            this.granteesData.value,
            this.purposesData.value,
            this.seeAlsoData.value
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasAccessNeedGroup"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("fromSocialAgent"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("toSocialAgent"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("forSocialAgent"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, "https://w3id.org/dpv#purpose", null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, RDFS("seeAlso"), null, null, this.uri).catch(e => e.reactiveResult)
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new AccessRequest(uri).init();
        objectPromiseCache.set(uri, instancePromise); // IMPORTANT: Immediately store the promise in the cache.
        return instancePromise;
    }
}

export function useAccessRequest(uri?: string | Ref<string | undefined>) {
    // 1. Internal reactive state
    const accessRequest = ref<AccessRequest | null>(null);
    const isLoading = ref(false);
    const error = ref<Error | null>(null);
    // 2. Reacts automatically to changes in the 'uri' prop
    watchEffect(async () => {
        // toValue() gets the value if it's a ref, or returns the value if it's not.
        const currentUri = toValue(uri);
        if (!currentUri) {
            accessRequest.value = null;
            return;
        }
        isLoading.value = true;
        error.value = null;
        try {
            accessRequest.value = await AccessRequest.read(currentUri);
        } catch (e: any) {
            error.value = e;
            accessRequest.value = null;
        } finally {
            isLoading.value = false;
        }
    });
    // 3. Returns the reactive state for the component to use
    return { accessRequest, isLoading, error };
}

export async function getAccessRequest(uri: string) {
    return AccessRequest.read(uri);
}