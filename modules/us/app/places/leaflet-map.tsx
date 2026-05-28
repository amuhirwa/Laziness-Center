"use client"

import { useEffect, useRef } from "react"

export type MapMarker = {
  lat: number
  lng: number
  name: string
  status: string
  href: string
}

const STATUS_COLORS: Record<string, string> = {
  wantToGo: "#3b82f6",
  visited: "#22c55e",
  passed: "#6b7280",
}

export default function LeafletMap({
  markers,
  center,
  zoom = 13,
  height = "400px",
}: {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  height?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let defaultCenter: [number, number] = center ?? [-1.9441, 30.0619] // Kigali default
    if (!center && markers.length > 0) {
      const lats = markers.map((m) => m.lat)
      const lngs = markers.map((m) => m.lng)
      defaultCenter = [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
      ]
    }

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return

      // Fix default icon path broken by bundlers
      // @ts-expect-error leaflet internals
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(containerRef.current!, { zoomControl: true }).setView(
        defaultCenter,
        markers.length === 1 ? zoom : markers.length === 0 ? 12 : 11,
      )

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      for (const m of markers) {
        const color = STATUS_COLORS[m.status] ?? "#6b7280"
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        L.marker([m.lat, m.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${m.name}</strong><br><a href="${m.href}" style="color:#3b82f6;font-size:12px">View details →</a>`)
      }

      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [30, 30] })
      }

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ height, width: "100%", borderRadius: "0.75rem", overflow: "hidden" }} />
    </>
  )
}
