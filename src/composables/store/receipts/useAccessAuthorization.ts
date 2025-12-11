import { Quint } from "@uvdsl/solid-rdf-store";
import { INTEROP } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, toValue, watchEffect } from "vue";
import { useSolidRdfStore } from "../useSolidRdfStore";
import { useSolidSession } from "../../useSolidSession";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<AccessAuthorization>>();
const { session } = useSolidSession();
session.addEventListener(SessionEvents.STATE_CHANGE, (event: Event) => {
    if (event instanceof CustomEvent) {
        const { isActive } = event.detail as SessionStateChangeDetail;
        if (!isActive) { // If the session becomes inactive (logout/expiration), wipe the cache.
            objectPromiseCache.clear();
        }
    }
});

/**
 * Along the lines of {@link https://solid.github.io/data-interoperability-panel/specification/#access-authorization}.
 */
class AccessAuthorization {
    uri: string;
    // Public Computed Properties
    accessNeedGroups: ComputedRef<string[]>;
    dataAuthorizations: ComputedRef<string[]>;
    // Private reactive data sources
    private readonly accessNeedGroupsData: Ref<Quint[]>;
    private readonly dataAuthorizationsData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs
        this.accessNeedGroupsData = ref([]);
        this.dataAuthorizationsData = ref([]);
        // Initialize all computed properties
        this.accessNeedGroups = computed(() => this.accessNeedGroupsData.value.map(e => e.object));
        this.dataAuthorizations = computed(() => this.dataAuthorizationsData.value.map(e => e.object));
    }

    private async init() {
        [
            this.accessNeedGroupsData.value,
            this.dataAuthorizationsData.value
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasAccessNeedGroup"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasDataAuthorization"), null, null, this.uri).catch(e => e.reactiveResult),
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new AccessAuthorization(uri).init();
        objectPromiseCache.set(uri, instancePromise);
        return instancePromise;
    }
}

export function useAccessAuthorization(uri?: string | Ref<string | undefined>) {
    // 1. Internal reactive state
    const accessAuthorization = ref<AccessAuthorization | null>(null);
    const isLoading = ref(false);
    const error = ref<Error | null>(null);
    // 2. Reacts automatically to changes in the 'uri' prop
    watchEffect(async () => {
        const currentUri = toValue(uri);
        if (!currentUri) {
            accessAuthorization.value = null;
            return;
        }
        isLoading.value = true;
        error.value = null;
        try {
            accessAuthorization.value = await AccessAuthorization.read(currentUri);
        } catch (e: any) {
            error.value = e;
            accessAuthorization.value = null;
        } finally {
            isLoading.value = false;
        }
    });
    // 3. Returns the reactive state for the component to use
    return { accessAuthorization, isLoading, error };
}

export async function getAccessAuthorization(uri: string) {
    return AccessAuthorization.read(uri);
}