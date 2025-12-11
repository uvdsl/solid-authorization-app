import { Quint } from "@uvdsl/solid-rdf-store";
import { INTEROP, RDFS } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, toValue, watchEffect } from "vue";
import { useSolidRdfStore } from "../useSolidRdfStore";
import { useSolidSession } from "../../useSolidSession";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<AccessReceipt>>();
const { session } = useSolidSession();
session.addEventListener(SessionEvents.STATE_CHANGE, (event: Event) => {
    if (event instanceof CustomEvent) {
        const { isActive } = event.detail as SessionStateChangeDetail;
        if (!isActive) {
            objectPromiseCache.clear();
        }
    }
});

/**
 * Along the lines of {@link https://solid.github.io/data-interoperability-panel/specification/#access-receipt}.
 */
class AccessReceipt {
    uri: string;
    // Public Computed Properties
    grantedAt: ComputedRef<string[]>;
    grantees: ComputedRef<string[]>;
    grantedBy: ComputedRef<string[]>;
    purposes: ComputedRef<string[]>;
    seeAlso: ComputedRef<string[]>;
    replaces: ComputedRef<string[]>;
    accessRequests: ComputedRef<string[]>;
    accessAuthorizations: ComputedRef<string[]>;
    // Private reactive data sources
    private readonly grantedAtData: Ref<Quint[]>;
    private readonly granteesData: Ref<Quint[]>;
    private readonly grantedByData: Ref<Quint[]>;
    private readonly purposesData: Ref<Quint[]>;
    private readonly seeAlsoData: Ref<Quint[]>;
    private readonly replacesData: Ref<Quint[]>;
    private readonly accessRequestsData: Ref<Quint[]>;
    private readonly accessAuthorizationsData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs
        this.grantedAtData = ref([]);
        this.granteesData = ref([]);
        this.grantedByData = ref([]);
        this.purposesData = ref([]);
        this.seeAlsoData = ref([]);
        this.replacesData = ref([]);
        this.accessRequestsData = ref([]);
        this.accessAuthorizationsData = ref([]);
        // Initialize all computed properties
        this.grantedAt = computed(() => this.grantedAtData.value.map(e => e.object));
        this.grantees = computed(() => this.granteesData.value.map(e => e.object));
        this.grantedBy = computed(() => this.grantedByData.value.map(e => e.object));
        this.purposes = computed(() => this.purposesData.value.map(e => e.object));
        this.seeAlso = computed(() => this.seeAlsoData.value.map(e => e.object));
        this.replaces = computed(() => this.replacesData.value.map(e => e.object));
        this.accessRequests = computed(() => this.accessRequestsData.value.map(e => e.object));
        this.accessAuthorizations = computed(() => this.accessAuthorizationsData.value.map(e => e.object));
    }

    private async init() {
        [
            this.grantedAtData.value,
            this.granteesData.value,
            this.grantedByData.value,
            this.purposesData.value,
            this.seeAlsoData.value,
            this.replacesData.value,
            this.accessRequestsData.value,
            this.accessAuthorizationsData.value
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, INTEROP("grantedAt"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("grantee"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("grantedBy"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, "https://w3id.org/dpv#purpose", null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, RDFS("seeAlso"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("replaces"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasAccessRequest"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, INTEROP("hasAccessAuthorization"), null, null, this.uri).catch(e => e.reactiveResult),
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new AccessReceipt(uri).init();
        objectPromiseCache.set(uri, instancePromise);
        return instancePromise;
    }
}

export function useAccessReceipt(uri?: string | Ref<string | undefined>) {
    // 1. Internal reactive state
    const accessReceipt = ref<AccessReceipt | null>(null);
    const isLoading = ref(false);
    const error = ref<Error | null>(null);
    // 2. Reacts automatically to changes in the 'uri' prop
    watchEffect(async () => {
        const currentUri = toValue(uri);
        if (!currentUri) {
            accessReceipt.value = null;
            return;
        }
        isLoading.value = true;
        error.value = null;
        try {
            accessReceipt.value = await AccessReceipt.read(currentUri);
        } catch (e: any) {
            error.value = e;
            accessReceipt.value = null;
        } finally {
            isLoading.value = false;
        }
    });
    // 3. Returns the reactive state
    return { accessReceipt, isLoading, error };
}

export async function getAccessReceipt(uri: string) {
    return AccessReceipt.read(uri);
}