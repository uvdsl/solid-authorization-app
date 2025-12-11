import { Quint } from "@uvdsl/solid-rdf-store";
import { INTEROP, RDFS } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, toValue, watchEffect } from "vue";
import { useSolidRdfStore } from "../useSolidRdfStore";
import { useSolidSession } from "../../useSolidSession";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<DataAuthorization>>();
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
 * Along the lines of {@link https://solid.github.io/data-interoperability-panel/specification/#data-authorization}.
 */
class DataAuthorization {
    uri: string;
    // Public Computed Properties
    accessModes: ComputedRef<string[]>;
    registeredShapeTrees: ComputedRef<string[]>;
    dataInstances: ComputedRef<string[]>;
    dataRegistrations: ComputedRef<string[]>;
    grantees: ComputedRef<string[]>;
    scopes: ComputedRef<string[]>;
    accessNeeds: ComputedRef<string[]>;
    enforcedByRules: ComputedRef<string[]>;
    // Private reactive data sources
    private readonly accessModesData: Ref<Quint[]>;
    private readonly registeredShapeTreesData: Ref<Quint[]>;
    private readonly dataInstancesData: Ref<Quint[]>;
    private readonly dataRegistrationsData: Ref<Quint[]>;
    private readonly granteesData: Ref<Quint[]>;
    private readonly scopesData: Ref<Quint[]>;
    private readonly accessNeedsData: Ref<Quint[]>;
    private readonly enforcedByRulesData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs
        this.accessModesData = ref([]);
        this.registeredShapeTreesData = ref([]);
        this.dataInstancesData = ref([]);
        this.dataRegistrationsData = ref([]);
        this.granteesData = ref([]);
        this.scopesData = ref([]);
        this.accessNeedsData = ref([]);
        this.enforcedByRulesData = ref([]);
        // Initialize all computed properties
        this.accessModes = computed(() => this.accessModesData.value.map(e => e.object));
        this.registeredShapeTrees = computed(() => this.registeredShapeTreesData.value.map(e => e.object));
        this.dataInstances = computed(() => this.dataInstancesData.value.map(e => e.object));
        this.dataRegistrations = computed(() => this.dataRegistrationsData.value.map(e => e.object));
        this.grantees = computed(() => this.granteesData.value.map(e => e.object));
        this.scopes = computed(() => this.scopesData.value.map(e => e.object));
        this.accessNeeds = computed(() => this.accessNeedsData.value.map(e => e.object));
        this.enforcedByRules = computed(() => this.enforcedByRulesData.value.map(e => e.object));
    }

    private async init() {
        [
            this.accessModesData.value,
            this.registeredShapeTreesData.value,
            this.dataInstancesData.value,
            this.dataRegistrationsData.value,
            this.granteesData.value,
            this.scopesData.value,
            this.accessNeedsData.value,
            this.enforcedByRulesData.value,
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, INTEROP("accessMode"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("registeredShapeTree"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasDataInstance"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasDataRegistration"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("grantee"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("scopeOfAuthorization"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("satisfiesAccessNeed"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, RDFS("seeAlso"), null, null, this.uri).catch(e => e.reactiveResult),
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new DataAuthorization(uri).init();
        objectPromiseCache.set(uri, instancePromise);
        return instancePromise;
    }
}

export function useDataAuthorization(uri?: string | Ref<string | undefined>) {
    // 1. Internal reactive state
    const dataAuthorization = ref<DataAuthorization | null>(null);
    const isLoading = ref(false);
    const error = ref<Error | null>(null);
    // 2. Reacts automatically to changes in the 'uri' prop
    watchEffect(async () => {
        const currentUri = toValue(uri);
        if (!currentUri) {
            dataAuthorization.value = null;
            return;
        }
        isLoading.value = true;
        error.value = null;
        try {
            dataAuthorization.value = await DataAuthorization.read(currentUri);
        } catch (e: any) {
            error.value = e;
            dataAuthorization.value = null;
        } finally {
            isLoading.value = false;
        }
    });
    // 3. Returns the reactive state for the component to use
    return { dataAuthorization, isLoading, error };
}

export async function getDataAuthorization(uri: string) {
    return DataAuthorization.read(uri);
}