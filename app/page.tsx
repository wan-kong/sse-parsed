"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyIcon, DownloadIcon, UploadIcon, PlayIcon, PauseIcon, RefreshCwIcon } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronUpIcon, ChevronDownIcon, CodeIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Helper function to recursively parse JSON strings in objects
// and track which fields were parsed
const deepParseJSON = (obj: any): { result: any; parsedFields: string[] } => {
  const parsedFields: string[] = []

  const parseValue = (value: any, path = ""): any => {
    if (value === null || typeof value !== "object") {
      // If it's a string, try to parse it as JSON
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value)
          // If parsing succeeded and result is an object or array, add to parsedFields
          if (parsed && typeof parsed === "object") {
            parsedFields.push(path)
            // Recursively parse the contents
            const { result: deepResult, parsedFields: deepParsedFields } = deepParseJSON(parsed)
            // Add nested parsed fields with proper path prefix
            deepParsedFields.forEach((field) => {
              parsedFields.push(path ? `${path}.${field}` : field)
            })
            return deepResult
          }
          return parsed
        } catch (e) {
          // If parsing fails, return the original string
          return value
        }
      }
      return value
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item, index) => parseValue(item, path ? `${path}[${index}]` : `[${index}]`))
    }

    // Handle objects
    const result: Record<string, any> = {}
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const newPath = path ? `${path}.${key}` : key
        result[key] = parseValue(value[key], newPath)
      }
    }
    return result
  }

  const result = parseValue(obj)
  return { result, parsedFields }
}

