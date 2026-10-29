import { AsyncLocalStorage } from "async_hooks";

export interface RequestUserContext {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface LeadGenContext {
  runId: string;
  version: "v1" | "v2";
  trigger: string;
  restart?: boolean;
  expand?: boolean;
}

export interface RequestContext {
  reqId?: string;
  user?: RequestUserContext;
  leadGen?: LeadGenContext;
}

const als = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(ctx: RequestContext, fn: () => T): T =>
  als.run(ctx, fn);

export const getRequestId = (): string | undefined => als.getStore()?.reqId;

// Mutates the active store so the user is visible to the rest of the request.
// Falls back to enterWith when no request context has been established.
export const setCurrentUser = (user: RequestUserContext): void => {
  const store = als.getStore();
  if (store) {
    store.user = user;
  } else {
    als.enterWith({ user });
  }
};

export const getLeadGenContext = (): LeadGenContext | undefined =>
  als.getStore()?.leadGen;

// Runs fn in a child context inheriting the parent's reqId/user, so that every
// log and Apollo call made during a lead generation run can be correlated.
export const runWithLeadGenContext = <T>(
  leadGen: LeadGenContext,
  user: RequestUserContext | undefined,
  fn: () => T
): T => {
  const parent = als.getStore();
  return als.run(
    { ...parent, user: user ?? parent?.user, leadGen },
    fn
  );
};

export const getCurrentUser = (): RequestUserContext | undefined =>
  als.getStore()?.user;
