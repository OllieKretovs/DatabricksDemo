type Params = {
  agent: 'accountHealth' | 'dealDesk'
  question: string
  conversationId?: string
}

type Response = {
  content: { textAttachments?: string[]; suggestedQuestions?: string[] }
  conversationId: string
  messageId: string
  status: string
}

export default async function (req: { params: Params; user: User }) {
  const question = req.params.question.trim()
  if (!question) throw new Error('Enter a question for Genie.')
  if (question.length > 800) throw new Error('Keep the question under 800 characters.')

  if (req.params.agent === 'accountHealth') {
    const started = await genieAgentAccountHealthMcpPat.tools.querySpace01f1c64cfcd11121825870122686c346({
      query: question,
      ...(req.params.conversationId ? { conversation_id: req.params.conversationId } : {}),
    })
    let response: Response = started.data
    for (let attempt = 0; attempt < 10 && response.status !== 'COMPLETED'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 750))
      const polled = await genieAgentAccountHealthMcpPat.tools.pollResponse01f1c64cfcd11121825870122686c346({
        conversation_id: response.conversationId,
        message_id: response.messageId,
      })
      response = polled.data
    }
    return response
  }

  const started = await genieAgentAeDealDeskMcpPat.tools.querySpace01f1c64bbbd219fa9dccf39e0f653159({
    query: question,
    ...(req.params.conversationId ? { conversation_id: req.params.conversationId } : {}),
  })
  let response: Response = started.data
  for (let attempt = 0; attempt < 10 && response.status !== 'COMPLETED'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750))
    const polled = await genieAgentAeDealDeskMcpPat.tools.pollResponse01f1c64bbbd219fa9dccf39e0f653159({
      conversation_id: response.conversationId,
      message_id: response.messageId,
    })
    response = polled.data
  }
  return response
}
