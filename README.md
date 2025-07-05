#  YouTube Downloader

This project is a full-stack web application that allows users to fetch YouTube video information and download them in MP4 (with quality selection and combined audio/video) and MP3 formats.

---

#  Descargador de YouTube

Este proyecto es una aplicación web full-stack que permite a los usuarios obtener información de videos de YouTube y descargarlos en formatos MP4 (con selección de calidad y audio/video combinado) y MP3.

##  Main Features

*   Video metadata retrieval (title, thumbnail).
*   MP4 download quality selection (up to 1080p).
*   MP3 audio download.
*   Responsive user interface built with React (Vite).
*   Robust Node.js (Express) API to process download requests.

---

##  Características Principales

*   Obtención de metadatos de videos (título, miniatura).
*   Selección de calidad para descargas MP4 (hasta 1080p).
*   Descarga de audio en formato MP3.
*   Interfaz de usuario responsiva construida con React (Vite).
*   API robusta en Node.js (Express) para procesar las solicitudes de descarga.


## 🚀 Live Deployment

**Note:** This application is primarily designed for local execution.

### **Why it's not fully hosted?:**

The core functionality of this project relies on interacting with YouTube's public API endpoints using `@distube/ytdl-core`. Due to YouTube's strict anti-scraping and bot detection policies, requests originating from cloud environments (like serverless functions on AWS Lambda, which platforms like Netlify, Vercel use) are frequently identified and blocked.

This results in errors such as `"Sign in to confirm you're not a bot"`, preventing reliable fetching of video information and subsequent downloads when deployed on cloud infrastructure without the use of expensive, rotating residential proxy services.

Therefore, for a complete and fully functional demonstration of the project, please follow the local execution instructions below.

---

## 🚀 Despliegue en Vivo

**Nota:** Esta aplicación está diseñada principalmente para ejecución local.

### **¿Por qué no está hosteado?:**

La funcionalidad central de este proyecto se basa en la interacción con los puntos finales de la API pública de YouTube utilizando `@distube/ytdl-core`. Debido a las estrictas políticas anti-scraping y de detección de bots de YouTube, las solicitudes que se originan en entornos de nube (como las funciones serverless en AWS Lambda, utilizadas por plataformas como Netlify, Vercel) son frecuentemente identificadas y bloqueadas.

Esto da como resultado errores como `"Sign in to confirm you're not a bot"`, impidiendo la recuperación fiable de información de video y las descargas posteriores cuando se despliega en infraestructura en la nube sin el uso de servicios de proxy residenciales rotativos y costosos.

Por lo tanto, para una demostración completa y funcional del proyecto, por favor, siguí las instrucciones de ejecución local a continuación.

## 🎥 Video Demonstration

Here's a brief video demonstrating the application in full functionality within a local environment. This showcases the complete features as the cloud deployment faces external limitations.

[**CLICK HERE**](https://drive.google.com/file/d/1rcuH-qlrm5079Y3exV5YCG03RDwP95re/view?usp=drive_link)

---

## 🎥 Demostración en Video

Dejo un breve video que muestra la aplicación en pleno funcionamiento en un entorno local. Esto demuestra las características completas ya que el despliegue en la nube enfrenta limitaciones externas.

[**CLICKEA ACA**](https://drive.google.com/file/d/1rcuH-qlrm5079Y3exV5YCG03RDwP95re/view?usp=drive_link)

##  Local Project Execution

To run this project on your local machine and experience its full functionality:

### **Prerequisites**

Make sure you have the following installed:

*   [Node.js](https://nodejs.org/en/download/) (version 20.x or higher recommended).
    *   You can check your version with `node -v`.
*   [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (usually comes with Node.js).
*   [Git](https://git-scm.com/downloads)

### **Steps to Start**

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/ValentinTarantino/Youtube-Downloader.git
    cd Youtube-Downloader
    ```

2.  **Install Backend (API) Dependencies:**
    The `package.json` in the root directory contains the API dependencies.
    ```bash
    npm install
    ```

3.  **Start the Backend Server (API):**
    Open a **new terminal window** in the project's root directory.
    ```bash
    cd backend
    ```
    ```bash
    npm start
    ```
    *(You should see a message like `[LOCAL API] API Server running on port 3001` in the console. Keep this terminal window open.)*

4.  **Install Frontend (React) Dependencies:**
    In the **first terminal window** (or a new one), navigate to the frontend directory.
    ```bash
    cd youtube-downloader-frontend
    ```
    ```bash
    npm install
    ```

5.  **Start the Frontend Application:**
    ```bash
    npm run dev
    ```
    *(This will open the application in your browser, usually at `http://localhost:5173/`. Keep this terminal window open.)*

Now you can interact with the application in your browser and observe the logs in the terminal window where you started the backend.

---

##  Ejecución Local del Proyecto

Para ejecutar este proyecto en tu máquina local y ver su funcionalidad completa:

### **Prerrequisitos**

Asegúrate de tener instalado:

*   [Node.js](https://nodejs.org/es/download/) (versión 20.x o superior recomendada).
    *   Puedes verificar tu versión con `node -v`.
*   [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) (normalmente viene con Node.js).
*   [Git](https://git-scm.com/downloads)

### **Pasos para Iniciar**

1.  **Clona el Repositorio:**
    ```bash
    git clone https://github.com/ValentinTarantino/Youtube-Downloader.git
    cd Youtube-Downloader
    ```

2.  **Instala las Dependencias del Backend (API):**
    El `package.json` en la raíz contiene las dependencias de la API.
    ```bash
    npm install
    ```

3.  **Inicia el Servidor Backend (API):**
    Abre una **nueva ventana de terminal** en la raíz del proyecto.
    ```bash
    cd backend
    ```
    ```bash
    npm start
    ```
    *(Verás un mensaje como `[LOCAL API] API Server running on port 3001` en la consola. Mantén esta ventana de terminal abierta.)*

4.  **Instala las Dependencias del Frontend (React):**
    En la **primera ventana de terminal** (o una nueva), navega al directorio del frontend.
    ```bash
    cd youtube-downloader-frontend
    ```
    ```bash
    npm install
    ```

5.  **Inicia la Aplicación Frontend:**
    ```bash
    npm run dev
    ```
    *(Esto abrirá la aplicación en tu navegador, generalmente en `http://localhost:5173/`. Mantén esta ventana de terminal abierta.)*

Ahora podes interactuar con la aplicación en tu navegador y observar los logs en la ventana de terminal donde iniciaste el backend.


##  Technologies Used

*   **Frontend:** React, JS, Vite, CSS, Boostrap
*   **Backend:** Node.js, Express, `@distube/ytdl-core`, `fluent-ffmpeg`, `ffmpeg-static`

---

##  Tecnologías Utilizadas

*   **Frontend:** React, JS, Vite, CSS, Boostrap
*   **Backend:** Node.js, Express, `@distube/ytdl-core`, `fluent-ffmpeg`, `ffmpeg-static`