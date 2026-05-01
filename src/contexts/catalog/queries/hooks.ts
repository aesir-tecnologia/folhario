"use client";

import { useQuery } from "@tanstack/react-query";
import { plantsKeys, locationsKeys, type PlantsListParams } from "./index";

export function usePlants(params: PlantsListParams) {
  return useQuery(plantsKeys.lists(params));
}

export function usePlant(plantId: string) {
  return useQuery(plantsKeys.detail(plantId));
}

export function usePhotoEntries(plantId: string) {
  return useQuery(plantsKeys.photoEntries(plantId));
}

export function useLocations() {
  return useQuery(locationsKeys.all());
}
