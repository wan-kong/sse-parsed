"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Code2Icon,
  CopyIcon,
  DownloadIcon,
  FileUpIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"

type SSEEvent = {
  event?: string
  data?: unknown
  _rawData?: string
  _isParsed?: boolean
  _isDeepParsed?: boolean
  _parsedFields?: string[]
  [key: string]: unknown
}

type Feedback = {
  action: "copy-all" | "download" | "copy-event" | "error"
  message: string
  eventIndex?: number
}

const demoEvents = [
  'data: {"message":"Sprint planning started","count":1}\n\n',
  'event: update\ndata: {"status":"processing","progress":33}\n\n',
  'data: {"workshop":{"board":"Product launch","members":8}}\n\n',
  'event: insight\ndata: {"payload":"{\\"priority\\":\\"high\\",\\"owner\\":\\"Design\\"}"}\n\n',
  'data: {"cards":[{"title":"Interview notes"},{"title":"Next steps"}]}\n\n',
  'event: complete\ndata: {"status":"done","progress":100}\n\n',
]

const deepParseJSON = (value: unknown): { result: unknown; parsedFields: string[] } => {
  const parsedFields: string[] = []

  const parseValue = (item: unknown, path = ""): unknown => {
    if (typeof item === "string") {
      try {
        const parsed = JSON.parse(item) as unknown
        if (parsed !== null && typeof parsed === "object") {
          if (path) parsedFields.push(path)
          return parseValue(parsed, path)
        }
        return parsed
      } catch {
        return item
      }
    }

    if (Array.isArray(item)) {
      return item.map((entry, index) => parseValue(entry, `${path}[${index}]`))
    }

    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([key, entry]) => [key, parseValue(entry, path ? `${path}.${key}` : key)]),
      )
    }

    return item
  }

  return { result: parseValue(value), parsedFields }
}

const parseEventData = (event: SSEEvent, rawData: string) => {
  event._rawData = rawData

  try {
    const initialParsed = JSON.parse(rawData) as unknown
    const { result, parsedFields } = deepParseJSON(initialParsed)
    event.data = result
    event._isParsed = true
    event._parsedFields = parsedFields
    event._isDeepParsed = parsedFields.length > 0
  } catch {
    event.data = rawData
    event._isParsed = false
    event._isDeepParsed = false
    event._parsedFields = []
  }
}

const parseSSEData = (stream: string) => {
  const events: SSEEvent[] = []
  let currentEvent: SSEEvent = {}
  let currentData: string[] = []

  const commitEvent = () => {
    if (Object.keys(currentEvent).length === 0 && currentData.length === 0) return

    if (currentData.length) parseEventData(currentEvent, currentData.join("\n"))
    events.push(currentEvent)
    currentEvent = {}
    currentData = []
  }

  stream.split(/\r?\n/).forEach((line) => {
    if (line === "") {
      commitEvent()
      return
    }

    if (line.startsWith(":")) return
    const colonIndex = line.indexOf(":")
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    const value = colonIndex === -1 ? "" : line.slice(colonIndex + 1).replace(/^ /, "")

    if (field === "data") {
      currentData.push(value)
    } else if (field) {
      currentEvent[field] = value
    }
  })

  commitEvent()
  return events
}

const getEventType = (event: SSEEvent) => event.event || "message"

