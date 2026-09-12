# FastConvert - Stateless Image & Document Converter

A clean, modern, minimalistic, and privacy-first web application for converting image files into PDF, JPG, PNG, and WEBP formats.

Built strictly with **Vanilla HTML5, CSS3, ES6+ JavaScript**, and **Node.js with Express.js**.

---

## Features

- **Strictly Stateless:** No database is used. Files are processed in a temporary directory and immediately deleted the millisecond the response is served.
- **Pure Web Standards:** Zero frontend frameworks (No React, Vue, Angular, jQuery) and zero CSS frameworks (No Tailwind, Bootstrap, Sass).
- **Multiple Conversion Targets:**
  - Image to PDF (via `pdf-lib` and `sharp` normalization)
  - Image to JPG (with transparent alpha channel flattened to white)
  - Image to PNG (lossless compression)
  - Image to WEBP (modern web compression)
- **Dedicated Route Pages:**
  - `/` (Home): Full multi-format converter, feature list, and how-it-works overview.
  - `/jpg-to-pdf`: Specialized tool page optimized for JPG-to-PDF conversion.
  - `/png-to-pdf`: Specialized tool page optimized for PNG-to-PDF conversion.
  - `/about.html`: Architectural overview and privacy philosophy.
  - `/contact.html`: Clean contact inquiry form.
  - `/privacy.html`: Comprehensive zero-storage privacy policy.
- **Drag-and-Drop Interface:** Interactive upload area with instant client-side thumbnail generation.
- **State Management:** Complete visual state machine: Waiting for File &rarr; File Selected &rarr; Uploading/Processing &rarr; Done (with immediate download).

---

## Directory Structure

```
.
├── .gitignore
├── README.md
├── package.json
├── server.js
├── uploads/
│   └── .gitkeep
└── public/
    ├── index.html
    ├── jpg-to-pdf.html
    ├── png-to-pdf.html
    ├── about.html
    ├── contact.html
    ├── privacy.html
    ├── css/
    │   └── styles.css
    └── js/
        └── script.js
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.x or later recommended)
- `npm` (bundled with Node.js)

### Installation

1. Clone or navigate to the project directory:
   ```bash
   cd GDG
   ```

2. Install the backend dependencies:
   ```bash
   npm install
   ```

3. Start the Express server:
   ```bash
   npm start
   ```
   *(Or for auto-reloading during development: `npm run dev`)*

4. Open your web browser and visit:
   ```
   http://localhost:3000
   ```

---

## Security & Privacy Highlights

1. **MIME Validation:** Server strictly accepts only `image/jpeg`, `image/png`, `image/webp`, `image/tiff`, and `image/gif`. Any unauthorized file format is rejected.
2. **File Size Limits:** Uploads are restricted to 25MB per file to prevent Denial of Service (DoS).
3. **Immediate Unlinking:** Files stored temporarily in `uploads/` are unconditionally cleaned up inside a `finally` block before or directly following response termination.
