## Instructions
How to Test and Play Music-Gem
Since this is a React application using Web Audio and Web MIDI, you run it locally on your computer to test it.
1. Running it Locally
To run this code, you generally need a Node.js environment.
Install Node.js: Download and install it from nodejs.org.
Create Project: If you haven't already, put the files in a folder.
Install Dependencies: Run npm install react react-dom lucide-react tailwindcss (or specific build tools like Vite: npm create vite@latest).
Start: Run npm start (or npm run dev).
Browser: Open Chrome or Edge (Chromium browsers have the best Web MIDI support).
2. How to "Play" the App (Acid Workflow)
Once the app is open in your browser:
Audio Setup: Click the RUN button first. This initializes the audio engine (browsers require a click to start audio).
Create a Pattern:
Click the Big Number Buttons (1-16) to turn steps ON (Yellow).
Change the Note (e.g., C, D#) for active steps.
Octave: Click UP/DN to shift the pitch.
Acid Techniques:
ACC (Accent): Click this on a few steps. Then turn up the red ACCENT knob. You will hear a "wow" filter bite on those specific notes.
SLD (Slide): Turn this on for a step. The pitch will glide into the next note, and the envelope won't re-trigger (Legato).
Tweaking: While the loop plays, twist the Cutoff and Resonance knobs. This is the core of the "Acid" sound.
3. Connecting MIDI (Hardware)
Plug your MIDI interface into your computer.
Refresh the web page.
Select your device from the MIDI Output dropdown in the top right.
The app will now send note data to your synth.
Deployment: Putting it on the Internet
Yes, this app will work perfectly on the internet. Because the logic runs entirely in the user's browser (Client-Side), you do not need a complex backend server.
Option 1: GitHub Pages (Recommended for Code Visibility)
Does it work? Yes.
Pros: Free, integrated directly with your code repository.
How: You usually need a generic "build" step (e.g., npm run build), which creates a dist or build folder. You tell GitHub to host that folder.
HTTPS: GitHub Pages provides HTTPS automatically, which is mandatory for Web MIDI to work.
Option 2: Netlify (Easiest Setup)
Does it work? Yes, fantastic for React apps.
Pros: extremely simple. You can often just connect your GitHub repo, and Netlify detects the settings automatically. It handles "Single Page Application" routing rules better than GitHub Pages out of the box.
Verdict: Probably the easiest "set and forget" option.
Option 3: Cloudflare Pages
Does it work? Yes.
Pros: Very fast, enterprise-grade infrastructure.
Critical Considerations for Deployment
HTTPS is Required: The Web MIDI API (used to talk to your hardware synth) is a powerful feature. Browsers block it on insecure (HTTP) sites. All three options above (GitHub, Netlify, Cloudflare) provide HTTPS by default, so you are safe.
Browser Compatibility: Even when hosted on the web, your users (or you) must use a browser that supports Web MIDI.
Chrome / Edge / Opera: Works perfectly.
Firefox / Safari: May not work natively without complex add-ons or specific flag settings.
Audio Latency: The "tightness" of the timing depends on the user's computer, not the server you host it on. Since we used the AudioContext scheduler in the code, it should be rock solid on any modern device.

---


<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/12Ns0zVId1GxjgJ-eQ6BNg1-2ODExEYQO

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
