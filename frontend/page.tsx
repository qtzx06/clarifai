import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploader } from "@/components/file-uploader"
import { ConceptList } from "@/components/concept-list"
import { CodeImplementation } from "@/components/code-implementation"
import { VideoExplanation } from "@/components/video-explanation"
import { QuestionSection } from "@/components/question-section"
import { BookOpen, Code, FileText, Video } from "lucide-react"

export default function Home() {
  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">PaperPilot</h1>
        <p className="text-muted-foreground text-lg">Your AI-powered research assistant</p>
      </header>

      <div className="grid gap-8">
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6">
            <FileUploader />
          </CardContent>
        </Card>

        <Tabs defaultValue="concepts" className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="concepts" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Key Concepts</span>
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Implementation</span>
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Explanation</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Q&A</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="concepts">
            <Card>
              <CardHeader>
                <CardTitle>Key Concepts</CardTitle>
                <CardDescription>The main concepts and findings extracted from your research paper</CardDescription>
              </CardHeader>
              <CardContent>
                <ConceptList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code">
            <Card>
              <CardHeader>
                <CardTitle>Code Implementation</CardTitle>
                <CardDescription>Generated code implementation of selected concepts</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeImplementation />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="video">
            <Card>
              <CardHeader>
                <CardTitle>Visual Explanation</CardTitle>
                <CardDescription>3Blue1Brown-style animated explanation of key concepts</CardDescription>
              </CardHeader>
              <CardContent>
                <VideoExplanation />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Ask Questions</CardTitle>
                <CardDescription>Ask specific questions about the research paper</CardDescription>
              </CardHeader>
              <CardContent>
                <QuestionSection />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
