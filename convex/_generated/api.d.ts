/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bills_extraction from "../bills/extraction.js";
import type * as bills_guest_claims from "../bills/guest/claims.js";
import type * as bills_guest_people from "../bills/guest/people.js";
import type * as bills_guest_queries from "../bills/guest/queries.js";
import type * as bills_host_claims from "../bills/host/claims.js";
import type * as bills_host_lifecycle from "../bills/host/lifecycle.js";
import type * as bills_host_people from "../bills/host/people.js";
import type * as bills_host_queries from "../bills/host/queries.js";
import type * as bills_host_uploads from "../bills/host/uploads.js";
import type * as bills_lib_functions from "../bills/lib/functions.js";
import type * as bills_lib_validators from "../bills/lib/validators.js";
import type * as crons from "../crons.js";
import type * as extraction_actions from "../extraction/actions.js";
import type * as extraction_prompt from "../extraction/prompt.js";
import type * as extraction_vision from "../extraction/vision.js";
import type * as lib_imageStore from "../lib/imageStore.js";
import type * as lib_invariant from "../lib/invariant.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_retrier from "../lib/retrier.js";
import type * as model_bills from "../model/bills.js";
import type * as model_claimChanges from "../model/claimChanges.js";
import type * as model_claimRows from "../model/claimRows.js";
import type * as model_itemSharing from "../model/itemSharing.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "bills/extraction": typeof bills_extraction;
  "bills/guest/claims": typeof bills_guest_claims;
  "bills/guest/people": typeof bills_guest_people;
  "bills/guest/queries": typeof bills_guest_queries;
  "bills/host/claims": typeof bills_host_claims;
  "bills/host/lifecycle": typeof bills_host_lifecycle;
  "bills/host/people": typeof bills_host_people;
  "bills/host/queries": typeof bills_host_queries;
  "bills/host/uploads": typeof bills_host_uploads;
  "bills/lib/functions": typeof bills_lib_functions;
  "bills/lib/validators": typeof bills_lib_validators;
  crons: typeof crons;
  "extraction/actions": typeof extraction_actions;
  "extraction/prompt": typeof extraction_prompt;
  "extraction/vision": typeof extraction_vision;
  "lib/imageStore": typeof lib_imageStore;
  "lib/invariant": typeof lib_invariant;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/retrier": typeof lib_retrier;
  "model/bills": typeof model_bills;
  "model/claimChanges": typeof model_claimChanges;
  "model/claimRows": typeof model_claimRows;
  "model/itemSharing": typeof model_itemSharing;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
};