const formatEventType = (eventType: string) =>
  eventType
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function SSEFormatter() {
  const [input, setInput] = useState("")
  const [parsedEvents, setParsedEvents] = useState<SSEEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isInputCollapsed, setIsInputCollapsed] = useState(false)
  const [outputView, setOutputView] = useState<"pretty" | "raw">("pretty")
  const [eventFilter, setEventFilter] = useState("all")
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const simulationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parseSSE = (content: string) => {
    try {
      setError(null)
      setParsedEvents(parseSSEData(content))
    } catch (parseError) {
      console.error(parseError)
      setError("Failed to parse SSE data. Please check the stream format.")
    }
  }

  useEffect(() => {
    const contentParam = new URLSearchParams(window.location.search).get("content")
    if (!contentParam) return

    try {
      setInput(contentParam)
      parseSSE(contentParam)
    } catch (decodeError) {
      console.error(decodeError)
      setError("Unable to decode the content query parameter.")
    }
  }, [])

  useEffect(() => {
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current)
      if (feedbackRef.current) clearTimeout(feedbackRef.current)
    }
  }, [])

  const deepParsedCount = useMemo(
    () => parsedEvents.filter((event) => event._isDeepParsed).length,
    [parsedEvents],
  )
  const parsedCount = useMemo(() => parsedEvents.filter((event) => event._isParsed).length, [parsedEvents])
  const eventTypes = useMemo(
    () => Array.from(new Set(parsedEvents.map(getEventType))),
    [parsedEvents],
  )
  const visibleEvents = useMemo(
    () =>
      parsedEvents
        .map((event, index) => ({ event, index }))
        .filter(({ event }) => eventFilter === "all" || getEventType(event) === eventFilter),
    [eventFilter, parsedEvents],
  )
  const exportEvents = useMemo(() => visibleEvents.map(({ event }) => event), [visibleEvents])

  useEffect(() => {
    if (eventFilter !== "all" && !eventTypes.includes(eventFilter)) setEventFilter("all")
  }, [eventFilter, eventTypes])

  const stopSimulation = () => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current)
      simulationRef.current = null
    }
    setIsSimulating(false)
  }

  const simulateSSEStream = () => {
    if (isSimulating) {
      stopSimulation()
      return
    }

    let count = 0
    let stream = ""
    setInput("")
    setParsedEvents([])
    setError(null)
    setIsSimulating(true)

    simulationRef.current = setInterval(() => {
      const nextEvent = demoEvents[count]
      if (!nextEvent) {
        stopSimulation()
        return
      }

      stream += nextEvent
      setInput(stream)
      parseSSE(stream)
      count += 1
    }, 700)
  }

  const handleClear = () => {
    stopSimulation()
    setInput("")
    setParsedEvents([])
    setError(null)
  }

  const showFeedback = (nextFeedback: Feedback) => {
    if (feedbackRef.current) clearTimeout(feedbackRef.current)
    setFeedback(nextFeedback)
    feedbackRef.current = setTimeout(() => setFeedback(null), 1800)
  }

  const copyText = async (text: string, success: Feedback) => {
    try {
      await navigator.clipboard.writeText(text)
      showFeedback(success)
    } catch {
      showFeedback({ action: "error", message: "Copy failed" })
    }
  }

  const handleCopy = () => {
    void copyText(JSON.stringify(exportEvents, null, 2), {
      action: "copy-all",
      message: `${exportEvents.length} event${exportEvents.length === 1 ? "" : "s"} copied`,
    })
  }

  const handleCopyEvent = (event: SSEEvent, index: number) => {
    void copyText(JSON.stringify(event, null, 2), {
      action: "copy-event",
      eventIndex: index,
      message: "Copied",
    })
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportEvents, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const suffix = eventFilter === "all" ? "all" : eventFilter.replace(/[^a-z\d-]+/gi, "-").toLowerCase()
    link.download = `sse-events-${suffix}.json`
    link.click()
    URL.revokeObjectURL(url)
    showFeedback({
      action: "download",
      message: `${exportEvents.length} event${exportEvents.length === 1 ? "" : "s"} downloaded`,
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const content = String(loadEvent.target?.result ?? "")
      setInput(content)
      parseSSE(content)
    }
    reader.readAsText(file)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col px-3 py-3 md:px-6 md:pb-6 md:pt-[18px] lg:h-dvh lg:overflow-hidden">
      <header className="mb-3 flex h-[66px] shrink-0 items-center gap-[18px] border-b border-[#eef0f3] md:mb-[18px]">
        <div className="grid h-[42px] w-11 shrink-0 place-items-center rounded-[11px] bg-[#ffd02f] text-[#050038]" aria-hidden="true">
          <svg className="h-[38px] w-[38px]" viewBox="0 0 44 44">
            <path className="fill-none stroke-[#050038] stroke-[2.3] [stroke-linecap:round]" d="M15.5 14.5h15M15.5 22h11M15.5 29.5h15" />
            <circle className="fill-[#050038]" cx="10" cy="14.5" r="2" />
            <circle className="fill-[#050038]" cx="10" cy="22" r="2" />
            <circle className="fill-[#4262ff]" cx="10" cy="29.5" r="2" />
          </svg>
        </div>
        <div>
          <h1 className="m-0 text-lg font-medium tracking-[-0.35px] text-[#050038] md:mb-0.5 md:text-[22px]">SSE Stream Formatter</h1>
          <p className="m-0 hidden text-[13px] text-[#6b6f7e] md:block">Parse, inspect, and export Server-Sent Event payloads.</p>
        </div>
      </header>

      <section className="flex shrink-0 flex-col rounded-2xl bg-[#f7f8fa] p-3 md:rounded-[20px] md:p-5 lg:min-h-0 lg:flex-1" id="workspace">
        <div className="mb-3.5 flex shrink-0 flex-col items-start justify-between gap-4 md:mb-[18px] md:flex-row md:items-center md:gap-6">
          <div>
            <h2 className="m-0 mb-0.5 text-[21px] font-medium text-[#050038]">Workspace</h2>
            <p className="m-0 text-[13px] text-[#6b6f7e]">Input stream and parsed output</p>
          </div>
          <div className="flex w-full justify-stretch gap-2.5 md:w-auto" aria-label="Parsing summary">
            <div className="flex flex-1 flex-col gap-px rounded-xl border border-[#e0e2e8] bg-white px-2.5 py-2 md:flex-none md:flex-row md:items-baseline md:gap-2 md:px-3.5 md:py-2.5">
              <strong className="text-[23px] font-medium leading-[1.08] tracking-[-0.5px] text-[#050038] md:text-[25px]">{parsedEvents.length}</strong>
              <span className="text-[13px] text-[#6b6f7e]">Events</span>
            </div>
            <div className="flex flex-1 flex-col gap-px rounded-xl border border-[#e0e2e8] bg-white px-2.5 py-2 md:flex-none md:flex-row md:items-baseline md:gap-2 md:px-3.5 md:py-2.5">
              <strong className="text-[23px] font-medium leading-[1.08] tracking-[-0.5px] text-[#050038] md:text-[25px]">{parsedCount}</strong>
              <span className="text-[13px] text-[#6b6f7e]">Parsed</span>
            </div>
            <div className="flex flex-1 flex-col gap-px rounded-xl border border-[#e0e2e8] bg-white px-2.5 py-2 md:flex-none md:flex-row md:items-baseline md:gap-2 md:px-3.5 md:py-2.5">
              <strong className="text-[23px] font-medium leading-[1.08] tracking-[-0.5px] text-[#050038] md:text-[25px]">{deepParsedCount}</strong>
              <span className="text-[13px] text-[#6b6f7e]">Deep fields</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(380px,0.92fr)_minmax(460px,1.08fr)]">
          <section className="flex h-[calc(100dvh-15rem)] min-h-[430px] flex-col overflow-hidden rounded-xl border border-[#eef0f3] bg-white p-[19px] md:p-[22px] lg:h-full lg:min-h-0">
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold tracking-[0.5px] text-[#6b6f7e]">INPUT STREAM</span>
                <h3 className="mt-[7px] text-xl font-medium text-[#050038]">Paste or upload SSE</h3>
              </div>
              <button
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border border-[#e0e2e8] bg-white text-[#1c1c1e]"
                onClick={() => setIsInputCollapsed((current) => !current)}
                aria-label={isInputCollapsed ? "Expand input" : "Collapse input"}
              >
                {isInputCollapsed ? <ChevronDownIcon className="h-[17px] w-[17px]" /> : <ChevronUpIcon className="h-[17px] w-[17px]" />}
              </button>
            </div>

            {!isInputCollapsed && (
              <>
                <div className="my-[18px] flex shrink-0 flex-wrap gap-2">
                  <button className="inline-flex min-h-[42px] items-center justify-center gap-[9px] rounded-full bg-[#1c1c1e] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2c2c34]" onClick={simulateSSEStream}>
                    {isSimulating ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                    {isSimulating ? "Stop replay" : "Replay demo"}
                  </button>
                  <label className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-[9px] rounded-full border border-[#c7cad5] bg-white px-4 py-2.5 text-sm font-medium text-[#1c1c1e] transition-colors hover:bg-[#f7f8fa]">
                    <FileUpIcon className="h-4 w-4" />
                    Upload
                    <input className="sr-only" type="file" onChange={handleFileUpload} accept=".txt,.log,.sse" />
                  </label>
                  <button className="inline-flex min-h-10 items-center justify-center gap-[9px] rounded-full px-3.5 py-2.5 text-sm font-medium text-[#555a6a] transition-colors hover:bg-black/[0.06]" onClick={handleClear}>
                    <Trash2Icon className="h-4 w-4" />
                    Clear
                  </button>
                </div>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="min-h-0 flex-1 resize-none overflow-auto rounded-xl border border-[#c7cad5] bg-white p-[18px] font-mono text-[13px] leading-[1.65] text-[#1c1c1e] placeholder:text-[#a5a8b5] focus:border-transparent focus:outline-2 focus:outline-[#4262ff]"
                  placeholder={'event: message\ndata: {"message":"Hello workspace"}\n\n'}
                  spellCheck={false}
                />
                <button className="mt-4 inline-flex min-h-[46px] shrink-0 items-center justify-center gap-[9px] rounded-full bg-[#1c1c1e] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2c2c34]" onClick={() => parseSSE(input)}>
                  Format SSE data <ArrowRightIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </section>

          <section className="flex h-[calc(100dvh-15rem)] min-h-[480px] flex-col overflow-hidden rounded-xl border border-[#eef0f3] bg-white pt-5 md:pt-[22px] lg:h-full lg:min-h-0" id="output">
            <div className="flex shrink-0 items-start justify-between gap-3 px-[19px] md:px-[22px]">
              <div>
                <span className="text-[11px] font-semibold tracking-[0.5px] text-[#6b6f7e]">OUTPUT BOARD</span>
                <h3 className="mt-[7px] text-xl font-medium text-[#050038]">Parsed events</h3>
                <p
                  className={`mt-1 min-h-[18px] text-xs ${feedback?.action === "error" ? "text-[#600000]" : "text-[#187574]"}`}
                  aria-live="polite"
                >
                  {feedback?.eventIndex === undefined ? feedback?.message : ""}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-[#e0e2e8] bg-white px-3.5 text-[13px] font-medium text-[#1c1c1e] transition-colors hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:text-[#a5a8b5]" onClick={handleCopy} disabled={!exportEvents.length} aria-label="Copy current JSON results">
                  {feedback?.action === "copy-all" ? <CheckIcon className="h-[15px] w-[15px] text-[#187574]" /> : <CopyIcon className="h-[15px] w-[15px]" />}
                  Copy
                </button>
                <button className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-[#e0e2e8] bg-white px-3.5 text-[13px] font-medium text-[#1c1c1e] transition-colors hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:text-[#a5a8b5]" onClick={handleDownload} disabled={!exportEvents.length} aria-label="Download current JSON results">
                  {feedback?.action === "download" ? <CheckIcon className="h-[15px] w-[15px] text-[#187574]" /> : <DownloadIcon className="h-[15px] w-[15px]" />}
                  Download
                </button>
              </div>
            </div>

            <div className="mx-[19px] my-[18px] flex shrink-0 flex-col gap-3 md:mx-[22px] sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex gap-1 rounded-full bg-[#f7f8fa] p-1" role="tablist" aria-label="Output format">
                <button className={`rounded-full px-[17px] py-[9px] text-[13px] font-medium ${outputView === "pretty" ? "bg-[#1c1c1e] text-white" : "text-[#6b6f7e]"}`} onClick={() => setOutputView("pretty")} role="tab">
                  Pretty board
                </button>
                <button className={`rounded-full px-[17px] py-[9px] text-[13px] font-medium ${outputView === "raw" ? "bg-[#1c1c1e] text-white" : "text-[#6b6f7e]"}`} onClick={() => setOutputView("raw")} role="tab">
                  Raw JSON
                </button>
              </div>
              {eventTypes.length > 0 && (
                <div className="relative w-full sm:w-[190px]">
                  <select
                    className="h-10 w-full appearance-none rounded-full border border-[#e0e2e8] bg-white py-2 pl-4 pr-10 text-sm text-[#1c1c1e] outline-none focus:border-[#4262ff] focus:ring-1 focus:ring-[#4262ff]"
                    value={eventFilter}
                    onChange={(event) => setEventFilter(event.target.value)}
                    aria-label="Filter event type"
                  >
                    <option value="all">All events ({parsedEvents.length})</option>
                    {eventTypes.map((eventType) => (
                      <option key={eventType} value={eventType}>
                        {formatEventType(eventType)}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6f7e]" />
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-[19px] pb-[19px] md:px-[22px] md:pb-[22px]">
              {error ? (
                <div className="rounded-xl border border-[#e3c5c5] bg-[#fbd4d4] p-[18px] text-sm text-[#600000]">{error}</div>
              ) : parsedEvents.length === 0 ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center text-[#6b6f7e]">
                  <Code2Icon className="mb-[17px] h-[33px] w-[33px] text-[#4262ff]" />
                  <h4 className="mb-1.5 text-xl font-medium text-[#1c1c1e]">Your board is empty</h4>
                  <p className="m-0 max-w-[280px] text-sm leading-6">Replay the demo or format a stream to see parsed cards here.</p>
                </div>
              ) : outputView === "raw" ? (
                <pre className="m-0 overflow-auto rounded-[9px] border border-[#eef0f3] bg-[#f7f8fa] p-[13px] font-mono text-[12.5px] leading-[1.6] text-[#050038]">{JSON.stringify(exportEvents, null, 2)}</pre>
                ) : (
                  <div className="flex flex-col gap-3">
                    {visibleEvents.length === 0 ? (
                      <p className="py-12 text-center text-sm text-[#6b6f7e]">No events match this filter.</p>
                    ) : visibleEvents.map(({ event, index }) => {
                      const eventType = getEventType(event)
                      return (
                    <article className="rounded-xl border border-[#eef0f3] bg-white p-[18px]" key={`${eventType}-${index}`}>
                      <div className="mb-[13px] flex flex-wrap items-center gap-2.5 text-sm">
                        <span className="text-xs text-[#6b6f7e]">{String(index + 1).padStart(2, "0")}</span>
                        <strong className="font-medium text-[#1c1c1e]">{formatEventType(eventType)}</strong>
                        {event.event && event.event !== formatEventType(eventType) && (
                          <code className="hidden rounded bg-[#f7f8fa] px-1.5 py-0.5 text-[11px] text-[#6b6f7e] sm:inline">{event.event}</code>
                        )}
                        <button
                          className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border border-[#e0e2e8] bg-white px-2.5 text-xs font-medium text-[#555a6a] transition-colors hover:bg-[#f7f8fa] hover:text-[#1c1c1e]"
                          onClick={() => handleCopyEvent(event, index)}
                          aria-label={`Copy ${formatEventType(eventType)} event ${index + 1}`}
                        >
                          {feedback?.action === "copy-event" && feedback.eventIndex === index ? (
                            <>
                              <CheckIcon className="h-3.5 w-3.5 text-[#187574]" />
                              Copied
                            </>
                          ) : (
                            <>
                              <CopyIcon className="h-3.5 w-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                        <span className={`rounded-full bg-[#f7f8fa] px-[9px] py-1 text-[11px] font-semibold ${event._isParsed ? "text-[#187574]" : "text-[#600000]"}`}>
                          {event._isDeepParsed ? "Deep JSON" : event._isParsed ? "JSON" : "Raw"}
                        </span>
                      </div>
                      {!!event._parsedFields?.length && (
                        <div className="mb-2.5 flex flex-wrap items-center gap-[5px] text-[#6b6f7e]">
                          <Code2Icon className="mr-0.5 h-[13px] w-[13px]" />
                          {event._parsedFields.map((field) => (
                            <span className="rounded-full bg-[#f7f8fa] px-2 py-[3px] text-[11px]" key={field}>{field}</span>
                          ))}
                        </div>
                      )}
                      <pre className="m-0 overflow-auto rounded-[9px] border border-[#eef0f3] bg-[#f7f8fa] p-[13px] font-mono text-[12.5px] leading-[1.6] text-[#050038]">{event._isParsed ? JSON.stringify(event.data, null, 2) : event._rawData}</pre>
                    </article>
                      )
                    })}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
