/**
 * TeamFrame AI — public surface.
 *
 * This file is the ONLY entry point for AI usage. Only two functions are
 * exported. Do not add a third without removing one first. See
 * /docs/ai-boundaries.md for the contract.
 */

export { generateBio } from "./generateBio";
export { generateContract, ContractInputSchema, type ContractInput } from "./generateContract";
