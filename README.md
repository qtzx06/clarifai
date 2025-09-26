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
- **multi-clip video stitching**: successfully rendered video clips are automatically stitched together into a final, complete video using ffmpeg.
- **resilient workflow**: the video generation process is fault-tolerant; if a single scene fails to render after multiple attempts, it is skipped, and the final video is created from the successful scenes.
- **real-time logging**: a websocket connection provides a message-by-message stream of the agent's entire process (prompts, ai responses, errors, and render commands) directly to the frontend.
- **ai-powered code implementation**: generate functional python code examples for any extracted concept.
- **responsive ui**: a clean and responsive frontend built with next.js and tailwind css provides a seamless user experience.

## tech stack
- **frontend**: next.js, react, typescript, tailwind css
- **backend**: fastapi, python, uvicorn
- **ai/ml**: google gemini flash, langchain
- **video generation**: manim community v0.18.1
- **video processing**: ffmpeg
- **environment management**: uv for isolated python environments, npm for dependency management.

## prerequisites
before you begin, ensure you have the following dependencies installed on your system.

### 1. general
- **git**: for cloning the repository.
### 2. backend dependencies
- **python 3.12 & 3.13**: the application requires two different python versions. the main backend uses python 3.13, while the video generation agent requires python 3.12.
- **`uv`**: a fast python package installer and resolver. 
  - **installation**: `curl -lssf https://astral.sh/uv/install.sh | sh`
- **`ffmpeg`**:
  - **macos**: `brew install ffmpeg`
  - **linux**: `sudo apt-get update && sudo apt-get install ffmpeg` or `sudo pacman -s ffmpeg`
  - **windows**: `choco install ffmpeg` or `scoop install ffmpeg`
### 3. frontend dependencies
- **node.js**: version 18.x or later.
- **npm**: usually installed with node.js.

## setup and installation
1.  **clone the repository**
    ```bash
    git clone https://github.com/qtzx06/clarifai
    cd clarifai
    ```

2.  **configure environment variables**
    copy the example environment file and add your api key.
    ```bash
    cp .env.example .env
    ```
    now, open the `.env` file and add your google gemini api key:
    ```
    gemini_api_key="your_api_key_here"
    ```

3.  **make scripts executable**
    this step is required for linux and macos users.
    ```bash
    chmod +x start.sh stop.sh
    ```

4.  **run the application**
    a single script handles all dependency installation and server startup.
    ```bash
    ./start.sh
    ```
    this script will:
    - create and populate two separate python virtual environments (`./backend/venv` and `./backend/agent_env`) using `uv`.
    - install all python dependencies using `uv pip`.
    - install all node.js dependencies using `npm`.
    - create the necessary storage directories (`/backend/clips`, `/backend/videos`).
    - start the backend and frontend servers in the background.

    once the script is finished, the application will be running:
    - **frontend**: [http://localhost:3000](http://localhost:3000)
    - **backend api**: [http://localhost:8000/docs](http://localhost:8000/docs)

## usage
1.  open your web browser and navigate to `http://localhost:3000`.
2.  upload a research paper using the file uploader.
3.  wait for the ai analysis to complete. key concepts will appear on the right.
4.  on any concept card, click **"video"** to trigger the agentic video generation process or **"code"** to generate a python implementation.
5.  you can monitor the real-time progress of the video agent in the "video explanation" panel.

## stopping the application
to stop both the frontend and backend servers, run the `stop.sh` script from the project root:
```bash
./stop.sh
```

## project architecture
the application is composed of three main parts:

1.  **frontend**: a next.js application that provides the user interface for uploading papers, viewing concepts, and watching the generated videos.
2.  **backend**: a fastapi server that handles file uploads, orchestrates the analysis and video generation process, and serves the final videos.
3.  **agent**: a standalone python script (`run_agent.py`) that operates in an isolated environment. it communicates with the gemini api to generate manim scripts and then renders them into video clips. said isolation prevents dependency conflicts between manim and the main backend.

the backend and agent communicate via a streaming subprocess pipeline, with logs and results sent back to the backend in real-time and then relayed to the frontend over a websocket connection.