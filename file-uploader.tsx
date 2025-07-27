"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, X } from "lucide-react"

export function FileUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = () => {
    if (!file) return

    setUploading(true)

    // Simulate upload progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploading(false)
          return 100
        }
        return prev + 10
      })
    }, 300)
  }

  const removeFile = () => {
    setFile(null)
    setProgress(0)
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold mb-2">Upload Research Paper</h2>
        <p className="text-muted-foreground">
          Upload a PDF research paper to extract key concepts and generate insights
        </p>
      </div>

      {!file ? (
        <div className="w-full max-w-md">
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="mb-1 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PDF (MAX. 20MB)</p>
            </div>
            <Input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center p-3 bg-muted rounded-lg">
            <FileText className="h-8 w-8 mr-3 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <Button variant="ghost" size="icon" onClick={removeFile} disabled={uploading}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {uploading && <Progress value={progress} className="h-2 w-full" />}

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={uploading} className="w-full sm:w-auto">
              {uploading ? "Uploading..." : "Analyze Paper"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
