import { Quint } from "@uvdsl/solid-rdf-store";
import { INTEROP } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, watchEffect, toValue } from "vue";
import { useSolidRdfStore } from "../useSolidRdfStore";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";
import { useSolidSession } from "../../useSolidSession";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<AccessNeedGroup>>();
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
 * Along the lines of {@link https://solid.github.io/data-interoperability-panel/specification/#access-need-group}.
 * We choose not to support replacement.
 * We choose not to use description sets.
 */
class AccessNeedGroup {
    uri: string;
    // Public properties
    accessNeeds: ComputedRef<string[]>;
    accessNecessity: ComputedRef<string | undefined>;
    // Private reactive data sources
    private readonly accessNeedsData: Ref<Quint[]>;
    private readonly accessNecessityData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs 
        this.accessNeedsData = ref([]);
        this.accessNecessityData = ref([]);
        // Initialize all computed properties
        this.accessNeeds = computed(() => this.accessNeedsData.value.map(e => e.object));
        this.accessNecessity = computed(() => this.accessNecessityData.value.map(e => e.object)[0]);
    }

    private async init() {
        [
            this.accessNeedsData.value,
            this.accessNecessityData.value
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasAccessNeed"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("accessNecessity"), null, null, this.uri).catch(e => e.reactiveResult)
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new AccessNeedGroup(uri).init();
        objectPromiseCache.set(uri, instancePromise); // IMPORTANT: Immediately store the promise in the cache.
        return instancePromise;
    }
}

export function useAccessNeedGroup(uri?: string | Ref<string | undefined>) {
    // 1. Internal reactive state
    const accessNeedGroup = ref<AccessNeedGroup | null>(null);
    const isLoading = ref(false);
    const error = ref<Error | null>(null);
    // 2. Reacts automatically to changes in the 'uri' prop
    watchEffect(async () => {
        // toValue() gets the value if it's a ref, or returns the value if it's not.
        const currentUri = toValue(uri);
        if (!currentUri) {
            accessNeedGroup.value = null;
            return;
        }
        isLoading.value = true;
        error.value = null;
        try {
            accessNeedGroup.value = await AccessNeedGroup.read(currentUri);
        } catch (e: any) {
            error.value = e;
            accessNeedGroup.value = null;
        } finally {
            isLoading.value = false;
        }
    });
    // 3. Returns the reactive state for the component to use
    return { accessNeedGroup, isLoading, error };
}

export async function getAccessNeedGroup(uri: string){
    return AccessNeedGroup.read(uri);
}