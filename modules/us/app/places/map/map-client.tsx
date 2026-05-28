"use client"

import nextDynamic from "next/dynamic"
import type { MapMarker } from "../leaflet-map"

const LeafletMap = nextDynamic(() => import("../leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-[480px] rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />,
})

export default function MapClient({ markers }: { markers: MapMarker[] }) {
  return <LeafletMap markers={markers} height="480px" />
}
