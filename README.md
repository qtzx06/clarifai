# clarifai

deconstruct complex research papers into digestible concepts and automatically generate video explanations in the style of 3blue1brown.

---

## demos

<table>
  <tr>
    <td align="center"><b>workflow</b></td>
    <td align="center"><b>ui</b></td>
  </tr>
  <tr>
    <td>
      <a href="media/demo.mp4">
        <img src="media/demo.gif" alt="main demo gif" height="300">
      </a>
    </td>
    <td>
      <a href="media/landing2.png">
        <img src="media/landing1.png" alt="main application interface" height="300">
      </a>
    </td>
  </tr>
</table>

### example clips generated for specific concepts.

| the weight monodromy conjecture | word embeddings |
| :---: | :---: |
| <a href="media/demo1.mp4"><img src="media/demo1.gif" alt="demo 1"></a> | <a href="media/demo2.mp4"><img src="media/demo2.gif" alt="demo 2"></a> |

| rnns vs cnns | bellman's equations |
| :---: | :---: |
| <a href="media/demo3.mp4"><img src="media/demo3.gif" alt="demo 3"></a> | <a href="media/demo4.mp4"><img src="media/demo4.gif" alt="demo 4"></a> |

---

### extracted paper analysis and the video generation panel.

![a screenshot showing some concepts and the video generation agent panel.](media/landing2.png)

### examples of generated manim animation frames.

<div align="center">
<table>
  <tr>
    <td align="center">
      <img src="media/image1.png" alt="an example of a generated manim animation frame." height="200">
    </td>
    <td align="center">
      <img src="media/image2.png" alt="another example of a generated manim animation frame." height="200">
    </td>
  </tr>
</table>
</div>

---

## features
- **pdf upload & analysis**: upload research papers in pdf format for comprehensive ai-powered analysis.
- **key concept extraction**: automatically identifies and extracts core concepts, methodologies, and insights from the text using google's gemini flash.
- **agentic video generation**: a langchain agent uses manim to generate high-quality, 3blue1brown-style animations for each concept.
- **self-correcting code generation**: the agent makes up to three attempts to generate and render manim code, analyzing the previous error to correct itself.
- **intelligent scene splitting**: an initial ai call intelligently splits a complex concept into multiple thematic scenes to create a more structured and understandable video narrative.
- **parallel clip processing**: video clips are rendered in parallel (batches of 3) for 3-4x faster generation.
- **multi-clip video stitching**: successfully rendered video clips are automatically stitched together into a final, complete video using ffmpeg.
- **vercel blob storage**: videos are automatically uploaded to vercel blob storage for persistent cdn-backed delivery.
- **resilient workflow**: the video generation process is fault-tolerant; if a single scene fails to render after multiple attempts, it is skipped, and the final video is created from the successful scenes.
- **real-time progress tracking**: websocket connection provides live progress updates with stage indicators and fake progress bar during video generation.
- **api security**: rate limiting (slowapi) and api key authentication to prevent abuse.
- **ai-powered code implementation**: generate functional python code examples for any extracted concept.
- **responsive ui**: a clean and responsive frontend built with next.js and tailwind css with webgl shader background.

## tech stack
- **frontend**: next.js 15, react 19, typescript, tailwind css, framer motion, webgl shaders
- **backend**: fastapi, python 3.12, uvicorn, asyncio
- **ai/ml**: google gemini flash 2.0, langchain
- **video generation**: manim community v0.19.0
- **video processing**: ffmpeg
- **storage**: vercel blob (production), local filesystem (development)
- **security**: slowapi (rate limiting), api key authentication, cors
- **deployment**: vercel (frontend), railway (backend), docker

## prerequisites
before you begin, ensure you have the following dependencies installed on your system.

### 1. general
- **git**: for cloning the repository.
### 2. backend dependencies
- **python 3.12**: the application requires python 3.12 for both backend and agent (unified environment).
- **`ffmpeg`**:
  - **macos**: `brew install ffmpeg`
  - **linux**: `sudo apt-get update && sudo apt-get install ffmpeg` or `sudo pacman -s ffmpeg`
  - **windows**: `choco install ffmpeg` or `scoop install ffmpeg`
- **latex**: required for manim text rendering
  - **macos**: `brew install --cask mactex-no-gui`
  - **linux**: `sudo apt-get install texlive texlive-latex-extra texlive-fonts-recommended`
### 3. frontend dependencies
- **node.js**: version 18.x or later.
- **npm**: usually installed with node.js.

