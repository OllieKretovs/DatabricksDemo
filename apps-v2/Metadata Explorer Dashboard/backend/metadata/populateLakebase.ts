type Params = {
  confirmed: boolean
}

export default async function (req: { params: Params; user: User }) {
  if (!req.params.confirmed) throw new Error('Confirmation is required before populating Lakebase.')

  await lakebaseBasicAuth.query(`
    INSERT INTO test.playing_with_lakebase (id, name, value)
    VALUES
      (10001, 'metadata:account_health', 1.0),
      (10002, 'metadata:account_360', 1.0),
      (10003, 'metadata:deal_pipeline', 1.0),
      (10004, 'metadata:support_activity', 1.0),
      (10005, 'metadata:product_consumption', 1.0)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      value = EXCLUDED.value
  `)

  return { populated: true, records: 5, target: 'test.playing_with_lakebase' }
}
