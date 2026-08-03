/**
 * Task Parser Module
 * Provides rule-based and LLM-based task extraction from natural language input.
 */

/**
 * Detects if the input text contains multiple action items.
 * Checks for conjunctions ("and", "then"), punctuation (commas, semicolons), line breaks, or list markers.
 */
export function isMultiActionInput(raw: string): boolean {
  if (!raw || !raw.trim()) return false
  const trimmed = raw.trim()

  // Newlines or multiple lines
  if (trimmed.includes('\n')) return true

  // Check for multi-action connectors: commas, semicolons, "and", "then", "also", "plus"
  const multiPattern = /[,;]|\b(?:and|then|also|plus|along with)\b/i
  const matches = trimmed.match(new RegExp(multiPattern, 'gi'))

  // Check for bullet points or numbered lists
  const hasListMarkers = /^[\-\*\•\d+[\.\)]]/m.test(trimmed)

  return (matches !== null && matches.length > 0) || hasListMarkers
}

/**
 * Helper to clean and format task text (capitalization, removing filler prefixes).
 */
export function cleanTaskPhrase(str: string): string {
  if (!str) return ''
  let s = str.trim()

  // Remove filler prefixes
  s = s.replace(/^(?:today\s+)?(?:i\s+have\s+to|i\s+need\s+to|i\s+want\s+to|i\s+must|must|remember\s+to|don't\s+forget\s+to|please)\s+/i, '')
  // Remove leading date/time framing words
  s = s.replace(/^(?:today|tonight|this\s+morning|this\s+afternoon|this\s+evening|tomorrow)\s+/i, '')
  
  // Capitalize first letter
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  return s
}

/**
 * Rule-based task parser.
 * Splits raw text into individual task strings.
 */
export function parseTasks(raw: string): string[] {
  if (!raw || !raw.trim()) return []

  // Normalize line breaks
  const text = raw.replace(/\r\n/g, '\n')

  // Split on common delimiters
  const items = text
    .split('\n')
    .flatMap((line) =>
      line
        .split(/[,;]|\b(?:and|then)\b/i)
        .map((s) => s.trim())
    )
    // Remove bullet markers (-, *, •, numbered lists)
    .map((s) => s.replace(/^[\-\*\•]\s*/, '').replace(/^\d+[\.\)]\s*/, ''))
    .map(cleanTaskPhrase)
    .filter((s) => s.length > 0)

  // Deduplicate (case-insensitive)
  const seen = new Set<string>()
  const unique: string[] = []
  for (const item of items) {
    const key = item.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  // Cap max items to 10
  return unique.slice(0, 10)
}

/**
 * LLM-based task parser using Gemini API.
 * Falls back gracefully to rule-based parsing if network or LLM fails.
 */
export async function parseTasksWithLLM(raw: string, customApiKey?: string): Promise<string[]> {
  if (!raw || !raw.trim()) return []
  const trimmed = raw.trim()

  const apiKey = customApiKey || 
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) || 
    ''

  if (!apiKey) {
    // Fall back gracefully to rule-based parser if no API key is set
    return parseTasks(trimmed)
  }

  const prompt = `You are a task list extractor.
Given a free-form input describing actions to perform, parse it into individual discrete tasks.
Rules:
1. Split the text into atomic action items (maximum 10 items).
2. Normalize each item into a short imperative phrase (verb first, e.g. "Give laptop", "Go to cafe", "Work on assignments").
3. Strip filler phrases ("today I have to", "I need to", "remember to") and date/time framing words ("today", "this morning", "tonight", "tomorrow").
4. Preserve the user's intent without inventing tasks that were not implied.
5. Ambiguous joins like "go to cafe and work on assignments" must be split into separate tasks ("Go to cafe", "Work on assignments").
6. Return ONLY a strict JSON array of strings, e.g. ["Give laptop", "Go to cafe"]. No markdown wrappers, no commentary.

User Input: "${trimmed.replace(/"/g, '\\"')}"`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`)
    }

    const data = await response.json()
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error('No content returned from LLM')

    // Clean JSON markdown blocks if present
    let jsonText = content.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    }

    const parsed = JSON.parse(jsonText)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleanList = parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(cleanTaskPhrase)
        .slice(0, 10)

      if (cleanList.length > 0) {
        return cleanList
      }
    }
  } catch (err) {
    console.warn('[task-parser] LLM parsing failed or unavailable, using rule-based fallback:', err)
  }

  // Graceful fallback
  return parseTasks(trimmed)
}
