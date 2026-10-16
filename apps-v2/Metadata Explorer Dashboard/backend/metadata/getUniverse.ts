interface Params {}

type Column = {
  name: string
  type: string
}

type Asset = {
  id: string
  name: string
  fullName: string
  domain: string
  columns: Column[]
}

type LakebaseMetadata = {
  id: number
  name: string
  value: number
}

type GenieResult = {
  content: {
    textAttachments?: string[]
    suggestedQuestions?: string[]
  }
  status: string
}

async function finishAccountHealth(result: GenieResult) {
  let current = result
  for (let attempt = 0; attempt < 8 && current.status !== 'COMPLETED'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750))
    const polled = await genieAgentAccountHealthMcpPat.tools.pollResponse01f1c64cfcd11121825870122686c346({
      conversation_id: (result as GenieResult & { conversationId: string }).conversationId,
      message_id: (result as GenieResult & { messageId: string }).messageId,
    })
    current = polled.data
  }
  return current
}

async function finishDealDesk(result: GenieResult) {
  let current = result
  for (let attempt = 0; attempt < 8 && current.status !== 'COMPLETED'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750))
    const polled = await genieAgentAeDealDeskMcpPat.tools.pollResponse01f1c64bbbd219fa9dccf39e0f653159({
      conversation_id: (result as GenieResult & { conversationId: string }).conversationId,
      message_id: (result as GenieResult & { messageId: string }).messageId,
    })
    current = polled.data
  }
  return current
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function inferDomain(tableName: string) {
  const value = tableName.toLowerCase()
  if (value.includes('account') || value.includes('opportun') || value.includes('salesforce')) return 'Sales'
  if (value.includes('health') || value.includes('success')) return 'Customer Success'
  if (value.includes('support') || value.includes('ticket') || value.includes('conversation')) return 'Support'
  if (value.includes('usage') || value.includes('consumption') || value.includes('event')) return 'Product'
  if (value.includes('finance') || value.includes('revenue') || value.includes('invoice')) return 'Finance'
  if (value.includes('marketing') || value.includes('intent') || value.includes('campaign')) return 'Marketing'
  if (value.includes('gold') || value.includes('curated')) return 'Curated'
  return 'Shared'
}

function shapeAssets(schema: Record<string, Record<string, { data_type: string }>>, source: 'lakebase' | 'warehouse'): Asset[] {
  return Object.entries(schema).map(([fullName, columns]) => {
    const rawName = fullName.split('.').at(-1) ?? fullName
    return {
      id: `${source}:${fullName}`,
      name: titleCase(rawName),
      fullName,
      domain: source === 'lakebase' ? 'Operational' : inferDomain(fullName),
      columns: Object.entries(columns).map(([name, definition]) => ({ name, type: definition.data_type })),
    }
  })
}

export default async function (_req: { params: Params; user: User }) {
  const [warehouseResult, lakebaseResult, lakebaseMetadataResult, lakehouseWritebackResult, healthStart, dealStart] = await Promise.all([
    sqlWarehouseSpPat.getSchema(),
    lakebaseBasicAuth.getSchema(),
    lakebaseBasicAuth.query<LakebaseMetadata>("SELECT id, name, value FROM test.playing_with_lakebase WHERE name LIKE 'metadata:%' ORDER BY id"),
    sqlWarehouseSpPat.query<{ database: string; tableName: string; isTemporary: boolean }>("SHOW TABLES IN retool_hackathon.sandbox LIKE 'metadata_explorer_writeback_test'"),
    genieAgentAccountHealthMcpPat.tools.querySpace01f1c64cfcd11121825870122686c346({
      query: 'For a metadata explorer, provide a concise summary of key business questions, primary data concepts, and suggested cross-domain relationships. Do not include row-level values.',
    }),
    genieAgentAeDealDeskMcpPat.tools.querySpace01f1c64bbbd219fa9dccf39e0f653159({
      query: 'What business metrics and dimensions are available for analyzing territory performance, quota attainment, and deal pipeline? Return only a concise conceptual summary without individual names or row-level values.',
    }),
  ])

  const [accountHealth, dealDesk] = await Promise.all([
    finishAccountHealth(healthStart.data),
    finishDealDesk(dealStart.data),
  ])
  const warehouseAssets = shapeAssets(warehouseResult.data, 'warehouse')
  const writebackTableName = 'retool_hackathon.sandbox.metadata_explorer_writeback_test'
  const hasWritebackTable = lakehouseWritebackResult.data.length > 0
  if (hasWritebackTable && !warehouseAssets.some((asset) => asset.fullName === writebackTableName)) {
    warehouseAssets.push({
      id: `warehouse:${writebackTableName}`,
      name: 'Metadata Explorer Writeback Test',
      fullName: writebackTableName,
      domain: 'Shared',
      columns: [
        { name: 'asset_key', type: 'STRING' },
        { name: 'display_name', type: 'STRING' },
        { name: 'source_type', type: 'STRING' },
        { name: 'created_at', type: 'TIMESTAMP' },
      ],
    })
  }
  const lakebaseAssets = shapeAssets(lakebaseResult.data, 'lakebase')
  const populatedLakebaseAssets: Asset[] = lakebaseMetadataResult.data.map((record) => {
    const key = record.name.replace(/^metadata:/, '')
    return {
      id: `lakebase-metadata:${record.id}`,
      name: titleCase(key),
      fullName: `test.playing_with_lakebase.${key}`,
      domain: inferDomain(key),
      columns: [
        { name: 'id', type: 'integer' },
        { name: 'name', type: 'text' },
        { name: 'value', type: 'real' },
      ],
    }
  })
  const allLakebaseAssets = [...lakebaseAssets, ...populatedLakebaseAssets]
  const companyWarehouseAssets = warehouseAssets.filter((asset) => asset.fullName.startsWith('retool_hackathon.'))
  const featuredWarehouseAssets = (companyWarehouseAssets.length ? companyWarehouseAssets : warehouseAssets).slice(0, 80)

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      assets: featuredWarehouseAssets.length + allLakebaseAssets.length + 2,
      warehouseTables: featuredWarehouseAssets.length,
      lakehouseWritebackReady: hasWritebackTable,
      lakebaseTables: lakebaseAssets.length,
      lakebaseMetadataRecords: lakebaseMetadataResult.data.length,
      genieSpaces: 2,
      connectedSources: 4,
    },
    sources: {
      warehouse: featuredWarehouseAssets,
      lakebase: allLakebaseAssets,
      accountHealth: {
        id: 'genie:account-health',
        name: 'Account Health',
        description: 'Customer health, support, consumption and renewal intelligence.',
        summary: accountHealth.content.textAttachments?.join('\n\n') ?? 'Account health intelligence is available.',
        suggestedQuestions: accountHealth.content.suggestedQuestions ?? [],
        status: accountHealth.status,
      },
      dealDesk: {
        id: 'genie:deal-desk',
        name: 'AE Deal Desk',
        description: 'Territory performance, quota attainment and deal pipeline intelligence.',
        summary: dealDesk.content.textAttachments?.join('\n\n') ?? 'Deal desk intelligence is available.',
        suggestedQuestions: dealDesk.content.suggestedQuestions ?? [],
        status: dealDesk.status,
      },
    },
  }
}
