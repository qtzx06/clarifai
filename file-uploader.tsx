"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, X, CheckCircle } from "lucide-react"

export function FileUploader() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setIsUploading(true)
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setIsUploading(false)
            return 100
          }
          return prev + 10
        })
      }, 200)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setUploadProgress(0)
    setIsUploading(false)
  }

  return (
    <div className="w-full">
      {!uploadedFile ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-slate-400 transition-colors">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Upload Research Paper
              </h3>
              <p className="text-slate-600 mb-4">
                Drag and drop your PDF file here, or click to browse
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileText className="h-4 w-4" />
              <span>Supports PDF files up to 20MB</span>
            </div>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <Button
              onClick={() => document.getElementById('file-upload')?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Choose File
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-slate-800">{uploadedFile.name}</h4>
                <p className="text-sm text-slate-500">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeFile}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isUploading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Processing...</span>
                <span className="text-slate-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Upload complete!</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 