export default function SSEFormatter() {
  const [input, setInput] = useState("")
  const [parsedEvents, setParsedEvents] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationInterval, setSimulationInterval] = useState<NodeJS.Timeout | null>(null)
  const [isInputCollapsed, setIsInputCollapsed] = useState(false)

  // 从URL参数获取content并自动解析
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const contentParam = urlParams.get('content')
    
    if (contentParam) {
      try {
        // URL解码content参数
        const decodedContent = decodeURIComponent(contentParam)
        setInput(decodedContent)
        // 自动触发解析
        parseSSE(decodedContent)
      } catch (error) {
        console.error('Error decoding content parameter:', error)
        setError('无法解码URL参数中的content内容')
      }
    }
  }, [])

  const parseSSE = (data: string) => {
    try {
      setError(null)
      const events: any[] = []
      const lines = data.split("\n")

      let currentEvent: Record<string, any> = {}
      let currentData = ""

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        if (line === "") {
          // Empty line indicates the end of an event
          if (Object.keys(currentEvent).length > 0 || currentData) {
            try {
              // Try to parse the data as JSON
              if (currentData) {
                // First attempt to parse the entire data as JSON
                try {
                  // Store the raw data for reference
                  currentEvent._rawData = currentData

                  // Parse the initial JSON
                  const initialParsed = JSON.parse(currentData)

                  // Deep parse any nested JSON strings and track which fields were parsed
                  const { result: deepParsed, parsedFields } = deepParseJSON(initialParsed)
                  currentEvent.data = deepParsed

                  // Track parsing status
                  currentEvent._isParsed = true

                  // Store which fields were parsed as JSON
                  currentEvent._parsedFields = parsedFields

                  // Track if we have deeply parsed nested JSON
                  currentEvent._isDeepParsed = parsedFields.length > 0
                } catch (e) {
                  // Check if this might be nested JSON with escaped quotes
                  try {
                    // Try to handle escaped JSON strings
                    const unescaped = currentData.replace(/\\"/g, '"')
                    const initialParsed = JSON.parse(unescaped)

                    // Deep parse any nested JSON strings and track which fields were parsed
                    const { result: deepParsed, parsedFields } = deepParseJSON(initialParsed)
                    currentEvent.data = deepParsed

                    currentEvent._rawData = currentData
                    currentEvent._isParsed = true
                    currentEvent._parsedFields = parsedFields
                    currentEvent._isDeepParsed = parsedFields.length > 0
                  } catch (nestedError) {
                    // If all parsing attempts fail, keep as raw string
                    currentEvent.data = currentData
                    currentEvent._rawData = currentData
                    currentEvent._isParsed = false
                    currentEvent._isDeepParsed = false
                    currentEvent._parsedFields = []
                  }
                }
              }
            } catch (e) {
              // If it's not valid JSON, keep it as a string
              if (currentData) {
                currentEvent.data = currentData
                currentEvent._rawData = currentData
                currentEvent._isParsed = false
                currentEvent._isDeepParsed = false
                currentEvent._parsedFields = []
              }
            }

            events.push(currentEvent)
            currentEvent = {}
            currentData = ""
          }
          continue
        }

        const colonIndex = line.indexOf(":")
        if (colonIndex === -1) continue

        const field = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()

        if (field === "data") {
          currentData = value
        } else {
          currentEvent[field] = value
        }
      }

      // Handle the last event if there's no trailing newline
      if (Object.keys(currentEvent).length > 0 || currentData) {
        try {
          if (currentData) {
            try {
              // Store the raw data for reference
              currentEvent._rawData = currentData

              // Parse the initial JSON
              const initialParsed = JSON.parse(currentData)

              // Deep parse any nested JSON strings and track which fields were parsed
              const { result: deepParsed, parsedFields } = deepParseJSON(initialParsed)
              currentEvent.data = deepParsed

              // Track parsing status
              currentEvent._isParsed = true

              // Store which fields were parsed as JSON
              currentEvent._parsedFields = parsedFields

              // Track if we have deeply parsed nested JSON
              currentEvent._isDeepParsed = parsedFields.length > 0
            } catch (e) {
              // Try to handle escaped JSON strings
              try {
                const unescaped = currentData.replace(/\\"/g, '"')
                const initialParsed = JSON.parse(unescaped)

                // Deep parse any nested JSON strings and track which fields were parsed
                const { result: deepParsed, parsedFields } = deepParseJSON(initialParsed)
                currentEvent.data = deepParsed

                currentEvent._rawData = currentData
                currentEvent._isParsed = true
                currentEvent._parsedFields = parsedFields
                currentEvent._isDeepParsed = parsedFields.length > 0
              } catch (nestedError) {
                currentEvent.data = currentData
                currentEvent._rawData = currentData
                currentEvent._isParsed = false
                currentEvent._isDeepParsed = false
                currentEvent._parsedFields = []
              }
            }
          }
        } catch (e) {
          if (currentData) {
            currentEvent.data = currentData
            currentEvent._rawData = currentData
            currentEvent._isParsed = false
            currentEvent._isDeepParsed = false
            currentEvent._parsedFields = []
          }
        }
        events.push(currentEvent)
      }

      setParsedEvents(events)
    } catch (err) {
      setError("Failed to parse SSE data. Please check the format.")
      console.error(err)
    }
  }

  const handleFormat = () => {
    parseSSE(input)
  }

  const handleClear = () => {
    setInput("")
    setParsedEvents([])
    setError(null)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(parsedEvents, null, 2))
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(parsedEvents, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sse-events.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setInput(content)
      parseSSE(content)
    }
    reader.readAsText(file)
  }

  const simulateSSEStream = () => {
    if (isSimulating) {
      if (simulationInterval) {
        clearInterval(simulationInterval)
        setSimulationInterval(null)
      }
      setIsSimulating(false)
      return
    }

    setIsSimulating(true)
    let count = 0
    const events = [
      'data: {"message": "Simple JSON event", "count": 1}\n\n',
      'event: update\ndata: {"status": "processing", "progress": 33}\n\n',
      'data: {"nested": {"foo": "bar", "items": [1, 2, 3]}}\n\n',
      'event: complex\ndata: {"data": "{"nested": {"deeply": {"value": true}}}"}\n\n',
      'data: {"config": {"settings": "{"theme": "dark", "notifications": true}"}}\n\n',
      'data: {"results": [{"data": "{"id": 1, "name": "Item 1"}"}, {"data": "{"id": 2, "name": "Item 2"}"}]}\n\n',
      'data: {"mixed": {"normal": "plain text", "json": "{"parsed": true, "count": 42}"}}\n\n',
      'data: {"escaped": "This has \\"quotes\\" inside"}\n\n',
      "data: Not valid JSON but still displayed\n\n",
      'event: complete\ndata: {"status": "done", "progress": 100}\n\n',
    ]

    const interval = setInterval(() => {
      if (count < events.length) {
        setInput((prev) => prev + events[count])
        parseSSE(input + events[count])
        count++
      } else {
        clearInterval(interval)
        setIsSimulating(false)
        setSimulationInterval(null)
      }
    }, 1000)

    setSimulationInterval(interval)
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-center">SSE Stream Formatter</h1>

      <div className="flex flex-col gap-4 flex-grow">
        {/* Input Card */}
        <Collapsible open={!isInputCollapsed} className="w-full">
          <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Input SSE Stream</CardTitle>
                <CardDescription>
                  Paste your SSE stream data or use the simulate button to generate sample data
                </CardDescription>
              </div>
              <CollapsibleTrigger asChild onClick={() => setIsInputCollapsed(!isInputCollapsed)}>
                <Button variant="ghost" size="sm" className="w-9 p-0">
                  {isInputCollapsed ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
                  <span className="sr-only">{isInputCollapsed ? "Expand" : "Collapse"}</span>
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button onClick={simulateSSEStream} variant="outline">
                    {isSimulating ? (
                      <>
                        <PauseIcon className="h-4 w-4 mr-2" /> Stop Simulation
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-4 w-4 mr-2" /> Simulate Stream
                      </>
                    )}
                  </Button>
                  <Button onClick={handleClear} variant="outline">
                    <RefreshCwIcon className="h-4 w-4 mr-2" /> Clear
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      id="file-upload"
                      className="sr-only"
                      onChange={handleFileUpload}
                      accept=".txt,.log,.sse"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <UploadIcon className="h-4 w-4 mr-2" /> Upload
                      </label>
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste SSE stream data here..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </CardContent>
              <CardFooter>
                <Button onClick={handleFormat} className="w-full">
                  Format SSE Data
                </Button>
              </CardFooter>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Output Card */}
        <Card className="w-full flex-grow">
          <CardHeader>
            <CardTitle>Formatted Output</CardTitle>
            <CardDescription>Parsed SSE events will appear here</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow overflow-hidden">
            <Tabs defaultValue="pretty" className="h-full flex flex-col">
              <TabsList className="mb-4">
                <TabsTrigger value="pretty">Pretty</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>

              <TabsContent value="pretty" className="flex-grow overflow-auto">
                {error ? (
                  <div className="text-red-500 p-4 border border-red-300 rounded-md bg-red-50">{error}</div>
                ) : parsedEvents.length > 0 ? (
                  <div className="space-y-4 pb-4">
                    {parsedEvents.map((event, index) => (
                      <div key={index} className="border rounded-md p-4 bg-muted/30">
                        {event.event && (
                          <div className="mb-2">
                            <span className="font-semibold text-sm bg-primary/10 px-2 py-1 rounded">
                              Event: {event.event}
                            </span>
                          </div>
                        )}
                        {event.data && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">
                                {!event._isParsed
                                  ? "Raw Data (parsing failed)"
                                  : event._isDeepParsed
                                    ? "Deeply Parsed JSON"
                                    : "Parsed JSON"}
                              </span>
                            </div>

                            {/* Show parsed fields if any */}
                            {event._parsedFields && event._parsedFields.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1">
                                <span className="text-xs text-muted-foreground mr-1 flex items-center">
                                  <CodeIcon className="h-3 w-3 mr-1" /> Parsed JSON fields:
                                </span>
                                {event._parsedFields.map((field: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs bg-primary/5">
                                    {field}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <pre className="bg-muted p-3 rounded-md overflow-auto text-sm max-h-[500px]">
                              {event._isParsed
                                ? JSON.stringify(event.data, null, 2)
                                : event._rawData || String(event.data)}
                            </pre>
                          </div>
                        )}
                        {Object.entries(event)
                          .filter(
                            ([key]) =>
                              !["data", "event", "_rawData", "_isParsed", "_isDeepParsed", "_parsedFields"].includes(
                                key,
                              ),
                          )
                          .map(([key, value]) => (
                            <div key={key} className="mt-2">
                              <span className="font-semibold">{key}: </span>
                              <span>{String(value)}</span>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    No events to display. Format your SSE data to see results.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="raw" className="flex-grow overflow-auto">
                {error ? (
                  <div className="text-red-500 p-4 border border-red-300 rounded-md bg-red-50">{error}</div>
                ) : parsedEvents.length > 0 ? (
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-sm max-h-[600px]">
                    {JSON.stringify(parsedEvents, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    No events to display. Format your SSE data to see results.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button onClick={handleCopy} variant="outline" disabled={parsedEvents.length === 0}>
              <CopyIcon className="h-4 w-4 mr-2" /> Copy JSON
            </Button>
            <Button onClick={handleDownload} variant="outline" disabled={parsedEvents.length === 0}>
              <DownloadIcon className="h-4 w-4 mr-2" /> Download
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
