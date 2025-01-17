// Import JSZip library
importScripts('lib/jszip.min.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadFiles") {
    sendResponse({ status: 'processing' });
    handleDownloads(request.files);
    return true;
  }
});

async function handleDownloads(files) {
  // Create a new JSZip instance
  const zip = new JSZip();
  
  chrome.runtime.sendMessage({
    action: "updateProgress",
    message: "Starting to prepare files..."
  });

  for (const file of files) {
    try {
      // Check if URL is valid
      if (!file.url) {
        console.error(`Invalid URL for file: ${file.fileName}`);
        chrome.runtime.sendMessage({
          action: "updateProgress",
          message: `Skipped: ${file.fileName} (Invalid URL)`
        });
        continue;
      }

      // Try to fetch the file
      const response = await fetch(file.url, {
        credentials: 'include',
        headers: {
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      let finalFileName = file.fileName;
      const hasExtension = finalFileName.toLowerCase().endsWith(`.${file.urlExtension}`);
      if (!hasExtension && file.urlExtension) {
        finalFileName = `${finalFileName}.${file.urlExtension}`;
      }
      
      const sanitizedSectionTitle = sanitizeFileName(file.sectionTitle);
      const sanitizedFileName = sanitizeFileName(finalFileName);
      const filePath = `${sanitizedSectionTitle}/${sanitizedFileName}`;
      
      zip.file(filePath, blob);
      
      chrome.runtime.sendMessage({
        action: "updateProgress",
        message: `Added: ${finalFileName}`
      });
    } catch (error) {
      console.error(`Failed to process ${file.fileName}:`, error);
      chrome.runtime.sendMessage({
        action: "updateProgress",
        message: `Failed: ${file.fileName} (${error.message})`
      });
    }
  }

  try {
    chrome.runtime.sendMessage({
      action: "updateProgress",
      message: "Generating zip file..."
    });
    
    const content = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 5 }
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `course_materials_${timestamp}.zip`;
    
    // Convert blob to base64 string
    const reader = new FileReader();
    reader.readAsDataURL(content);
    reader.onload = function() {
      const base64data = reader.result;
      
      chrome.runtime.sendMessage({
        action: "processZipDownload",
        data: base64data,
        filename: zipFileName
      });
    };
  } catch (error) {
    console.error('Failed to create zip:', error);
    chrome.runtime.sendMessage({
      action: "downloadError",
      message: "Error creating zip file"
    });
  }
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[<>:"/\\|?*]/g, '-');
}

function waitForDownload(downloadId) {
  return new Promise((resolve, reject) => {
    chrome.downloads.onChanged.addListener(function onChanged({id, state}) {
      if (id === downloadId) {
        if (state?.current === 'complete') {
          chrome.downloads.onChanged.removeListener(onChanged);
          resolve();
        } else if (state?.current === 'interrupted') {
          chrome.downloads.onChanged.removeListener(onChanged);
          reject(new Error('Download interrupted'));
        }
      }
    });
  });
}