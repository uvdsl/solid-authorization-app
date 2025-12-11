import { Quint } from "@uvdsl/solid-rdf-store";
import { FOAF, RDF, SPACE, VCARD } from "@uvdsl/solid-requests";
import { ref, computed, ComputedRef, Ref, toValue, watchEffect } from "vue";
import { useSolidRdfStore } from "./useSolidRdfStore";
import { SessionEvents, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";
import { useSolidSession } from "../useSolidSession";

const { store } = useSolidRdfStore();
const objectPromiseCache = new Map<string, Promise<SolidWebId>>();
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
 * As defined in {@link https://solid.github.io/webid-profile/}.
 * We choose not to use extended profiles.
 */
class SolidWebId {
    uri: string;
    // Public properties
    types: ComputedRef<string[]>;
    names: ComputedRef<string[]>;
    photos: ComputedRef<string[]>;
    knows: ComputedRef<string[]>;
    storages: ComputedRef<string[]>;
    // Private reactive data sources
    private readonly typesData: Ref<Quint[]>;
    private readonly foafNamesData: Ref<Quint[]>;
    private readonly vcardNamesData: Ref<Quint[]>;
    private readonly photosData: Ref<Quint[]>;
    private readonly knowsData: Ref<Quint[]>;
    private readonly storagesData: Ref<Quint[]>;

    private constructor(uri: string) {
        this.uri = uri;
        // Initialize all underlying data refs 
        this.typesData = ref([]);
        this.foafNamesData = ref([]);
        this.vcardNamesData = ref([]);
        this.photosData = ref([]);
        this.knowsData = ref([]);
        this.storagesData = ref([]);
        // Initialize all computed properties
        this.types = computed(() => this.typesData.value.map(e => e.object));
        this.names = computed(() => {
            const foaf = this.foafNamesData.value.map(e => e.object);
            const vcard = this.vcardNamesData.value.map(e => e.object);
            return [...new Set([...foaf, ...vcard])]; 
        });
        this.photos = computed(() => this.photosData.value.map(e => e.object));
        this.knows = computed(() => this.knowsData.value.map(e => e.object));
        this.storages = computed(() => this.storagesData.value.map(e => e.object));
    }

    private async init() {
        [
            this.typesData.value,
            this.foafNamesData.value,
            this.vcardNamesData.value,
            this.photosData.value,
            this.knowsData.value,
            this.storagesData.value
        ] = await Promise.all([
            store.getQuintReactiveFromWeb(this.uri, RDF("type"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, FOAF("name"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, VCARD("fn"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, VCARD("hasPhoto"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, FOAF("knows"), null, null, this.uri).catch(e => e.reactiveResult),
            store.getQuintReactiveFromWeb(this.uri, SPACE("storage"), null, null, this.uri).catch(e => e.reactiveResult)
        ]);
        return this;
    }

    static async read(uri: string) {
        if (objectPromiseCache.has(uri)) {
            return objectPromiseCache.get(uri)!;
        }
        const instancePromise = new SolidWebId(uri).init();
        objectPromiseCache.set(uri, instancePromise); // IMPORTANT: Immediately store the promise in the cache.
        return instancePromise;
    }
}

export function useSolidWebId(webId?: string | Ref<string|undefined>) {
  // 1. Internal reactive state
  const user = ref<SolidWebId | null>(null);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  // 2. Reacts automatically to changes in the 'webId' prop
  watchEffect(async () => {
    // toValue() gets the value if it's a ref, or returns the value if it's not.
    const currentWebId = toValue(webId);
    if (!currentWebId) {
      user.value = null;
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      user.value = await SolidWebId.read(currentWebId);
    } catch (e: any) {
      error.value = e;
      user.value = null;
    } finally {
      isLoading.value = false;
    }
  });
  // 3. Returns the reactive state for the component to use
  return { user, isLoading, error };
}

export async function getUser(uri: string) {
    return SolidWebId.read(uri);
}