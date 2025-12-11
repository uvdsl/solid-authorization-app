import { Session } from "@uvdsl/solid-oidc-client-browser";
import { getAclResourceUri, patchResource } from "@uvdsl/solid-requests";

/**
 * Set the .acl according to the access need.
 * Make sure that the owner has still control as well.
 *
 * @param accessTo
 * @param agent
 * @param mode
 */
export async function grantAccess(
    agent: string[],
    accessTo: string,
    isDefault: boolean,
    mode: string[],
    session: Session
) {
    const uuid = self.crypto.randomUUID();
    const subject = `#grant-${uuid}`;
    // keep the owner authorization! If .acl does not yet exist, this MUST be present to ensure access for the controller
    const patchBody = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix acl: <http://www.w3.org/ns/auth/acl#>.

_:patch a solid:InsertDeletePatch;
    solid:inserts {
        <#owner> a acl:Authorization;
            acl:accessTo <.${accessTo.substring(accessTo.lastIndexOf("/"))}>;
            acl:agent <${session.webId}>;
            acl:default <.${accessTo.substring(accessTo.lastIndexOf("/"))}>;
            acl:mode acl:Read, acl:Write, acl:Control.

        <${subject}>
            a acl:Authorization;
            acl:accessTo <.${accessTo.substring(accessTo.lastIndexOf("/"))}>;
            acl:agent ${agent.map((a) => "<" + a + ">").join(", ")};
            ${(isDefault) ? "acl:default <." + accessTo.substring(accessTo.lastIndexOf("/")) + ">;" : ""}
            acl:mode ${mode.map((mode) => "<" + mode + ">").join(", ")} .
    } .`; // n3 patch may not contain blank node, so we do the next best thing, and try to generate a unique name
    const aclURI = await getAclResourceUri(accessTo, session).catch(() => { return undefined });
    if (!aclURI) throw new Error(`ACL not found for: ${accessTo}`);
    await patchResource(aclURI, patchBody, session);
    return new URL(subject, aclURI).href;
}
// TODO issue on create: to proper inheritance?

/**
 * Delete from the .acl according to the access need.
 *
 * @param accessTo
 * @param agent
 * @param mode
 */
export async function rollBackAccess(
    ruleUri: string,
    agent: string[],
    accessTo: string,
    isDefault: boolean,
    mode: string[],
    session: Session
) {
    // keep the owner authorization! If .acl does not yet exist, this MUST be present to ensure access for the controller
    const patchBody = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix acl: <http://www.w3.org/ns/auth/acl#>.

_:patch a solid:InsertDeletePatch;
    solid:deletes {
        <${ruleUri}>
            a acl:Authorization;
            acl:accessTo <.${accessTo.substring(accessTo.lastIndexOf("/"))}>;
            acl:agent ${agent.map((a) => "<" + a + ">").join(", ")};
            ${(isDefault) ? "acl:default <." + accessTo.substring(accessTo.lastIndexOf("/")) + ">;" : ""}
            acl:mode ${mode.map((mode) => "<" + mode + ">").join(", ")} .
    } .`;
    const aclURI = await getAclResourceUri(accessTo, session).catch(() => { return undefined });
    if (!aclURI) throw new Error(`ACL not found for: ${accessTo}`);
    await patchResource(aclURI, patchBody, session);
}

/**
 * Delete a rule from the .acl
 *
 * @param accessTo
 * @param agent
 * @param mode
 */
export async function revokeAccess(
    ruleUri: string,
    agent: string[],
    isDefault: boolean,
    mode: string[],
    session: Session
) {
    // keep the owner authorization! If .acl does not yet exist, this MUST be present to ensure access for the controller
    const patchBody = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix acl: <http://www.w3.org/ns/auth/acl#>.

_:patch a solid:InsertDeletePatch;
    solid:where {
        <${ruleUri}>
            a acl:Authorization;
            acl:accessTo ?resource.
            
    };
    solid:deletes {
        <${ruleUri}>
            a acl:Authorization;
            acl:accessTo ?resource;
            acl:agent ${agent.map((a) => "<" + a + ">").join(", ")};
            ${(isDefault) ? "acl:default ?resource;" : ""}
            acl:mode ${mode.map((mode) => "<" + mode + ">").join(", ")} .
    } .`;
    await patchResource(ruleUri, patchBody, session);
}