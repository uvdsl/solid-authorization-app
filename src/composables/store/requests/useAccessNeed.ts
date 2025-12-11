import { Quint } from "@uvdsl/solid-rdf-store";
import { INTEROP } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, toValue, watchEffect } from "vue";
import { useSolidRdfStore } from "../useSolidRdfStore";
import { useSolidSession } from "../../useSolidSession";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<AccessNeed>>();
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
 * Along the lines of {@link https://solid.github.io/data-interoperability-panel/specification/#needs-access-need}.
 * We choose not to support inheritance.
 */
class AccessNeed {
    uri: string;
    // Public properties 
    accessModes: ComputedRef<string[]>;
    creatorAccessModes: ComputedRef<string[]>;
    registeredShapeTrees: ComputedRef<string[]>;
    dataInstances: ComputedRef<string[]>;
    accessNecessity: ComputedRef<string | undefined>;
    // Private reactive data sources
    private readonly accessModesData: Ref<Quint[]>;
    private readonly creatorAccessModesData: Ref<Quint[]>;
    private readonly registeredShapeTreesData: Ref<Quint[]>;
    private readonly dataInstancesData: Ref<Quint[]>;
    private readonly accessNecessityData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs 
        this.accessModesData = ref([]);
        this.creatorAccessModesData = ref([]);
        this.registeredShapeTreesData = ref([]);
        this.dataInstancesData = ref([]);
        this.accessNecessityData = ref([]);
        // Initialize all computed properties
        this.accessModes = computed(() => this.accessModesData.value.map(e => e.object));
        this.creatorAccessModes = computed(() => this.creatorAccessModesData.value.map(e => e.object));
        this.registeredShapeTrees = computed(() => this.registeredShapeTreesData.value.map(e => e.object));
        this.dataInstances = computed(() => this.dataInstancesData.value.map(e => e.object));
        this.accessNecessity = computed(() => this.accessNecessityData.value.map(e => e.object)[0]);
    }

    private async init() {
        [
            this.accessModesData.value,
            this.creatorAccessModesData.value,
            this.registeredShapeTreesData.value,
            this.dataInstancesData.value,
            this.accessNecessityData.value
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, INTEROP("accessMode"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("creatorAccessMode"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("registeredShapeTree"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasDataInstance"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("accessNecessity"), null, null, this.uri).catch(e => e.reactiveResult),
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new AccessNeed(uri).init();
        objectPromiseCache.set(uri, instancePromise); // IMPORTANT: Immediately store the promise in the cache.
        return instancePromise;
    }
}


export function useAccessNeed(uri?: string | Ref<string | undefined>) {
    // 1. Internal reactive state
    const accessNeed = ref<AccessNeed | null>(null);
    const isLoading = ref(false);
    const error = ref<Error | null>(null);
    // 2. Reacts automatically to changes in the 'uri' prop
    watchEffect(async () => {
        // toValue() gets the value if it's a ref, or returns the value if it's not.
        const currentUri = toValue(uri);
        if (!currentUri) {
            accessNeed.value = null;
            return;
        }
        isLoading.value = true;
        error.value = null;
        try {
            accessNeed.value = await AccessNeed.read(currentUri);
        } catch (e: any) {
            error.value = e;
            accessNeed.value = null;
        } finally {
            isLoading.value = false;
        }
    });
    // 3. Returns the reactive state for the component to use
    return { accessNeed, isLoading, error };
}

export async function getAccessNeed(uri: string) {
    return AccessNeed.read(uri);
}