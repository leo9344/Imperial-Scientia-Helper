// Store the sections data globally
let sectionsData = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Request sections data from content script
  chrome.tabs.sendMessage(tab.id, { action: "getSections" }, response => {
    if (response && response.sections) {
      sectionsData = response.sections;
      renderSections(response.sections);
    }
  });
  
  // Set up event listeners
  document.getElementById('fileTypeFilter').addEventListener('change', handleFilter);
  document.getElementById('selectAll').addEventListener('click', () => toggleAllCheckboxes(true));
  document.getElementById('deselectAll').addEventListener('click', () => toggleAllCheckboxes(false));
  document.getElementById('downloadBtn').addEventListener('click', handleDownload);
});

function renderSections(sections) {
  const container = document.getElementById('sections');
  container.innerHTML = '';
  
  sections.forEach((section, sectionIndex) => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'section';
    
    // Create section header
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <input type="checkbox" class="section-checkbox" data-section="${sectionIndex}">
      <span class="section-title">${section.title}</span>
    `;
    
    // Create file list
    const fileList = document.createElement('div');
    fileList.className = 'file-list';
    
    section.items.forEach((item, itemIndex) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <input type="checkbox" class="file-checkbox" 
          data-section="${sectionIndex}" 
          data-item="${itemIndex}"
          data-type="${item.fileType}">
        <span>${item.fileName}</span>
      `;
      fileList.appendChild(fileItem);
    });
    
    sectionDiv.appendChild(header);
    sectionDiv.appendChild(fileList);
    container.appendChild(sectionDiv);
  });
  
  // Set up section checkbox listeners
  document.querySelectorAll('.section-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleSectionCheckbox);
  });
}

function handleFilter() {
  const filterValue = document.getElementById('fileTypeFilter').value;
  
  document.querySelectorAll('.file-checkbox').forEach(checkbox => {
    const fileType = checkbox.dataset.type.toLowerCase();
    const fileItem = checkbox.parentElement;
    
    if (filterValue === 'all' || fileType === filterValue) {
      fileItem.style.display = '';
    } else {
      fileItem.style.display = 'none';
    }
  });
}

function handleSectionCheckbox(event) {
  const sectionIndex = event.target.dataset.section;
  const checked = event.target.checked;
  
  document.querySelectorAll(`.file-checkbox[data-section="${sectionIndex}"]`).forEach(checkbox => {
    checkbox.checked = checked;
  });
}

function toggleAllCheckboxes(checked) {
  document.querySelectorAll('.file-checkbox').forEach(checkbox => {
    if (checkbox.parentElement.style.display !== 'none') {
      checkbox.checked = checked;
    }
  });
}

function updateDownloadStatus(message) {
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.textContent = message;
}

// 在初始化时添加消息监听
chrome.runtime.onMessage.addListener((message) => {
  switch (message.action) {
    case 'updateProgress':
      updateDownloadStatus(message.message);
      break;
    case 'processZipDownload':
      try {
        // 将 base64 转换回 blob
        const base64Response = message.data;
        
        // 从 base64 字符串中提取实际的数据部分
        const byteString = atob(base64Response.split(',')[1]);
        
        // 将字符串转换为 Uint8Array
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        
        // 创建 blob
        const blob = new Blob([arrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        
        chrome.downloads.download({
          url: url,
          filename: message.filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download failed:', chrome.runtime.lastError);
            updateDownloadStatus('Download failed');
          }
          
          // 监听下载完成
          chrome.downloads.onChanged.addListener(function onChanged(delta) {
            if (delta.id === downloadId && delta.state) {
              if (delta.state.current === 'complete') {
                URL.revokeObjectURL(url);
                setTimeout(() => {
                  updateDownloadStatus('Download Selected Files');
                  document.getElementById('downloadBtn').disabled = false;
                }, 2000);
                chrome.downloads.onChanged.removeListener(onChanged);
              } else if (delta.state.current === 'interrupted') {
                console.error('Download interrupted');
                updateDownloadStatus('Download failed');
                URL.revokeObjectURL(url);
                document.getElementById('downloadBtn').disabled = false;
                chrome.downloads.onChanged.removeListener(onChanged);
              }
            }
          });
        });
      } catch (error) {
        console.error('Error processing zip:', error);
        updateDownloadStatus('Error processing zip');
        setTimeout(() => {
          updateDownloadStatus('Download Selected Files');
          document.getElementById('downloadBtn').disabled = false;
        }, 3000);
      }
      break;
    case 'downloadError':
      updateDownloadStatus('Error occurred');
      setTimeout(() => {
        updateDownloadStatus('Download Selected Files');
        document.getElementById('downloadBtn').disabled = false;
      }, 3000);
      break;
  }
});

async function handleDownload() {
  const selectedFiles = [];
  const downloadBtn = document.getElementById('downloadBtn');
  
  document.querySelectorAll('.file-checkbox:checked').forEach(checkbox => {
    const sectionIndex = parseInt(checkbox.dataset.section);
    const itemIndex = parseInt(checkbox.dataset.item);
    const section = sectionsData[sectionIndex];
    const item = section.items[itemIndex];
    
    selectedFiles.push({
      sectionTitle: section.title,
      ...item
    });
  });
  
  if (selectedFiles.length > 0) {
    downloadBtn.disabled = true;
    updateDownloadStatus('Preparing files...');
    
    chrome.runtime.sendMessage({
      action: "downloadFiles",
      files: selectedFiles
    });
  }
}