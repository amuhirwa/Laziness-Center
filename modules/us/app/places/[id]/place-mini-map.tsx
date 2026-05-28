"use client"

import nextDynamic from "next/dynamic"
import type { MapMarker } from "../leaflet-map"

const LeafletMap = nextDynamic(() => import("../leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-44 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />,
})

export default function PlaceMiniMap({ lat, lng, name, status, id }: { lat: number; lng: number; name: string; status: string; id: string }) {
  const markers: MapMarker[] = [{ lat, lng, name, status, href: `/places/${id}` }]
  return <LeafletMap markers={markers} center={[lat, lng]} zoom={15} height="176px" />
}
