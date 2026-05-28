export const dynamic = "force-dynamic"

import { db } from "@/db"
import { places } from "@/db/schema"
import { isNotNull, and } from "drizzle-orm"
import type { MapMarker } from "../leaflet-map"
import MapClient from "./map-client"

export default async function PlacesMapPage() {
  const rows = await db.select({
    id: places.id,
    name: places.name,
    status: places.status,
    lat: places.lat,
    lng: places.lng,
  }).from(places).where(and(isNotNull(places.lat), isNotNull(places.lng)))

  const markers: MapMarker[] = rows.map((r) => ({
    lat: parseFloat(r.lat!),
    lng: parseFloat(r.lng!),
    name: r.name,
    status: r.status,
    href: `/places/${r.id}`,
  }))

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Places Map</h1>
        <a href="/us/places" className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">← List view</a>
      </div>

      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Want to go ({statusCounts.wantToGo ?? 0})</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Visited ({statusCounts.visited ?? 0})</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block" /> Passed ({statusCounts.passed ?? 0})</span>
      </div>

      {markers.length === 0 ? (
        <div className="h-64 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <p className="text-sm text-neutral-400 text-center">No places with coordinates yet.<br />Add places via URL or Map Search to get coordinates.</p>
        </div>
      ) : (
        <MapClient markers={markers} />
      )}

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        {markers.length} place{markers.length !== 1 ? "s" : ""} on the map. Add via URL or Map Search to get coordinates for others.
      </p>
    </div>
  )
}
