type Params = {
  confirmed: boolean
}

export default async function (req: { params: Params; user: User }) {
  if (!req.params.confirmed) throw new Error('Confirmation is required before creating a Lakehouse table.')

  await sqlWarehouseSpPat.query(`
    CREATE TABLE IF NOT EXISTS retool_hackathon.sandbox.metadata_explorer_writeback_test (
      asset_key STRING NOT NULL,
      display_name STRING NOT NULL,
      source_type STRING NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
    USING DELTA
  `)

  await sqlWarehouseSpPat.query(`
    MERGE INTO retool_hackathon.sandbox.metadata_explorer_writeback_test AS target
    USING (
      SELECT
        'lakehouse_writeback_test' AS asset_key,
        'Lakehouse Writeback Test' AS display_name,
        'metadata_explorer' AS source_type,
        current_timestamp() AS created_at
    ) AS source
    ON target.asset_key = source.asset_key
    WHEN MATCHED THEN UPDATE SET
      target.display_name = source.display_name,
      target.source_type = source.source_type,
      target.created_at = source.created_at
    WHEN NOT MATCHED THEN INSERT (asset_key, display_name, source_type, created_at)
    VALUES (source.asset_key, source.display_name, source.source_type, source.created_at)
  `)

  return {
    created: true,
    table: 'retool_hackathon.sandbox.metadata_explorer_writeback_test',
  }
}
