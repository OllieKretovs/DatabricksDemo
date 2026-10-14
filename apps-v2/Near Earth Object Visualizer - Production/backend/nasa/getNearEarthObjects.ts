type NasaFeedEntry = {
  id: string
  name: string
  absolute_magnitude_h: number
  is_potentially_hazardous_asteroid: boolean
  estimated_diameter: {
    meters: {
      estimated_diameter_min: number
      estimated_diameter_max: number
    }
  }
  close_approach_data: Array<{
    close_approach_date: string
    miss_distance: {
      astronomical: string
      kilometers: string
    }
    relative_velocity: {
      kilometers_per_hour: string
    }
  }>
}

type NasaFeedResponse = {
  element_count: number
  near_earth_objects: Record<string, NasaFeedEntry[]>
}

type Params = {
  startDate: string
  endDate: string
}

export type NearEarthObject = {
  id: string
  name: string
  date: string
  magnitude: number
  hazardous: boolean
  diameterMinMeters: number
  diameterMaxMeters: number
  missDistanceAu: number
  missDistanceKm: number
  velocityKph: number
}

export type NearEarthObjectsResponse = {
  elementCount: number
  objects: NearEarthObject[]
}

export default async function (req: { params: Params }): Promise<NearEarthObjectsResponse> {
  const response = await nasaNearEarthObjectsProduction.rawRequest<NasaFeedResponse>({
    path: '/feed',
    method: 'GET',
    queryParams: {
      start_date: req.params.startDate,
      end_date: req.params.endDate,
    },
  })

  const objects = Object.entries(response.data.near_earth_objects).flatMap(([date, entries]) =>
    entries.map((entry) => {
      const approach = entry.close_approach_data[0]
      return {
        id: entry.id,
        name: entry.name,
        date: approach?.close_approach_date ?? date,
        magnitude: entry.absolute_magnitude_h,
        hazardous: entry.is_potentially_hazardous_asteroid,
        diameterMinMeters: entry.estimated_diameter.meters.estimated_diameter_min,
        diameterMaxMeters: entry.estimated_diameter.meters.estimated_diameter_max,
        missDistanceAu: Number(approach?.miss_distance.astronomical ?? 0),
        missDistanceKm: Number(approach?.miss_distance.kilometers ?? 0),
        velocityKph: Number(approach?.relative_velocity.kilometers_per_hour ?? 0),
      }
    }),
  )

  return {
    elementCount: response.data.element_count,
    objects,
  }
}
