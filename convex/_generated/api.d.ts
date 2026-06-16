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
import type * as bills_mutations from "../bills/mutations.js";
import type * as bills_queries from "../bills/queries.js";
import type * as bills_uploads from "../bills/uploads.js";
import type * as bills_validators from "../bills/validators.js";
import type * as crons from "../crons.js";
import type * as extraction_actions from "../extraction/actions.js";
import type * as extraction_prompt from "../extraction/prompt.js";
import type * as extraction_vision from "../extraction/vision.js";
import type * as lib_imageStore from "../lib/imageStore.js";
import type * as lib_invariant from "../lib/invariant.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "bills/extraction": typeof bills_extraction;
  "bills/mutations": typeof bills_mutations;
  "bills/queries": typeof bills_queries;
  "bills/uploads": typeof bills_uploads;
  "bills/validators": typeof bills_validators;
  crons: typeof crons;
  "extraction/actions": typeof extraction_actions;
  "extraction/prompt": typeof extraction_prompt;
  "extraction/vision": typeof extraction_vision;
  "lib/imageStore": typeof lib_imageStore;
  "lib/invariant": typeof lib_invariant;
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

export declare const components: {};
