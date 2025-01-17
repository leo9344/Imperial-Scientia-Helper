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
    const fileType = checkbox.dataset.type;
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

async function handleDownload() {
  const selectedFiles = [];
  
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
    chrome.runtime.sendMessage({
      action: "downloadFiles",
      files: selectedFiles
    });
  }
}