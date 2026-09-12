/**
 * FastConvert - Frontend Client Application
 * Pure Vanilla JavaScript (ES6+) - No external libraries
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize File Converter if present on page
  initConverter();

  // Initialize Contact Form if present on page
  initContactForm();
});

/**
 * Main File Converter Controller
 */
function initConverter() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filePreview = document.getElementById('filePreview');
  const previewThumbnail = document.getElementById('previewThumbnail');
  const previewName = document.getElementById('previewName');
  const previewSize = document.getElementById('previewSize');
  const btnRemove = document.getElementById('btnRemove');
  const converterControls = document.getElementById('converterControls');
  const btnConvert = document.getElementById('btnConvert');
  const statusContainer = document.getElementById('statusContainer');
  const spinnerWrapper = document.getElementById('spinnerWrapper');
  const resultBox = document.getElementById('resultBox');
  const resultName = document.getElementById('resultName');
  const btnDownload = document.getElementById('btnDownload');
  const btnReset = document.getElementById('btnReset');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');

  // Guard clause if not on a conversion page
  if (!dropzone || !fileInput) return;

  // State
  let currentFile = null;
  let convertedBlobUrl = null;
  let convertedFileName = '';

  // Max file size in bytes (25MB)
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/gif'
  ];

  // -------------------------------------------------------------
  // Drag & Drop Handlers
  // -------------------------------------------------------------
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelected(droppedFiles[0]);
    }
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    resetConverter();
  });

  btnReset.addEventListener('click', () => {
    resetConverter();
  });

  // -------------------------------------------------------------
  // File Selection and Validation
  // -------------------------------------------------------------
  function handleFileSelected(file) {
    hideError();

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      showError('Please select a valid image file (JPEG, PNG, WEBP, TIFF, or GIF).');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      showError('File is too large. Maximum allowed size is 25MB.');
      return;
    }

    // Page-specific validation for dedicated tools (e.g., JPG-to-PDF or PNG-to-PDF)
    const requiredType = dropzone.getAttribute('data-required-type');
    if (requiredType) {
      if (requiredType === 'jpg' && !['image/jpeg', 'image/jpg'].includes(file.type)) {
        showError('Please upload a JPG / JPEG image for this dedicated tool.');
        return;
      }
      if (requiredType === 'png' && file.type !== 'image/png') {
        showError('Please upload a PNG image for this dedicated tool.');
        return;
      }
    }

    currentFile = file;

    // Update Preview Details
    previewName.textContent = file.name;
    previewSize.textContent = formatBytes(file.size);

    // Generate Thumbnail
    const reader = new FileReader();
    reader.onload = (e) => {
      previewThumbnail.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Transition UI to "File Selected"
    dropzone.classList.add('hidden');
    filePreview.classList.remove('hidden');
    converterControls.classList.remove('hidden');
    statusContainer.classList.add('hidden');
    resultBox.classList.add('hidden');
  }

  // -------------------------------------------------------------
  // Conversion Execution & API Integration
  // -------------------------------------------------------------
  btnConvert.addEventListener('click', async () => {
    if (!currentFile) {
      showError('No file selected. Please select a file first.');
      return;
    }

    hideError();

    // Determine target format
    let targetFormat = 'pdf';
    const selectedRadio = document.querySelector('input[name="targetFormat"]:checked');
    if (selectedRadio) {
      targetFormat = selectedRadio.value;
    }

    // Transition UI to "Uploading / Processing"
    setProcessingState(true);

    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('targetFormat', targetFormat);

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMsg = 'Failed to convert file.';
        try {
          const errData = await response.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (_) {
          const text = await response.text();
          if (text) errorMsg = text;
        }
        throw new Error(errorMsg);
      }

      // Extract filename from Content-Disposition header if available
      const disposition = response.headers.get('Content-Disposition');
      let downloadName = `converted-file.${targetFormat}`;

      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          downloadName = matches[1].replace(/['"]/g, '');
        }
      } else {
        const baseName = currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) || 'converted';
        downloadName = `${baseName}.${targetFormat}`;
      }

      // Receive binary blob
      const blob = await response.blob();

      // Revoke previous blob URL if any
      if (convertedBlobUrl) {
        window.URL.revokeObjectURL(convertedBlobUrl);
      }

      convertedBlobUrl = window.URL.createObjectURL(blob);
      convertedFileName = downloadName;

      // Transition UI to "Done"
      showDoneState(downloadName, blob.size);

    } catch (err) {
      console.error('Conversion error:', err);
      setProcessingState(false);
      showError(err.message || 'An unexpected error occurred while converting your file.');
    }
  });

  // -------------------------------------------------------------
  // Trigger Browser Download
  // -------------------------------------------------------------
  btnDownload.addEventListener('click', () => {
    if (!convertedBlobUrl || !convertedFileName) return;

    const tempLink = document.createElement('a');
    tempLink.href = convertedBlobUrl;
    tempLink.download = convertedFileName;
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
  });

  // -------------------------------------------------------------
  // UI State Helpers
  // -------------------------------------------------------------
  function setProcessingState(isProcessing) {
    if (isProcessing) {
      converterControls.classList.add('hidden');
      statusContainer.classList.remove('hidden');
      spinnerWrapper.classList.remove('hidden');
      resultBox.classList.add('hidden');
    } else {
      spinnerWrapper.classList.add('hidden');
      converterControls.classList.remove('hidden');
    }
  }

  function showDoneState(fileName, fileSize) {
    spinnerWrapper.classList.add('hidden');
    resultBox.classList.remove('hidden');
    resultName.textContent = `${fileName} (${formatBytes(fileSize)})`;

    // Automatically initiate download for seamless user experience
    setTimeout(() => {
      if (btnDownload) {
        btnDownload.click();
      }
    }, 400);
  }

  function resetConverter() {
    currentFile = null;
    fileInput.value = '';
    previewThumbnail.src = '';
    previewName.textContent = '';
    previewSize.textContent = '';

    if (convertedBlobUrl) {
      window.URL.revokeObjectURL(convertedBlobUrl);
      convertedBlobUrl = null;
    }
    convertedFileName = '';

    hideError();
    dropzone.classList.remove('hidden');
    filePreview.classList.add('hidden');
    converterControls.classList.add('hidden');
    statusContainer.classList.add('hidden');
    spinnerWrapper.classList.add('hidden');
    resultBox.classList.add('hidden');
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
    errorMessage.textContent = '';
  }

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

/**
 * Simple Contact Form Handler (for contact.html)
 */
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  const formFeedback = document.getElementById('formFeedback');

  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();
    const submitBtn = contactForm.querySelector('button[type="submit"]');

    if (!name || !email || !message) {
      displayFeedback('Please fill out all required fields.', 'danger');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });

      const data = await response.json();

      if (response.ok) {
        displayFeedback(data.message || 'Thank you! Your message was sent.', 'success');
        contactForm.reset();
      } else {
        displayFeedback(data.error || 'Failed to submit form.', 'danger');
      }
    } catch (err) {
      displayFeedback('Unable to send message right now. Please try again later.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });

  function displayFeedback(msg, type) {
    if (!formFeedback) return;
    formFeedback.textContent = msg;
    formFeedback.className = type === 'success' ? 'callout-box' : 'error-box';
    formFeedback.classList.remove('hidden');
  }
}
