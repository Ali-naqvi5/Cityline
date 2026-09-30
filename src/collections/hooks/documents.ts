import { ValidationError, type CollectionBeforeValidateHook } from "payload";

import { EXPIRING_TYPES, type DocumentType } from "@/domain/compliance/documents";

/**
 * A licence, MOT or insurance certificate without an expiry date would count
 * as valid for ever — so for those types the date is required, on the server,
 * whichever screen or API call is saving it.
 */
export const requireExpiryForExpiringTypes: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
  collection,
  req,
}) => {
  const type = (data?.type ?? originalDoc?.type) as DocumentType | undefined;
  const expiresAt = data && "expiresAt" in data ? data.expiresAt : originalDoc?.expiresAt;
  if (type && EXPIRING_TYPES.has(type) && !expiresAt) {
    throw new ValidationError({
      collection: collection.slug,
      errors: [{ path: "expiresAt", message: "This document needs an expiry date." }],
      req,
    });
  }
  return data;
};