## local development setup

1.  **clone the repository**
    ```bash
    git clone https://github.com/yourusername/clarifai
    cd clarifai
    ```

2.  **backend setup**
    ```bash
    cd backend

    # create virtual environment
    python3 -m venv venv
    source venv/bin/activate  # on windows: venv\Scripts\activate

    # install dependencies
    pip install -r requirements.txt
    pip install -r agent_requirements.txt

    # configure environment variables
    cp .env.example .env
    # edit .env and add your keys:
    # GEMINI_API_KEY=your_gemini_api_key
    # API_KEY=your_secret_api_key (optional for dev)
    # ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

    # create storage directories
    mkdir -p storage/uploads storage/videos clips videos

    # start backend server
    uvicorn app.main:app --reload --port 8000
    ```

3.  **frontend setup** (in a new terminal)
    ```bash
    cd frontend

    # install dependencies
    npm install

    # configure environment variables
    cp .env.example .env.local
    # edit .env.local:
    # NEXT_PUBLIC_API_KEY=your_secret_api_key (must match backend)
    # NEXT_PUBLIC_API_URL=http://localhost:8000
    # NEXT_PUBLIC_WS_URL=ws://localhost:8000

    # start development server
    npm run dev
    ```

4.  **access the application**
    - **frontend**: [http://localhost:3000](http://localhost:3000)
    - **backend api**: [http://localhost:8000/docs](http://localhost:8000/docs)

## production deployment

### vercel (frontend)
1. push your code to github
2. import project to vercel
3. set environment variables in vercel dashboard:
   ```
   NEXT_PUBLIC_API_KEY=your_production_api_key
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
   ```
4. deploy

### railway (backend)
1. create new project from github repo
2. set environment variables:
   ```
   API_KEY=your_production_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ALLOWED_ORIGINS=https://your-app.vercel.app
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxx
   ```
3. railway will auto-detect the dockerfile and deploy
4. videos will automatically upload to vercel blob for persistent storage

### vercel blob setup
1. in vercel dashboard, go to storage → blob
2. create a new blob store
3. copy the `BLOB_READ_WRITE_TOKEN`
4. add it to railway environment variables

## usage
1.  open your web browser and navigate to the deployed url or `http://localhost:3000`.
2.  upload a research paper using the drag-and-drop uploader.
3.  wait for the ai analysis to complete. key concepts will appear on the page.
4.  on any concept card, click **"generate video"** to trigger the agentic video generation process.
5.  monitor real-time progress in the video panel with live logs and progress indicators.
6.  once complete, watch or download the generated video.

## api rate limits
- **uploads**: 5 per hour per ip
- **video generation**: 10 per hour per ip
- **general api**: 100 requests per hour per ip

## project architecture
the application is composed of three main parts:

1.  **frontend**: a next.js application that provides the user interface for uploading papers, viewing concepts, and watching the generated videos. features webgl shader background animations and real-time websocket updates.

2.  **backend**: a fastapi server that handles file uploads, orchestrates the analysis and video generation process, and serves the final videos. includes rate limiting, api key authentication, and cors protection.

3.  **agent**: integrated into the backend via async execution. uses langchain and gemini to generate manim scripts, renders them in parallel (batches of 3), and uploads to vercel blob for persistent storage.

the backend and agent communicate via async subprocess pipelines, with logs and results streamed back to the frontend over websocket connections.

## docker deployment
the backend includes a dockerfile for containerized deployment:

```bash
# build
docker build -t clarifai-backend ./backend

# run
docker run -p 8000:8000 \
  -e GEMINI_API_KEY=your_key \
  -e API_KEY=your_api_key \
  -e ALLOWED_ORIGINS=https://your-frontend.vercel.app \
  -e BLOB_READ_WRITE_TOKEN=your_blob_token \
  clarifai-backend
```

## troubleshooting

### videos return 404 in production
- ensure `BLOB_READ_WRITE_TOKEN` is set in railway
- check railway logs for upload errors
- verify vercel blob store is created and accessible

### cors errors
- ensure `ALLOWED_ORIGINS` in railway includes your vercel url
- check that frontend `NEXT_PUBLIC_API_URL` matches railway backend url

### video generation fails
- check that `GEMINI_API_KEY` is valid
- ensure ffmpeg and latex are installed (handled by dockerfile in production)
- verify sufficient memory allocation in railway (recommend 2GB+)

## contributing
contributions are welcome! please feel free to submit a pull request.

## license
mit license - see license file for details.
