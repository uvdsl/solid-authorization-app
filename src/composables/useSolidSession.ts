import { DynamicRegistrationClientDetails, Session, SessionEvents, SessionExpirationWarningDetail, SessionOptions, SessionStateChangeDetail } from "@uvdsl/solid-oidc-client-browser";
import { Reactive, reactive, readonly } from "vue";
import refreshWorkerUrl from '@uvdsl/solid-oidc-client-browser/RefreshWorker?sharedworker&url';

interface SessionState {
  isActive: boolean;
  webId?: string;
  isLoading: boolean;
}

// This reactive object holds the global session state. Components can
// subscribe to this state and will automatically update when it changes.
const sessionState: Reactive<SessionState> = reactive({
  isActive: false,
  webId: undefined,
  isLoading: true,
});

// This handler syncs the external session's state with our reactive Vue state.
const handleStateChange = (event: Event) => {
  if (event instanceof CustomEvent) {
    const { isActive, webId } = event.detail as SessionStateChangeDetail;
    // Any event from the session means the loading phase is complete.
    sessionState.isActive = isActive;
    sessionState.webId = webId;
    sessionState.isLoading = false;
  }
};

// This handler warns about session expiration
const handleExpirationWarning = (event: Event) => {
  if (event instanceof CustomEvent) {
    const { expires_in } = event.detail as SessionExpirationWarningDetail;
    console.warn(`[WARN] Session will expire in ${expires_in}s.`);
  }
};

// This handler ends the session on expiration
const handleExpiration = (event: Event) => {
  if (event instanceof CustomEvent) {
    sessionState.isActive = false;
    sessionState.webId = undefined;
    sessionState.isLoading = false;
  }
};


// some example client details
const clientDetails: DynamicRegistrationClientDetails = {
  redirect_uris: [window.location.href],
  client_name: "uvdsl's Solid Authorization App"
};

// Option 1: pass event listeners as session options
const sessionOptions = {
  workerUrl: refreshWorkerUrl,
  // onSessionStateChange: handleStateChange,
  // onSessionExpirationWarning: handleExpirationWarning,
  // onSessionExpiration: handleExpiration
} as SessionOptions

// It's recommended to create a single session instance 
// that the entire application can share.
const session = new Session(clientDetails, sessionOptions);

// Option 2: pass (additional) event listeners dynamically after session creation
session.addEventListener(SessionEvents.STATE_CHANGE, handleStateChange);
session.addEventListener(SessionEvents.EXPIRATION_WARNING, handleExpirationWarning);
session.addEventListener(SessionEvents.EXPIRATION, handleExpiration);

// This function handles the initial, asynchronous session restoration.
// It is called only once when this module is first imported.
const initializeSession = async () => {
  try {
    await session.restore()
  } catch (e) {
    // This is an expected outcome if no previous session exists.
  } finally {
    // This block is crucial. It ensures `isLoading` is set to false
    // and the state is synchronized after the restore attempt, even if
    // `restore()` fails silently and doesn't fire a `stateChange` event.
    sessionState.isActive = session.isActive;
    sessionState.webId = session.webId;
    sessionState.isLoading = false;
  }
};

// Start the session restoration process immediately.
initializeSession();


/**
 * A Vue Composable to provide access to the global session state and instance.
 * @returns An object with the reactive state (readonly) and the session instance.
 */
export function useSolidSession() {
  return {
    // It's a best practice to return a readonly version of the state
    // to prevent components from directly modifying it.
    state: readonly(sessionState),
    // The session instance is provided for calling methods like login() or logout().
    session,
  };
}