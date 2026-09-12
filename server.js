const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure temporary uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Multer Configuration for Secure Temporary File Uploads
// -------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique temporary filename to avoid name collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedExt = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${uniqueSuffix}${sanitizedExt}`);
  }
});

// Strict MIME type validator - allow only valid image formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, TIFF, and GIF images are supported.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max file size
  }
});

// -------------------------------------------------------------
// Middleware
// -------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Page Routing
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/jpg-to-pdf', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'jpg-to-pdf.html'));
});

app.get('/png-to-pdf', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'png-to-pdf.html'));
});

app.get(['/about', '/about.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get(['/contact', '/contact.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get(['/privacy', '/privacy.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// -------------------------------------------------------------
// Helper: Immediate File Cleanup
// -------------------------------------------------------------
const removeTempFile = async (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete temporary file ${filePath}:`, err.message);
    }
  }
};

// -------------------------------------------------------------
// API Endpoint: File Conversion (/api/convert)
// -------------------------------------------------------------
app.post('/api/convert', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).json({ error: 'No file was uploaded.' });
  }

  const targetFormat = (req.body.targetFormat || 'pdf').toLowerCase().trim();
  const validFormats = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

  if (!validFormats.includes(targetFormat)) {
    await removeTempFile(uploadedFile.path);
    return res.status(400).json({
      error: `Invalid target format '${targetFormat}'. Supported formats: PDF, JPG, PNG, WEBP.`
    });
  }

  try {
    const inputBuffer = await fs.promises.readFile(uploadedFile.path);
    let outputBuffer;
    let outputMimeType = '';
    let outputExtension = '';

    if (targetFormat === 'pdf') {
      // -------------------------------------------------------
      // Image -> PDF conversion using pdf-lib and sharp
      // -------------------------------------------------------
      const pdfDoc = await PDFDocument.create();

      // Normalize image to ensure EXIF orientation and RGB compatibility
      const isPng = uploadedFile.mimetype === 'image/png';
      let embeddedImage;

      if (isPng) {
        // Normalize PNG with sharp to avoid unsupported color spaces
        const normalizedPng = await sharp(inputBuffer).rotate().png().toBuffer();
        embeddedImage = await pdfDoc.embedPng(normalizedPng);
      } else {
        // Normalize any other image format (JPG, WEBP, TIFF) into high-quality JPEG
        const normalizedJpg = await sharp(inputBuffer)
          .rotate()
          .jpeg({ quality: 95 })
          .toBuffer();
        embeddedImage = await pdfDoc.embedJpg(normalizedJpg);
      }

      // Add a page matching the dimensions of the image
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height
      });

      const pdfBytes = await pdfDoc.save();
      outputBuffer = Buffer.from(pdfBytes);
      outputMimeType = 'application/pdf';
      outputExtension = 'pdf';

    } else if (targetFormat === 'jpg' || targetFormat === 'jpeg') {
      // -------------------------------------------------------
      // Image -> JPG conversion (flatten alpha to white)
      // -------------------------------------------------------
      outputBuffer = await sharp(inputBuffer)
        .rotate()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 90 })
        .toBuffer();
      outputMimeType = 'image/jpeg';
      outputExtension = 'jpg';

    } else if (targetFormat === 'png') {
      // -------------------------------------------------------
      // Image -> PNG conversion
      // -------------------------------------------------------
      outputBuffer = await sharp(inputBuffer)
        .rotate()
        .png({ compressionLevel: 8 })
        .toBuffer();
      outputMimeType = 'image/png';
      outputExtension = 'png';

    } else if (targetFormat === 'webp') {
      // -------------------------------------------------------
      // Image -> WEBP conversion
      // -------------------------------------------------------
      outputBuffer = await sharp(inputBuffer)
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();
      outputMimeType = 'image/webp';
      outputExtension = 'webp';
    }

    // Build the output filename based on original file name
    const originalBaseName = path.parse(uploadedFile.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadFileName = `${originalBaseName}.${outputExtension}`;

    // Send the converted binary buffer
    res.setHeader('Content-Type', outputMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    res.setHeader('Content-Length', outputBuffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return res.status(200).send(outputBuffer);

  } catch (conversionError) {
    console.error('File conversion failed:', conversionError);
    return res.status(500).json({
      error: 'An error occurred during file conversion. Please verify the file is not corrupted and try again.'
    });

  } finally {
    // STATLESS ASSURANCE: Immediately delete uploaded temporary file
    await removeTempFile(uploadedFile.path);
  }
});

// -------------------------------------------------------------
// API Endpoint: Contact Form Submission (/api/contact)
// -------------------------------------------------------------
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Please provide your name, email, and message.' });
  }

  // Stateless application: In a production setup this might dispatch an email via SendGrid/SES.
  // We log the inquiry safely and return an immediate positive acknowledgement.
  console.log(`[Contact Form Received] From: ${name} (${email}) | Subject: ${subject || 'No Subject'}`);

  return res.status(200).json({
    success: true,
    message: 'Thank you for reaching out! Your message has been received successfully.'
  });
});

// -------------------------------------------------------------
// Multer and Application Error Handling Middleware
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  // If a file was saved before an error occurred, remove it immediately
  if (req.file && req.file.path) {
    removeTempFile(req.file.path);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'The uploaded file exceeds the 25MB maximum limit.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err) {
    return res.status(400).json({ error: err.message || 'An unexpected error occurred.' });
  }

  next();
});

// 404 Fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 FastConvert Server running at http://localhost:${PORT}`);
  console.log(`📁 Stateless temporary upload dir: ${UPLOAD_DIR}`);
  console.log(`===================================================`);
});
