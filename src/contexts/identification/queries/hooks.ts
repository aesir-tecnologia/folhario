"use client";

import { useQuery } from "@tanstack/react-query";

import { identificationKeys, type IdentificationsListParams } from "./index";

export function useIdentificationHistory(params: IdentificationsListParams) {
  return useQuery(identificationKeys.history(params));
}

export function useIdentificationDetail(id: string) {
  return useQuery(identificationKeys.detail(id));
}
