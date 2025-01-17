// Create a zip file using the JSZip library (you'll need to include this in your extension)
importScripts('lib\\jszip.min.js');


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadFiles") {
    handleDownloads(request.files);
  }
});

async function handleDownloads(files) {
  const zip = new JSZip();
  
  // Group files by section
  const sections = {};
  files.forEach(file => {
    if (!sections[file.sectionTitle]) {
      sections[file.sectionTitle] = [];
    }
    sections[file.sectionTitle].push(file);
  });
  
  // Download each file and add to zip
  for (const [sectionTitle, sectionFiles] of Object.entries(sections)) {
    const folder = zip.folder(sectionTitle);
    
    for (const file of sectionFiles) {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        folder.file(file.fileName, blob);
        console.log(`Successfully downloaded ${file.fileName}`);
      } catch (error) {
        console.error(`Error downloading ${file.fileName}:`, error);
      }
    }
  }
  
  // Generate and download the zip file
  const zipBlob = await zip.generateAsync({type: 'blob'});
  // Use FileReader to convert Blob to data URL
  const reader = new FileReader();
  reader.onload = function (event) {
    chrome.downloads.download({
      url: event.target.result,
      filename: 'course_materials.zip',
      saveAs: true
    });
  };
  reader.readAsDataURL(zipBlob);
}